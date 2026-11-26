#!/usr/bin/env node
/**
 * Turn a contract's onboarding copy (Markdown, written with the contract)
 * into the JSON the cockpit reads: welcome, how we work, one card per
 * contract section with its plain-English summary, the exact acceptance
 * wording, and the countersignature wording.
 *
 *   node tools/contracts/copy-to-json.mjs <copy.md> > <contract-dir>/v<version>.copy.json
 *
 * The output, like the contract, belongs on the server beside the user
 * store, never in git: it names the contractor's business.
 *
 * The Done text and the countersignature wording come from the copy (v1.2
 * on); older copies without them get the cockpit's own wording.
 */
import fs from 'node:fs';

const md = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n?/g, '\n');
const section = (n) => {
  const m = new RegExp(`^## ${n}\\.[^\\n]*\\n([\\s\\S]*?)(?=^## \\d+\\.|$(?![\\s\\S]))`, 'm').exec(md);
  if (!m) throw new Error(`copy has no section ${n}`);
  return m[1];
};
const strip = (s) => s.replace(/\*\*/g, '').trim();
const quoted = (s) => (/"([^"]+)"/.exec(s) || [])[1];

const flow = section(1).split('\n').filter((l) => /^\d+\. /.test(l));
const welcome = quoted(flow[0]);
if (!welcome) throw new Error('no welcome text');
const how = flow[1].replace(/^\d+\.\s*\*\*[^*]+\*\*\s*/, '');
const howWeWork = how.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);

const keys = (col) => col.split(/,\s*/).flatMap((part) => {
  const sched = /^Schedules?\s+(\d+)(?:-(\d+))?/i.exec(part);
  if (sched) {
    const a = Number(sched[1]); const b = Number(sched[2] ?? sched[1]);
    return Array.from({ length: b - a + 1 }, (_, i) => `Schedule ${a + i}`);
  }
  const num = /^(\d+)\b/.exec(part);
  return [num ? num[1] : part.trim()];
});
const cards = section(2).split('\n').filter((l) => l.startsWith('| ') && !/^\|\s*(Contract section|---)/.test(l))
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
  .map(([col, title, summary]) => ({ title, sections: keys(col), summary: strip(summary) }));

const quote = section(3).split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, '')).filter(Boolean);
const acceptance = {
  heading: strip(quote[0]),
  checkboxes: quote.filter((l) => l.startsWith('☐')).map((l) => l.replace(/^☐\s*/, '').trim()),
  namePrompt: quote.find((l) => l.startsWith('Type your full name')).replace(/\[[\s_]*\]/, '').trim(),
  intent: quote.find((l) => l.startsWith('By selecting') && !l.includes('on behalf of GGO Med Ltd')),
  button: quote.find((l) => /^\[ .* \]$/.test(l)).replace(/^\[\s*|\s*\]$/g, ''),
};
if (acceptance.checkboxes.length !== 3 || !acceptance.intent) throw new Error('acceptance block not understood');

const out = {
  welcome,
  howWeWork,
  cards,
  acceptance,
  done: (flow[4] && quoted(flow[4])) || 'Thank you. Your tools are now unlocked. Your signed copy is in the Guide, to download whenever you need it.',
  countersign: {
    intent: quote.find((l) => l.includes('on behalf of GGO Med Ltd') && l.startsWith('By selecting'))
      || 'By selecting "I accept and sign on behalf of GGO Med Ltd", I agree that GGO Med Ltd is legally bound by this agreement and I intend my typed name and this action to be my electronic signature as its director.',
    button: 'I accept and sign on behalf of GGO Med Ltd as its director',
  },
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
