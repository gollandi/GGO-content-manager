import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ReviewPage from "../app/review/page";

vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../components/Registro", () => ({
    Guilloche: () => null, Socket: () => null, AgeBar: () => null,
    Mark: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("../components/SnapshotFreshness", () => ({ SnapshotFreshness: () => null }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { role: "social", name: "Diletta" } }, status: "authenticated" }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const row = (over: Record<string, unknown>) => ({
    rowId: "r1", title: "Varicocele: three signs", contentType: "Carousel", status: "Review", platforms: "Instagram",
    date: "2026-11-28", variant: null, caption: "Caption", hashtags: "#x", canva: null, hasAssets: false, media: [],
    url: "https://notion.so/r1", sourceUrl: null, createdAt: "2026-11-25", orderedBy: "Team", sanitySync: "",
    notes: "[page-story:abc@2026-11-01]\n[2026-11-26 09:12 · JJ] Keep the tone calm.", ...over,
});
const state = {
    wall: [], desk: [], website: [], generatedAt: "2026-11-26T10:00:00.000Z", cached: false, warnings: [],
    calendar: [row({}), row({ rowId: "r2", title: "Approved one", status: "Approved", sanitySync: "x" })],
};

it("offers the social media manager the three speaking acts and none of JJ's", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => state }) as Response));
    render(<ReviewPage />);
    expect(await screen.findByText("One post is waiting for review")).toBeTruthy();
    // The approved, staged row waiting for Buffer is JJ's business.
    expect(screen.queryByText("Approved one")).toBeNull();

    fireEvent.click(screen.getByText("Varicocele: three signs"));
    // The document renders as the desktop leaf and the phone sheet, hence getAll.
    expect(screen.getAllByRole("button", { name: "Ready for JJ" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Add note" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Send back" }).length).toBeGreaterThan(0);
    for (const label of [/Sigilla/, /Rifiuta/, /archivia/, /Elimina/, /Invia a Buffer/, /Apri in Notion/, /Le Questioni/]) {
        expect(screen.queryByText(label)).toBeNull();
    }
    // The people's notes are shown; the house's machine markers are not.
    expect(screen.getAllByText(/Keep the tone calm/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/page-story/)).toBeNull();
    // The note box starts empty rather than holding the history.
    for (const box of screen.getAllByPlaceholderText(/What should change/)) expect((box as HTMLInputElement).value).toBe("");
});
