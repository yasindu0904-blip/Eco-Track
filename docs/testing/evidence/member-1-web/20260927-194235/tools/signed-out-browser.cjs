const { chromium } = require('D:/Eco-Track/tmp/member1-playwright/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const target = 'https://eco-track-ctd.pages.dev';
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function inspect(executablePath, name) {
  const errors = [];
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push({ kind: 'pageerror', message: error.message }));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push({ kind: 'console', message: message.text() });
  });
  const response = await page.goto(target, { waitUntil: 'networkidle', timeout: 45000 });
  await page.getByRole('heading', { name: 'Sign in' }).waitFor({ state: 'visible', timeout: 20000 });
  const initial = {
    url: page.url(),
    httpStatus: response?.status() ?? null,
    heading: await page.getByRole('heading', { name: 'Sign in' }).textContent(),
    browserVersion: browser.version(),
    viewport: { width: 1440, height: 1000 },
    capturedAtUtc: new Date().toISOString(),
  };
  if (name === 'edge') {
    await page.screenshot({ path: path.join(root, 'screenshots', 'W01_attempt-01_login.png'), fullPage: true });
    const email = page.getByRole('textbox', { name: 'Email address' });
    await email.fill('not-an-email');
    await page.getByRole('button', { name: 'Send magic link' }).click();
    const invalid = await email.evaluate((element) => ({
      typeMismatch: element.validity.typeMismatch,
      validationMessage: element.validationMessage,
    }));
    const stillSignedOut = await page.getByRole('heading', { name: 'Sign in' }).isVisible();
    await page.screenshot({ path: path.join(root, 'screenshots', 'W01_attempt-01_invalid-email.png'), fullPage: true });

    await email.fill('');
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({
      tag: document.activeElement?.tagName ?? null,
      text: document.activeElement?.textContent?.trim() ?? '',
      outlineStyle: document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : null,
    }));
    await page.screenshot({ path: path.join(root, 'screenshots', 'W14_attempt-01_focus.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    await page.screenshot({ path: path.join(root, 'screenshots', 'W14_attempt-01_narrow.png'), fullPage: true });
    fs.writeFileSync(path.join(root, 'logs', 'signed-out-edge.json'), JSON.stringify({ initial, invalid, stillSignedOut, focus, mobile, errors }, null, 2));
  } else {
    await page.screenshot({ path: path.join(root, 'screenshots', 'W15_attempt-01_chrome-login.png'), fullPage: true });
    fs.writeFileSync(path.join(root, 'logs', 'signed-out-chrome.json'), JSON.stringify({ initial, errors }, null, 2));
  }
  await browser.close();
  return { name, initial, errors };
}

(async () => {
  const results = [];
  results.push(await inspect(edgePath, 'edge'));
  results.push(await inspect(chromePath, 'chrome'));
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
