import { test, expect, type Locator } from '@playwright/test';
import fs from 'node:fs';
import { createLocator, resolveProfile, type WalkAction } from './site-profiles';

const TARGET_URL_FROM_ENV = process.env.TARGET_URL;
const TARGET_PROFILE_FILE = process.env.TARGET_PROFILE_FILE;
const REQUESTED_PROFILE =
  process.env.TARGET_PROFILE || (TARGET_URL_FROM_ENV?.includes('academybugs.com') ? 'academybugs' : 'fobalfoca');
const PROFILE = resolveProfile(REQUESTED_PROFILE, TARGET_PROFILE_FILE);
const TARGET_URL = TARGET_PROFILE_FILE ? PROFILE.defaultUrl : TARGET_URL_FROM_ENV || PROFILE.defaultUrl;
const ALLOW_MUTATIONS = process.env.ALLOW_MUTATIONS === 'true';
const STRICT_TELEMETRY = process.env.STRICT_TELEMETRY === 'true';
const ACTION_DELAY_MS = Number(process.env.ACTION_DELAY_MS ?? '1500');
const STEP_SCREENSHOT_DIR = 'artifacts/steps';
const IS_ACADEMYBUGS = TARGET_URL.includes('academybugs.com');

test('visual walkthrough and telemetry capture', async ({ page }) => {
  const visited = new Set<string>();
  const interactions: Array<{ step: string; url: string; screenshotPath: string }> = [];
  const consoleIssues: string[] = [];
  const failedRequests: string[] = [];
  let screenshotIndex = 0;

  fs.mkdirSync(STEP_SCREENSHOT_DIR, { recursive: true });

  const pauseForObservation = async () => {
    await page.waitForTimeout(ACTION_DELAY_MS);
  };

  const captureStepScreenshot = async (step: string) => {
    screenshotIndex += 1;
    const safeStepName = step.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const screenshotPath = `${STEP_SCREENSHOT_DIR}/${String(screenshotIndex).padStart(2, '0')}-${safeStepName}.png`;

    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch {
      return 'artifacts/steps/unavailable.png';
    }

    return screenshotPath;
  };

  const recordStep = async (step: string) => {
    visited.add(page.url());
    const screenshotPath = await captureStepScreenshot(step);
    interactions.push({ step, url: page.url(), screenshotPath });
  };

  const ensureVisible = async (action: WalkAction) => {
    const locator = createLocator(page, action);

    try {
      await expect(locator).toBeVisible({ timeout: 10_000 });
      await recordStep(action.step);
    } catch (error) {
      if (action.optional) {
        await recordStep(`${action.step} not visible, skipped`);
        return;
      }

      throw error;
    }
  };

  const clickAndRecord = async (action: WalkAction) => {
    const locator = createLocator(page, action);

    try {
      await expect(locator).toBeVisible({ timeout: 10_000 });
      await locator.click();
      await pauseForObservation();
      await recordStep(action.step);

      if (action.closeWithEscape) {
        await page.keyboard.press('Escape');
        await pauseForObservation();
        await recordStep(`Close ${action.step.toLowerCase()} with Escape`);
      }
    } catch (error) {
      if (action.optional) {
        await recordStep(`${action.step} not available, skipped`);
        return;
      }

      throw error;
    }
  };

  const tryClickIfVisible = async (step: string, locator: Locator) => {
    try {
      await locator.waitFor({ state: 'visible', timeout: 2500 });
      await locator.click({ timeout: 5000 });
      await pauseForObservation();
      await recordStep(step);
      return true;
    } catch {
      return false;
    }
  };

  const dismissAcademyBugsOverlays = async () => {
    if (!IS_ACADEMYBUGS) {
      return;
    }

    await tryClickIfVisible(
      'Dismiss cookie banner (continue without accepting)',
      page.getByText(/Continue without Accepting/i).first()
    );

    if (
      !(await tryClickIfVisible(
        'Dismiss cookie banner (functional only)',
        page.getByText(/Functional only/i).first()
      ))
    ) {
      await tryClickIfVisible('Dismiss cookie banner (accept cookies)', page.getByText(/Accept cookies|Accept All Cookies/i).first());
    }

    // Close the tutorial via JS (calls the same jQuery.tourTip.close() as the × button)
    // and remove the blocking canvas overlay if present.
    // Wait up to 3s for the tutorial canvas to appear, then dismiss immediately.
    try {
      await page.locator('#TourTipDisabledArea').waitFor({ state: 'attached', timeout: 3000 });
    } catch { /* tutorial didn't appear */ }
    await page.evaluate(() => {
      const win = window as any;
      if (win.jQuery?.tourTip?.close) {
        win.jQuery.tourTip.close();
      }
      const canvas = document.getElementById('TourTipDisabledArea');
      if (canvas) canvas.remove();
      // Also close any Popup Maker popup (pum-close)
      document.querySelectorAll<HTMLElement>('.pum-close, .popmake-close').forEach(el => el.click());
    });
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleIssues.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`);
  });

  await test.step('Open home page', async () => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await pauseForObservation();
    await dismissAcademyBugsOverlays();
    await recordStep('Open home page');
    await expect(page).toHaveURL(/.+/);
    await page.screenshot({ path: 'artifacts/home.png', fullPage: true });
  });

  await test.step('Validate home checks', async () => {
    if (PROFILE.homeChecks.length === 0) {
      await recordStep('No home checks configured for profile');
      return;
    }

    for (const homeCheck of PROFILE.homeChecks) {
      await ensureVisible(homeCheck);
    }
  });

  await test.step('Walk primary navigation', async () => {
    if (PROFILE.navigationActions.length === 0) {
      await recordStep('No navigation actions configured for profile');
      return;
    }

    for (const action of PROFILE.navigationActions) {
      await clickAndRecord(action);
    }
  });

  await test.step('Open utility controls', async () => {
    if (PROFILE.utilityActions.length === 0) {
      await recordStep('No utility actions configured for profile');
      return;
    }

    for (const action of PROFILE.utilityActions) {
      await clickAndRecord(action);
    }
  });

  if (ALLOW_MUTATIONS && PROFILE.mutationAction) {
    await test.step('Exercise first vote action', async () => {
      await clickAndRecord(PROFILE.mutationAction);
    });
  }

  const telemetry = {
    profileRequested: REQUESTED_PROFILE,
    profileResolved: PROFILE.id,
    profileFile: TARGET_PROFILE_FILE || null,
    targetUrl: TARGET_URL,
    visited: Array.from(visited),
    interactions,
    consoleIssues: Array.from(new Set(consoleIssues)),
    failedRequests: Array.from(new Set(failedRequests))
  };

  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/telemetry.json', JSON.stringify(telemetry, null, 2), 'utf8');

  await test.info().attach('telemetry.json', {
    body: Buffer.from(JSON.stringify(telemetry, null, 2), 'utf8'),
    contentType: 'application/json'
  });

  fs.writeFileSync('artifacts/report.html', buildReport(telemetry), 'utf8');

  if (STRICT_TELEMETRY) {
    expect(telemetry.failedRequests, 'Detected failed network requests').toEqual([]);
    expect(telemetry.consoleIssues, 'Detected console errors/warnings').toEqual([]);
  }
});

// ---------------------------------------------------------------------------
// HTML report builder
// ---------------------------------------------------------------------------

type Telemetry = {
  profileRequested: string;
  profileResolved: string;
  profileFile: string | null;
  targetUrl: string;
  visited: string[];
  interactions: Array<{ step: string; url: string; screenshotPath: string }>;
  consoleIssues: string[];
  failedRequests: string[];
};

const ANALYTICS_HOSTS = [
  'google-analytics.com', 'analytics.google.com', 'googletagmanager.com',
  'doubleclick.net', 'facebook.com/tr', 'hotjar.com', 'segment.com',
  'mixpanel.com', 'amplitude.com', 'clarity.ms', 'polyfill.io',
];

function classifyRequest(req: string): 'analytics' | 'media' | 'real' {
  const lower = req.toLowerCase();
  if (ANALYTICS_HOSTS.some(h => lower.includes(h))) return 'analytics';
  if (/\.(mp4|webm|ogg|mp3|wav|m3u8)(\s|$|::)/.test(lower)) return 'media';
  return 'real';
}

function buildReport(t: Telemetry): string {
  const now = new Date().toLocaleString();
  const errors = t.consoleIssues.filter(i => i.startsWith('[error]'));
  const warnings = t.consoleIssues.filter(i => i.startsWith('[warning]'));

  const realFailed = t.failedRequests.filter(r => classifyRequest(r) === 'real');
  const mediaFailed = t.failedRequests.filter(r => classifyRequest(r) === 'media');
  const analyticsFailed = t.failedRequests.filter(r => classifyRequest(r) === 'analytics');

  const severity = realFailed.length > 0 || errors.length > 0 ? 'FAIL' : warnings.length > 0 || mediaFailed.length > 0 ? 'WARN' : 'PASS';
  const severityColor = severity === 'FAIL' ? '#ef4444' : severity === 'WARN' ? '#f59e0b' : '#22c55e';

  const badgeHtml = (count: number, label: string, color: string) =>
    `<div class="badge" style="border-color:${color}"><span class="badge-num" style="color:${color}">${count}</span><span class="badge-label">${label}</span></div>`;

  const issueRows = (items: string[], cls: string) =>
    items.map(i => `<div class="issue-row ${cls}">${escHtml(i)}</div>`).join('');

  const reqRows = (items: string[], cls: string, label: string) => {
    if (items.length === 0) return '';
    return `<div class="req-group">
      <div class="req-group-label ${cls}-label">${label} (${items.length})</div>
      ${items.map(r => `<div class="req-row ${cls}">${escHtml(r)}</div>`).join('')}
    </div>`;
  };

  const stepCards = t.interactions.map((s, i) => {
    const imgPath = s.screenshotPath.replace(/^artifacts\//, '');
    return `<div class="step-card">
      <div class="step-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="step-body">
        <div class="step-title">${escHtml(s.step)}</div>
        <div class="step-url">${escHtml(s.url)}</div>
        <img class="step-img" src="${imgPath}" alt="${escHtml(s.step)}" loading="lazy" onclick="openLightbox(this.src)">
      </div>
    </div>`;
  }).join('');

  const visitedList = t.visited.map(u => `<li><a href="${escHtml(u)}" target="_blank">${escHtml(u)}</a></li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bug Report — ${escHtml(t.targetUrl)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  a { color: #60a5fa; }
  header { background: #1e293b; border-bottom: 1px solid #334155; padding: 1.5rem 2rem; display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
  .header-icon { font-size: 2rem; }
  .header-text h1 { font-size: 1.1rem; font-weight: 700; color: #f1f5f9; }
  .header-text .url { font-size: 0.85rem; color: #94a3b8; word-break: break-all; }
  .header-text .meta { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
  .verdict { margin-left: auto; font-size: 0.9rem; font-weight: 700; padding: 0.4rem 1rem; border-radius: 9999px; border: 2px solid ${severityColor}; color: ${severityColor}; }
  main { max-width: 1100px; margin: 0 auto; padding: 2rem; }
  section { margin-bottom: 2.5rem; }
  h2 { font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #1e293b; }
  .badges { display: flex; flex-wrap: wrap; gap: 1rem; }
  .badge { background: #1e293b; border: 1px solid; border-radius: 0.75rem; padding: 1rem 1.5rem; min-width: 120px; text-align: center; }
  .badge-num { display: block; font-size: 2rem; font-weight: 800; line-height: 1; }
  .badge-label { display: block; font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem; }
  .issue-row { font-size: 0.78rem; font-family: monospace; padding: 0.4rem 0.75rem; border-radius: 0.25rem; margin-bottom: 0.3rem; word-break: break-all; }
  .issue-row.error { background: #450a0a; color: #fca5a5; }
  .issue-row.warning { background: #451a03; color: #fcd34d; }
  .req-group { margin-bottom: 1rem; }
  .req-group-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.4rem; }
  .req-group-label.real-label { color: #ef4444; }
  .req-group-label.media-label { color: #f59e0b; }
  .req-group-label.analytics-label { color: #64748b; }
  .req-row { font-size: 0.72rem; font-family: monospace; padding: 0.35rem 0.75rem; border-radius: 0.25rem; margin-bottom: 0.25rem; word-break: break-all; }
  .req-row.real { background: #450a0a; color: #fca5a5; }
  .req-row.media { background: #1c1917; color: #d6b090; }
  .req-row.analytics { background: #0f172a; color: #475569; }
  .visited-list { list-style: none; display: flex; flex-direction: column; gap: 0.35rem; }
  .visited-list li { font-size: 0.82rem; }
  .step-card { display: flex; gap: 1rem; background: #1e293b; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; }
  .step-num { font-size: 0.75rem; font-weight: 700; color: #475569; min-width: 2rem; padding-top: 0.1rem; }
  .step-body { flex: 1; min-width: 0; }
  .step-title { font-size: 0.9rem; font-weight: 600; color: #e2e8f0; margin-bottom: 0.2rem; }
  .step-url { font-size: 0.72rem; color: #60a5fa; margin-bottom: 0.75rem; word-break: break-all; }
  .step-img { width: 100%; max-width: 800px; border-radius: 0.375rem; cursor: zoom-in; border: 1px solid #334155; display: block; }
  .empty { color: #475569; font-size: 0.85rem; font-style: italic; }
  #lightbox { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.9); z-index: 9999; align-items: center; justify-content: center; cursor: zoom-out; }
  #lightbox.open { display: flex; }
  #lightbox img { max-width: 95vw; max-height: 95vh; border-radius: 0.5rem; }
</style>
</head>
<body>
<header>
  <div class="header-icon">🔍</div>
  <div class="header-text">
    <h1>Bug Hunter Report</h1>
    <div class="url">${escHtml(t.targetUrl)}</div>
    <div class="meta">Generated ${now} &nbsp;·&nbsp; Profile: ${escHtml(t.profileResolved)}${t.profileFile ? ` (${escHtml(t.profileFile)})` : ''}</div>
  </div>
  <div class="verdict">${severity}</div>
</header>

<main>
  <section>
    <h2>Summary</h2>
    <div class="badges">
      ${badgeHtml(t.visited.length, 'Pages visited', '#60a5fa')}
      ${badgeHtml(t.interactions.length, 'Steps captured', '#818cf8')}
      ${badgeHtml(errors.length, 'Console errors', '#ef4444')}
      ${badgeHtml(warnings.length, 'Warnings', '#f59e0b')}
      ${badgeHtml(realFailed.length, 'Failed requests', '#ef4444')}
      ${badgeHtml(mediaFailed.length, 'Media errors', '#f59e0b')}
    </div>
  </section>

  <section>
    <h2>Pages Visited (${t.visited.length})</h2>
    ${t.visited.length > 0 ? `<ul class="visited-list">${visitedList}</ul>` : '<div class="empty">None recorded</div>'}
  </section>

  <section>
    <h2>Console Issues (${t.consoleIssues.length})</h2>
    ${t.consoleIssues.length === 0
      ? '<div class="empty">No console errors or warnings</div>'
      : issueRows(errors, 'error') + issueRows(warnings, 'warning')}
  </section>

  <section>
    <h2>Failed Requests (${t.failedRequests.length})</h2>
    ${t.failedRequests.length === 0
      ? '<div class="empty">No failed requests</div>'
      : reqRows(realFailed, 'real', 'Real failures') +
        reqRows(mediaFailed, 'media', 'Media / video') +
        reqRows(analyticsFailed, 'analytics', 'Analytics / tracking (expected)')}
  </section>

  <section>
    <h2>Step-by-step Walkthrough (${t.interactions.length} steps)</h2>
    ${t.interactions.length === 0 ? '<div class="empty">No steps recorded</div>' : stepCards}
  </section>
</main>

<div id="lightbox" onclick="closeLightbox()"><img id="lightbox-img" src="" alt=""></div>

<script>
  function openLightbox(src) {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.add('open');
  }
  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
</script>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
