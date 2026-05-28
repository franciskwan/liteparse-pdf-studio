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
    `Output profile: ${input.options.outputProfile === "rag" ? "RAG chunks" : "Reading markdown"}`,
    `Pages parsed: ${input.processed.pages.length}`,
    `Chunks: ${input.processed.chunks.length}`,
    `OCR: ${input.options.ocrEnabled ? `enabled (${input.options.ocrLanguage})` : "disabled"}`,
    `DPI: ${input.options.dpi}`,
    `Parse time: ${input.parseMs} ms`,
    "",
    "> Note: This markdown is post-processed from LiteParse text/JSON output. Raw page text remains available in the JSON download.",
    "",
    "---",
    "",
  ];

  const body =
    input.options.outputProfile === "rag"
      ? chunksToMarkdown(input.processed.chunks)
      : pagesToMarkdown(input.processed.pages);

  return `${[...header, ...body].join("\n").trimEnd()}\n`;
}

function pagesToMarkdown(pages: ProcessedDocument["pages"]): string[] {
  return pages.flatMap((page) => [
    `## Page ${page.pageNum}`,
    "",
    formatCleanedTextForMarkdown(page.cleanedText) || "_No text extracted on this page._",
    "",
  ]);
}

function chunksToMarkdown(chunks: ProcessedDocument["chunks"]): string[] {
  if (chunks.length === 0) {
    return ["## Chunks", "", "_No text extracted for chunking._", ""];
  }

  return [
    "## Chunk Index",
    "",
    ...chunks.map(
      (chunk) => `- ${chunk.id}: pages ${pageRange(chunk.pageStart, chunk.pageEnd)}, ${chunk.charCount} chars`,
    ),
    "",
    ...chunks.flatMap((chunk) => [
      `## ${chunk.id}`,
      "",
      `Source pages: ${pageRange(chunk.pageStart, chunk.pageEnd)}`,
      "",
      formatCleanedTextForMarkdown(chunk.text),
      "",
    ]),
  ];
}

function formatCleanedTextForMarkdown(text: string): string {
  const output: string[] = [];

  for (const line of text.split("\n")) {
    if (!line.trim()) {
      output.push("");
      continue;
    }

    if (looksLikeSectionHeading(line)) {
      output.push(`### ${line}`);
      continue;
    }

    if (shouldRecoverBullet(output[output.length - 1], line)) {
      output.push(`- ${line}`);
      continue;
    }

    output.push(line);
  }

  return output.join("\n");
}

function pageRange(start: number, end: number): string {
  return start === end ? String(start) : `${start}-${end}`;
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

function shouldRecoverBullet(previous: string | undefined, line: string): boolean {
  if (!previous?.startsWith("- ")) return false;
  if (line.startsWith("- ") || /^\d+[.)]\s/.test(line)) return false;
  if (/[.!?:;。！？：；]$/.test(line)) return false;

  const words = line.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 10;
}
