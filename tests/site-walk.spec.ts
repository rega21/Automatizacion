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

    const tutorialTip = page.locator('p.TourTipDesc', { hasText: /Click start to begin the guided site tutorial/i }).first();

    try {
      await tutorialTip.waitFor({ state: 'visible', timeout: 2500 });

      const started =
        (await tryClickIfVisible(
          'Start guided tutorial',
          page.locator('div.TourTipButtonsHolder button.TourTipButton.TourTipNextButton', { hasText: /^Start$/i }).first()
        )) || (await tryClickIfVisible('Start guided tutorial', page.getByRole('button', { name: /^Start$/i }).first()));

      if (started) {
        await tryClickIfVisible('Close tutorial after start', page.getByRole('button', { name: /^×$/ }).first());
      }
    } catch {
      // Tutorial popup was not visible.
    }
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

  if (STRICT_TELEMETRY) {
    expect(telemetry.failedRequests, 'Detected failed network requests').toEqual([]);
    expect(telemetry.consoleIssues, 'Detected console errors/warnings').toEqual([]);
  }
});
