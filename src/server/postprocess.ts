import type { LiteParseResult } from "./markdown";

export interface ProcessedPage {
  pageNum: number;
  width: number;
  height: number;
  rawText: string;
  cleanedText: string;
  textItems: LiteParseResult["pages"][number]["textItems"];
}

export interface DocumentChunk {
  id: string;
  pageStart: number;
  pageEnd: number;
  text: string;
  charCount: number;
}

export interface ProcessedDocument {
  rawText: string;
  cleanedText: string;
  pages: ProcessedPage[];
  chunks: DocumentChunk[];
}

const TARGET_CHUNK_CHARS = 1400;
const MIN_CHUNK_CHARS = 400;

const BULLET_PATTERN = /^([-*+]|[0-9]+[.)]|[A-Z][.)])\s+/;
const ENDS_SENTENCE_PATTERN = /[.!?:;。！？：；)"'\]]$/;

export function postProcessResult(result: LiteParseResult): ProcessedDocument {
  const pages = result.pages.map((page) => ({
    pageNum: page.pageNum,
    width: page.width,
    height: page.height,
    rawText: page.text,
    cleanedText: cleanExtractedText(page.text),
    textItems: page.textItems,
  }));

  return {
    rawText: result.text,
    cleanedText: pages.map((page) => page.cleanedText).filter(Boolean).join("\n\n"),
    pages,
    chunks: buildChunks(pages),
  };
}

export function cleanExtractedText(input: string): string {
  const normalized = input
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/([A-Za-z])-\n\s*([a-z])/g, "$1$2");

  const lines = normalized
    .split("\n")
    .map(cleanLine)
    .filter((line, index, allLines) => !(line === "" && allLines[index - 1] === ""));

  return joinWrappedLines(lines).trim();
}

function cleanLine(line: string): string {
  return line
    .replace(/[ \t]+/g, " ")
    .replace(/^\|\s*([-*+]\s+)/, "$1")
    .replace(/^\|\s*/, "")
    .replace(/^[|•·\s]+$/g, "")
    .trim();
}

function joinWrappedLines(lines: string[]): string {
  const output: string[] = [];

  for (const line of lines) {
    if (!line) {
      pushBlank(output);
      continue;
    }

    const previous = output[output.length - 1];
    if (previous && shouldJoin(previous, line)) {
      output[output.length - 1] = `${previous} ${line}`;
      continue;
    }

    output.push(line);
  }

  return output.join("\n");
}

function shouldJoin(previous: string, current: string): boolean {
  if (!previous || !current) return false;
  if (BULLET_PATTERN.test(previous) || BULLET_PATTERN.test(current)) return false;
  if (looksLikeHeading(previous) || looksLikeHeading(current)) return false;
  if (ENDS_SENTENCE_PATTERN.test(previous)) return false;
  if (/^\|/.test(previous) || /^\|/.test(current)) return false;

  return /^[a-z,(]/.test(current) || previous.length < 90;
}

function looksLikeHeading(line: string): boolean {
  if (line.length > 90 || ENDS_SENTENCE_PATTERN.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (
    words.length > 0 &&
    words.length <= 8 &&
    words.every((word) => /^[A-Z0-9][A-Za-z0-9/&()+,-]*$/.test(word))
  ) {
    return true;
  }

  const letters = line.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4) return false;
  const uppercase = letters.replace(/[^A-Z]/g, "").length;
  return uppercase / letters.length > 0.55;
}

function pushBlank(lines: string[]): void {
  if (lines.length > 0 && lines[lines.length - 1] !== "") {
    lines.push("");
  }
}

function buildChunks(pages: ProcessedPage[]): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let currentText = "";
  let pageStart = 0;
  let pageEnd = 0;

  for (const page of pages) {
    const blocks = page.cleanedText.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    for (const block of blocks) {
      if (!currentText) {
        pageStart = page.pageNum;
      }

      const candidate = currentText ? `${currentText}\n\n${block}` : block;
      if (candidate.length > TARGET_CHUNK_CHARS && currentText.length >= MIN_CHUNK_CHARS) {
        chunks.push(createChunk(chunks.length + 1, pageStart, pageEnd, currentText));
        currentText = block;
        pageStart = page.pageNum;
      } else {
        currentText = candidate;
      }
      pageEnd = page.pageNum;
    }
  }

  if (currentText) {
    chunks.push(createChunk(chunks.length + 1, pageStart, pageEnd, currentText));
  }

  return chunks;
}

function createChunk(index: number, pageStart: number, pageEnd: number, text: string): DocumentChunk {
  return {
    id: `chunk-${String(index).padStart(3, "0")}`,
    pageStart,
    pageEnd,
    text,
    charCount: text.length,
  };
}
