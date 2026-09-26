import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

import { ListMemory } from "./ListMemory";
export function useListState<T,>(key: string, initial: T) {
  const memory = useContext(ListMemory);
  const [state, update] = useState(() => ({ key, value: memory?.has(key) ? memory.get(key) as T : initial }));
  const value = state.key === key ? state.value : memory?.has(key) ? memory.get(key) as T : initial;
  const set = useCallback((next: T) => { memory?.set(key, next); update({ key, value: next }); }, [memory, key]);
  return [value, set] as const;
}
export type ListPage<T> = { items: T[]; nextCursor: string | null };
type Snapshot<T> = { key: string; pages: ListPage<T>[]; index: number; savedAt: number };
export function usePagedList<T,>(key: string, loader: (cursor?: string) => Promise<ListPage<T>>, append = false, enabled = true) {
  const memory = useContext(ListMemory);
  const read = useCallback(() => {
    const saved = memory?.get(key) as Snapshot<T> | undefined;
    return saved && Date.now() - saved.savedAt < 300_000 ? saved : { key, pages: [], index: 0, savedAt: 0 };
  }, [memory, key]);
  const [state, setState] = useState(read);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const latestLoader = useRef(loader);
  useLayoutEffect(() => { latestLoader.current = loader; }, [loader]);
  const version = useRef(0);
  const save = useCallback((next: Snapshot<T>) => { memory?.set(key, next); setState(next); }, [memory, key]);
  const fetchPage = useCallback(async (base: Snapshot<T>, cursor?: string) => {
    const request = ++version.current;
    setBusy(true); setError(undefined);
    try {
      const page = await latestLoader.current(cursor);
      if (request !== version.current) return;
      save({ key, pages: [...base.pages, page], index: base.pages.length, savedAt: Date.now() });
    } catch (reason) {
      if (request === version.current) setError(reason instanceof Error ? reason.message : "Unable to load this list.");
    } finally { if (request === version.current) setBusy(false); }
  }, [key, save]);
  useEffect(() => {
    const restored = read();
    // Synchronize the visible page with the user-scoped cache when its key changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(restored); setError(undefined); setBusy(false);
    if (enabled && !restored.pages.length) void fetchPage(restored);
    return () => { version.current += 1; };
  }, [key, read, fetchPage, enabled]);
  const visible = state.key === key ? state : { key, pages: [], index: 0, savedAt: 0 };
  const page = visible.pages[visible.index];
  return {
    items: append ? visible.pages.slice(0, visible.index + 1).flatMap(p => p.items) : page?.items ?? [],
    busy, error, pageNumber: visible.index + 1,
    hasPrevious: !append && visible.index > 0,
    hasNext: Boolean(page?.nextCursor),
    previous: () => { if (!busy && visible.index > 0) save({ ...visible, index: visible.index - 1 }); },
    next: () => {
      if (busy || !page?.nextCursor) return;
      if (visible.pages[visible.index + 1]) save({ ...visible, index: visible.index + 1 });
      else void fetchPage(visible, page.nextCursor);
    },
    refresh: () => busy
      ? Promise.resolve()
      : fetchPage({ key, pages: [], index: 0, savedAt: 0 }),
  };
}
export const eventSections = [
  { value: "upcoming", label: "Upcoming" }, { value: "ongoing", label: "Ongoing" },
  { value: "past", label: "Past" }, { value: "cancelled", label: "Cancelled" },
] as const;
export type EventSection = typeof eventSections[number]["value"];
export const reportSections = [{ value: "active", label: "Active" }, { value: "resolved", label: "Resolved" }, { value: "all", label: "All" }] as const;
export type ReportSection = typeof reportSections[number]["value"];

export const applicationSections = [{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "declined", label: "Declined" }, { value: "all", label: "All" }] as const;
export type ApplicationSection = typeof applicationSections[number]["value"];

export function listDateLabel(value: string, now = new Date()) {
  const date = new Date(value);
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? "Yesterday" : date.toLocaleDateString();
}

export function useScrollMemory(key?: string) {
  const memory = useContext(ListMemory);
  const read = useCallback(() => key ? (memory?.get("scroll:" + key) as number | undefined) ?? 0 : 0, [memory, key]);
  const write = useCallback((offset: number) => { if (key) memory?.set("scroll:" + key, offset); }, [memory, key]);
  return { read, write };
}

export function useInvalidateLists() {
  const memory = useContext(ListMemory);
  return useCallback((prefix: string) => {
    if (memory) for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key);
  }, [memory]);
}
