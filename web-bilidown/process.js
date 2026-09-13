const { spawn } = require('node:child_process');

// Resolve once: failed spawns emit both error and close. Decode UTF-8 across chunks.
function runProcess(command, args, { spawnImpl = spawn, timeout = 0, ...options } = {}) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '', timer, settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, ...result });
    };
    let child;
    try {
      child = spawnImpl(command, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    } catch (error) {
      finish({ exitCode: 10, stderr: error.message });
      return;
    }
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => finish({ exitCode: 10, stderr: `${stderr}\n${error.message}`.trim() }));
    child.on('close', code => finish({ exitCode: code ?? 30 }));
    if (timeout) {
      timer = setTimeout(() => {
        finish({ exitCode: 10, stderr: `${stderr}\n进程等待超时。`.trim() });
        child.kill();
      }, timeout);
      timer.unref();
    }
  });
}
module.exports = { runProcess };
