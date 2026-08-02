export type StepStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface WorkflowStep {
  name: string;
  status: StepStatus;
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export type WorkflowRunStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

export interface WorkflowRun {
  runId: string;
  workflowType: string;
  status: WorkflowRunStatus;
  topic?: string;
  sessionId?: string;
  steps: WorkflowStep[];
  result?: unknown;
  createdAt: string;
  updatedAt: string;
}

const runs = new Map<string, WorkflowRun>();

export function createRun(
  run: Omit<WorkflowRun, "createdAt" | "updatedAt">,
): WorkflowRun {
  const now = new Date().toISOString();
  const record: WorkflowRun = {
    ...run,
    createdAt: now,
    updatedAt: now,
  };
  runs.set(record.runId, record);
  return record;
}

export function updateRun(runId: string, patch: Partial<WorkflowRun>): WorkflowRun | undefined {
  const existing = runs.get(runId);
  if (!existing) return undefined;

  const updated: WorkflowRun = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  runs.set(runId, updated);
  return updated;
}

export function getRun(runId: string): WorkflowRun | undefined {
  return runs.get(runId);
}

export function listRuns(): WorkflowRun[] {
  return [...runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
