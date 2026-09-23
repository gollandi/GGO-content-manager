/**
 * Closure attribution — who declared a piece of work finished, and on what.
 *
 * The house could open a promise and never close one. Flags were raised and
 * never lowered, needs sat at `To do` on patches already live, Desk rows
 * stayed Approved for work long since landed. The clearance cycle of
 * 2026-08-24 measured it: twelve assets, four needs open up to 130 days,
 * eleven stale Desk rows.
 *
 * The fix is not merely a closing direction — it is a closing direction that
 * has to sign its name. JJ's ruling (2026-08-24): work is declared closed by
 * a status flip **from the responsible agent or the supervisor**. An
 * anonymous closure is the same silence in a new place, so the actor is
 * mandatory and the marker is machine-readable, following the precedent set
 * by Ettore's DISPOSITION_MARKER for raw orphans.
 *
 * Marker form, appended to the row's own evidence field:
 *
 *   [closed 2026-08-24 by edmondo: NG257 card verified live in Sanity]
 *
 * It is greppable, stable, and idempotent — re-running a reconciliation
 * appends nothing the second time.
 */

/**
 * Who may declare work closed.
 *
 * The responsible agents — the orchestrators who plan work, the specialists
 * who produce it, the maintenance and oversight family who verify it — plus
 * `jj`, the supervisor, who may close anything. Deliberately a closed roster:
 * a typo in an actor name would otherwise produce an audit trail attributing
 * a closure to nobody, which is worse than no attribution at all.
 *
 * Extend it by commit when a new agent joins the house.
 */
export const CLOSERS = Object.freeze([
  // supervisor
  'jj',
  // orchestrators
  'edmondo', 'ernesto',
  // research and production
  'berenice', 'daria', 'samantha', 'emily', 'titti', 'greta', 'ginevra',
  'jessika', 'natascia',
  // maintenance and oversight
  'ettore', 'ambrogio', 'battista', 'sibilla', 'cartografina',
]);

const MARKER_PREFIX = 'closed';

/**
 * Assert an actor is on the roster. Fails loud — an unrecognised closer is a
 * bug in the caller, not a value to coerce.
 */
export function assertCloser(closedBy) {
  if (typeof closedBy !== 'string' || closedBy.trim() === '') {
    throw new Error(
      'closedBy is required: work is declared closed by the responsible ' +
      'agent or the supervisor, never anonymously.'
    );
  }
  const actor = closedBy.trim().toLowerCase();
  if (!CLOSERS.includes(actor)) {
    throw new Error(
      `Unknown closer "${closedBy}". Must be one of: ${CLOSERS.join(', ')}. ` +
      'Add a new agent to CLOSERS by commit rather than passing a free string.'
    );
  }
  return actor;
}

/**
 * Build the closure marker. `date` is an ISO date string (YYYY-MM-DD); the
 * caller supplies it so the marker is deterministic and testable.
 */
export function formatClosure({ closedBy, evidence, date }) {
  const actor = assertCloser(closedBy);

  if (typeof evidence !== 'string' || evidence.trim() === '') {
    throw new Error(
      'evidence is required to declare work closed. State what was verified ' +
      'and where — a closure without a reason is a silent claim.'
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    throw new Error(`date must be an ISO date (YYYY-MM-DD), got "${date}".`);
  }

  return `[${MARKER_PREFIX} ${date} by ${actor}: ${evidence.trim()}]`;
}

/**
 * True when this exact marker is already present — the idempotency guard.
 * Running a reconciliation twice must not stack duplicate markers.
 */
export function hasClosure(text, marker) {
  return typeof text === 'string' && text.includes(marker);
}

/**
 * Read back every closure recorded in a field, oldest first. Used by audits
 * that ask who closed what, and by drift detection that wants to distinguish
 * a row closed on evidence from one closed by hand with no account given.
 */
export function readClosures(text) {
  if (typeof text !== 'string') return [];
  const pattern = new RegExp(
    `\\[${MARKER_PREFIX} (\\d{4}-\\d{2}-\\d{2}) by ([a-z]+): ([\\s\\S]*?)\\]`,
    'g',
  );
  const found = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    found.push({ date: match[1], closedBy: match[2], evidence: match[3] });
  }
  return found;
}
