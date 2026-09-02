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

  return {
    pause: useCallback(() => timerRef.current?.pause(now()) ?? 0, []),
    resume: useCallback(() => timerRef.current?.resume(now()), []),
    reset: useCallback((startImmediately = true) => timerRef.current?.reset(now(), startImmediately), []),
    elapsed: useCallback(() => timerRef.current?.elapsed(now()) ?? 0, []),
  };
}
