import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearJobsForTests } from "../src/server/jobs";
import { parsePdf } from "../src/server/parser";

vi.mock("../src/server/parser", () => ({
  parsePdf: vi.fn(async () => ({
    text: "Page one\n\nPage two",
    pages: [
      { pageNum: 1, width: 612, height: 792, text: "Page one", textItems: [] },
      { pageNum: 2, width: 612, height: 792, text: "Page two", textItems: [] },
    ],
  })),
}));

const mockedParsePdf = vi.mocked(parsePdf);

describe("API", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    clearJobsForTests();
    mockedParsePdf.mockClear();
    const { createApp } = await import("../src/server/index");
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not bind to a local port.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    clearJobsForTests();
  });

  it("rejects invalid non-PDF uploads", async () => {
    const form = new FormData();
    form.append("file", new Blob(["not a pdf"], { type: "text/plain" }), "notes.txt");

    const response = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("PDF") });
    expect(mockedParsePdf).not.toHaveBeenCalled();
  });

  it("creates a job, reaches ready status, and downloads markdown", async () => {
    const createResponse = await uploadPdf();
    expect(createResponse.status).toBe(202);
    const created = (await createResponse.json()) as { jobId: string };
    expect(created.jobId).toEqual(expect.any(String));

    const readyJob = await waitForReady(created.jobId);
    expect(readyJob).toMatchObject({
      id: created.jobId,
      status: "ready",
      metadata: {
        fileName: "sample.pdf",
        pagesParsed: 2,
        ocrEnabled: true,
      },
    });

    const markdownResponse = await fetch(`${baseUrl}/api/jobs/${created.jobId}/result?format=md`);
    expect(markdownResponse.status).toBe(200);
    expect(markdownResponse.headers.get("content-disposition")).toContain("sample.md");
    await expect(markdownResponse.text()).resolves.toContain("# Parsed Document");

    const jsonResponse = await fetch(`${baseUrl}/api/jobs/${created.jobId}/result?format=json`);
    expect(jsonResponse.status).toBe(200);
    const parsedJson = await jsonResponse.json();
    expect(parsedJson).toMatchObject({
      metadata: {
        sourceFile: "sample.pdf",
        postProcessor: "liteparse-pdf-studio",
      },
      cleanedText: expect.stringContaining("Page one"),
      rawText: expect.stringContaining("Page one"),
    });
    expect(parsedJson.pages[0]).toMatchObject({
      cleanedText: "Page one",
      rawText: "Page one",
    });
  });

  async function uploadPdf(): Promise<Response> {
    const form = new FormData();
    form.append("file", new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }), "sample.pdf");
    form.append("ocrEnabled", "true");
    form.append("ocrLanguage", "eng");
    form.append("maxPages", "100");
    form.append("dpi", "150");

    return fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      body: form,
    });
  }

  async function waitForReady(jobId: string): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/jobs/${jobId}`);
      expect(response.status).toBe(200);
      const job = (await response.json()) as Record<string, unknown>;

      if (job.status === "ready") {
        return job;
      }

      if (job.status === "failed") {
        throw new Error(`Job failed: ${String(job.error)}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw new Error("Timed out waiting for ready job.");
  }
});
