/**
 * JJ's send orders: the calendar rows his approval has cleared for Buffer.
 *
 * Since 27 November 2026 JJ's approval is the order to send, whoever proposed
 * the post. The click sends at once when the house has already staged the
 * drafts; otherwise the Buffer sweep sends the row once staging lands, and
 * needs to know that JJ approved it under this rule. That knowledge lives
 * here, on the cockpit's own disk beside the user store, written only by the
 * admin's decision path. It is deliberately not read from Notion: the row's
 * `Notes` are free text that several house writers append to, so a line there
 * can be written by something other than JJ's click. The notes keep his
 * signed line for the history only.
 *
 * An order is withdrawn by any later decision of his on the row (send back,
 * reject, close, delete), and dropped once the row has been handed off.
 * Approvals made before this store existed are not in it, so rows approved
 * under the old rule keep needing "Invia a Buffer".
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { authDir } from "../auth/users";

export interface SendOrder {
    rowId: string;
    /** When JJ approved, ISO. */
    approvedAt: string;
    /** The admin account that approved. */
    by: string;
}

interface OrdersFile { version: 1; orders: SendOrder[] }

const ordersPath = () => path.join(authDir(), "send-orders.json");
const norm = (rowId: string) => rowId.replace(/-/g, "").toLowerCase();

function read(): OrdersFile {
    const p = ordersPath();
    if (!existsSync(p)) return { version: 1, orders: [] };
    const parsed = JSON.parse(readFileSync(p, "utf8")) as Partial<OrdersFile>;
    // Fail loud: a corrupt store must not silently become "no orders" (rows
    // would wait unseen) nor be overwritten by the next write.
    if (parsed?.version !== 1 || !Array.isArray(parsed.orders)) {
        throw new Error(`send-order store ${p} is not a version-1 store`);
    }
    return { version: 1, orders: parsed.orders };
}

function write(file: OrdersFile): void {
    const p = ordersPath();
    mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
    const tmp = `${p}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(file, null, 2) + "\n", { mode: 0o600 });
    renameSync(tmp, p);
}

/** Record JJ's approval of a row as an order to send it. Idempotent. */
export function recordSendOrder(rowId: string, by: string, at = new Date()): void {
    const file = read();
    const others = file.orders.filter((o) => norm(o.rowId) !== norm(rowId));
    write({ version: 1, orders: [...others, { rowId, approvedAt: at.toISOString(), by }] });
}

/** Withdraw the order (a later decision of JJ's, or the row has gone out). */
export function withdrawSendOrder(rowId: string): void {
    const file = read();
    const kept = file.orders.filter((o) => norm(o.rowId) !== norm(rowId));
    if (kept.length !== file.orders.length) write({ version: 1, orders: kept });
}

export function hasSendOrder(rowId: string): boolean {
    return read().orders.some((o) => norm(o.rowId) === norm(rowId));
}

export function sendOrderIds(): Set<string> {
    return new Set(read().orders.map((o) => norm(o.rowId)));
}

export const sendOrderKey = norm;
