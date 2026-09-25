"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore } from "react";

// A tiny external store for playback time so only subscribers re-render (the transcript, timeline and
// chapter list), not the whole meeting page, as the video plays.
export type Player = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  seek: (ms: number, opts?: { play?: boolean }) => void;
  playClip: (startMs: number, endMs: number) => void;
  toggle: () => void;
  getTime: () => number;
  subscribe: (fn: () => void) => () => void;
  emit: () => void;
  clipEnd: React.RefObject<number | null>;
};

const Ctx = createContext<Player | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const listeners = useRef(new Set<() => void>());
  const clipEnd = useRef<number | null>(null);
  const pending = useRef<number | null>(null);

  const api = useMemo<Player>(() => {
    const getTime = () => Math.round((videoRef.current?.currentTime ?? (pending.current ?? 0) / 1000) * 1000);
    const emit = () => listeners.current.forEach((l) => l());
    return {
      videoRef,
      clipEnd,
      getTime,
      emit,
      subscribe: (fn) => {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
      },
      seek: (ms, opts) => {
        const v = videoRef.current;
        clipEnd.current = null;
        if (!v) {
          pending.current = ms;
          return;
        }
        v.currentTime = Math.max(0, ms / 1000);
        if (opts?.play !== false) v.play().catch(() => {});
        emit();
      },
      playClip: (startMs, endMs) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = startMs / 1000;
        clipEnd.current = endMs;
        v.play().catch(() => {});
        emit();
      },
      toggle: () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play().catch(() => {});
        else v.pause();
      },
    };
  }, []);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const p = useContext(Ctx);
  if (!p) throw new Error("usePlayer outside PlayerProvider");
  return p;
}

/** Current playback time, quantised to `stepMs` so subscribers re-render at most that often. */
export function useTime(stepMs = 250) {
  const p = usePlayer();
  const get = useCallback(() => Math.floor(p.getTime() / stepMs) * stepMs, [p, stepMs]);
  return useSyncExternalStore(p.subscribe, get, () => 0);
}

/** Index of the utterance/chapter containing `t` (binary search over sorted starts). */
export function indexAt<T extends { startMs: number }>(items: T[], t: number) {
  let lo = 0;
  let hi = items.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid].startMs <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
