// Budget: step caps, retry limits, one retry on transient errors.
// The numbers belong to the caller; the core only enforces them.

export interface BudgetOptions {
  maxSteps: number;
  maxRetries: number;
  transientRetry: number;
}

export class Budget {
  readonly maxSteps: number;
  readonly maxRetries: number;
  readonly transientRetry: number;
  private stepsUsed = 0;
  private transientUsed = 0;

  constructor(opts: BudgetOptions) {
    this.maxSteps = opts.maxSteps;
    this.maxRetries = opts.maxRetries;
    this.transientRetry = opts.transientRetry;
  }

  /** Record one completed step. */
  spend(): void {
    this.stepsUsed += 1;
  }

  /** True once maxSteps steps have been spent. */
  exhausted(): boolean {
    return this.stepsUsed >= this.maxSteps;
  }

  /**
   * Consume one transient retry (e.g. falling back to stateless replay after a
   * server-side-storage failure). Returns false when the allowance is spent.
   */
  useTransientRetry(): boolean {
    if (this.transientUsed >= this.transientRetry) return false;
    this.transientUsed += 1;
    return true;
  }
}

export function createBudget(opts: BudgetOptions): Budget {
  return new Budget(opts);
}

export interface RetryOptions {
  backoffMs: number[];
  isTransient: (err: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

/** Retry transient failures with backoff; anything else (e.g. 4xx) throws immediately. */
export async function withRetries<T>(send: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (err) {
      const wait = opts.backoffMs[attempt];
      if (!opts.isTransient(err) || wait === undefined) throw err;
      await sleep(wait);
    }
  }
}
