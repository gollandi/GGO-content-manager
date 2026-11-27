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
    date: "2026-11-28", variant: null, caption: "Caption", hashtags: "#x", canva: null, hasAssets: true,
    url: "https://notion.so/r1", sourceUrl: null, createdAt: "2026-11-25", orderedBy: "Team", sanitySync: "",
    notes: "[page-story:abc@2026-11-01]\n[2026-11-26 09:12 · JJ] Keep the tone calm.",
    media: [
        { kind: "image", url: "/media?path=%2Fsrv%2Fggomed-media%2FIMG_5416-slide-one.png" },
        { kind: "image", url: "/media?path=%2Fsrv%2Fggomed-media%2FIMG_5417-slide-two.png" },
    ], ...over,
});
const state = {
    wall: [], desk: [], website: [], generatedAt: "2026-11-26T10:00:00.000Z", cached: false, warnings: [],
    calendar: [row({}), row({ rowId: "r2", title: "Approved one", status: "Approved", sanitySync: "x" })],
};

it("offers the social media manager the three speaking acts and none of JJ's", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => state }) as Response));
    render(<ReviewPage />);
    expect(await screen.findByText("Un post è in attesa di revisione")).toBeTruthy();
    // The approved, staged row waiting for Buffer is JJ's business.
    expect(screen.queryByText("Approved one")).toBeNull();

    fireEvent.click(screen.getByText("Varicocele: three signs"));
    // The document renders as the desktop leaf and the phone sheet, hence getAll.
    expect(screen.getAllByRole("button", { name: "Pronto per JJ" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Aggiungi nota" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Chiedi modifiche" }).length).toBeGreaterThan(0);
    for (const label of [/Sigilla/, /Rifiuta/, /archivia/, /Elimina/, /Invia a Buffer/, /Apri in Notion/, /Le Questioni/, /Timbra/, /Send back/]) {
        expect(screen.queryByText(label)).toBeNull();
    }
    // The people's notes are shown; the house's machine markers are not.
    expect(screen.getAllByText(/Keep the tone calm/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/page-story/)).toBeNull();
    // The post as it goes out: the exact text, where and when — and no internal labels.
    expect(screen.getAllByText((_, el) => el?.textContent === "Caption\n\n#x" && el.tagName === "DIV").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Instagram/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Social")).toBeNull();
    expect(screen.queryByText(/Ordered by|Allegato|\.png|\.mp4|IMG_|Notion|Sanity|Carousel ·|Ordine/)).toBeNull();
    // The slides are there, in order, described without their file names.
    const slides = screen.getAllByRole("img").filter((el) => (el.getAttribute("src") ?? "").includes("slide-"));
    expect(slides.length).toBeGreaterThanOrEqual(2);
    expect(slides[0].getAttribute("src")).toContain("slide-one");
    for (const s of slides) expect(s.getAttribute("alt") ?? "").not.toMatch(/IMG_|\.png/);
    expect(screen.getAllByText(/Immagine 1 di 2|1 \/ 2/).length).toBeGreaterThan(0);
    // The note box starts empty rather than holding the history.
    for (const box of screen.getAllByPlaceholderText(/Cosa va cambiato/)) expect((box as HTMLInputElement).value).toBe("");
});
