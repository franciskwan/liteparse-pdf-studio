import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { JobSummary, ParseOptions } from "../shared/types";
import { createJob, expireOldJobs, getJob, updateJob, type JobRecord } from "./jobs";
import { processedToMarkdown, type LiteParseResult } from "./markdown";
import { parsePdf } from "./parser";
import { postProcessResult } from "./postprocess";
import { MAX_UPLOAD_BYTES, normalizeParseOptions, validatePdfUpload } from "./validation";

const JOB_TTL_MS = 60 * 60 * 1000;
const DEFAULT_PORT = 4174;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export function createApp(): express.Express {
  const app = express();

  app.post("/api/jobs", upload.single("file"), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "A PDF file is required." });
        return;
      }

      validatePdfUpload(req.file);
      const options = normalizeParseOptions(req.body as Record<string, unknown>);
      const job = createJob(req.file.originalname);

      void runParseLifecycle(job.id, req.file.originalname, req.file.buffer, options);
      res.status(202).json({ jobId: job.id });
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.get("/api/jobs/:id", (req: Request, res: Response) => {
    const jobId = getRouteParam(req.params.id);
    if (!jobId) {
      res.status(400).json({ error: "Job id is required." });
      return;
    }

    const job = getJob(jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }

    res.json(toJobSummary(job));
  });

  app.get("/api/jobs/:id/result", (req: Request, res: Response) => {
    const jobId = getRouteParam(req.params.id);
    if (!jobId) {
      res.status(400).json({ error: "Job id is required." });
      return;
    }

    const job = getJob(jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }

    const format = normalizeResultFormat(req.query.format);
    if (!format) {
      res.status(400).json({ error: "format must be md, text, or json." });
      return;
    }

    if (job.status === "expired") {
      res.status(410).json({ error: "Job expired." });
      return;
    }

    if (job.status !== "ready" || !job.results) {
      res.status(409).json({ error: "Job result is not ready." });
      return;
    }

    const fileBaseName = path.basename(job.fileName, path.extname(job.fileName)) || "parsed-document";
    const extension = format === "text" ? "txt" : format;
    const contentType = format === "json" ? "application/json" : "text/plain; charset=utf-8";

    res.setHeader("Content-Type", contentType);
    res.attachment(`${fileBaseName}.${extension}`);
    res.send(job.results[format]);
  });

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next;

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "PDF must be between 1 byte and 50 MB." });
      return;
    }

    res.status(500).json({ error: "Unexpected server error." });
  });

  return app;
}

export async function startServer(port = Number(process.env.PORT) || DEFAULT_PORT): Promise<Server> {
  const app = createApp();
  await attachFrontend(app);
  const cleanup = setInterval(() => expireOldJobs(JOB_TTL_MS), 5 * 60 * 1000);
  cleanup.unref();

  return app.listen(port, () => {
    console.log(`LiteParse PDF Studio listening on http://localhost:${port}`);
  });
}

async function attachFrontend(app: express.Express): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (process.env.NODE_ENV === "production") {
    const serverDir = path.dirname(fileURLToPath(import.meta.url));
    const clientDist = path.resolve(serverDir, "../../dist/client");
    app.use(express.static(clientDist));
    app.get("/{*splat}", (_req: Request, res: Response) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
    return;
  }

  const { createServer } = await import("vite");
  const vite = await createServer({
    appType: "spa",
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);
}

async function runParseLifecycle(
  jobId: string,
  fileName: string,
  buffer: Buffer,
  options: ParseOptions,
): Promise<void> {
  try {
    updateJob(jobId, { status: "validating", message: "Validating upload." });
    validatePdfUpload({ originalname: fileName, mimetype: "application/pdf", size: buffer.length });

    updateJob(jobId, { status: "parsing", message: "Parsing PDF." });
    const startedAt = Date.now();
    const result = await parsePdf(buffer, options);
    const parseMs = Date.now() - startedAt;

    updateJob(jobId, { status: "formatting", message: "Formatting result." });
    const results = formatResults({ fileName, options, parseMs, result });

    updateJob(jobId, {
      status: "ready",
      message: "Result ready.",
      metadata: {
        fileName,
        pagesParsed: result.pages.length,
        parseMs,
        markdownChars: results.md.length,
        rawTextChars: results.text.length,
        ocrEnabled: options.ocrEnabled,
      },
      results,
    });
  } catch (error) {
    updateJob(jobId, {
      status: "failed",
      message: "Parsing failed.",
      error: errorMessage(error),
      results: undefined,
    });
  }
}

function formatResults(input: {
  fileName: string;
  options: ParseOptions;
  parseMs: number;
  result: LiteParseResult;
}) {
  const processed = postProcessResult(input.result);
  const json = {
    metadata: {
      sourceFile: input.fileName,
      parser: "run-llama/liteparse",
      postProcessor: "liteparse-pdf-studio",
      pagesParsed: processed.pages.length,
      ocrEnabled: input.options.ocrEnabled,
      ocrLanguage: input.options.ocrLanguage,
      dpi: input.options.dpi,
      parseMs: input.parseMs,
    },
    cleanedText: processed.cleanedText,
    rawText: processed.rawText,
    pages: processed.pages,
  };

  return {
    md: processedToMarkdown({ ...input, processed }),
    text: processed.cleanedText,
    json: JSON.stringify(json, null, 2),
  };
}

function toJobSummary(job: JobRecord): JobSummary {
  return {
    id: job.id,
    status: job.status,
    message: job.message,
    metadata: job.metadata,
    error: job.error,
  };
}

function normalizeResultFormat(value: unknown): "md" | "text" | "json" | undefined {
  if (value === "md" || value === "text" || value === "json") {
    return value;
  }

  return undefined;
}

function getRouteParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

if (process.env.NODE_ENV !== "test" && process.argv[1] === fileURLToPath(import.meta.url)) {
  void startServer();
}
