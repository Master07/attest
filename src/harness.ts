import type { Plan, Task, WorkItem } from "./types.js";

export interface MergeResult {
  merged: string[];
  conflicts: string[];
}

export interface Harness {
  plan(item: WorkItem): Promise<Plan>;
  fanOut(item: WorkItem, plan: Plan): Promise<Task[]>;
  merge(tasks: Task[]): Promise<MergeResult>;
}

let counter = 0;
const nextId = (prefix: string): string => `${prefix}-${++counter}`;

export class MockHarness implements Harness {
  constructor(private readonly concurrency = 4) {}

  async plan(item: WorkItem): Promise<Plan> {
    return {
      workItemId: item.id,
      approved: true,
      tasks: [
        { title: "Fix the failing checkout flow", role: "worker" },
        { title: "Add regression coverage for the fix", role: "worker" },
        { title: "Resolve overlapping edits in billing", role: "reasoning" },
      ],
    };
  }

  async fanOut(_item: WorkItem, plan: Plan): Promise<Task[]> {
    return plan.tasks.map((spec) => {
      const id = nextId("task");
      return {
        id,
        title: spec.title,
        role: spec.role,
        provider: "meta",
        model: "",
        worktree: `.muse/worktrees/${id}`,
        branch: `attest/${id}`,
      };
    });
  }

  async merge(tasks: Task[]): Promise<MergeResult> {
    return { merged: tasks.map((t) => t.branch), conflicts: [] };
  }

  get parallelLimit(): number {
    return this.concurrency;
  }
}
