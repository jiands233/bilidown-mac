"""Packaging integrity checks: python3 -m unittest discover -s script -p 'test_package_web_windows.py'."""
from pathlib import Path
import tempfile
import unittest
import zipfile

from package_web_windows import digest, extract_member, fetch


class PackageIntegrityTests(unittest.TestCase):
    def test_cached_download_must_match_pinned_checksum(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            payload = cache / 'tool.exe'
            payload.write_bytes(b'correct pinned binary')
            item = {'filename': payload.name, 'sha256': digest(payload)}
            self.assertEqual(fetch(item, cache), payload)
            payload.write_bytes(b'tampered binary')
            with self.assertRaisesRegex(RuntimeError, 'Cached checksum mismatch'):
                fetch(item, cache)

    def test_selected_member_does_not_extract_traversal_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / 'vendor.zip'
            with zipfile.ZipFile(archive, 'w') as output:
                output.writestr('package/bin/ffmpeg.exe', b'MZ executable')
                output.writestr('../unwanted.txt', b'do not extract')
            destination = root / 'runtime' / 'ffmpeg.exe'
            extract_member(archive, '/bin/ffmpeg.exe', destination)
            self.assertEqual(destination.read_bytes(), b'MZ executable')
            self.assertEqual(sorted(p.name for p in root.iterdir()), ['runtime', 'vendor.zip'])

    def test_ambiguous_archive_member_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / 'vendor.zip'
            with zipfile.ZipFile(archive, 'w') as output:
                output.writestr('first/node.exe', b'one')
                output.writestr('second/node.exe', b'two')
            with self.assertRaisesRegex(RuntimeError, 'Expected one'):
                extract_member(archive, '/node.exe', root / 'node.exe')
            self.assertFalse((root / 'node.exe').exists())


if __name__ == '__main__':
    unittest.main()
