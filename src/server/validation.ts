import type { OutputProfile, ParseOptions } from "../shared/types";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const DEFAULT_OPTIONS: ParseOptions = {
  ocrEnabled: true,
  ocrLanguage: "eng",
  maxPages: 100,
  dpi: 150,
  preserveVerySmallText: false,
  outputProfile: "reading",
};

export interface UploadLike {
  originalname: string;
  mimetype: string;
  size: number;
}

export function validatePdfUpload(file: UploadLike): void {
  const hasPdfExtension = file.originalname.toLowerCase().endsWith(".pdf");
  const hasPdfMimeType = file.mimetype === "application/pdf";

  if (!hasPdfExtension || !hasPdfMimeType) {
    throw new Error("Only PDF uploads are supported.");
  }

  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("PDF must be between 1 byte and 50 MB.");
  }
}

export function normalizeParseOptions(input: Record<string, unknown>): ParseOptions {
  const maxPages = toInteger(input.maxPages, DEFAULT_OPTIONS.maxPages, "maxPages");
  const dpi = toInteger(input.dpi, DEFAULT_OPTIONS.dpi, "dpi");
  const targetPages = normalizeTargetPages(input.targetPages);

  if (maxPages < 1 || maxPages > 100) {
    throw new Error("maxPages must be between 1 and 100.");
  }

  if (dpi < 72 || dpi > 300) {
    throw new Error("dpi must be between 72 and 300.");
  }

  return {
    ocrEnabled: toBoolean(input.ocrEnabled, DEFAULT_OPTIONS.ocrEnabled),
    ocrLanguage: normalizeOcrLanguage(input.ocrLanguage),
    targetPages,
    maxPages,
    dpi,
    preserveVerySmallText: toBoolean(
      input.preserveVerySmallText,
      DEFAULT_OPTIONS.preserveVerySmallText,
    ),
    outputProfile: normalizeOutputProfile(input.outputProfile),
  };
}

function normalizeOutputProfile(value: unknown): OutputProfile {
  if (value === "reading" || value === "rag") {
    return value;
  }

  return DEFAULT_OPTIONS.outputProfile;
}

function normalizeOcrLanguage(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_OPTIONS.ocrLanguage;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_OPTIONS.ocrLanguage;
}

function normalizeTargetPages(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parts = trimmed.split(",");
  for (const part of parts) {
    if (!/^\d+(?:-\d+)?$/.test(part)) {
      throw new Error("targetPages must look like 1-5,10,15-20.");
    }

    const [start, end] = part.split("-").map((page) => Number.parseInt(page, 10));
    if (start < 1 || (end !== undefined && (end < 1 || end < start))) {
      throw new Error("targetPages must look like 1-5,10,15-20.");
    }
  }

  return trimmed;
}

function toInteger(value: unknown, fallback: number, fieldName: string): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  return parsed;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}
