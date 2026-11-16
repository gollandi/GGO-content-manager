import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import QuestioniPage from "../app/questioni/page";

vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../components/Registro", () => ({ Guilloche: () => null, Mark: () => null, AgeBar: () => null }));

const response = (value: unknown) => ({ ok: true, json: async () => value }) as Response;
const desk = (title: string) => ({
  desk: [{ rowId: "fixture", title, type: "question", status: "Pending", priority: "Normal", due: null,
    correction: "", body: "", videos: [], media: [], url: "" }],
  cached: false, generatedAt: "2026-09-08T10:00:00.000Z",
});
const house = { night: null, runs: { active: 0, failed: 0 }, pif: null, snapshot: null, errors: [] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
// The new panel has its own independent read; desk/house timing stays isolated.
function withPipeline(fn: (url: string) => Promise<unknown>) {
  return vi.fn((url: string) => url === "/api/pipeline/health"
    ? Promise.resolve(response({ checkedAt: "2026-09-08T10:00:00Z", configured: false, workflows: [] }))
    : fn(url));
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Questioni independent loading", () => {
  it("shows questions before the slower house summary resolves", async () => {
    const summary = deferred<Response>();
    vi.stubGlobal("fetch", withPipeline((url: string) => url.includes("/house/") ? summary.promise : Promise.resolve(response(desk("Ready question")))));
    render(<QuestioniPage />);
    expect(await screen.findByText("Ready question")).toBeTruthy();
    await act(async () => { summary.resolve(response(house)); });
  });

  it("keeps questions usable when the summary fails and labels the error", async () => {
    vi.stubGlobal("fetch", withPipeline((url: string) => Promise.resolve(url.includes("/house/") ? { ok: false, status: 503 } : response(desk("Available question")))));
    render(<QuestioniPage />);
    expect(await screen.findByText("Available question")).toBeTruthy();
    expect(await screen.findByText("Segnali della casa: 503")).toBeTruthy();
  });

  it("ignores an older response arriving after a refresh", async () => {
    const old = deferred<Response>();
    vi.stubGlobal("fetch", withPipeline((url: string) => {
      if (url.includes("/house/")) return Promise.resolve(response(house));
      return url.includes("refresh=1") ? Promise.resolve(response(desk("Current question"))) : old.promise;
    }));
    render(<QuestioniPage />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Rileggi da Notion" })); });
    expect(await screen.findByText("Current question")).toBeTruthy();
    await act(async () => { old.resolve(response(desk("Obsolete question"))); });
    expect(screen.queryByText("Obsolete question")).toBeNull();
  });

  it("cancels all three outstanding requests on navigation away", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => {
      signals.push(options.signal as AbortSignal);
      return new Promise<Response>(() => {});
    }));
    const view = render(<QuestioniPage />);
    await waitFor(() => expect(signals).toHaveLength(3));
    view.unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("says the desk is being rebuilt and asks again by itself", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", withPipeline((url: string) => {
      if (url.includes("/house/")) return Promise.resolve(response(house));
      calls += 1;
      return Promise.resolve(calls === 1
        ? { ok: false, status: 503, headers: new Headers({ "retry-after": "1" }),
            json: async () => ({ code: "CANCELLO_STATE_TIMEOUT", error: "Lo stato del Cancello non è pronto." }) } as Response
        : response(desk("Rebuilt question")));
    }));
    render(<QuestioniPage />);
    expect(await screen.findByText(/non è pronto\. Nuovo tentativo automatico tra 1 s\./)).toBeTruthy();
    expect(await screen.findByText("Rebuilt question", undefined, { timeout: 3000 })).toBeTruthy();
  });

  it("after a decision reads the desk again without forcing a full re-read", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", withPipeline((url: string) => {
      urls.push(url);
      if (url.includes("/decision")) return Promise.resolve(response({ ok: true }));
      return Promise.resolve(response(url.includes("/house/") ? house : desk("Decide me")));
    }));
    render(<QuestioniPage />);
    const title = await screen.findByText("Decide me");
    await act(async () => { fireEvent.click(title); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Approva" })); });
    await waitFor(() => expect(urls.filter((u) => u.startsWith("/api/review-dashboard/state")).length).toBe(2));
    expect(urls.some((u) => u.includes("refresh=1"))).toBe(false);
  });
});
