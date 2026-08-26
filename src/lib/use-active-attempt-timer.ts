"use client";

import { useCallback, useEffect, useRef } from "react";
import { ActiveAttemptTimer } from "@/lib/active-attempt-timer";

function now() {
  return globalThis.performance?.now() ?? Date.now();
}

export function useActiveAttemptTimer(attemptKey: string) {
  const timerRef = useRef<ActiveAttemptTimer | null>(null);
  if (timerRef.current === null) timerRef.current = new ActiveAttemptTimer(now());

  useEffect(() => {
    timerRef.current?.reset(now());
  }, [attemptKey]);

  useEffect(() => {
    const timer = timerRef.current;
    if (!timer) return;
    const syncAvailability = () => timer.setAvailability(!document.hidden, document.hasFocus(), now());
    const recordActivity = () => timer.recordActivity(now());

    syncAvailability();
    document.addEventListener("visibilitychange", syncAvailability);
    window.addEventListener("focus", syncAvailability);
    window.addEventListener("blur", syncAvailability);
    window.addEventListener("pointerdown", recordActivity, { passive: true });
    window.addEventListener("keydown", recordActivity);
    window.addEventListener("scroll", recordActivity, { passive: true });
    window.addEventListener("touchstart", recordActivity, { passive: true });
    return () => {
      timer.pause(now());
      document.removeEventListener("visibilitychange", syncAvailability);
      window.removeEventListener("focus", syncAvailability);
      window.removeEventListener("blur", syncAvailability);
      window.removeEventListener("pointerdown", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("scroll", recordActivity);
      window.removeEventListener("touchstart", recordActivity);
    };
  }, []);

  return {
    pause: useCallback(() => timerRef.current?.pause(now()) ?? 0, []),
    resume: useCallback(() => timerRef.current?.resume(now()), []),
    reset: useCallback((startImmediately = true) => timerRef.current?.reset(now(), startImmediately), []),
  };
}
