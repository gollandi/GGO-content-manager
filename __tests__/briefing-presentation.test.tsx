import React from "react";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MorningBrief from "../components/MorningBrief";
import { RunConversation } from "../components/RunConversation";
import { usePreparedBrief } from "../lib/briefing/use-prepared-brief";
const paragraphs = ["La produzione ha preparato una bozza che resta da valutare. Le fonti devono essere controllate prima del via libera.", "Una decisione è ancora aperta. La lettura del testo serve a stabilire se la proposta risponde al bisogno editoriale."];
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("readable brief presentation", () => {
    it("opens on paragraphs and keeps the entire original behind an explicit disclosure", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ configured: true, url: "https://notion.so/fixture", lastEditedAt: new Date().toISOString(),
            markdown: "# Raw source\n- ORIGINAL RAW LOG\n- second record", narrative: { paragraphs, status: "ready", generatedAt: new Date().toISOString() } })));
        render(<MorningBrief />);
        await screen.findByText(paragraphs[0]);
        expect(screen.getByText(paragraphs[1]).tagName).toBe("P");
        expect(screen.getByText("ORIGINAL RAW LOG").closest("details")).not.toHaveAttribute("open");
        expect(screen.getByText(paragraphs[0]).closest("details")).toBeNull();
        expect(screen.getByRole("link", { name: "Apri in Notion" })).toHaveAttribute("href", "https://notion.so/fixture");
    });
    it("keeps the human question visible while retaining tool telemetry outside the conversation", () => {
        render(<RunConversation endRef={React.createRef<HTMLDivElement>()} rows={[
            { key: 1, kind: "text", text: paragraphs[0] },
            { key: 2, kind: "tool", text: "RAW_TOOL_TRACE file=/srv/fixture status=ok" },
            { key: 3, kind: "status", text: "Fonte registrata: technical reference" },
            { key: 4, kind: "status", text: "❓ Quale proposta vuoi approfondire?" },
        ]} />);
        expect(screen.getByText("❓ Quale proposta vuoi approfondire?").closest("details")).toBeNull();
        expect(screen.getByText(/RAW_TOOL_TRACE/).closest("details")).not.toHaveAttribute("open");
        expect(screen.getByText(/Fonte registrata/).closest("details")).not.toHaveAttribute("open");
    });
    it("does not let an old request overwrite a newer reread, even if transport ignores cancellation", async () => {
        let release!: (value: Response) => void;
        const first = new Promise<Response>((resolve) => { release = resolve; });
        vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(first).mockResolvedValue(Response.json({ label: "new" })));
        const pending = () => false;
        const hook = renderHook(({ url }) => usePreparedBrief<{ label: string }>(url, pending), { initialProps: { url: "/old" } });
        hook.rerender({ url: "/new" });
        await waitFor(() => expect(hook.result.current.data?.label).toBe("new"));
        await act(async () => { release(Response.json({ label: "old" })); });
        expect(hook.result.current.data?.label).toBe("new");
    });
    it("updates a pending factual account automatically and stops polling on unmount", async () => {
        vi.useFakeTimers();
        const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ status: "pending" })).mockResolvedValue(Response.json({ status: "ready" }));
        vi.stubGlobal("fetch", fetcher);
        const pending = (data: { status: string }) => data.status === "pending";
        const hook = renderHook(() => usePreparedBrief("/brief", pending));
        await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
        expect(hook.result.current.data?.status).toBe("pending"); expect(hook.result.current.loading).toBe(false);
        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        expect(hook.result.current.data?.status).toBe("ready");
        hook.unmount(); await vi.advanceTimersByTimeAsync(10_000);
        expect(fetcher).toHaveBeenCalledTimes(2);
    });
});
