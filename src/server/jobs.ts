import type { JobMetadata, JobStatus } from "../shared/types";

export interface JobResults {
  md: string;
  text: string;
  json: string;
}

export interface JobRecord {
  id: string;
  status: JobStatus;
  message: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
  metadata?: JobMetadata;
  error?: string;
  results?: JobResults;
}

const jobs = new Map<string, JobRecord>();

export function createJob(fileName: string): JobRecord {
  const now = Date.now();
  const job: JobRecord = {
    id: crypto.randomUUID(),
    status: "queued",
    message: "Job queued.",
    fileName,
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): JobRecord | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<JobRecord>): JobRecord | undefined {
  const current = jobs.get(id);
  if (!current) {
    return undefined;
  }

  const next = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: Date.now(),
  };

  jobs.set(id, next);
  return next;
}

export function expireOldJobs(ttlMs: number, now = Date.now()): void {
  for (const job of jobs.values()) {
    if (now - job.createdAt <= ttlMs || job.status === "expired") {
      continue;
    }

    jobs.set(job.id, {
      ...job,
      status: "expired",
      message: "Job expired.",
      results: undefined,
      updatedAt: now,
    });
  }
}

export function clearJobsForTests(): void {
  jobs.clear();
}
