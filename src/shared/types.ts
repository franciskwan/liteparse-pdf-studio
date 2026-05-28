export type JobStatus =
  | "queued"
  | "validating"
  | "parsing"
  | "formatting"
  | "ready"
  | "failed"
  | "expired";

export type OutputProfile = "reading" | "rag";

export interface ParseOptions {
  ocrEnabled: boolean;
  ocrLanguage: string;
  targetPages?: string;
  maxPages: number;
  dpi: number;
  preserveVerySmallText: boolean;
  outputProfile: OutputProfile;
}

export interface JobMetadata {
  fileName: string;
  pagesParsed: number;
  parseMs: number;
  markdownChars: number;
  rawTextChars: number;
  ocrEnabled: boolean;
  outputProfile: OutputProfile;
  chunkCount: number;
}

export interface JobSummary {
  id: string;
  status: JobStatus;
  message: string;
  metadata?: JobMetadata;
  error?: string;
}

export interface JobCreatedResponse {
  jobId: string;
}
