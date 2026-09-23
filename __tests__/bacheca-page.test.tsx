import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BachecaPage from "../app/bacheca/page";
import type { BoardView } from "../lib/board/types";

vi.mock("../components/Registro", () => ({
    Document: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    RegisterHeading: ({ label, action }: { label: string; action?: React.ReactNode }) => <h2>{label}{action}</h2>,
    RoomCrest: () => null,
}));

const board: BoardView = {
    syncedAt: new Date().toISOString(),
    roster: ["jj", "edmondo", "ettore", "ambrogio"],
    rejected: [],
    threads: [
        {
            threadId: "coda-riparata", opener: "ettore", recipients: ["edmondo"], participants: ["ettore"], tags: ["repair"],
            lastDate: "2026-09-16T10:00:00Z", closed: false, closedBy: null, pending: false,
            events: [{ id: "e1", threadId: "coda-riparata", date: "2026-09-16T10:00:00Z", kind: "message", from: "ettore", to: "edmondo", lang: "en", body: "The queue is clean.", pending: false }],
        },
        {
            threadId: "vecchia-questione", opener: "ambrogio", recipients: ["house"], participants: ["ambrogio"], tags: [],
            lastDate: "2026-09-10T10:00:00Z", closed: true, closedBy: "ambrogio", pending: false,
            events: [{ id: "a1", threadId: "vecchia-questione", date: "2026-09-10T10:00:00Z", kind: "message", from: "ambrogio", to: "house", lang: "it", body: "Chiusa.", pending: false }],
        },
    ],
};

const ok = (value: unknown, status = 200) => ({ ok: status < 400, status, json: async () => value }) as Response;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("La Bacheca", () => {
    it("lists open and closed threads and filters them", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ok(board)));
        render(<BachecaPage />);
        expect(await screen.findByText("coda-riparata")).toBeTruthy();
        expect(screen.getByText("vecchia-questione")).toBeTruthy();

        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "closed" } });
        expect(screen.queryByText("coda-riparata")).toBeNull();
        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "all" } });
        fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "repair" } });
        expect(screen.queryByText("vecchia-questione")).toBeNull();
        fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "" } });
        fireEvent.change(screen.getByLabelText("Agent"), { target: { value: "ambrogio" } });
        expect(screen.queryByText("coda-riparata")).toBeNull();
        expect(screen.getByText("vecchia-questione")).toBeTruthy();
    });

    it("replies as JJ to the opener, in Italian by default for Italian threads, and reuses the id on retry", async () => {
        const posts: Record<string, unknown>[] = [];
        let fail = true;
        vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
            if (init?.method !== "POST") return ok(board);
            posts.push(JSON.parse(String(init.body)));
            if (fail) { fail = false; return ok({ error: "board: body does not read as English" }, 422); }
            return ok({ queued: true }, 201);
        }));
        render(<BachecaPage />);
        fireEvent.click(await screen.findByText("coda-riparata"));
        fireEvent.change(screen.getByLabelText("Reply"), { target: { value: "Thank you, that is good news for the queue." } });
        fireEvent.click(screen.getByText("Reply as JJ"));
        expect(await screen.findByRole("alert")).toBeTruthy();
        fireEvent.click(screen.getByText("Reply as JJ"));
        await waitFor(() => expect(posts).toHaveLength(2));
        expect(posts[0]).toMatchObject({ mode: "reply", threadId: "coda-riparata", to: ["ettore"], lang: "en" });
        expect(posts[0]).not.toHaveProperty("from");
        expect(posts[1].id).toBe(posts[0].id);
    });

    it("opens a thread with a slug from the title, Italian by default, and offers no close on closed threads", async () => {
        const posts: Record<string, unknown>[] = [];
        vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
            if (init?.method === "POST") { posts.push(JSON.parse(String(init.body))); return ok({ queued: true }, 201); }
            return ok(board);
        }));
        render(<BachecaPage />);
        fireEvent.click(await screen.findByText("vecchia-questione"));
        expect(screen.queryByText("Close as JJ")).toBeNull();

        fireEvent.click(screen.getByText("Write"));
        fireEvent.change(screen.getByLabelText("Thread"), { target: { value: "Perché la coda è ferma?" } });
        expect(screen.getByText("perche-la-coda-e-ferma")).toBeTruthy();
        fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Ditemi cosa succede." } });
        fireEvent.click(screen.getByText("Pin to the board"));
        await waitFor(() => expect(posts).toHaveLength(1));
        expect(posts[0]).toMatchObject({ mode: "open", threadId: "perche-la-coda-e-ferma", to: ["house"], lang: "it" });
    });
});
