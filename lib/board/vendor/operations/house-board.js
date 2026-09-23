/**
 * House board — the asynchronous room where the agents of the house, and JJ,
 * talk to each other (HOUSE-0010). It replaces the Cockpit intercom.
 *
 * Source of truth is the repository: one append-only JSONL file per thread
 * under `docs/board/`, so every word is in git, diffable and attributable.
 * The agents run as separate launchd slots and are rarely awake together, so
 * nothing here waits for a reply: an agent reads its inbox at slot start and
 * answers within its own turn.
 *
 * The shape is deliberately loose (JJ, 2026-09-14). The machine needs only
 * `from`, `to` and a free body; `tags` are optional and chosen by the writer.
 * Two rules from JJ (2026-09-16) are enforced here:
 *   - JJ and Ambrogio may read every message, open or closed, at any time.
 *     Every other agent reads a bounded inbox so a growing board does not
 *     tax every slot.
 *   - Messages are written in Italian or English, declared in `lang`.
 *
 * Messages are never deleted or edited. A thread is closed by an event that
 * signs its name, like every closure in the house.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CLOSERS } from '../core/closure-marker.js';

export const BOARD_DIR = fileURLToPath(new URL('../docs/board/', import.meta.url));
export const LANGS = Object.freeze(['it', 'en']);
export const FULL_READERS = Object.freeze(['jj', 'ambrogio']);
export const DEFAULT_WINDOW_DAYS = 30;

const THREAD_ID = /^[a-z0-9][a-z0-9-]{2,80}$/;
const KINDS = new Set(['message', 'close']);

// Function words frequent enough that any real sentence of a few words in the
// declared language contains at least one. This is a rail against a message
// silently written in a third language, not a language detector: short
// messages are exempt because "ok, fatto" proves nothing either way.
const STOPWORDS = {
  it: new Set(['il', 'lo', 'la', 'gli', 'le', 'di', 'che', 'non', 'per', 'con', 'una', 'uno', 'sono', 'del', 'della', 'nel', 'nella', 'questo', 'questa', 'anche', 'ma', 'come', 'se', 'ho', 'ha', 'è', 'e', 'al', 'alla', 'dei', 'delle', 'perché', 'più', 'già']),
  en: new Set(['the', 'of', 'and', 'to', 'is', 'in', 'that', 'it', 'for', 'on', 'with', 'this', 'was', 'are', 'not', 'be', 'have', 'has', 'we', 'i', 'you', 'a', 'an', 'but', 'from', 'what', 'which', 'there']),
};
const LANG_CHECK_MIN_WORDS = 6;

function assertActor(value, field) {
  const actor = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!CLOSERS.includes(actor)) {
    throw new Error(`board: ${field} must be one of ${CLOSERS.join(', ')} (got "${value}")`);
  }
  return actor;
}

function assertLanguage(body, lang) {
  if (!LANGS.includes(lang)) {
    throw new Error(`board: lang must be one of ${LANGS.join(', ')} — messages are written in Italian or English`);
  }
  const words = body.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  if (words.length < LANG_CHECK_MIN_WORDS) return;
  if (!words.some((word) => STOPWORDS[lang].has(word))) {
    throw new Error(`board: body does not read as ${lang === 'it' ? 'Italian' : 'English'} — messages are written in Italian or English`);
  }
}

export function validateBoardEvent(event) {
  for (const key of ['id', 'threadId', 'date', 'kind', 'from', 'body']) {
    if (typeof event?.[key] !== 'string' || !event[key].trim()) {
      throw new Error(`board: non-empty ${key} required`);
    }
  }
  if (!THREAD_ID.test(event.threadId)) throw new Error('board: threadId must be a lowercase slug');
  if (!KINDS.has(event.kind)) throw new Error('board: kind must be message or close');
  if (!Number.isFinite(Date.parse(event.date))) throw new Error('board: invalid date');
  assertActor(event.from, 'from');
  if (event.kind === 'message') {
    const recipients = Array.isArray(event.to) ? event.to : [event.to];
    if (recipients.length === 0) throw new Error('board: to required');
    for (const recipient of recipients) {
      if (recipient !== 'house') assertActor(recipient, 'to');
    }
  }
  if (event.tags !== undefined && (!Array.isArray(event.tags) || event.tags.some((tag) => typeof tag !== 'string'))) {
    throw new Error('board: tags must be an array of strings');
  }
  assertLanguage(event.body, event.lang);
  return event;
}

function threadPath(threadId, dir) {
  if (!THREAD_ID.test(threadId)) throw new Error('board: threadId must be a lowercase slug');
  return path.join(dir, `${threadId}.jsonl`);
}

function readThreadFile(filePath) {
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return raw.split('\n').filter((line) => line.trim()).map((line) => validateBoardEvent(JSON.parse(line)));
}

export function readThread(threadId, dir = BOARD_DIR) {
  const events = readThreadFile(threadPath(threadId, dir));
  return summariseThread(threadId, events);
}

function summariseThread(threadId, events) {
  const messages = events.filter((event) => event.kind === 'message');
  const closure = events.find((event) => event.kind === 'close') ?? null;
  const recipients = new Set(messages.flatMap((event) => (Array.isArray(event.to) ? event.to : [event.to])));
  return {
    threadId,
    opener: messages[0]?.from ?? null,
    recipients: [...recipients],
    participants: [...new Set(messages.map((event) => event.from))],
    lastDate: events.at(-1)?.date ?? null,
    closed: closure !== null,
    closure,
    events,
  };
}

function listThreads(dir) {
  let names;
  try { names = fs.readdirSync(dir); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return names
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => name.slice(0, -'.jsonl'.length))
    .filter((threadId) => THREAD_ID.test(threadId))
    .sort()
    .map((threadId) => readThread(threadId, dir));
}

function appendEvent(event, dir, check) {
  validateBoardEvent(event);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = threadPath(event.threadId, dir);
  // Exclusive lock stops two slots racing the idempotency check on one thread.
  const lock = `${filePath}.lock`;
  const fd = fs.openSync(lock, 'wx');
  try {
    const events = readThreadFile(filePath);
    const previous = events.find((entry) => entry.id === event.id);
    if (previous) {
      const canonical = (value) => JSON.stringify(Object.keys(value).sort().map((key) => [key, value[key]]));
      if (canonical(previous) !== canonical(event)) throw new Error('board: event id already used with different content');
      return { written: false };
    }
    check(summariseThread(event.threadId, events));
    fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`);
    return { written: true };
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lock);
  }
}

/** Post a message: opens the thread if new, replies otherwise. Idempotent on `id`. */
export function postMessage(message, dir = BOARD_DIR) {
  return appendEvent({ ...message, kind: 'message' }, dir, (thread) => {
    if (thread.closed) throw new Error(`board: thread ${thread.threadId} is closed — open a new one`);
  });
}

/**
 * Close a thread. The opener closes their own thread; Ambrogio closes
 * orphans; JJ, the supervisor, may close anything. The body is the reason.
 */
export function closeThread(closure, dir = BOARD_DIR) {
  return appendEvent({ ...closure, kind: 'close' }, dir, (thread) => {
    if (!thread.opener) throw new Error(`board: thread ${thread.threadId} does not exist`);
    if (thread.closed) throw new Error(`board: thread ${thread.threadId} is already closed`);
    const closer = closure.from.trim().toLowerCase();
    if (closer !== thread.opener && closer !== 'ambrogio' && closer !== 'jj') {
      throw new Error(`board: only ${thread.opener}, ambrogio or jj may close ${thread.threadId}`);
    }
  });
}

/**
 * An agent's bounded inbox: open threads addressed to it or to the house, or
 * that it opened, with activity inside the window.
 */
export function readInbox(agent, { now = new Date(), windowDays = DEFAULT_WINDOW_DAYS, dir = BOARD_DIR } = {}) {
  const reader = assertActor(agent, 'reader');
  const since = new Date(now).getTime() - windowDays * 86_400_000;
  return listThreads(dir).filter((thread) => !thread.closed
    && Date.parse(thread.lastDate) >= since
    && (thread.recipients.includes(reader) || thread.recipients.includes('house') || thread.opener === reader));
}

/** Every thread, open and closed, with no window. JJ and Ambrogio only. */
export function readAll(reader, { dir = BOARD_DIR } = {}) {
  const actor = assertActor(reader, 'reader');
  if (!FULL_READERS.includes(actor)) {
    throw new Error(`board: only ${FULL_READERS.join(' and ')} read the whole board; ${actor} reads its inbox`);
  }
  return listThreads(dir);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const usage = 'usage: house-board.js inbox <agent> | all <jj|ambrogio> | thread <id> | post <event.json> | close <event.json>';
  try {
    const [command, arg] = process.argv.slice(2);
    if (!arg) throw new Error(usage);
    const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
    const commands = {
      inbox: () => readInbox(arg),
      all: () => readAll(arg),
      thread: () => readThread(arg),
      post: () => postMessage(readJson(arg)),
      close: () => closeThread(readJson(arg)),
    };
    if (!commands[command]) throw new Error(usage);
    process.stdout.write(`${JSON.stringify(commands[command](), null, 2)}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
