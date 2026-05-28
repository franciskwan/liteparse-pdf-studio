import type { ParseOptions } from "../shared/types";

export interface LiteParseTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  fontSize?: number;
  confidence?: number;
}

export interface LiteParsePage {
  pageNum: number;
  width: number;
  height: number;
  text: string;
  textItems: LiteParseTextItem[];
}

export interface LiteParseResult {
  pages: LiteParsePage[];
  text: string;
}

export function toMarkdown(input: {
  fileName: string;
  options: ParseOptions;
  parseMs: number;
  result: LiteParseResult;
}): string {
  const header = [
    "# Parsed Document",
    "",
    `Source file: ${input.fileName}`,
    "Parser: run-llama/liteparse",
    `Pages parsed: ${input.result.pages.length}`,
    `OCR: ${input.options.ocrEnabled ? `enabled (${input.options.ocrLanguage})` : "disabled"}`,
    `DPI: ${input.options.dpi}`,
    `Parse time: ${input.parseMs} ms`,
    "",
    "> Note: This markdown is app-generated from LiteParse text and JSON output for LLM-ready reading.",
    "",
    "---",
    "",
  ];

  const pages = input.result.pages.flatMap((page) => [
    `## Page ${page.pageNum}`,
    "",
    page.text.trim() || "_No text extracted on this page._",
    "",
  ]);

  return `${[...header, ...pages].join("\n").trimEnd()}\n`;
}
