import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { JobCreatedResponse, JobSummary, OutputProfile, ParseOptions } from "../shared/types";

type ResultFormat = "md" | "text" | "json";

const initialOptions: ParseOptions & { targetPages: string } = {
  ocrEnabled: true,
  ocrLanguage: "eng",
  targetPages: "",
  maxPages: 100,
  dpi: 150,
  preserveVerySmallText: false,
  outputProfile: "reading"
};

const tabLabels: Record<ResultFormat, string> = {
  md: "Markdown",
  text: "Clean Text",
  json: "JSON"
};

const profileLabels: Record<OutputProfile, string> = {
  reading: "Reading",
  rag: "RAG chunks"
};

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState(initialOptions);
  const [activeTab, setActiveTab] = useState<ResultFormat>("md");
  const [job, setJob] = useState<JobSummary | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<number | null>(null);

  const canSubmit = Boolean(file) && !busy;
  const statusLabel = job ? `${job.status}: ${job.message}` : "Waiting for a PDF";

  const selectedFileMeta = useMemo(() => {
    if (!file) return "No file selected";
    return `${file.name} • ${formatBytes(file.size)} • ${file.type || "application/pdf"}`;
  }, [file]);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const fetchPreview = useCallback(async (jobId: string, format: ResultFormat) => {
    const response = await fetch(`/api/jobs/${jobId}/result?format=${format}`);
    if (!response.ok) {
      throw new Error(`Could not fetch ${tabLabels[format]} result.`);
    }

    const text = await response.text();
    setPreview(format === "json" ? prettyJson(text) : text);
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();

      const tick = async () => {
        try {
          const response = await fetch(`/api/jobs/${jobId}`);
          if (!response.ok) {
            throw new Error("Could not read parse job status.");
          }

          const summary = (await response.json()) as JobSummary;
          setJob(summary);

          if (summary.status === "ready") {
            stopPolling();
            setBusy(false);
            await fetchPreview(summary.id, "md");
          }

          if (summary.status === "failed" || summary.status === "expired") {
            stopPolling();
            setBusy(false);
            setError(summary.error || summary.message || "The parse job did not finish.");
          }
        } catch (pollError) {
          stopPolling();
          setBusy(false);
          setError(pollError instanceof Error ? pollError.message : "Could not poll parse job.");
        }
      };

      void tick();
      pollRef.current = window.setInterval(tick, 1000);
    },
    [fetchPreview, stopPolling]
  );

  useEffect(() => {
    if (!job || job.status !== "ready") return;

    setError("");
    void fetchPreview(job.id, activeTab).catch((previewError: unknown) => {
      setPreview("");
      setError(previewError instanceof Error ? previewError.message : "Could not load preview.");
    });
  }, [activeTab, fetchPreview, job]);

  function updateOption<K extends keyof typeof initialOptions>(key: K, value: (typeof initialOptions)[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  function handleFiles(files: FileList | null) {
    const nextFile = files?.[0];
    setError("");

    if (!nextFile) return;

    if (!isPdf(nextFile)) {
      setFile(null);
      setPreview("");
      setJob(null);
      setError("Only PDF files are supported. Choose a file ending in .pdf.");
      return;
    }

    setFile(nextFile);
    setJob(null);
    setPreview("");
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  async function submitJob() {
    if (!file) {
      setError("Select a PDF before starting a parse job.");
      return;
    }

    setBusy(true);
    setError("");
    setPreview("");
    setActiveTab("md");
    setJob({ id: "local", status: "queued", message: "Uploading PDF and parse options." });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("ocrEnabled", String(options.ocrEnabled));
    formData.append("ocrLanguage", options.ocrLanguage.trim() || "eng");
    formData.append("targetPages", options.targetPages.trim());
    formData.append("maxPages", String(options.maxPages));
    formData.append("dpi", String(options.dpi));
    formData.append("preserveVerySmallText", String(options.preserveVerySmallText));
    formData.append("outputProfile", options.outputProfile);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Could not create parse job.");
      }

      const created = (await response.json()) as JobCreatedResponse;
      setJob({ id: created.jobId, status: "queued", message: "Job accepted. Waiting for parser." });
      pollJob(created.jobId);
    } catch (submitError) {
      setBusy(false);
      setJob(null);
      setError(submitError instanceof Error ? submitError.message : "Could not upload PDF.");
    }
  }

  async function copyPreview() {
    if (!preview) return;

    try {
      await navigator.clipboard.writeText(preview);
      setError("");
    } catch {
      setError("Copy failed. Select the preview text manually.");
    }
  }

  function clearAll() {
    stopPolling();
    setFile(null);
    setJob(null);
    setPreview("");
    setBusy(false);
    setError("");
    setActiveTab("md");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="app-shell">
      <section className="workspace-header" aria-label="Application summary">
        <div>
          <h1>LiteParse PDF Studio</h1>
          <p>Upload a PDF, tune parse settings, and export LLM-ready results.</p>
        </div>
        <div className={`status-pill status-${job?.status ?? "idle"}`} aria-live="polite">
          {statusLabel}
        </div>
      </section>

      <section className="studio-grid">
        <aside className="control-panel" aria-label="PDF upload and parse controls">
          <label
            className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => handleFiles(event.target.files)}
            />
            <span className="dropzone-title">Drop PDF here</span>
            <span className="dropzone-copy">or choose a file from disk</span>
          </label>

          <div className="file-meta" data-testid="selected-file">
            {selectedFileMeta}
          </div>

          {error ? (
            <div className="error-banner" role="alert">
              {error}
            </div>
          ) : null}

          <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
            <div className="setting-row toggle-row">
              <div>
                <label htmlFor="ocr-enabled">OCR</label>
                <p>Use LiteParse OCR when the source needs it.</p>
              </div>
              <input
                id="ocr-enabled"
                type="checkbox"
                checked={options.ocrEnabled}
                onChange={(event) => updateOption("ocrEnabled", event.target.checked)}
              />
            </div>

            <fieldset className="profile-field">
              <legend>Output profile</legend>
              <div className="profile-options">
                {(["reading", "rag"] as OutputProfile[]).map((profile) => (
                  <label key={profile} className={options.outputProfile === profile ? "profile-option active" : "profile-option"}>
                    <input
                      type="radio"
                      name="output-profile"
                      value={profile}
                      checked={options.outputProfile === profile}
                      onChange={() => updateOption("outputProfile", profile)}
                    />
                    <span>{profileLabels[profile]}</span>
                    <small>
                      {profile === "reading"
                        ? "Clean page-by-page markdown."
                        : "Chunk index and source-page metadata."}
                    </small>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="field">
              <span>OCR language</span>
              <input
                value={options.ocrLanguage}
                onChange={(event) => updateOption("ocrLanguage", event.target.value)}
                placeholder="eng"
              />
            </label>

            <label className="field">
              <span>Target pages</span>
              <input
                value={options.targetPages}
                onChange={(event) => updateOption("targetPages", event.target.value)}
                placeholder="1-5,10"
              />
            </label>

            <div className="split-fields">
              <label className="field">
                <span>Max pages</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={options.maxPages}
                  onChange={(event) => updateOption("maxPages", clampNumber(event.target.value, 1, 100))}
                />
              </label>

              <label className="field">
                <span>DPI</span>
                <input
                  type="number"
                  min={72}
                  max={300}
                  value={options.dpi}
                  onChange={(event) => updateOption("dpi", clampNumber(event.target.value, 72, 300))}
                />
              </label>
            </div>

            <label className="field range-field">
              <span>DPI range</span>
              <input
                type="range"
                min={72}
                max={300}
                step={1}
                value={options.dpi}
                onChange={(event) => updateOption("dpi", Number(event.target.value))}
              />
            </label>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={options.preserveVerySmallText}
                onChange={(event) => updateOption("preserveVerySmallText", event.target.checked)}
              />
              <span>Preserve very small text</span>
            </label>
          </form>

          <div className="action-row">
            <button type="button" className="primary-button" disabled={!canSubmit} onClick={submitJob}>
              {busy ? "Parsing..." : "Parse PDF"}
            </button>
            <button type="button" className="secondary-button" onClick={clearAll}>
              Clear
            </button>
          </div>
        </aside>

        <section className="preview-panel" aria-label="Parsed document preview">
          <div className="preview-toolbar">
            <div className="tabs" role="tablist" aria-label="Result formats">
              {(Object.keys(tabLabels) as ResultFormat[]).map((format) => (
                <button
                  key={format}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === format}
                  className={activeTab === format ? "tab-active" : ""}
                  onClick={() => setActiveTab(format)}
                >
                  {tabLabels[format]}
                </button>
              ))}
            </div>

            <div className="preview-actions">
              <button type="button" onClick={copyPreview} disabled={!preview}>
                Copy
              </button>
              <DownloadButton job={job} format="md" label="Download MD" />
              <DownloadButton job={job} format="text" label="Download TXT" />
              <DownloadButton job={job} format="json" label="Download JSON" />
              <button type="button" onClick={clearAll}>
                Clear
              </button>
            </div>
          </div>

          <MetadataStrip job={job} />

          <pre className="preview-box" data-testid="preview-output">
            {preview || (busy ? "Waiting for parsed output..." : "Parsed output will appear here.")}
          </pre>
        </section>
      </section>
    </main>
  );
}

function DownloadButton({ job, format, label }: { job: JobSummary | null; format: ResultFormat; label: string }) {
  const enabled = job?.status === "ready";

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => {
        if (enabled) {
          window.location.href = `/api/jobs/${job.id}/result?format=${format}`;
        }
      }}
    >
      {label}
    </button>
  );
}

function MetadataStrip({ job }: { job: JobSummary | null }) {
  if (!job?.metadata) {
    return (
      <dl className="metadata-strip">
        <div>
          <dt>Status</dt>
          <dd>{job?.status ?? "idle"}</dd>
        </div>
        <div>
          <dt>Preview</dt>
          <dd>not ready</dd>
        </div>
      </dl>
    );
  }

  return (
    <dl className="metadata-strip">
      <div>
        <dt>File</dt>
        <dd title={job.metadata.fileName}>{job.metadata.fileName}</dd>
      </div>
      <div>
        <dt>Pages</dt>
        <dd>{job.metadata.pagesParsed}</dd>
      </div>
      <div>
        <dt>Parse time</dt>
        <dd>{job.metadata.parseMs} ms</dd>
      </div>
      <div>
        <dt>OCR</dt>
        <dd>{job.metadata.ocrEnabled ? "enabled" : "disabled"}</dd>
      </div>
      <div>
        <dt>Profile</dt>
        <dd>{profileLabels[job.metadata.outputProfile]}</dd>
      </div>
      <div>
        <dt>Chunks</dt>
        <dd>{job.metadata.chunkCount}</dd>
      </div>
      <div>
        <dt>Characters</dt>
        <dd>{job.metadata.markdownChars.toLocaleString()}</dd>
      </div>
    </dl>
  );
}

function isPdf(candidate: File) {
  return candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf");
}

function clampNumber(value: string, min: number, max: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function prettyJson(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
