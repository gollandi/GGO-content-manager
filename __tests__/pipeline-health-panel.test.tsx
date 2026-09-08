import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import PipelineHealthPanel from "../components/PipelineHealthPanel";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps absent measurements distinct from zero and offers the exact run", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        checkedAt: "2026-09-08T10:00:00Z",
        configured: true,
        workflows: [
          {
            name: "Sincronizzazione completa",
            mode: "full",
            state: "unverified",
            workflowState: "active",
            report: null,
            lastRunAt: "2026-09-06T04:18:22Z",
            runUrl: "https://github.com/GGO-Med/notion-integration/actions/runs/42",
            stale: false,
            message: "Report assente",
          },
        ],
      }),
    })
  );
  render(<PipelineHealthPanel />);
  expect(await screen.findByText("Report assente")).toBeTruthy();
  expect(screen.getAllByText("Non misurato").length).toBeGreaterThan(0);
  expect(screen.getByRole("link", { name: /Apri esecuzione/ }).getAttribute("href")).toContain(
    "/runs/42"
  );
  fireEvent.click(screen.getByRole("button", { name: "Aggiorna stato" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
});
it("does not retain a healthy card after a failed refresh", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
  render(<PipelineHealthPanel />);
  expect(await screen.findByText(/Stato non disponibile/)).toBeTruthy();
  expect(screen.queryByText("Verificata")).toBeNull();
});

it("cancels the pipeline request when leaving the page", async () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    })
  );
  const view = render(<PipelineHealthPanel />);
  await waitFor(() => expect(signal).toBeDefined());
  view.unmount();
  expect(signal?.aborted).toBe(true);
});
it("treats malformed JSON shapes as unavailable rather than crashing the page", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ desk: [] }) }));
  render(<PipelineHealthPanel />);
  expect(await screen.findByText(/Stato non disponibile/)).toBeTruthy();
});
