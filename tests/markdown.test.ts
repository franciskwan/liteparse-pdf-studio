import { describe, expect, it } from "vitest";
import { toMarkdown } from "../src/server/markdown";

describe("toMarkdown", () => {
  it("wraps page text in deterministic markdown", () => {
    const md = toMarkdown({
      fileName: "report.pdf",
      options: {
        ocrEnabled: true,
        ocrLanguage: "eng",
        maxPages: 2,
        dpi: 150,
        preserveVerySmallText: false,
      },
      parseMs: 42,
      result: {
        text: "Page one\n\nPage two",
        pages: [
          { pageNum: 1, width: 612, height: 792, text: "Executive    Summary\n\nPage    one", textItems: [] },
          { pageNum: 2, width: 612, height: 792, text: "Page two", textItems: [] },
        ],
      },
    });

    expect(md).toMatchInlineSnapshot(`
      "# Parsed Document

      Source file: report.pdf
      Parser: run-llama/liteparse
      Pages parsed: 2
      OCR: enabled (eng)
      DPI: 150
      Parse time: 42 ms

      > Note: This markdown is post-processed from LiteParse text/JSON output. Raw page text remains available in the JSON download.

      ---

      ## Page 1

      ### Executive Summary

      Page one

      ## Page 2

      Page two
      "
    `);
  });

  it("marks pages without extracted text", () => {
    const md = toMarkdown({
      fileName: "empty.pdf",
      options: {
        ocrEnabled: false,
        ocrLanguage: "eng",
        maxPages: 1,
        dpi: 150,
        preserveVerySmallText: false,
      },
      parseMs: 1,
      result: {
        text: "",
        pages: [{ pageNum: 1, width: 612, height: 792, text: "   ", textItems: [] }],
      },
    });

    expect(md).toContain("OCR: disabled");
    expect(md).toContain("_No text extracted on this page._");
  });
});
