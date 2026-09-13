const fs = require('node:fs');
const path = require('node:path');
const { runProcess } = require('./process');

const formats = {
  best: 'bestvideo*[vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo*+bestaudio/best',
  '1080p': 'bestvideo*[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo*[height<=1080]+bestaudio/best[height<=1080]',
  '720p': 'bestvideo*[height<=720][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo*[height<=720]+bestaudio/best[height<=720]',
  audio: 'bestaudio[acodec^=mp4a]/bestaudio/best',
};

function buildDownloadArgs(options, vendorDir) {
  const { url, output, quality, playlist, cookieMode, cookieFile } = options;
  const args = [
    '--ignore-config', '--encoding', 'utf-8', '--ffmpeg-location', vendorDir,
    '--paths', output, '--output', '%(title).180B [%(id)s].%(ext)s',
    '--newline', '--windows-filenames', '--trim-filenames', '180',
    '--format', formats[quality], '--add-header', 'Referer:https://www.bilibili.com/',
    '--print', 'after_move:filepath', playlist === 'all' ? '--yes-playlist' : '--no-playlist',
  ];
  if (quality === 'audio') args.push('--extract-audio', '--audio-format', 'm4a');
  else args.push('--merge-output-format', 'mp4', '--remux-video', 'mp4');
  if (cookieMode === 'chrome') args.push('--cookies-from-browser', 'chrome');
  if (cookieMode === 'file') args.push('--cookies', cookieFile);
  args.push('--', url);
  return args;
}

function parseDownloadedFiles(stdout) {
  return stdout.split(/\r?\n/).map(line => line.trim()).filter(line =>
    path.win32.isAbsolute(line) && /\.(mp4|m4a|mov|mkv|webm)$/i.test(line));
}

function createWindowsBackend({ rootDir, spawnImpl, io = fs.promises } = {}) {
  const vendorDir = path.join(rootDir, 'vendor', 'win32-x64');
  const tool = name => path.join(vendorDir, `${name}.exe`);
  const run = (command, args, options = {}) => runProcess(command, args, { spawnImpl, cwd: rootDir, ...options });

  async function doctor() {
    const stdout = [], stderr = [];
    for (const name of ['yt-dlp', 'ffmpeg', 'ffprobe']) {
      const result = await run(tool(name), [name === 'yt-dlp' ? '--version' : '-version'], { timeout: 15000 });
      if (result.exitCode !== 0) stderr.push(`${name} 依赖不可用：${result.stderr || result.stdout}`);
      else stdout.push(`${name}: ${(result.stdout || result.stderr).split(/\r?\n/)[0]}`);
    }
    return { exitCode: stderr.length ? 10 : 0, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
  }

  function classify(result, cookieMode) {
    if (result.exitCode === 10 || /ff(?:mpeg|probe).*(?:not found|not installed|not available)/i.test(result.stderr)) {
      return { ...result, exitCode: 10, stderr: `下载依赖不可用，请重新解压完整安装包。\n${result.stderr}` };
    }
    // yt-dlp may skip undecryptable cookies and still exit successfully.
    const cookieFailure = /(?:failed|cannot|could not|unable) to decrypt|cannot decrypt|DPAPI|(?:failed|unable) to (?:read|load|extract) cookies|could not (?:find|copy).*cookies? (?:database|file)|does not look like a Netscape|invalid Netscape|failed to load cookies|failed to decrypt|extracted 0 cookies/i;
    if (cookieMode !== 'none' && (cookieFailure.test(result.stderr) || /^Extracted 0 cookies from /im.test(result.stdout))) {
      return { ...result, exitCode: 20, stderr: `${result.stderr}\nCookie 读取失败。可切换为本机 Netscape cookies.txt 文件；不会自动改为无登录下载。` };
    }
    if (result.exitCode === 0) return result;
    if (/permission denied|access is denied|errno 13|winerror 5/i.test(result.stderr)) {
      return { ...result, exitCode: 30, stderr: `保存目录或文件不可写，请更换目录。\n${result.stderr}` };
    }
    return { ...result, exitCode: 30 };
  }

  async function download(options) {
    if (options.cookieMode === 'file') {
      try {
        const stat = await io.stat(options.cookieFile);
        if (!stat.isFile()) throw new Error('not a file');
        const content = await io.readFile(options.cookieFile, 'utf8');
        if (!/^# (?:Netscape )?HTTP Cookie File/.test(content.replace(/^\uFEFF/, ''))) throw new Error('invalid format');
      } catch {
        return { exitCode: 20, stdout: '', stderr: '无法读取 Cookie 文件，或文件不是 Netscape cookies.txt 格式。请选择有效的本机文件。' };
      }
    }
    if (options.cookieMode === 'chrome') {
      const preflight = classify(await run(tool('yt-dlp'), [
        '--ignore-config', '--encoding', 'utf-8', '--cookies-from-browser', 'chrome',
        '--skip-download', '--simulate', '--no-playlist', '--print', 'title', '--', options.url,
      ]), options.cookieMode);
      if (preflight.exitCode !== 0) return preflight;
    }
    try {
      await io.mkdir(options.output, { recursive: true });
      await io.access(options.output, fs.constants.W_OK);
    } catch {
      return { exitCode: 30, stdout: '', stderr: `保存目录不可写或无法创建：${options.output}` };
    }
    return classify(await run(tool('yt-dlp'), buildDownloadArgs(options, vendorDir)), options.cookieMode);
  }

  async function choose(kind) {
    // No user-controlled text is interpolated into PowerShell code.
    const script = [
      "$ErrorActionPreference = 'Stop'",
      '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)',
      'Add-Type -AssemblyName System.Windows.Forms',
      '[System.Windows.Forms.Application]::EnableVisualStyles()',
      kind === 'folder'
        ? "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = '选择视频保存文件夹'"
        : "$dialog = New-Object System.Windows.Forms.OpenFileDialog; $dialog.Title = '选择 Netscape cookies.txt'; $dialog.Filter = 'Cookie 文件 (*.txt)|*.txt|所有文件 (*.*)|*.*'",
      'try {',
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
      kind === 'folder' ? '[Console]::WriteLine($dialog.SelectedPath)' : '[Console]::WriteLine($dialog.FileName)',
      '}',
      '} finally { $dialog.Dispose() }',
    ].join('\n');
    const powershell = path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const result = await run(powershell, ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]);
    if (result.exitCode !== 0) return { ok: false, output: `无法打开选择窗口，可手动输入路径。\n${result.stderr}` };
    const selected = result.stdout.trim();
    return selected ? { ok: true, path: selected, output: '' } : { ok: false, cancelled: true, output: '已取消选择。' };
  }
  return { doctor, download, chooseFolder: () => choose('folder'), chooseCookieFile: () => choose('file') };
}
module.exports = { createWindowsBackend, buildDownloadArgs, parseDownloadedFiles };
