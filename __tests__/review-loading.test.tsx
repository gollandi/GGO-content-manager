import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import ReviewPage from "../app/review/page";

vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../components/Registro", () => ({ Guilloche: () => null, Socket: () => null, Mark: () => null, AgeBar: () => null }));
vi.mock("../components/SnapshotFreshness", () => ({ SnapshotFreshness: () => null }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { role: "admin" } }, status: "authenticated" }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const empty = { wall: [], desk: [], calendar: [], website: [], generatedAt: "2026-11-16T10:00:00.000Z", cached: false, warnings: [] };
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    ({ ok: status < 400, status, headers: new Headers(headers), json: async () => body }) as Response;

it("Il Cancello says its state is being rebuilt and asks again by itself", async () => {
    const answers = [
        reply(503, { code: "CANCELLO_STATE_TIMEOUT", error: "Lo stato del Cancello non è pronto." }, { "retry-after": "1" }),
        // nginx's own page while the service restarts: not JSON.
        { ok: false, status: 504, headers: new Headers({ "retry-after": "1" }),
          json: async () => { throw new SyntaxError("Unexpected token <"); } } as unknown as Response,
        reply(200, empty),
    ];
    const fetch = vi.fn(async () => answers.shift()!);
    vi.stubGlobal("fetch", fetch);
    render(<ReviewPage />);
    expect(await screen.findByText(/non è pronto\. Nuovo tentativo automatico tra 1 s\./)).toBeTruthy();
    // A proxy page that is not JSON keeps the retry going instead of stopping it.
    expect(await screen.findByText(/non disponibile \(504\) Nuovo tentativo automatico tra 1 s\./, undefined, { timeout: 3000 })).toBeTruthy();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3), { timeout: 5_000 });
    await vi.waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
}, 15_000);

it("an older read failing after a newer one succeeded does not cover the fresh state", async () => {
    let failOld!: (r: Response) => void;
    const old = new Promise<Response>((resolve) => { failOld = resolve; });
    const fetch = vi.fn()
        .mockImplementationOnce(() => old)
        .mockImplementationOnce(async () => reply(200, empty));
    vi.stubGlobal("fetch", fetch);
    render(<ReviewPage />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Rileggi da Notion" })); });
    await act(async () => { failOld(reply(500, { error: "Snapshot invalidated; retry the read" })); });
    expect(screen.queryByRole("alert")).toBeNull();
});

it("a 200 whose body is cut off is reported and asked again, not shown as an empty register", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(),
        json: async () => { throw new SyntaxError("Unexpected end of JSON input"); } }) as unknown as Response));
    render(<ReviewPage />);
    expect(await screen.findByText(/risposta incompleta.*Nuovo tentativo automatico tra 30 s\./i)).toBeTruthy();
});

