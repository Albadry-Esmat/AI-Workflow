class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = Math.max(1, Number(options.failureThreshold || 3));
    this.cooldownMs = Math.max(1, Number(options.cooldownMs || 30000));
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.lastErrorCategory = null;
  }
  assertCanCall(now = Date.now()) {
    if (this.state === "closed") return true;
    if (this.state === "open" && now - this.openedAt >= this.cooldownMs) {
      this.state = "half-open";
      return true;
    }
    const error = new Error(`CIRCUIT_OPEN: runtime circuit is ${this.state}`);
    error.code = "CIRCUIT_OPEN";
    error.state = this.state;
    throw error;
  }
  recordSuccess() {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.lastErrorCategory = null;
  }
  recordFailure(category = "runtime", now = Date.now()) {
    this.consecutiveFailures += 1;
    this.lastErrorCategory = String(category).slice(0, 80);
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = now;
    }
  }
  snapshot() {
    return { state: this.state, consecutive_failures: this.consecutiveFailures, last_error_category: this.lastErrorCategory, opened_at: this.openedAt, failure_threshold: this.failureThreshold, cooldown_ms: this.cooldownMs };
  }
}
module.exports = { CircuitBreaker };
