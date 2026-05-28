import type { ParseOptions } from "../shared/types";
import { postProcessResult, type ProcessedDocument } from "./postprocess";

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
  return processedToMarkdown({
    ...input,
    processed: postProcessResult(input.result),
  });
}

export function processedToMarkdown(input: {
  fileName: string;
  options: ParseOptions;
  parseMs: number;
  processed: ProcessedDocument;
}): string {
  const header = [
    "# Parsed Document",
    "",
    `Source file: ${input.fileName}`,
    "Parser: run-llama/liteparse",
    `Pages parsed: ${input.processed.pages.length}`,
    `OCR: ${input.options.ocrEnabled ? `enabled (${input.options.ocrLanguage})` : "disabled"}`,
    `DPI: ${input.options.dpi}`,
    `Parse time: ${input.parseMs} ms`,
    "",
    "> Note: This markdown is post-processed from LiteParse text/JSON output. Raw page text remains available in the JSON download.",
    "",
    "---",
    "",
  ];

  const pages = input.processed.pages.flatMap((page) => [
    `## Page ${page.pageNum}`,
    "",
    formatCleanedTextForMarkdown(page.cleanedText) || "_No text extracted on this page._",
    "",
  ]);

  return `${[...header, ...pages].join("\n").trimEnd()}\n`;
}

function formatCleanedTextForMarkdown(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      if (looksLikeSectionHeading(line)) return `### ${line}`;
      return line;
    })
    .join("\n");
}

function looksLikeSectionHeading(line: string): boolean {
  if (line.startsWith("#") || line.startsWith("- ") || /^\d+[.)]\s/.test(line)) return false;
  if (line.length > 90 || /[.!?:;。！？：；)"'\]]$/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  return (
    words.length > 0 &&
    words.length <= 8 &&
    words.every((word) => /^[A-Z0-9][A-Za-z0-9/&()+,-]*$/.test(word))
  );
}
