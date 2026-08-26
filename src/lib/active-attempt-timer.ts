export const ACTIVE_ATTEMPT_IDLE_MS = 5 * 60 * 1000;
export const MAX_RECORDED_ATTEMPT_MS = 60 * 60 * 1000;

export class ActiveAttemptTimer {
  private accumulatedMs = 0;
  private runningSince: number | null;
  private lastActivityAt: number;
  private visible: boolean;
  private focused: boolean;
  private manuallyPaused = false;

  constructor(now = 0, visible = true, focused = true, private readonly idleMs = ACTIVE_ATTEMPT_IDLE_MS) {
    this.lastActivityAt = now;
    this.visible = visible;
    this.focused = focused;
    this.runningSince = visible && focused ? now : null;
  }

  private stop(now: number) {
    if (this.runningSince === null) return;
    const activeUntil = Math.min(now, this.lastActivityAt + this.idleMs);
    this.accumulatedMs += Math.max(0, activeUntil - this.runningSince);
    this.runningSince = null;
  }

  private start(now: number) {
    if (!this.manuallyPaused && this.visible && this.focused && now < this.lastActivityAt + this.idleMs) {
      this.runningSince = now;
    }
  }

  setAvailability(visible: boolean, focused: boolean, now: number) {
    this.stop(now);
    this.visible = visible;
    this.focused = focused;
    this.start(now);
  }

  recordActivity(now: number) {
    this.stop(now);
    this.lastActivityAt = now;
    this.start(now);
  }

  pause(now: number) {
    this.stop(now);
    this.manuallyPaused = true;
    return Math.min(MAX_RECORDED_ATTEMPT_MS, Math.round(this.accumulatedMs));
  }

  resume(now: number) {
    this.stop(now);
    this.manuallyPaused = false;
    this.lastActivityAt = now;
    this.start(now);
  }

  reset(now: number, startImmediately = true) {
    this.runningSince = null;
    this.accumulatedMs = 0;
    this.lastActivityAt = now;
    this.manuallyPaused = !startImmediately;
    this.start(now);
  }

  elapsed(now: number) {
    this.stop(now);
    const elapsed = Math.min(MAX_RECORDED_ATTEMPT_MS, Math.round(this.accumulatedMs));
    this.start(now);
    return elapsed;
  }
}
