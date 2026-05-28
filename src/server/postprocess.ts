import type { LiteParseResult } from "./markdown";

export interface ProcessedPage {
  pageNum: number;
  width: number;
  height: number;
  rawText: string;
  cleanedText: string;
  textItems: LiteParseResult["pages"][number]["textItems"];
}

export interface ProcessedDocument {
  rawText: string;
  cleanedText: string;
  pages: ProcessedPage[];
}

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
