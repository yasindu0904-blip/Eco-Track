import { useState, type ReactNode } from "react";
import { ListMemory } from "./ListMemory";

export function ListMemoryProvider({ children }: { children: ReactNode }) {
  const [memory] = useState(() => new Map<string, unknown>());
  return <ListMemory.Provider value={memory}>{children}</ListMemory.Provider>;
}
