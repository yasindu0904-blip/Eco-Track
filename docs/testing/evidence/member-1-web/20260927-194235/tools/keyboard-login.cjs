const { chromium } = require('D:/Eco-Track/tmp/member1-playwright/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const output = path.join(root, 'logs', 'W14_attempt-02_keyboard.json');

async function focusInfo(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    return {
      tag: element?.tagName ?? null,
      role: element?.getAttribute('role') ?? null,
      type: element?.getAttribute('type') ?? null,
      text: element?.tagName === 'INPUT' ? null : element?.textContent?.trim().slice(0, 80) ?? null,
      accessibleLabel: element?.getAttribute('aria-label') ?? null,
      outlineStyle: element ? getComputedStyle(element).outlineStyle : null,
      outlineWidth: element ? getComputedStyle(element).outlineWidth : null,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: edgePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const apiRequests = [];
    const pageErrors = [];
    page.on('request', request => {
      if (request.url().includes('/auth/v1/') || request.url().includes('/api/v1/')) {
        const url = new URL(request.url());
        apiRequests.push({ method: request.method(), origin: url.origin, pathname: url.pathname });
      }
    });
    page.on('pageerror', error => pageErrors.push(error.message));
    const response = await page.goto('https://eco-track-ctd.pages.dev', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Sign in' }).waitFor();
    await page.keyboard.press('Tab');
    const firstTab = await focusInfo(page);
    await page.keyboard.type('not-an-email');
    await page.keyboard.press('Tab');
    const secondTab = await focusInfo(page);
    await page.keyboard.press('Shift+Tab');
    const reverseTab = await focusInfo(page);
    const email = page.getByRole('textbox', { name: 'Email address' });
    const association = await email.evaluate(element => ({
      type: element.getAttribute('type'),
      required: element.required,
      id: element.id,
      associatedLabels: Array.from(element.labels ?? [], label => label.textContent?.trim()),
      ariaDescribedBy: element.getAttribute('aria-describedby'),
      typeMismatch: element.validity.typeMismatch,
    }));
    await page.keyboard.press('Enter');
    const afterInvalidEnter = {
      url: new URL(page.url()).origin + new URL(page.url()).pathname,
      signInVisible: await page.getByRole('heading', { name: 'Sign in' }).isVisible(),
      emailValidationMessage: await email.evaluate(element => element.validationMessage),
      apiRequests,
      pageErrors,
    };
    await page.screenshot({ path: path.join(root, 'screenshots', 'W14_attempt-02_keyboard-invalid-enter.png'), fullPage: true });
    const result = { capturedAtUtc: new Date().toISOString(), httpStatus: response?.status(), browserVersion: browser.version(), firstTab, secondTab, reverseTab, association, afterInvalidEnter };
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
