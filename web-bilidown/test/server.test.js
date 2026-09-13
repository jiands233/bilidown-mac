const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createServer, startServer } = require('../server');
const { createWindowsBackend } = require('../windows');

async function fixture(t, { platform = 'win32', arch = 'x64', spawnImpl, backend, home = 'C:\\用户\\小明' } = {}) {
  const server = createServer({ platform, arch, home, spawnImpl, windowsBackend: backend });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    get: async route => (await fetch(`${origin}${route}`)).json(),
    post: async (route, body = {}) => {
      const response = await fetch(`${origin}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, data: await response.json() };
    },
  };
}
function recordingSpawn(result = {}) {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
    process.nextTick(() => {
      child.stdout.end(result.stdout || ''); child.stderr.end(result.stderr || '');
      child.emit('close', result.code || 0);
    });
    return child;
  };
  return { calls, spawn };
}
const payload = { url: 'https://www.bilibili.com/video/BV123?p=2&x=a', quality: '1080p', output: 'C:\\视频 & 素材', playlist: 'all' };

test('config exposes Windows defaults and UI page remains available', async t => {
  const api = await fixture(t);
  const config = await api.get('/api/config');
  assert.equal(config.platform, 'win32');
  assert.equal(config.defaultOutput, 'C:\\用户\\小明\\Downloads\\Bilidown');
  assert.equal(config.defaultCookieMode, 'none');
  assert.deepEqual(config.cookieModes, ['none', 'chrome', 'file']);
  assert.equal((await fetch(api.origin)).status, 200);
});
test('HTTP Windows download reaches executable with literal arguments and reports saved path', async t => {
  const fake = recordingSpawn({ stdout: 'C:\\视频 & 素材\\成片.mp4\r\n' });
  const backend = createWindowsBackend({ rootDir: '/portable', spawnImpl: fake.spawn, io: { mkdir: async () => {}, access: async () => {} } });
  const api = await fixture(t, { backend });
  const { status, data } = await api.post('/api/download', payload);
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.deepEqual(data.files, ['C:\\视频 & 素材\\成片.mp4']);
  assert.equal(fake.calls[0].args.at(-1), payload.url);
  assert.ok(fake.calls[0].args.includes(payload.output));
  assert.ok(!fake.calls[0].args.includes('--cookies-from-browser'));
  assert.equal(fake.calls[0].options.shell, false);
});
test('legacy useCookies and explicit cookieMode precedence', async t => {
  const received = [];
  const api = await fixture(t, { backend: { download: async options => { received.push(options); return { exitCode: 0, stdout: '', stderr: '' }; } } });
  for (const extra of [{ useCookies: true }, { useCookies: false }, { useCookies: true, cookieMode: 'none' }]) {
    assert.equal((await api.post('/api/download', { ...payload, ...extra })).status, 200);
  }
  assert.deepEqual(received.map(x => x.cookieMode), ['chrome', 'none', 'none']);
});
test('invalid inputs never reach downloader', async t => {
  const api = await fixture(t, { backend: { download: () => { assert.fail('must not download'); } } });
  for (const extra of [
    { url: 'https://bilibili.com.evil.example/' }, { quality: '4k' }, { cookieMode: 'other' },
    { cookieMode: 'file', cookieFile: '' }, { output: 'C:relative' }, { output: 'C:\\a\u0000b' },
  ]) assert.equal((await api.post('/api/download', { ...payload, ...extra })).status, 400);
});
test('blank output uses home Downloads and tilde supports Windows slash', async t => {
  const received = [];
  const api = await fixture(t, { backend: { download: async options => { received.push(options); return { exitCode: 0, stdout: '', stderr: '' }; } } });
  await api.post('/api/download', { ...payload, output: '' });
  await api.post('/api/download', { ...payload, output: '~\\下载' });
  assert.deepEqual(received.map(x => x.output), ['C:\\用户\\小明\\Downloads\\Bilidown', 'C:\\用户\\小明\\下载']);
});
test('cancelled Windows pickers and doctor errors retain response contracts', async t => {
  const cancelled = { ok: false, cancelled: true, output: '已取消选择。' };
  const api = await fixture(t, { backend: { chooseFolder: async () => cancelled, chooseCookieFile: async () => cancelled, doctor: async () => ({ exitCode: 10, stdout: '', stderr: 'ffmpeg 依赖缺失' }) } });
  assert.deepEqual((await api.post('/api/choose-folder')).data, cancelled);
  assert.deepEqual((await api.post('/api/choose-cookie-file')).data, cancelled);
  assert.equal((await api.get('/api/doctor')).exitCode, 10);
});
test('Mac keeps CLI arguments, default Chrome cookies, and native folder picker', async t => {
  const fake = recordingSpawn({ stdout: '/Users/me/Downloads/Bilidown/a.mp4\n' });
  const api = await fixture(t, { platform: 'darwin', home: '/Users/me', spawnImpl: fake.spawn });
  const config = await api.get('/api/config');
  assert.equal(config.defaultCookieMode, 'chrome');
  assert.deepEqual(config.cookieModes, ['none', 'chrome']);
  const result = await api.post('/api/download', { ...payload, output: '~/Downloads/Bilidown', useCookies: false });
  assert.equal(result.data.ok, true);
  assert.deepEqual(fake.calls[0].args, ['download', payload.url, '--quality', '1080p', '--playlist', 'all', '--output', '/Users/me/Downloads/Bilidown', '--no-cookies']);
  assert.match(fake.calls[0].command, /mac-bilidown\/bin\/bilidown$/);
  await api.get('/api/doctor');
  assert.deepEqual(fake.calls[1].args, ['doctor', '--skip-cookie-check']);
  await api.post('/api/choose-folder');
  assert.equal(fake.calls[2].command, 'osascript');
});
test('unsupported platform fails clearly', async t => {
  const api = await fixture(t, { platform: 'linux' });
  assert.equal((await api.post('/api/download', payload)).data.exitCode, 10);
});
test('malformed JSON and foreign origins cannot initiate a download', async t => {
  const api = await fixture(t);
  const malformed = await fetch(`${api.origin}/api/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  const foreign = await fetch(`${api.origin}/api/choose-folder`, { method: 'POST', headers: { Origin: 'https://example.com' } });
  assert.equal(foreign.status, 403);
});
test('browser opens only after successful listen, never on port conflict', async t => {
  const fake = recordingSpawn();
  const server = createServer();
  await startServer({ server, port: 0, open: true, platform: 'win32', spawnImpl: fake.spawn });
  t.after(() => new Promise(resolve => server.close(resolve)));
  assert.equal(fake.calls.length, 1);
  const encoded = fake.calls[0].args.at(-1);
  assert.ok(Buffer.from(encoded, 'base64').toString('utf16le').includes(`http://127.0.0.1:${server.address().port}`));
  const second = createServer();
  await assert.rejects(startServer({ server: second, port: server.address().port, open: true, platform: 'win32', spawnImpl: fake.spawn }), { code: 'EADDRINUSE' });
  assert.equal(fake.calls.length, 1);
});
