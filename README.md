# LiteParse PDF Studio

LiteParse PDF Studio is a local-first web app for uploading PDFs, parsing them with [`run-llama/liteparse`](https://github.com/run-llama/liteparse), previewing the result, and downloading LLM-ready markdown, raw text, or structured JSON.

The app is intentionally a working tool first: open it, upload a PDF, choose parse options, inspect the output, then download the processed result.

## What It Uses

- Frontend: Vite, React, TypeScript
- Backend: Express, Multer, TypeScript
- Parser: `@llamaindex/liteparse`
- Tests: Vitest and Playwright

LiteParse runs locally and returns layout-preserved text plus structured page data with bounding boxes. This app adds a conservative post-processing layer that normalizes noisy spacing, repairs common hyphenated line wraps, removes simple layout symbols, promotes detected section titles into markdown headings, and keeps raw page text available in JSON for auditability.

LiteParse itself outputs text/JSON; this app turns that result into cleaner markdown/text/JSON for LLM-ready use. It is still not a full semantic table or chart reconstruction engine.

## Local Setup

```bash
git clone https://github.com/franciskwan/liteparse-pdf-studio.git
cd liteparse-pdf-studio
npm install
npm run dev
```

Open the printed local URL. The default server port is `4174`.

## Usage

1. Select or drag in a PDF.
2. Adjust OCR, page range, max pages, DPI, and small-text settings.
3. Click `Parse PDF`.
4. Preview Markdown, Raw Text, or JSON.
5. Download `.md`, `.txt`, or `.json`.

## MVP Limits

- PDF-only upload in v1.
- Upload limit: 50 MB.
- Server max pages: 100.
- OCR is enabled by default.
- Remote URL ingestion is intentionally disabled.
- Markdown and text downloads are deterministic post-processed output over LiteParse text/page data.
- JSON downloads include cleaned text, raw text, page dimensions, and raw text items.

## Privacy And Safety

The parser runs locally on the server where this app is deployed. Uploaded files are accepted in memory for the MVP, and extracted document text is not written to logs by app code. If this is deployed publicly, add stronger rate limiting, worker isolation, authentication or quota, and a persistent cleanup policy before accepting sensitive documents.

## Verification

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## Production Run

```bash
npm run build
npm start
```

## Attribution

This project wraps [`run-llama/liteparse`](https://github.com/run-llama/liteparse), which is licensed under Apache-2.0 in the upstream repository. Keep upstream attribution when publishing or modifying this app.

## License

Apache-2.0
