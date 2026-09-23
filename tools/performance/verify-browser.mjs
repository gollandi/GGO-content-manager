/** Local-only production browser check; every data response is a fixture. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { encode } from 'next-auth/jwt';

const base = new URL(process.env.PERF_BASE_URL || 'http://127.0.0.1:3112');
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Fixture authentication is local-only');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
const out = path.resolve(process.env.PERF_OUTPUT_DIR || 'docs/performance/2026-09-08');
await fs.mkdir(out, { recursive: true });
const results = [];
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const token = await encode({ secret: 'content-manager-local-fixture-only', salt: 'authjs.session-token',
      token: { sub: 'fixture', email: 'fixture@example.test', name: 'Local fixture', role: 'viewer' } });
    await context.addCookies([{ name: 'authjs.session-token', value: token, url: base.origin }]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let summaryDelivered = false;
    let dataRequestedAt;
    const title = 'Verificare il calendario editoriale';
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base.origin) return route.abort();
      const json = (value) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
      if (url.pathname === '/api/auth/session') return json({ user: { email: 'fixture@example.test', name: 'Local fixture', role: 'viewer' }, expires: '2099-01-01T00:00:00Z' });
      if (url.pathname === '/api/review-dashboard/state') {
        dataRequestedAt = performance.now();
        return json({ desk: [{ rowId: 'fixture', title, type: 'question', status: 'Pending', priority: 'Normal', due: null,
          correction: '', body: 'Controllare gli slot della prossima settimana.', videos: [], media: [], url: '' }],
          cached: false, generatedAt: '2026-09-08T10:00:00Z' });
      }
      if (url.pathname === '/api/house/state') {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        summaryDelivered = true;
        return json({ night: null, runs: { active: 0, failed: 0 }, pif: null, snapshot: null, ambrogioPending: 0,
          awaiting: { total: 0, questions: 1 }, errors: [] });
      }
      // Avoid speculative navigation and all non-fixture API requests.
      if (url.pathname.startsWith('/api/') || route.request().headers()['next-router-prefetch'] || url.searchParams.has('_rsc')) return route.abort();
      return route.continue();
    });
    await page.goto(new URL('/questioni', base).href, { waitUntil: 'domcontentloaded' });
    try {
      await page.getByText(title, { exact: true }).waitFor({ timeout: 5000 });
    } catch (error) {
      console.error(JSON.stringify({ url: page.url(), pageErrors: errors, text: (await page.locator('body').innerText()).slice(0, 2000) }));
      throw error;
    }
    const questionsVisibleMs = Math.round(performance.now() - dataRequestedAt);
    assert.equal(summaryDelivered, false, 'Questions must appear before the delayed summary');
    assert.deepEqual(errors, []);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, 'The page must fit the viewport');
    await page.screenshot({ path: path.join(out, `questioni-${viewport.width}.png`), fullPage: true });
    results.push({ viewport, fixtureOnly: true, summaryDelayMs: 2500, questionsVisibleMs, summaryDeliveredAtFirstQuestions: false, pageErrors: errors, horizontalOverflow: overflow });
    await context.close();
  }
  await fs.writeFile(path.join(out, 'browser-check.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
