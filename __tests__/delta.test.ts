import { describe, it, expect } from "vitest";
import { diffWords, diffText } from "../lib/delta/word-diff";
import { computeDocDelta, toComparableText } from "../lib/delta/doc-delta";

const joined = (segments: { kind: string; text: string }[], kind: string) =>
  segments.filter((s) => s.kind === kind).map((s) => s.text).join("");

describe("diffWords", () => {
  it("marks an in-place word replacement", () => {
    const segs = diffWords("the seal is red", "the seal is oxblood");
    expect(joined(segs, "del")).toBe("red");
    expect(joined(segs, "add")).toBe("oxblood");
    expect(joined(segs, "same")).toBe("the seal is ");
  });

  it("returns one same segment for identical input", () => {
    expect(diffWords("unchanged text", "unchanged text")).toEqual([
      { kind: "same", text: "unchanged text" },
    ]);
  });
});

describe("diffText", () => {
  it("keeps untouched paragraphs whole and word-diffs the changed one", () => {
    const pre = "First paragraph.\nThe dose is 5mg daily.\nLast paragraph.";
    const post = "First paragraph.\nThe dose is 10mg daily.\nLast paragraph.";
    const segs = diffText(pre, post);
    expect(joined(segs, "del")).toBe("5mg");
    expect(joined(segs, "add")).toBe("10mg");
    expect(joined(segs, "same")).toContain("First paragraph.");
    expect(joined(segs, "same")).toContain("Last paragraph.");
  });

  it("reports a new paragraph as a whole addition", () => {
    const segs = diffText("One.\nTwo.", "One.\nNew middle.\nTwo.");
    expect(joined(segs, "add")).toBe("\nNew middle.");
    expect(joined(segs, "del")).toBe("");
  });

  it("round-trips: concatenating same+add equals post, same+del equals pre", () => {
    const pre = "alpha beta\ngamma\ndelta epsilon";
    const post = "alpha bravo\ndelta epsilon zeta";
    const segs = diffText(pre, post);
    const rebuiltPost = segs.filter((s) => s.kind !== "del").map((s) => s.text).join("");
    const rebuiltPre = segs.filter((s) => s.kind !== "add").map((s) => s.text).join("");
    expect(rebuiltPost).toBe(post);
    expect(rebuiltPre).toBe(pre);
  });

  it("handles empty pre (all added)", () => {
    expect(diffText("", "fresh text")).toEqual([{ kind: "add", text: "fresh text" }]);
  });
});

describe("toComparableText", () => {
  it("flattens portable text through the preview walker", () => {
    const blocks = [
      { _type: "block", style: "normal", children: [{ text: "Hello " }, { text: "world" }] },
    ];
    expect(toComparableText(blocks)).toBe("Hello world");
  });

  it("reads a slug object as its current value", () => {
    expect(toComparableText({ current: "varicocele" })).toBe("varicocele");
  });

  it("flattens nested objects to key: value lines, skipping system keys", () => {
    expect(toComparableText({ _type: "seo", metaTitle: "T", noIndex: false })).toBe(
      "metaTitle: T\nnoIndex: false"
    );
  });
});

describe("computeDocDelta", () => {
  const published = {
    _id: "abc",
    _rev: "r1",
    title: "Varicocele",
    description: "Old description",
    legacy: "kept only on published",
  };
  const draft = {
    _id: "drafts.abc",
    _rev: "r2",
    title: "Varicocele",
    description: "New description",
    extra: "only on draft",
  };

  it("returns changed, added and removed fields — never system fields", () => {
    const deltas = computeDocDelta(draft, published);
    expect(deltas.map((d) => `${d.field}:${d.kind}`)).toEqual([
      "description:changed",
      "extra:added",
      "legacy:removed",
    ]);
  });

  it("treats every field of an orphan draft as added", () => {
    const deltas = computeDocDelta(draft, null);
    expect(deltas.every((d) => d.kind === "added")).toBe(true);
  });

  it("returns nothing for an identical pair", () => {
    expect(computeDocDelta({ title: "Same" }, { title: "Same" })).toEqual([]);
  });
});
