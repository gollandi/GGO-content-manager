/** Local fixture-only browser review. No production session or write requests. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { encode } from 'next-auth/jwt';
const base = new URL(process.env.PERF_BASE_URL || 'http://127.0.0.1:3114');
assert(['localhost', '127.0.0.1'].includes(base.hostname), 'Fixture authentication must remain local');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
const out = path.resolve('docs/briefings/2026-09-09');
await fs.mkdir(out, { recursive: true });
const results = [];
const paragraphs = [
  'La notte ha lasciato materiale pronto per la revisione, ma il calendario resta da completare. Il punto da valutare è se le proposte rispondano alle priorità editoriali: il semplice completamento delle attività non basta a dimostrarlo.',
  'Un accesso esterno ha interrotto parte del lavoro. I dati disponibili non chiariscono ancora la causa; prima di considerare concluso il passaggio occorre verificare la connessione e l’esito del tentativo.',
  'A te resta la valutazione dei testi e delle fonti. La preparazione può proseguire nei limiti già autorizzati, mentre il via libera alla pubblicazione passa dalla review dei contenuti effettivi.',
];
const narrative = { paragraphs, status: 'ready', generatedAt: new Date().toISOString() };
const handoff = { ...narrative, paragraphs: ['La bozza preparata è disponibile nel pannello di revisione. Il prossimo passaggio è controllare che il testo completo e le fonti rispondano al bisogno editoriale.', 'Il registro descrive materiale preparato; non documenta una pubblicazione. La decisione sui contenuti finali resta nella review umana.'] };
const draftText = 'TESTO INTEGRALE DA APPROVARE: questa proposta resta visibile senza riassumerla.';
const meta = { runId: 'fixture', title: 'Proposta editoriale di prova', status: 'awaiting-jj', updatedAt: new Date().toISOString(),
  drafts: [], science: [], proposal: { proposalMarkdown: draftText, deliverables: [], interactiveSections: [] },
  proposalApproved: false, summary: '- RAW_HANDOFF_LOG original record\n- second record' };
try {
  for (const viewport of [{ width: 1280, height: 950 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const token = await encode({ secret: 'content-manager-local-fixture-only', salt: 'authjs.session-token',
      token: { sub: 'fixture', email: 'fixture@example.test', name: 'Local fixture', role: 'viewer' } });
    await context.addCookies([{ name: 'authjs.session-token', value: token, url: base.origin }]);
    const page = await context.newPage(); const errors = []; const writes = []; let briefReads = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.origin !== base.origin) return route.abort();
      if (request.method() !== 'GET') { writes.push(url.pathname); return route.abort(); }
      const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      if (url.pathname === '/api/auth/session') return json({ user: { email: 'fixture@example.test', role: 'viewer' }, expires: '2099-01-01T00:00:00Z' });
      if (url.pathname === '/api/house/state') return json({ awaiting: { total: 1, questions: 1 }, night: null, runs: { active: 0, failed: 0 }, pif: null, snapshot: null, errors: [] });
      if (url.pathname === '/api/ernesto/operations') return json({ activity: [], media: [], desk: [], errors: [], generatedAt: new Date().toISOString() });
      if (url.pathname === '/api/ernesto/brief') {
        briefReads += 1;
        return json({ configured: true, url: 'https://notion.so/fixture', lastEditedAt: new Date().toISOString(),
          markdown: '# Fonte originale\n- RAW_BRIEF_LOG first record\n' + Array.from({ length: 120 }, (_, index) => `- Technical record ${index}`).join('\n'),
          narrative: briefReads === 1 ? { paragraphs: ['Il quadro essenziale segnala una decisione ancora aperta. La sintesi approfondita è in preparazione.'], status: 'pending', generatedAt: null } : narrative });
      }
      if (url.pathname === '/api/ernesto/runs') return json({ runs: [meta] });
      if (url.pathname === '/api/ernesto/runs/fixture') return url.searchParams.has('summary') ? json({ narrative: handoff }) : json({ meta,
        events: [{ type: 'text', text: 'Ho confrontato le informazioni disponibili. La proposta qui sopra resta da esaminare prima di procedere.' },
          { type: 'tool.use', name: 'read_view', summary: 'RAW_TOOL_LOG fixture' },
          { type: 'jj.asked', question: 'Quale aspetto vuoi approfondire?' }] });
      if (url.pathname === '/api/ernesto/operations/daily-report') return json({ days: [{ date: '2026-09-09', narrative: { ...handoff }, prose: handoff.paragraphs.join('\n\n'), proseError: null,
        runs: [{ id: 'cron', run: 'fixture', job: 'produce', status: 'Success', startedAt: new Date().toISOString(), durationMs: 2000, rowsWritten: 1, errors: 0, summary: 'RAW_DAILY_LOG record', errorMessage: '', triggeredBy: 'cron' }],
        counts: { total: 1, ok: 1, attention: 0, rowsWritten: 1 } }], generatedAt: new Date().toISOString() });
      if (url.pathname.startsWith('/api/')) return json({});
      return route.continue();
    });
    await page.goto(new URL('/casa-di-ernesto?run=fixture', base).href, { waitUntil: 'domcontentloaded' });
    await page.getByText('Il quadro essenziale segnala una decisione ancora aperta. La sintesi approfondita è in preparazione.', { exact: true }).waitFor();
    await page.getByText(paragraphs[0], { exact: true }).waitFor({ timeout: 10_000 });
    assert(briefReads >= 2, 'Pending narrative updates automatically');
    assert.equal(await page.getByText('RAW_BRIEF_LOG first record', { exact: true }).isVisible(), false);
    assert.equal(await page.getByText(/RAW_TOOL_LOG/).isVisible(), false);
    assert.equal(await page.getByText('RAW_HANDOFF_LOG original record', { exact: true }).isVisible(), false);
    await page.getByText(draftText, { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'No horizontal overflow');
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    const card = page.locator('section').filter({ has: page.getByText('Brief del mattino', { exact: true }) });
    await card.screenshot({ path: path.join(out, `morning-${viewport.width}.png`) });
    await page.screenshot({ path: path.join(out, `cockpit-${viewport.width}.png`), fullPage: true });
    await page.getByText('Testo originale e riferimenti', { exact: true }).click();
    assert.equal(await page.getByText('RAW_BRIEF_LOG first record', { exact: true }).isVisible(), true, 'Original remains available');
    results.push({ fixtureOnly: true, viewport, automaticNarrativeUpdate: true, originalCollapsedInitially: true, originalAccessible: true, fullReviewTextPreserved: true, pageErrors: errors, writes });
    await context.close();
  }
  await fs.writeFile(path.join(out, 'browser-check.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
