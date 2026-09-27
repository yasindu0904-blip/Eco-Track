const { chromium } = require('D:/Eco-Track/tmp/member1-playwright/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const runRoot = path.resolve(__dirname, '..');
const profileDir = 'D:/Eco-Track/tmp/member1-edge-profile';
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const target = 'https://eco-track-ctd.pages.dev';
const safeText = (value) => String(value ?? '')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
  .slice(0, 3000);
const safeUrl = (value) => {
  try { const url = new URL(value); return `${url.origin}${url.pathname}`; }
  catch { return '[unavailable]'; }
};

async function main() {
  fs.mkdirSync(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: edgePath,
    headless: false,
    viewport: { width: 1440, height: 1000 },
    args: ['--window-size=1440,1000'],
  });
  let page = context.pages()[0] ?? await context.newPage();
  const events = [];
  const observe = (p) => {
    p.on('pageerror', error => events.push({ at: new Date().toISOString(), type: 'pageerror', message: safeText(error.message) }));
    p.on('response', response => {
      const url = response.url();
      if (url.includes('code.run/api/v1') || url.includes('/auth/v1/')) {
        events.push({ at: new Date().toISOString(), type: 'response', status: response.status(), url: safeUrl(url) });
      }
    });
  };
  context.pages().forEach(observe);
  context.on('page', p => { page = p; observe(p); });
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
  console.log(JSON.stringify({ ready: true, browserVersion: context.browser().version(), url: safeUrl(page.url()) }));

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    let command;
    try { command = JSON.parse(line); }
    catch { console.log(JSON.stringify({ error: 'invalid JSON command' })); continue; }
    try {
      if (command.op === 'state') {
        const pages = context.pages().map((p, index) => ({ index, url: safeUrl(p.url()) }));
        const snapshot = await page.evaluate(() => ({
          headings: [...document.querySelectorAll('h1,h2,h3')].filter(x => x.getClientRects().length).map(x => x.textContent?.trim()).filter(Boolean),
          buttons: [...document.querySelectorAll('button')].filter(x => x.getClientRects().length).map(x => ({ text: x.textContent?.trim(), aria: x.getAttribute('aria-label'), disabled: x.disabled })),
          alerts: [...document.querySelectorAll('[role=alert]')].filter(x => x.getClientRects().length).map(x => x.textContent?.trim()),
          bodyText: document.body.innerText.slice(0, 2500),
        }));
        console.log(JSON.stringify({ op: 'state', pages, active: safeUrl(page.url()), data: JSON.parse(JSON.stringify(snapshot), (_k, v) => typeof v === 'string' ? safeText(v) : v), events: events.splice(0) }));
      } else if (command.op === 'forms') {
        const forms = await page.evaluate(() => [...document.querySelectorAll('input,select,textarea')].filter(x => x.getClientRects().length).map(x => ({ tag: x.tagName, type: x.type, name: x.name, id: x.id, required: x.required, placeholder: x.placeholder, minLength: x.minLength, maxLength: x.maxLength, value: x.type === 'email' || x.type === 'password' ? '[redacted]' : x.value })));
        console.log(JSON.stringify({ op: 'forms', forms }));
      } else if (command.op === 'click') {
        const locator = command.role ? page.getByRole(command.role, { name: command.name, exact: command.exact ?? true }) : command.text ? page.getByText(command.text, { exact: command.exact ?? true }) : page.locator(command.selector);
        await locator.first().click({ timeout: 15000 });
        console.log(JSON.stringify({ op: 'click', ok: true }));
      } else if (command.op === 'fill') {
        const locator = command.label ? page.getByLabel(command.label, { exact: command.exact ?? true }) : page.locator(command.selector);
        await locator.first().fill(command.value, { timeout: 15000 });
        console.log(JSON.stringify({ op: 'fill', ok: true }));
      } else if (command.op === 'press') {
        await page.keyboard.press(command.key);
        console.log(JSON.stringify({ op: 'press', ok: true }));
      } else if (command.op === 'wait') {
        await page.waitForTimeout(Math.min(Number(command.ms) || 1000, 10000));
        console.log(JSON.stringify({ op: 'wait', ok: true }));
      } else if (command.op === 'shot') {
        const name = String(command.name);
        if (!/^[A-Za-z0-9_-]+\.png$/.test(name)) throw new Error('invalid screenshot name');
        const output = path.join(runRoot, 'screenshots', name);
        await page.screenshot({ path: output, fullPage: true });
        console.log(JSON.stringify({ op: 'shot', path: path.relative(runRoot, output), at: new Date().toISOString() }));
      } else if (command.op === 'viewport') {
        await page.setViewportSize({ width: command.width, height: command.height });
        console.log(JSON.stringify({ op: 'viewport', width: command.width, height: command.height }));
      } else if (command.op === 'usePage') {
        page = context.pages()[command.index];
        if (!page) throw new Error('page index missing');
        console.log(JSON.stringify({ op: 'usePage', url: safeUrl(page.url()) }));
      } else if (command.op === 'goto') {
        await page.goto(command.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        console.log(JSON.stringify({ op: 'goto', url: safeUrl(page.url()) }));
      } else if (command.op === 'close') {
        await context.close();
        console.log(JSON.stringify({ op: 'close', ok: true }));
        break;
      } else {
        console.log(JSON.stringify({ error: 'unknown command' }));
      }
    } catch (error) {
      console.log(JSON.stringify({ op: command.op, error: safeText(error.message) }));
    }
  }
}

main().catch(error => { console.error(safeText(error.stack)); process.exitCode = 1; });
