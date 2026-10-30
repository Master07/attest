import type { Task, VerificationResult, VerificationStep } from "./types.js";

export interface Verifier {
  verify(task: Task): Promise<VerificationResult>;
}

const DEFAULT_FLOW: VerificationStep[] = [
  { action: "boot", target: "app", ok: true },
  { action: "navigate", target: "/checkout", ok: true },
  { action: "click", target: "[data-test=pay]", ok: true },
  { action: "assert", target: "order-confirmation", ok: true },
];

export class CuaVerifier implements Verifier {
  constructor(private readonly injectFailure = false) {}

  async verify(task: Task): Promise<VerificationResult> {
    const lastIndex = DEFAULT_FLOW.length - 1;
    const steps = DEFAULT_FLOW.map((s, i) => ({
      ...s,
      ok: this.injectFailure && i === lastIndex ? false : s.ok,
    }));
    const missingElements = steps.filter((s) => !s.ok).map((s) => s.target ?? s.action);
    return {
      taskId: task.id,
      passed: missingElements.length === 0,
      steps,
      missingElements,
    };
  }
}

export interface UiConfirmer {
  confirm(screenshot: string, expected: string[]): Promise<string[]>;
}

export class SamUiConfirmer implements UiConfirmer {
  async confirm(_screenshot: string, expected: string[]): Promise<string[]> {
    return expected;
  }
}
