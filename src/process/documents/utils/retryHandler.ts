export interface RetryOptions {
  retries?: number;
  delay?: number;
  factor?: number;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, delay = 1000, factor = 2 } = options;
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (!isRetryableError(lastError)) {
        throw lastError;
      }
      if (i < retries - 1) {
        const currentDelay = delay * Math.pow(factor, i);
        console.log(`[DocumentIntake] Retrying after ${currentDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
      }
    }
  }
  throw lastError;
}

export function isRetryableError(error: Error): boolean {
  if (error.message.includes('429') || error.message.includes('500') || error.message.includes('503')) {
    return true;
  }
  if (error.name === 'AbortError' || (error as any).code === 'ECONNRESET') {
    return true;
  }
  return false;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
}

enum CircuitBreakerState {
  CLOSED,
  OPEN,
  HALF_OPEN,
}

export class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 10000; // 10 seconds
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onFailure() {
    this.failures++;
    if (this.state === CircuitBreakerState.HALF_OPEN || this.failures >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.lastFailureTime = Date.now();
    }
  }

  private onSuccess() {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.failures = 0;
      }
    } else {
      this.failures = 0;
    }
  }
}
