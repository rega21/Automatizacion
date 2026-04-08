'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3000;
const ROOT = path.join(__dirname, '..');

// Active scan state
let scan = null; // { running, url, logs, exitCode }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(filePath) {
  try { return fs.readFileSync(filePath); } catch { return null; }
}

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.html': 'text/html; charset=utf-8',
  '.json': 'application/json', '.mp4': 'video/mp4',
};

function send(res, status, contentType, body) {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function detectProfile(url) {
  if (url.includes('academybugs.com')) return 'academybugs';
  return 'generic';
}

// ---------------------------------------------------------------------------
// Toolbar injected into the report HTML when served via server
// ---------------------------------------------------------------------------

function toolbar(currentUrl) {
  return `
<style>
  #bh-bar { position:fixed; bottom:0; left:0; right:0; background:#0f172a; border-top:1px solid #334155; z-index:9000; font-family:system-ui,sans-serif; }
  #bh-bar-inner { display:flex; align-items:center; gap:.75rem; padding:.75rem 1.25rem; flex-wrap:wrap; }
  #bh-url { flex:1; min-width:220px; background:#1e293b; border:1px solid #334155; color:#e2e8f0; border-radius:.375rem; padding:.45rem .75rem; font-size:.85rem; outline:none; }
  #bh-url:focus { border-color:#60a5fa; }
  #bh-btn { background:#3b82f6; color:#fff; border:none; border-radius:.375rem; padding:.45rem 1rem; font-size:.85rem; font-weight:600; cursor:pointer; white-space:nowrap; }
  #bh-btn:disabled { background:#1e3a5f; color:#64748b; cursor:not-allowed; }
  #bh-status { font-size:.8rem; color:#94a3b8; white-space:nowrap; }
  #bh-log-wrap { max-height:180px; overflow-y:auto; background:#020617; border-top:1px solid #1e293b; padding:.5rem 1.25rem; display:none; }
  #bh-log { font-family:monospace; font-size:.72rem; color:#94a3b8; white-space:pre-wrap; word-break:break-all; }
  body { padding-bottom: 60px; }
</style>
<div id="bh-bar">
  <div id="bh-log-wrap"><div id="bh-log"></div></div>
  <div id="bh-bar-inner">
    <input id="bh-url" type="url" placeholder="https://..." value="${currentUrl}" spellcheck="false">
    <button id="bh-btn" onclick="startScan()">Run Scan</button>
    <span id="bh-status">Ready</span>
  </div>
</div>
<script>
  let logIndex = 0;
  let polling = null;

  function startScan() {
    const url = document.getElementById('bh-url').value.trim();
    if (!url) return;
    document.getElementById('bh-btn').disabled = true;
    document.getElementById('bh-status').textContent = 'Starting...';
    document.getElementById('bh-log').textContent = '';
    document.getElementById('bh-log-wrap').style.display = 'block';
    logIndex = 0;

    fetch('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'url=' + encodeURIComponent(url)
    })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        document.getElementById('bh-status').textContent = data.error;
        document.getElementById('bh-btn').disabled = false;
        return;
      }
      document.getElementById('bh-status').textContent = 'Scanning...';
      polling = setInterval(pollStatus, 800);
    })
    .catch(() => {
      document.getElementById('bh-status').textContent = 'Error starting scan';
      document.getElementById('bh-btn').disabled = false;
    });
  }

  function pollStatus() {
    fetch('/scan/status?since=' + logIndex)
      .then(r => r.json())
      .then(data => {
        if (data.logs && data.logs.length) {
          const logEl = document.getElementById('bh-log');
          logEl.textContent += data.logs.join('');
          logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight;
          logIndex = data.total;
        }
        if (!data.running) {
          clearInterval(polling);
          polling = null;
          if (data.exitCode === 0) {
            document.getElementById('bh-status').textContent = 'Done — reloading...';
            setTimeout(() => location.reload(), 800);
          } else {
            document.getElementById('bh-status').textContent = 'Scan failed (exit ' + data.exitCode + ')';
            document.getElementById('bh-btn').disabled = false;
          }
        }
      });
  }

  document.getElementById('bh-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') startScan();
  });
</script>`;
}

// ---------------------------------------------------------------------------
// No-report landing page
// ---------------------------------------------------------------------------

function launcherHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bug Hunter</title>
<style>
  body { font-family:system-ui,sans-serif; background:#0f172a; color:#e2e8f0; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:#1e293b; border-radius:1rem; padding:2.5rem; max-width:480px; width:90%; }
  h1 { font-size:1.4rem; margin-bottom:.5rem; }
  p { color:#94a3b8; font-size:.9rem; margin-bottom:1.5rem; }
  input { width:100%; background:#0f172a; border:1px solid #334155; color:#e2e8f0; border-radius:.375rem; padding:.6rem .9rem; font-size:.9rem; box-sizing:border-box; outline:none; }
  input:focus { border-color:#60a5fa; }
  button { margin-top:.75rem; width:100%; background:#3b82f6; color:#fff; border:none; border-radius:.375rem; padding:.6rem; font-size:.9rem; font-weight:600; cursor:pointer; }
  #status { margin-top:1rem; font-size:.8rem; color:#94a3b8; min-height:1.2em; }
  #log-wrap { margin-top:.75rem; max-height:150px; overflow-y:auto; background:#020617; border-radius:.375rem; padding:.5rem; display:none; }
  #log { font-family:monospace; font-size:.7rem; color:#64748b; white-space:pre-wrap; word-break:break-all; }
</style>
</head>
<body>
<div class="card">
  <h1>Bug Hunter</h1>
  <p>Enter a URL to scan. The browser will navigate the site, capture screenshots and detect console errors and failed requests.</p>
  <input id="url" type="url" placeholder="https://your-site.com" autofocus>
  <button onclick="startScan()">Run Scan</button>
  <div id="status"></div>
  <div id="log-wrap"><div id="log"></div></div>
</div>
<script>
  let logIndex = 0;
  let polling = null;

  function startScan() {
    const url = document.getElementById('url').value.trim();
    if (!url) return;
    document.querySelector('button').disabled = true;
    document.getElementById('status').textContent = 'Starting scan...';
    document.getElementById('log').textContent = '';
    document.getElementById('log-wrap').style.display = 'block';
    logIndex = 0;

    fetch('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'url=' + encodeURIComponent(url)
    })
    .then(r => r.json())
    .then(data => {
      if (data.error) { document.getElementById('status').textContent = data.error; document.querySelector('button').disabled = false; return; }
      document.getElementById('status').textContent = 'Scanning... (this takes ~20s)';
      polling = setInterval(pollStatus, 800);
    });
  }

  function pollStatus() {
    fetch('/scan/status?since=' + logIndex)
      .then(r => r.json())
      .then(data => {
        if (data.logs && data.logs.length) {
          const logEl = document.getElementById('log');
          logEl.textContent += data.logs.join('');
          logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight;
          logIndex = data.total;
        }
        if (!data.running) {
          clearInterval(polling);
          if (data.exitCode === 0) {
            document.getElementById('status').textContent = 'Done — loading report...';
            setTimeout(() => location.reload(), 800);
          } else {
            document.getElementById('status').textContent = 'Scan failed (exit ' + data.exitCode + ')';
            document.querySelector('button').disabled = false;
          }
        }
      });
  }

  document.getElementById('url').addEventListener('keydown', e => { if (e.key === 'Enter') startScan(); });
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  // Main page — serve report or launcher
  if (req.method === 'GET' && u.pathname === '/') {
    const reportPath = path.join(ROOT, 'artifacts', 'report.html');
    const reportBuf = readFile(reportPath);
    if (!reportBuf) {
      return send(res, 200, 'text/html; charset=utf-8', launcherHtml());
    }

    // Fix screenshot paths: report uses relative `steps/...` but server needs `/artifacts/steps/...`
    let html = reportBuf.toString('utf8');
    html = html.replace(/src="steps\//g, 'src="/artifacts/steps/');
    html = html.replace(/src="home\.png"/g, 'src="/artifacts/home.png"');

    // Extract current URL from report to prefill the toolbar
    const urlMatch = html.match(/class="url">([^<]+)</);
    const currentUrl = urlMatch ? urlMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') : '';

    html = html.replace('</body>', toolbar(currentUrl) + '\n</body>');
    return send(res, 200, 'text/html; charset=utf-8', html);
  }

  // Static artifacts (screenshots)
  if (req.method === 'GET' && u.pathname.startsWith('/artifacts/')) {
    const filePath = path.join(ROOT, decodeURIComponent(u.pathname));
    const buf = readFile(filePath);
    if (!buf) return send(res, 404, 'text/plain', 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    return send(res, 200, MIME[ext] || 'application/octet-stream', buf);
  }

  // POST /scan — start a new scan
  if (req.method === 'POST' && u.pathname === '/scan') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (scan?.running) {
        return send(res, 409, 'application/json', JSON.stringify({ error: 'Scan already in progress' }));
      }

      const params = new URLSearchParams(body);
      const targetUrl = (params.get('url') || '').trim();
      if (!targetUrl) {
        return send(res, 400, 'application/json', JSON.stringify({ error: 'Missing url' }));
      }

      // Clean old artifacts so stale data is never shown
      try { fs.unlinkSync(path.join(ROOT, 'artifacts', 'telemetry.json')); } catch { /* ok */ }
      try { fs.unlinkSync(path.join(ROOT, 'artifacts', 'report.html')); } catch { /* ok */ }

      const profile = detectProfile(targetUrl);
      const env = {
        ...process.env,
        TARGET_URL: targetUrl,
        TARGET_PROFILE: profile,
        TARGET_PROFILE_FILE: '',   // ignore any profile file
      };

      scan = { running: true, url: targetUrl, logs: [], exitCode: null };

      const proc = spawn('npm', ['run', 'test:trace'], { env, cwd: ROOT, shell: true });
      proc.stdout.on('data', d => scan.logs.push(d.toString()));
      proc.stderr.on('data', d => scan.logs.push(d.toString()));
      proc.on('close', code => { scan.running = false; scan.exitCode = code; });

      return send(res, 200, 'application/json', JSON.stringify({ ok: true }));
    });
    return;
  }

  // GET /scan/status — poll progress
  if (req.method === 'GET' && u.pathname === '/scan/status') {
    const since = parseInt(u.searchParams.get('since') || '0', 10);
    if (!scan) {
      return send(res, 200, 'application/json', JSON.stringify({ running: false, logs: [], total: 0, exitCode: null }));
    }
    return send(res, 200, 'application/json', JSON.stringify({
      running: scan.running,
      logs: scan.logs.slice(since),
      total: scan.logs.length,
      exitCode: scan.exitCode,
    }));
  }

  return send(res, 404, 'text/plain', 'Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\nBug Hunter  →  http://localhost:${PORT}\n`);
  // Open browser automatically on Windows
  const { exec } = require('child_process');
  exec(`start http://localhost:${PORT}`);
});
