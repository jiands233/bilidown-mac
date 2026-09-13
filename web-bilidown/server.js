#!/usr/bin/env node
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { runProcess } = require('./process');
const { createWindowsBackend, parseDownloadedFiles: parseWindowsFiles } = require('./windows');

function sendJSON(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}
function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '', bytes = 0;
    request.setEncoding('utf8');
    request.on('data', chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 1024 * 1024) { reject(new Error('请求内容过大。')); return; }
      body += chunk;
    });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('请求必须是有效 JSON。')); }
    });
    request.on('error', reject);
  });
}
function isBilibiliURL(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password
      && (host === 'b23.tv' || host === 'bilibili.com' || host.endsWith('.bilibili.com'));
  } catch { return false; }
}

function createServer({
  rootDir = path.resolve(__dirname, '..'), platform = process.platform, arch = process.arch,
  home = os.homedir(), spawnImpl = spawn, windowsBackend,
} = {}) {
  const isWindows = platform === 'win32';
  const supported = platform === 'darwin' || (isWindows && arch === 'x64');
  const paths = isWindows ? path.win32 : path.posix;
  const defaultOutput = paths.join(home, 'Downloads', 'Bilidown');
  const cookieModes = isWindows ? ['none', 'chrome', 'file'] : ['none', 'chrome'];
  const defaultCookieMode = isWindows ? 'none' : 'chrome';
  const windows = windowsBackend || createWindowsBackend({ rootDir, spawnImpl });
  const run = (command, args) => runProcess(command, args, {
    spawnImpl, cwd: rootDir,
    env: { ...process.env, BILIDOWN_COOKIE_TIMEOUT: process.env.BILIDOWN_COOKIE_TIMEOUT || '20' },
  });
  const runCLI = args => run(path.join(rootDir, 'mac-bilidown', 'bin', 'bilidown'), args);

  function expandHome(value) {
    if (value === '~') return home;
    if (/^~[\\/]/.test(value)) return paths.join(home, value.slice(2));
    return value;
  }
  async function chooseFolder() {
    if (isWindows) return windows.chooseFolder();
    const result = await run('osascript', ['-e', 'set pickedFolder to choose folder with prompt "选择 Bilidown 视频保存位置"\nPOSIX path of pickedFolder']);
    const selected = result.stdout.trim();
    if (result.exitCode === 0 && selected) return { ok: true, path: selected === '/' ? '/' : selected.replace(/\/$/, ''), output: '' };
    return { ok: false, output: result.stderr || '已取消选择文件夹。' };
  }
  async function handleAPI(request, response, route) {
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
      sendJSON(response, 403, { ok: false, output: '仅允许本机页面调用。' }); return;
    }
    if (route === '/api/config' && request.method === 'GET') {
      sendJSON(response, 200, { platform, supported, defaultOutput, cookieModes, defaultCookieMode }); return;
    }
    if (!supported) {
      sendJSON(response, 500, { ok: false, exitCode: 10, output: '仅支持 macOS 和 Windows x64。' }); return;
    }
    if ((route === '/api/choose-folder' || route === '/api/choose-cookie-file') && request.method === 'POST') {
      if (route === '/api/choose-cookie-file' && !isWindows) {
        sendJSON(response, 400, { ok: false, output: '当前平台不支持 Cookie 文件选择。' }); return;
      }
      const result = route === '/api/choose-folder' ? await chooseFolder() : await windows.chooseCookieFile();
      sendJSON(response, result.ok || result.cancelled ? 200 : 400, result); return;
    }
    if (route === '/api/doctor' && request.method === 'GET') {
      const result = isWindows ? await windows.doctor() : await runCLI(['doctor', '--skip-cookie-check']);
      sendJSON(response, result.exitCode === 0 ? 200 : 500, {
        ok: result.exitCode === 0, exitCode: result.exitCode,
        output: [result.stdout, result.stderr].filter(Boolean).join('\n'),
      }); return;
    }
    if (route === '/api/download' && request.method === 'POST') {
      let body;
      try {
        body = await readBody(request);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('请求必须是 JSON 对象。');
      } catch (error) {
        sendJSON(response, 400, { ok: false, exitCode: 2, output: error.message }); return;
      }
      const url = String(body.url || '').trim();
      const quality = String(body.quality || 'best');
      const playlist = body.playlist === 'all' ? 'all' : 'current';
      const output = expandHome(String(body.output || '').trim() || defaultOutput);
      const cookieMode = body.cookieMode ?? (body.useCookies === undefined ? defaultCookieMode : body.useCookies === false ? 'none' : 'chrome');
      const cookieFile = expandHome(String(body.cookieFile || '').trim());
      let error;
      if (!isBilibiliURL(url)) error = '请输入有效的 bilibili.com 或 b23.tv 链接。';
      else if (!['best', '1080p', '720p', 'audio'].includes(quality)) error = '清晰度只能是 best、1080p、720p 或 audio。';
      else if (!cookieModes.includes(cookieMode)) error = '不支持此 Cookie 模式。';
      else if (output.includes('\0') || (isWindows && !/^(?:[a-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/i.test(output))) error = '请输入完整的保存目录路径，例如 C:\\Users\\你的用户名\\Downloads。';
      else if (cookieMode === 'file' && (!cookieFile || cookieFile.includes('\0') || !/^(?:[a-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/i.test(cookieFile))) error = '请选择或输入 cookies.txt 的完整本机路径。';
      if (error) { sendJSON(response, 400, { ok: false, exitCode: 2, output: error }); return; }
      let result;
      if (isWindows) result = await windows.download({ url, quality, playlist, output, cookieMode, cookieFile });
      else {
        const args = ['download', url, '--quality', quality, '--playlist', playlist, '--output', output];
        if (cookieMode === 'none') args.push('--no-cookies');
        result = await runCLI(args);
      }
      const files = isWindows ? parseWindowsFiles(result.stdout) : result.stdout.split(/\r?\n/).map(x => x.trim()).filter(x => path.posix.isAbsolute(x) && /\.(mp4|m4a|mov|mkv|webm)$/i.test(x));
      sendJSON(response, result.exitCode === 0 ? 200 : 500, {
        ok: result.exitCode === 0, exitCode: result.exitCode, files,
        output: [result.stdout, result.stderr].filter(Boolean).join('\n'),
      }); return;
    }
    sendJSON(response, 404, { ok: false, output: 'Unknown API route.' });
  }
  const publicDir = path.join(rootDir, 'web-bilidown', 'public');
  const mimeTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
  return http.createServer((request, response) => {
    let route;
    try { route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { sendJSON(response, 400, { ok: false, output: '无效路径。' }); return; }
    if (route.startsWith('/api/')) {
      handleAPI(request, response, route).catch(error => {
        sendJSON(response, 500, { ok: false, exitCode: 30, output: error.message });
      }); return;
    }
    const filePath = route === '/assets/app-icon.png' ? path.join(rootDir, 'Assets', 'AppIcon.png') : path.resolve(publicDir, `.${route === '/' ? '/index.html' : route}`);
    if (route !== '/assets/app-icon.png' && !filePath.startsWith(`${publicDir}${path.sep}`)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    fs.readFile(filePath, (error, content) => {
      if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500); response.end('File unavailable'); return; }
      response.writeHead(200, { 'content-type': mimeTypes[path.extname(filePath)] || 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(content);
    });
  });
}

function startServer({ server = createServer(), port = Number(process.env.PORT || 4789), open = false, platform = process.platform, spawnImpl = spawn } = {}) {
  return new Promise((resolve, reject) => {
    if (!Number.isInteger(port) || port < 0 || port > 65535) { reject(new Error('PORT 必须是 1–65535 的端口号。')); return; }
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const url = `http://127.0.0.1:${server.address().port}`;
      console.log(`Bilidown Web is running at ${url}`);
      if (open) {
        let command, args;
        if (platform === 'win32') {
          command = path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
          args = ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(`Start-Process '${url}'`, 'utf16le').toString('base64')];
        } else { command = 'open'; args = [url]; }
        runProcess(command, args, { spawnImpl, timeout: 15000 }).then(result => {
          if (result.exitCode !== 0) console.error(`无法自动打开浏览器，请手动访问 ${url}`);
        });
      }
      resolve(server);
    });
  });
}
if (require.main === module) {
  startServer({ open: process.argv.includes('--open') }).catch(error => {
    console.error(error.code === 'EADDRINUSE' ? '端口已被占用。请关闭已运行的服务，或设置 PORT 使用其他端口。' : `启动失败：${error.message}`);
    process.exitCode = 1;
  });
}
module.exports = { createServer, startServer };
