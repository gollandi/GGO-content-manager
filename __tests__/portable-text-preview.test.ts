// @vitest-environment node
import { describe, expect, it } from "vitest";
import { draftEssence, portableTextToPlainText } from "../lib/portable-text/preview";

describe("portable text preview", () => {
    it("renders nested editorial blocks consistently", () => {
        const text = portableTextToPlainText([
            { _type: "block", style: "h2", children: [{ text: "Main title" }] },
            {
                _type: "accordionBlock",
                title: "Questions",
                items: [{ title: "First", content: [{ _type: "block", children: [{ text: "Answer text" }] }] }],
            },
            { _type: "faqInlineBlock", faqs: [{ _ref: "faq-1" }, { _ref: "faq-2" }] },
            { _type: "linkCardBlock", title: "Source", href: "https://example.test" },
        ]);

        expect(text).toContain("[h2] Main title");
        expect(text).toContain("[accordion: Questions]");
        expect(text).toContain("First");
        expect(text).toContain("Answer text");
        expect(text).toContain("[faqInlineBlock: 2 FAQ refs]");
        expect(text).toContain("[link card: Source -> https://example.test]");
    });

    it("includes governance references in draft essence", () => {
        const essence = draftEssence({
            _type: "dedicatedPage",
            title: "Laser",
            slug: { current: "laser" },
            content: [{ _type: "ctaBannerBlock", title: "Book" }],
            pifTickGovernance: {
                references: [{ title: "Guideline", source: "NICE", url: "https://nice.test" }],
            },
        });

        expect(essence).toContain("## dedicatedPage: Laser");
        expect(essence).toContain('slug: {"current":"laser"}');
        expect(essence).toContain("[CTA: Book]");
        expect(essence).toContain("- Guideline (NICE https://nice.test)");
    });
});
