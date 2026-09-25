// @vitest-environment jsdom
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ListMemoryProvider } from "./ListMemoryProvider";
import { usePagedList } from "./usePagedList";

afterEach(cleanup);

test("pages on demand, reuses previous pages, and refreshes from the beginning", async () => {
  const loader = vi.fn(async (cursor?: string) => cursor
    ? { items: [3, 4], nextCursor: null }
    : { items: [1, 2], nextCursor: "second" });
  const { result } = renderHook(() => usePagedList("events", loader), { wrapper: ListMemoryProvider });
  await waitFor(() => expect(result.current.items).toEqual([1, 2]));
  expect(loader).toHaveBeenCalledTimes(1);
  act(() => result.current.next());
  await waitFor(() => expect(result.current.items).toEqual([3, 4]));
  expect(loader).toHaveBeenLastCalledWith("second");
  act(() => result.current.previous());
  expect(result.current.items).toEqual([1, 2]);
  act(() => result.current.next());
  expect(loader).toHaveBeenCalledTimes(2);
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.items).toEqual([1, 2]));
  expect(result.current.pageNumber).toBe(1);
});

test("a late response cannot replace the newly selected section", async () => {
  let finishOld!: (page: { items: string[]; nextCursor: null }) => void;
  const old = new Promise<{ items: string[]; nextCursor: null }>(resolve => { finishOld = resolve; });
  const { result, rerender } = renderHook(({ section }) => usePagedList(section,
    () => section === "upcoming" ? old : Promise.resolve({ items: ["past"], nextCursor: null })),
  { initialProps: { section: "upcoming" }, wrapper: ListMemoryProvider });
  rerender({ section: "past" });
  await waitFor(() => expect(result.current.items).toEqual(["past"]));
  await act(async () => finishOld({ items: ["old"], nextCursor: null }));
  expect(result.current.items).toEqual(["past"]);
  expect(result.current.busy).toBe(false);
});

test("failed load-more retains existing rows and can be retried without duplicates", async () => {
  const loader = vi.fn()
    .mockResolvedValueOnce({ items: [1], nextCursor: "next" })
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ items: [2], nextCursor: null });
  const { result } = renderHook(() => usePagedList<number>("joined", loader, true));
  await waitFor(() => expect(result.current.items).toEqual([1]));
  act(() => result.current.next());
  await waitFor(() => expect(result.current.error).toBe("Offline"));
  expect(result.current.items).toEqual([1]);
  act(() => result.current.next());
  await waitFor(() => expect(result.current.items).toEqual([1, 2]));
  expect(result.current.hasNext).toBe(false);
});

test("switching back restores the section's selected page", async () => {
  const loader = vi.fn(async (cursor?: string) => ({ items: [cursor ?? "first"], nextCursor: cursor ? null : "second" }));
  const { result, rerender } = renderHook(({ section }) => usePagedList(section, loader),
    { initialProps: { section: "upcoming" }, wrapper: ListMemoryProvider });
  await waitFor(() => expect(result.current.items).toEqual(["first"]));
  act(() => result.current.next());
  await waitFor(() => expect(result.current.pageNumber).toBe(2));
  rerender({ section: "past" });
  await waitFor(() => expect(result.current.items).toEqual(["first"]));
  rerender({ section: "upcoming" });
  await waitFor(() => expect(result.current.items).toEqual(["second"]));
  expect(result.current.pageNumber).toBe(2);
  expect(loader).toHaveBeenCalledTimes(3);
});
