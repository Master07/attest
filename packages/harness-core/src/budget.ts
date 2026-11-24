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

  /**
   * Retry policy capped by this budget's maxRetries. The caller supplies its own
   * backoff schedule and transient predicate; the budget owns how many retries
   * may be spent from that schedule.
   */
  retryPolicy(
    backoffMs: number[],
    isTransient: (err: unknown) => boolean,
    sleep?: (ms: number) => Promise<void>,
  ): RetryPolicy {
    const policy: RetryPolicy = { backoffMs, maxRetries: this.maxRetries, isTransient };
    if (sleep !== undefined) policy.sleep = sleep;
    return policy;
  }
}

export function createBudget(opts: BudgetOptions): Budget {
  return new Budget(opts);
}

export interface RetryOptions {
  backoffMs: number[];
  /** Retries allowed after the first attempt. Defaults to backoffMs.length (the whole schedule). */
  maxRetries?: number;
  isTransient: (err: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

/** Retry options whose limit comes from a Budget (see Budget.retryPolicy). */
export interface RetryPolicy extends RetryOptions {
  maxRetries: number;
}

/** Retry transient failures with backoff; anything else (e.g. 4xx) throws immediately. */
export async function withRetries<T>(send: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const backoffMs = opts.maxRetries === undefined ? opts.backoffMs : opts.backoffMs.slice(0, opts.maxRetries);
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (err) {
      const wait = backoffMs[attempt];
      if (!opts.isTransient(err) || wait === undefined) throw err;
      await sleep(wait);
    }
  }
}
