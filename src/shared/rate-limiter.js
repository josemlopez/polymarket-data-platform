export class RateLimiter {
  constructor({ maxTokens, refillRate }) {
    if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
      throw new Error('RateLimiter requires maxTokens > 0');
    }
    if (!Number.isFinite(refillRate) || refillRate <= 0) {
      throw new Error('RateLimiter requires refillRate > 0');
    }
    this.maxTokens = maxTokens;
    this.refillRate = refillRate; // tokens per minute
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  _refill() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    if (elapsedMs <= 0) return;

    const tokensToAdd = (elapsedMs * this.refillRate) / 60000;
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  tryAcquire() {
    this._refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  async acquire() {
    while (true) {
      if (this.tryAcquire()) return;

      const deficit = 1 - this.tokens;
      const waitMs = Math.ceil((deficit / this.refillRate) * 60000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
