"use client";

// 찜(저장) 스토어 — localStorage 기반, 라우트 간 공유. useSyncExternalStore로 구독.
import { useSyncExternalStore } from "react";

const KEY = "sbl:saved";
const EMPTY: ReadonlySet<string> = new Set();

let ids: Set<string> | null = null;
const listeners = new Set<() => void>();

function load(): Set<string> {
  if (ids) return ids;
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    ids = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    ids = new Set();
  }
  return ids;
}

function commit(next: Set<string>) {
  ids = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* 무시 */
  }
  listeners.forEach((l) => {
    l();
  });
}

export function toggleSaved(id: string) {
  const next = new Set(load());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  commit(next);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): ReadonlySet<string> {
  return load();
}

function getServerSnapshot(): ReadonlySet<string> {
  return EMPTY;
}

export function useSaved() {
  const savedIds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    savedIds,
    count: savedIds.size,
    isSaved: (id: string) => savedIds.has(id),
    toggle: toggleSaved,
  };
}
