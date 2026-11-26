// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/sanity/clients", () => ({ ggomedRawClient: { fetch: vi.fn() } }));
import { classifyMediaFormat, preferDrafts } from "../lib/cancello/state";

describe("one version per staged post", () => {
    it("takes the draft where there is one, else the published document, never both, in Sanity Sync order", () => {
        const docs = [{ _id: "a", v: "old" }, { _id: "drafts.a", v: "new" }, { _id: "b", v: "only" }];
        expect(preferDrafts(docs, ["b", "a"]).map((d) => d.v)).toEqual(["only", "new"]);
        expect(preferDrafts(docs, ["missing"])).toEqual([]);
    });
});

describe("media kept as staging keeps them", () => {
    it("classifies by the Media Asset's Format, as classifyMediaFormat does", () => {
        expect(classifyMediaFormat(".PNG")).toBe("image");
        expect(classifyMediaFormat(".svg")).toBe("image");
        expect(classifyMediaFormat(".webp")).toBe("other");
        expect(classifyMediaFormat(".mov")).toBe("video");
        expect(classifyMediaFormat(null)).toBe("other");
    });
});
