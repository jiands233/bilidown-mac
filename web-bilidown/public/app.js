const form = document.querySelector('#download-form');
const doctorButton = document.querySelector('#doctor-button');
const downloadButton = document.querySelector('#download-button');
const chooseFolderButton = document.querySelector('#choose-folder-button');
const chooseCookieButton = document.querySelector('#choose-cookie-button');
const outputInput = document.querySelector('#output');
const cookieModeInput = document.querySelector('#cookie-mode');
const cookieFileInput = document.querySelector('#cookie-file');
const statusText = document.querySelector('#status');
const log = document.querySelector('#log');
let config;

function setStatus(message, type = '') {
  statusText.textContent = message;
  statusText.className = type;
}
function setBusy(isBusy, downloading = false) {
  form.querySelectorAll('input, select, button').forEach(control => { control.disabled = isBusy || !config?.supported; });
  downloadButton.textContent = downloading ? '正在下载...' : '下载视频';
}
function showOutput(data) {
  const files = Array.isArray(data.files) && data.files.length
    ? `\n\n已保存文件：\n${data.files.map(file => `- ${file}`).join('\n')}` : '';
  log.textContent = `${data.output || '没有输出。'}${files}`;
}
function updateCookieField() {
  document.querySelector('#cookie-file-field').hidden = config?.platform !== 'win32' || cookieModeInput.value !== 'file';
}
cookieModeInput.addEventListener('change', updateCookieField);

doctorButton.addEventListener('click', async () => {
  setBusy(true);
  setStatus('正在检查环境...');
  log.textContent = '正在检查下载和音视频处理工具...';
  try {
    const data = await (await fetch('/api/doctor')).json();
    showOutput(data);
    setStatus(data.ok ? '环境正常' : `检查失败，退出码 ${data.exitCode}`, data.ok ? 'success' : 'error');
  } catch (error) {
    log.textContent = error.message;
    setStatus('检查失败', 'error');
  } finally { setBusy(false); }
});

async function choosePath(route, input) {
  setBusy(true);
  setStatus('请在弹出的窗口里选择；也可以取消后手动输入路径');
  try {
    const data = await (await fetch(route, { method: 'POST' })).json();
    if (!data.ok) { setStatus(data.output || '已取消选择', data.cancelled ? '' : 'error'); return; }
    input.value = data.path;
    setStatus('路径已更新', 'success');
  } catch (error) {
    setStatus('选择失败，可手动输入路径', 'error');
    log.textContent = error.message;
  } finally { setBusy(false); }
}
chooseFolderButton.addEventListener('click', () => choosePath('/api/choose-folder', outputInput));
chooseCookieButton.addEventListener('click', () => choosePath('/api/choose-cookie-file', cookieFileInput));

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!config?.supported) return;
  const formData = new FormData(form);
  const payload = {
    url: String(formData.get('url') || '').trim(),
    quality: formData.get('quality'), output: formData.get('output'),
    cookieMode: config.platform === 'win32' ? cookieModeInput.value : formData.get('cookies') === 'on' ? 'chrome' : 'none',
    playlist: formData.get('playlist') === 'on' ? 'all' : 'current',
  };
  if (payload.cookieMode === 'file') payload.cookieFile = cookieFileInput.value.trim();
  if (!payload.url) { setStatus('请先输入视频链接', 'error'); return; }
  if (payload.cookieMode === 'file' && !payload.cookieFile) { setStatus('请先选择或输入 cookies.txt 文件路径', 'error'); return; }
  setBusy(true, true);
  setStatus('正在下载，请保持本页打开...');
  log.textContent = '下载任务已启动，完成后会显示结果。';
  try {
    const data = await (await fetch('/api/download', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    })).json();
    showOutput(data);
    setStatus(data.ok ? '下载完成' : `下载失败，退出码 ${data.exitCode}`, data.ok ? 'success' : 'error');
  } catch (error) {
    log.textContent = error.message;
    setStatus('下载失败', 'error');
  } finally { setBusy(false); }
});

async function initialize() {
  setBusy(true);
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('无法读取本机配置。');
    config = await response.json();
    outputInput.value = config.defaultOutput;
    cookieModeInput.value = config.defaultCookieMode;
    document.querySelector('#windows-cookie-option').hidden = config.platform !== 'win32';
    document.querySelector('#legacy-cookie-option').hidden = config.platform === 'win32';
    updateCookieField();
    setStatus(config.supported ? '准备就绪' : '当前系统不受支持，请使用 macOS 或 Windows x64。', config.supported ? '' : 'error');
  } catch (error) {
    setStatus('初始化失败，请确认服务已启动后刷新页面', 'error');
    log.textContent = error.message;
  } finally { setBusy(false); }
}
initialize();
