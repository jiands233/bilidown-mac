const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createWindowsBackend, buildDownloadArgs, parseDownloadedFiles } = require('../windows');

const video = 'https://www.bilibili.com/video/BV1xx?p=2&hello=%22';
const output = 'C:\\用户\\我的视频 & (素材)';
function fakeSpawn(results = []) {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => {};
    const result = results.shift() || {};
    process.nextTick(() => {
      if (result.error) child.emit('error', Object.assign(new Error(result.error), { code: 'ENOENT' }));
      child.stdout.end(result.stdout || ''); child.stderr.end(result.stderr || '');
      child.emit('close', result.code ?? (result.error ? -2 : 0));
    });
    return child;
  };
  return { calls, spawn };
}
const goodIO = {
  mkdir: async () => {}, access: async () => {},
  readFile: async () => '# Netscape HTTP Cookie File\n.bilibili.com\tTRUE\t/\tTRUE\t0\tSESSDATA\tsecret\n',
  stat: async () => ({ isFile: () => true }),
};
function backend(results, io = goodIO) {
  const fake = fakeSpawn(results);
  return { ...fake, api: createWindowsBackend({ rootDir: '/package', spawnImpl: fake.spawn, io }) };
}
for (const quality of ['best', '1080p', '720p', 'audio']) {
  test(`download arguments preserve ${quality} and literal paths/URL`, () => {
    const args = buildDownloadArgs({ url: video, output, quality, playlist: 'all', cookieMode: 'none' }, '/vendor');
    assert.equal(args.at(-1), video);
    assert.equal(args[args.indexOf('--paths') + 1], output);
    assert.ok(args.includes('--windows-filenames'));
    assert.ok(args.includes('--yes-playlist'));
    assert.ok(!args.includes('--cookies-from-browser'));
    const format = args[args.indexOf('--format') + 1];
    if (/^\d/.test(quality)) assert.ok(format.includes(`height<=${parseInt(quality)}`));
    if (quality === 'audio') {
      assert.ok(args.includes('--extract-audio'));
      assert.equal(args[args.indexOf('--audio-format') + 1], 'm4a');
      assert.ok(!args.includes('--remux-video'));
    } else assert.ok(args.includes('--merge-output-format'));
  });
}
test('Chrome and cookie file modes are mutually exclusive', () => {
  const base = { url: video, output, quality: 'best', playlist: 'current' };
  const chrome = buildDownloadArgs({ ...base, cookieMode: 'chrome' }, '/vendor');
  assert.ok(chrome.includes('--no-playlist'));
  assert.equal(chrome[chrome.indexOf('--cookies-from-browser') + 1], 'chrome');
  const file = buildDownloadArgs({ ...base, cookieMode: 'file', cookieFile: 'C:\\资料\\cookies.txt' }, '/vendor');
  assert.equal(file[file.indexOf('--cookies') + 1], 'C:\\资料\\cookies.txt');
  assert.ok(!file.includes('--cookies-from-browser'));
});
test('parse Windows paths, including UNC, without interpreting log lines as files', () => {
  assert.deepEqual(parseDownloadedFiles('Downloading...\r\nC:\\视频\\测试.mp4\r\n\\\\server\\share\\歌曲.m4a\nrelative.mp4\nERROR: no.mp4'), ['C:\\视频\\测试.mp4', '\\\\server\\share\\歌曲.m4a']);
});
test('missing executable reports dependencies even when close follows error', async () => {
  const { api } = backend([{ error: 'spawn ENOENT' }]);
  const result = await api.download({ url: video, output, quality: 'best', cookieMode: 'none' });
  assert.equal(result.exitCode, 10);
  assert.match(result.stderr, /依赖/);
});
test('successful download runs executable without shell and reports files', async () => {
  const { api, calls } = backend([{ stdout: `${output}\\成片.mp4\r\n` }]);
  const result = await api.download({ url: video, output, quality: 'best', cookieMode: 'none' });
  assert.equal(result.exitCode, 0);
  assert.equal(calls.length, 1);
  assert.match(calls[0].command, /vendor\/win32-x64\/yt-dlp\.exe$/);
  assert.equal(calls[0].options.shell, false);
  assert.deepEqual(parseDownloadedFiles(result.stdout), [`${output}\\成片.mp4`]);
});
test('Cookie decryption failure is distinct and does not retry without login', async () => {
  const { api, calls } = backend([{ code: 1, stderr: 'ERROR: Failed to decrypt with DPAPI' }]);
  const result = await api.download({ url: video, output, quality: 'best', cookieMode: 'chrome' });
  assert.equal(result.exitCode, 20);
  assert.match(result.stderr, /cookies\.txt/);
  assert.equal(calls.length, 1);
});
test('unwritable directory fails before starting download', async () => {
  const { api, calls } = backend([], { ...goodIO, mkdir: async () => { throw new Error('EACCES'); } });
  const result = await api.download({ url: video, output, quality: 'best', cookieMode: 'none' });
  assert.equal(result.exitCode, 30);
  assert.match(result.stderr, /目录/);
  assert.equal(calls.length, 0);
});
test('invalid cookie files fail before spawning and never echo their contents', async () => {
  const { api, calls } = backend([], { ...goodIO, readFile: async () => 'secret-session-value' });
  const result = await api.download({ url: video, output, quality: 'best', cookieMode: 'file', cookieFile: 'C:\\cookies.txt' });
  assert.equal(result.exitCode, 20);
  assert.ok(!result.stderr.includes('secret-session-value'));
  assert.equal(calls.length, 0);
});
test('valid Netscape cookie file is forwarded by path', async () => {
  const { api, calls } = backend([]);
  assert.equal((await api.download({ url: video, output, quality: 'best', cookieMode: 'file', cookieFile: 'C:\\cookies.txt' })).exitCode, 0);
  assert.ok(calls[0].args.includes('C:\\cookies.txt'));
});
test('network error remains download failure', async () => {
  const { api } = backend([{ code: 1, stderr: 'ERROR: HTTP Error 412' }]);
  const result = await api.download({ url: video, output, quality: 'best', cookieMode: 'none' });
  assert.equal(result.exitCode, 30);
  assert.match(result.stderr, /412/);
});
test('doctor runs all three tool version commands and reports missing ffmpeg', async () => {
  const { api, calls } = backend([{ stdout: '2026.1' }, { error: 'spawn ENOENT' }, { stdout: 'ffprobe version 8' }]);
  const result = await api.doctor();
  assert.equal(result.exitCode, 10);
  assert.equal(calls.length, 3);
  assert.ok(calls.some(call => call.command.endsWith('ffmpeg.exe')));
  assert.match(result.stderr, /ffmpeg/);
});
test('native picker cancellation preserves empty result; script is encoded and fixed', async () => {
  const { api, calls } = backend([{ stdout: '' }, { stdout: 'C:\\视频\\cookies.txt\r\n' }]);
  assert.deepEqual(await api.chooseFolder(), { ok: false, cancelled: true, output: '已取消选择。' });
  assert.equal((await api.chooseCookieFile()).path, 'C:\\视频\\cookies.txt');
  assert.ok(calls[0].args.includes('-STA'));
  const script = Buffer.from(calls[0].args.at(-1), 'base64').toString('utf16le');
  assert.match(script, /FolderBrowserDialog/);
  assert.match(script, /UTF8Encoding/);
});
module.exports = { fakeSpawn, goodIO };

test('Chrome decryption warnings at exit zero stop before media download', async () => {
  const { api, calls } = backend([{ code: 0, stderr: 'WARNING: cannot decrypt v10 cookies: no key found' }]);
  const result = await api.download({ url: video, output, quality: 'best', cookieMode: 'chrome' });
  assert.equal(result.exitCode, 20);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].args.includes('--skip-download'));
});
test('Chrome success requires preflight before real download', async () => {
  const { api, calls } = backend([{ stdout: 'A video title' }, { stdout: 'C:\\video.mp4' }]);
  const result = await api.download({ url: video, output, quality: 'best', cookieMode: 'chrome' });
  assert.equal(result.exitCode, 0);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].args.includes('--simulate'));
  assert.ok(!calls[1].args.includes('--simulate'));
});
test('login required message suggesting cookies is not a cookie read failure', async () => {
  const { api } = backend([{ code: 1, stderr: 'ERROR: Login required. Use --cookies-from-browser or --cookies for authentication.' }]);
  const result = await api.download({ url: video, output, quality: 'best', cookieMode: 'none' });
  assert.equal(result.exitCode, 30);
  assert.ok(!result.stderr.includes('Cookie 读取失败'));
});

test('video title containing DPAPI is not a cookie failure', async () => {
  const { api } = backend([{ stdout: 'How DPAPI works' }, { stdout: 'C:\\DPAPI.mp4' }]);
  assert.equal((await api.download({ url: video, output, quality: 'best', cookieMode: 'chrome' })).exitCode, 0);
});
