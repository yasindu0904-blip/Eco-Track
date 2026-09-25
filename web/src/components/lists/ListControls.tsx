import { useState, type ReactNode } from "react";
import "./lists.css";

export function ListSections<T extends string>({ value, options, onChange }: { value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <nav className="list-sections" aria-label="List sections">{options.map(option => <button type="button" key={option.value} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}</nav>;
}
export function PageControls({ pageNumber, hasPrevious, hasNext, busy, previous, next, refresh }: { pageNumber: number; hasPrevious: boolean; hasNext: boolean; busy: boolean; previous: () => void; next: () => void; refresh?: () => void }) {
  return <nav className="list-pagination" aria-label="List pages">
    <button type="button" disabled={busy || !hasPrevious} onClick={previous}>Previous page</button>
    <span aria-live="polite">Page {pageNumber}</span>
    <button type="button" disabled={busy || !hasNext} onClick={next}>Next page</button>
    {refresh && <button type="button" disabled={busy} onClick={refresh}>Refresh</button>}
  </nav>;
}
// Existing cursor loaders keep their data; only one batch is rendered at a time.
export function ListWindow<T>({ items, children, hasMore = false, loadMore, busy = false }: { items: T[]; children: (items: T[]) => ReactNode; hasMore?: boolean; loadMore?: () => void; busy?: boolean }) {
  const [index, setIndex] = useState(0);
  const [offsets, setOffsets] = useState([0]);
  let current = index;
  while (current > 0 && offsets[current] >= items.length) current -= 1;
  const start = offsets[current];
  const end = offsets[current + 1] ?? start + 20;
  const hasLoadedNext = end < items.length;
  return <><div className="list-window">{children(items.slice(start, end))}</div>
    {(items.length > 20 || hasMore || current > 0) && <PageControls pageNumber={current + 1} hasPrevious={current > 0} hasNext={hasLoadedNext || hasMore} busy={busy} previous={() => setIndex(current - 1)} next={() => {
      setOffsets([...offsets.slice(0, current + 1), Math.min(end, items.length)]);
      setIndex(current + 1);
      if (!hasLoadedNext) loadMore?.();
    }} />}
  </>;
}
