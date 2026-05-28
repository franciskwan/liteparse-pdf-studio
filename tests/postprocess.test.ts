import { describe, expect, it } from "vitest";
import { cleanExtractedText, postProcessResult } from "../src/server/postprocess";

describe("cleanExtractedText", () => {
  it("removes spacing noise and joins wrapped prose conservatively", () => {
    expect(
      cleanExtractedText(`
        Executive    Summary

        LiteParse pro-
        cesses PDF text into a useful
        downstream representation.
        |
        - Revenue    grew   strongly
        - Margins improved
      `),
    ).toMatchInlineSnapshot(`
      "Executive Summary

      LiteParse processes PDF text into a useful downstream representation.

      - Revenue grew strongly
      - Margins improved"
    `);
  });
});

describe("postProcessResult", () => {
  it("preserves raw text while adding cleaned text", () => {
    const processed = postProcessResult({
      text: "Raw    whole document",
      pages: [{ pageNum: 1, width: 100, height: 200, text: "Raw    page", textItems: [] }],
    });

    expect(processed.rawText).toBe("Raw    whole document");
    expect(processed.cleanedText).toBe("Raw page");
    expect(processed.pages[0]).toMatchObject({
      rawText: "Raw    page",
      cleanedText: "Raw page",
    });
  });
});
