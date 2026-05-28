import { expect, test } from "@playwright/test";

const fixturePdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

test("renders controls and exercises upload, polling, preview, and downloads", async ({ page }) => {
  let statusCalls = 0;

  await page.route("**/api/jobs", async (route) => {
    expect(route.request().method()).toBe("POST");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ jobId: "job-smoke" })
    });
  });

  await page.route("**/api/jobs/job-smoke", async (route) => {
    statusCalls += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "job-smoke",
        status: statusCalls > 1 ? "ready" : "parsing",
        message: statusCalls > 1 ? "Parsed and formatted." : "Parsing PDF.",
        metadata: statusCalls > 1
          ? {
              fileName: "sample.pdf",
              pagesParsed: 1,
              parseMs: 42,
              markdownChars: 40,
              rawTextChars: 21,
              ocrEnabled: true,
              outputProfile: "rag",
              chunkCount: 2
            }
          : undefined
      })
    });
  });

  await page.route("**/api/jobs/job-smoke/result?format=md", async (route) => {
    await route.fulfill({
      contentType: "text/markdown",
      body: "# Parsed Document\n\n## Page 1\n\nSmoke test markdown."
    });
  });

  await page.route("**/api/jobs/job-smoke/result?format=text", async (route) => {
    await route.fulfill({
      contentType: "text/plain",
      body: "Smoke test raw text."
    });
  });

  await page.route("**/api/jobs/job-smoke/result?format=json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ cleanedText: "Smoke test JSON", chunks: [{ id: "chunk-001", pageStart: 1 }] })
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "LiteParse PDF Studio" })).toBeVisible();
  await expect(page.getByText("Drop PDF here")).toBeVisible();
  await expect(page.getByLabel("OCR language")).toBeVisible();
  await expect(page.getByText("Output profile")).toBeVisible();
  await expect(page.getByText("RAG chunks")).toBeVisible();
  await expect(page.getByLabel("Target pages")).toBeVisible();
  await expect(page.getByLabel("Max pages")).toBeVisible();
  await expect(page.getByLabel("DPI", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Markdown" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download MD" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download JSON" })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: fixturePdf
  });

  await expect(page.getByTestId("selected-file")).toContainText("sample.pdf");
  await page.getByLabel("RAG chunks").check();
  await page.getByRole("button", { name: "Parse PDF" }).click();

  await expect(page.getByText("ready: Parsed and formatted.")).toBeVisible();
  await expect(page.getByTestId("preview-output")).toContainText("# Parsed Document");

  await page.getByRole("tab", { name: "Clean Text" }).click();
  await expect(page.getByTestId("preview-output")).toContainText("Smoke test raw text.");

  await page.getByRole("tab", { name: "JSON" }).click();
  await expect(page.getByTestId("preview-output")).toContainText('"cleanedText": "Smoke test JSON"');

  await page.getByRole("button", { name: "Clear" }).first().click();
  await expect(page.getByTestId("selected-file")).toContainText("No file selected");
});
