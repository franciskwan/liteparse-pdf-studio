import { describe, expect, it } from "vitest";
import { normalizeParseOptions, validatePdfUpload } from "../src/server/validation";

describe("normalizeParseOptions", () => {
  it("normalizes safe defaults", () => {
    expect(normalizeParseOptions({})).toEqual({
      ocrEnabled: true,
      ocrLanguage: "eng",
      maxPages: 100,
      dpi: 150,
      preserveVerySmallText: false,
      outputProfile: "reading",
    });
  });

  it("normalizes valid user options", () => {
    expect(
      normalizeParseOptions({
        ocrEnabled: "false",
        ocrLanguage: "chi_tra",
        targetPages: "1-5,10,15-20",
        maxPages: "20",
        dpi: "200",
        preserveVerySmallText: "true",
        outputProfile: "rag",
      }),
    ).toEqual({
      ocrEnabled: false,
      ocrLanguage: "chi_tra",
      targetPages: "1-5,10,15-20",
      maxPages: 20,
      dpi: 200,
      preserveVerySmallText: true,
      outputProfile: "rag",
    });
  });

  it("rejects maxPages outside the supported range", () => {
    expect(() => normalizeParseOptions({ maxPages: "0" })).toThrow("maxPages");
    expect(() => normalizeParseOptions({ maxPages: "101" })).toThrow("maxPages");
  });

  it("rejects dpi outside the supported range", () => {
    expect(() => normalizeParseOptions({ dpi: "71" })).toThrow("dpi");
    expect(() => normalizeParseOptions({ dpi: "301" })).toThrow("dpi");
  });

  it("rejects invalid target page syntax", () => {
    expect(() => normalizeParseOptions({ targetPages: "1,,3" })).toThrow("targetPages");
    expect(() => normalizeParseOptions({ targetPages: "5-2" })).toThrow("targetPages");
    expect(() => normalizeParseOptions({ targetPages: "1 - 3" })).toThrow("targetPages");
  });
});

describe("validatePdfUpload", () => {
  it("accepts a normal PDF upload", () => {
    expect(() =>
      validatePdfUpload({ originalname: "report.pdf", mimetype: "application/pdf", size: 1024 }),
    ).not.toThrow();
  });

  it("rejects non-PDF uploads", () => {
    expect(() =>
      validatePdfUpload({ originalname: "report.txt", mimetype: "text/plain", size: 10 }),
    ).toThrow("PDF");
  });

  it("rejects oversized PDF uploads", () => {
    expect(() =>
      validatePdfUpload({
        originalname: "report.pdf",
        mimetype: "application/pdf",
        size: 50 * 1024 * 1024 + 1,
      }),
    ).toThrow("50 MB");
  });
});
