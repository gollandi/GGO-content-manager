/** Real Next HTTP/SSR, local synthetic state only. Run again after server restart. */
import assert from 'node:assert/strict';
import { encode } from 'next-auth/jwt';
const base = new URL(process.env.PERF_BASE_URL || 'http://127.0.0.1:3112');
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Fixture authentication is local-only');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport });
        const token = await encode({ secret: 'content-manager-local-fixture-only', salt: 'authjs.session-token',
            token: { sub: 'fixture', email: 'fixture@example.test', name: 'Local fixture', role: 'viewer' } });
        await context.addCookies([{ name: 'authjs.session-token', value: token, url: base.origin }]);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/*', (route) => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
        for (const pathname of ['/', '/questioni']) {
            const start = performance.now();
            const response = await page.goto(new URL(pathname, base).href, { waitUntil: 'domcontentloaded' });
            assert.equal(response.status(), 200);
            assert.equal(new URL(page.url()).pathname, pathname, 'Actual authenticated fixture page');
            await page.getByRole('heading', { name: pathname === '/' ? /ti aspetta/ : /Una questione aspetta/, exact: false }).waitFor({ timeout: 5000 });
            if (pathname === '/questioni') await page.getByText('Verificare il calendario editoriale', { exact: true }).waitFor({ timeout: 5000 });
            const elapsedMs = Math.round(performance.now() - start);
            assert(elapsedMs < 5000, 'A persisted projection must not wait for a Notion crawl');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
            assert.deepEqual(errors, []);
            console.log(JSON.stringify({ fixtureOnly: true, actualServerRendering: true, viewport: viewport.width, path: pathname, visibleMs: elapsedMs, pageErrors: errors }));
        }
        await context.close();
    }
} finally { await browser.close(); }
