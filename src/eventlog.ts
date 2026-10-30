import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LogEntry } from "./types.js";

export class EventLog {
  private readonly entries: LogEntry[] = [];
  private pending: LogEntry[] = [];

  constructor(
    private readonly path: string,
    private readonly sessionId: string,
  ) {}

  append(agent: string, kind: string, data: Record<string, unknown> = {}): LogEntry {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      sessionId: this.sessionId,
      agent,
      event: { kind, ...data },
    };
    this.entries.push(entry);
    this.pending.push(entry);
    return entry;
  }

  flush(): void {
    if (this.pending.length === 0) return;
    mkdirSync(dirname(this.path), { recursive: true });
    const lines = this.pending.map((e) => JSON.stringify(e)).join("\n");
    appendFileSync(this.path, `${lines}\n`, "utf8");
    this.pending = [];
  }

  all(): readonly LogEntry[] {
    return this.entries;
  }

  get location(): string {
    return this.path;
  }
}
