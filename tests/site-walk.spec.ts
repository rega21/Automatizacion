import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const TARGET_URL = process.env.TARGET_URL || 'https://fobalfoca5.vercel.app/';
const ALLOW_MUTATIONS = process.env.ALLOW_MUTATIONS === 'true';
const ACTION_DELAY_MS = Number(process.env.ACTION_DELAY_MS ?? '1500');
const STEP_SCREENSHOT_DIR = 'artifacts/steps';

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
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  };

  const recordStep = async (step: string) => {
    visited.add(page.url());
    const screenshotPath = await captureStepScreenshot(step);
    interactions.push({ step, url: page.url(), screenshotPath });
  };

  const clickAndRecord = async (name: string, locator: ReturnType<typeof page.getByRole>) => {
    await expect(locator).toBeVisible();
    await locator.click();
    await pauseForObservation();
    await recordStep(name);
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
    await recordStep('Open home page');
    await expect(page).toHaveURL(/.+/);
    await expect(page.getByRole('navigation', { name: 'Bottom Navigation' })).toBeVisible();
    await page.screenshot({ path: 'artifacts/home.png', fullPage: true });
  });

  await test.step('Walk primary navigation', async () => {
    await clickAndRecord('Open Partido tab', page.getByRole('button', { name: 'Partido' }));
    await clickAndRecord('Open Historial tab', page.getByRole('button', { name: 'Historial' }));
    await clickAndRecord('Return to Jugadores tab', page.getByRole('button', { name: 'Jugadores' }));
  });

  await test.step('Open utility controls', async () => {
    await clickAndRecord('Open menu', page.getByRole('button', { name: 'Abrir menú' }));
    await page.keyboard.press('Escape');
    await pauseForObservation();
    await recordStep('Close menu with Escape');

    await clickAndRecord('Open search', page.getByRole('button', { name: /Buscar/i }));
    await page.keyboard.press('Escape');
    await pauseForObservation();
    await recordStep('Close search with Escape');

    try {
      await clickAndRecord('Open add flow', page.getByRole('button', { name: /Agregar/i }));
      await page.keyboard.press('Escape');
      await pauseForObservation();
      await recordStep('Close add flow with Escape');
    } catch {
      await recordStep('Agregar button not visible, skipped');
    }
  });

  if (ALLOW_MUTATIONS) {
    await test.step('Exercise first vote action', async () => {
      await clickAndRecord('Vote for first player', page.getByRole('button', { name: /VOTAR/i }).first());
    });
  }

  const telemetry = {
    targetUrl: TARGET_URL,
    visited: Array.from(visited),
    interactions,
    consoleIssues,
    failedRequests
  };

  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/telemetry.json', JSON.stringify(telemetry, null, 2), 'utf8');

  await test.info().attach('telemetry.json', {
    body: Buffer.from(JSON.stringify(telemetry, null, 2), 'utf8'),
    contentType: 'application/json'
  });

  expect.soft(failedRequests, 'Detected failed network requests').toEqual([]);
  expect.soft(consoleIssues, 'Detected console errors/warnings').toEqual([]);
});
