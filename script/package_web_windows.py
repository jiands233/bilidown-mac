#!/usr/bin/env python3
"""Build the Windows x64 portable ZIP using only Python's standard library."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'script/windows-web-dependencies.json'
APP = 'BilidownWeb-Windows-x64'


def digest(path):
    checksum = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(block)
    return checksum.hexdigest()


def fetch(item, cache):
    target = cache / item['filename']
    if target.exists():
        if digest(target) != item['sha256']:
            raise RuntimeError(f"Cached checksum mismatch: {target}; remove this file and retry")
        print(f"Verified cache: {target.name}", flush=True)
        return target
    print(f"Downloading {item['name']} {item['version']}...", flush=True)
    temporary = target.with_suffix(target.suffix + '.partial')
    try:
        request = urllib.request.Request(item['url'], headers={'User-Agent': 'BilidownWeb-packager/1'})
        with urllib.request.urlopen(request, timeout=120) as response, temporary.open('wb') as output:
            shutil.copyfileobj(response, output)
        if digest(temporary) != item['sha256']:
            raise RuntimeError(f"Downloaded checksum mismatch: {item['url']}")
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    return target


def extract_member(archive, suffix, destination):
    """Copy only a selected member, never extract arbitrary archive paths."""
    with zipfile.ZipFile(archive) as source:
        names = [n for n in source.namelist() if n.endswith(suffix)]
        if len(names) != 1:
            raise RuntimeError(f'Expected one {suffix} in {archive.name}, found {len(names)}')
        destination.parent.mkdir(parents=True, exist_ok=True)
        with source.open(names[0]) as stream, destination.open('wb') as output:
            shutil.copyfileobj(stream, output)


def copy_web(stage):
    web = ROOT / 'web-bilidown'
    for source in sorted(web.glob('*.js')):
        if not source.name.endswith('.test.js'):
            destination = stage / 'web-bilidown' / source.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
    for source in sorted((web / 'public').rglob('*')):
        if source.is_file() and source.suffix.lower() in {'.html', '.js', '.css', '.png', '.svg', '.ico', '.woff', '.woff2'}:
            destination = stage / source.relative_to(ROOT)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
    (stage / 'Assets').mkdir()
    shutil.copy2(ROOT / 'Assets/AppIcon.png', stage / 'Assets/AppIcon.png')


def build(files, manifest, output):
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='bilidown-windows-', dir=output) as scratch:
        stage = Path(scratch) / APP
        stage.mkdir()
        copy_web(stage)
        runtime = stage / 'runtime/win32-x64'
        vendor = stage / 'vendor/win32-x64'
        licenses = stage / 'licenses'
        vendor.mkdir(parents=True)
        licenses.mkdir()
        extract_member(files['node'], '/node.exe', runtime / 'node.exe')
        extract_member(files['node'], files['node'].stem + '/LICENSE', licenses / 'Node.js-LICENSE.txt')
        shutil.copy2(files['yt-dlp'], vendor / 'yt-dlp.exe')
        for executable in ['ffmpeg', 'ffprobe']:
            extract_member(files['ffmpeg'], f'/bin/{executable}.exe', vendor / f'{executable}.exe')
        extract_member(files['ffmpeg'], '/LICENSE', licenses / 'FFmpeg-LICENSE.txt')
        extract_member(files['ffmpeg'], '/README.txt', licenses / 'FFmpeg-readme.txt')
        for name in ['LICENSE', 'THIRD_PARTY_LICENSES.txt']:
            shutil.copy2(files['yt-dlp-' + name], licenses / ('yt-dlp-' + name))
        shutil.copy2(ROOT / 'docs/windows-web.md', stage / '使用说明.md')
        launcher = (ROOT / 'script/启动 Bilidown Web.cmd').read_text(encoding='utf-8')
        (stage / '启动 Bilidown Web.cmd').write_bytes(launcher.replace('\r\n', '\n').replace('\n', '\r\n').encode('utf-8'))
        (licenses / 'sources.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
        hashes = {str(p.relative_to(stage)).replace('\\', '/'): digest(p) for p in sorted(stage.rglob('*')) if p.is_file()}
        (stage / 'SHA256SUMS.txt').write_text(''.join(f'{value}  {name}\n' for name, value in hashes.items()), encoding='utf-8')
        archive_path = output / (APP + '.zip')
        temporary_zip = Path(scratch) / (APP + '.zip')
        with zipfile.ZipFile(temporary_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for source in sorted(stage.rglob('*')):
                if source.is_file():
                    archive.write(source, str(source.relative_to(stage.parent)))
        verify_zip(temporary_zip)
        temporary_zip.replace(archive_path)
        print(f'Created: {archive_path}\nSHA256: {digest(archive_path)}', flush=True)


def verify_zip(path):
    with zipfile.ZipFile(path) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError(f'ZIP CRC failure: {bad}')
        prefix = APP + '/'
        required = ['web-bilidown/server.js', 'web-bilidown/public/index.html', 'runtime/win32-x64/node.exe', 'vendor/win32-x64/yt-dlp.exe', 'vendor/win32-x64/ffmpeg.exe', 'vendor/win32-x64/ffprobe.exe', '启动 Bilidown Web.cmd', '使用说明.md', 'licenses/sources.json']
        for name in required:
            if prefix + name not in archive.namelist():
                raise RuntimeError(f'Missing package entry: {name}')
        for line in archive.read(prefix + 'SHA256SUMS.txt').decode('utf-8').splitlines():
            expected, name = line.split('  ', 1)
            actual = hashlib.sha256(archive.read(prefix + name)).hexdigest()
            if actual != expected:
                raise RuntimeError(f'Package checksum mismatch: {name}')
        for name in required:
            if name.endswith('.exe') and archive.read(prefix + name)[:2] != b'MZ':
                raise RuntimeError(f'Not a Windows executable: {name}')
    print('Verified ZIP structure, CRC, packaged file hashes and Windows executable headers.', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download-only', action='store_true', help='Cache and verify pinned dependencies without building')
    parser.add_argument('--verify', type=Path, help='Verify an existing package and exit')
    parser.add_argument('--cache-dir', type=Path, default=ROOT / '.cache/windows-web')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    if args.verify:
        verify_zip(args.verify)
        return
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        pending = {item['name']: pool.submit(fetch, item, args.cache_dir) for item in manifest['dependencies']}
        files = {name: future.result() for name, future in pending.items()}
    if not args.download_only:
        build(files, manifest, args.output_dir)


if __name__ == '__main__':
    main()
