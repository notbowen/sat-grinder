export const MAX_RECORDED_ATTEMPT_MS = 60 * 60 * 1000;

export class ActiveAttemptTimer {
  private accumulatedMs = 0;
  private runningSince: number | null;

  constructor(now = 0) {
    this.runningSince = now;
  }

  private recordedMs() {
    return Math.min(MAX_RECORDED_ATTEMPT_MS, Math.round(this.accumulatedMs));
  }

  private stop(now: number) {
    if (this.runningSince === null) return;
    this.accumulatedMs += Math.max(0, now - this.runningSince);
    this.runningSince = null;
  }

  pause(now: number) {
    this.stop(now);
    return this.recordedMs();
  }

  resume(now: number) {
    if (this.runningSince === null) this.runningSince = now;
  }

  reset(now: number, startImmediately = true) {
    this.accumulatedMs = 0;
    this.runningSince = startImmediately ? now : null;
  }

  elapsed(now: number) {
    const running = this.runningSince !== null;
    this.stop(now);
    const elapsed = this.recordedMs();
    if (running) this.runningSince = now;
    return elapsed;
  }
}
