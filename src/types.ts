export type ModelRole = "worker" | "reasoning" | "image" | "ui" | "verifier" | "judge";

export type Provider = "meta" | "baseten";

export interface ModelRoute {
  provider: Provider;
  model: string;
}

export type WorkItemSource = "issue" | "pdf" | "recording";

export interface WorkItem {
  id: string;
  title: string;
  source: WorkItemSource;
  body: string;
}

export interface TaskSpec {
  title: string;
  role: ModelRole;
}

export interface Plan {
  workItemId: string;
  approved: boolean;
  tasks: TaskSpec[];
}

export interface Task {
  id: string;
  title: string;
  role: ModelRole;
  provider: Provider;
  model: string;
  worktree: string;
  branch: string;
}

export type WorktreeState =
  | "operation_requested"
  | "prepared"
  | "lease_active"
  | "workspace_scope_activated"
  | "committed";

export interface VerificationStep {
  action: string;
  target?: string;
  ok: boolean;
}

export interface VerificationResult {
  taskId: string;
  passed: boolean;
  steps: VerificationStep[];
  missingElements: string[];
}

export interface DiffSummary {
  filesChanged: number;
  added: number;
  removed: number;
}

export interface Attestation {
  workItemId: string;
  diff: DiffSummary;
  traceEvents: number;
  video: string;
  verdict: "verified" | "rejected";
}

export interface LogEvent {
  kind: string;
  tool?: string;
  result?: { added?: number; removed?: number };
  [key: string]: unknown;
}

export interface LogEntry {
  ts: string;
  sessionId: string;
  agent: string;
  event: LogEvent;
}
