import { createContext } from "react";

// A null context value indicates that no list memory provider is present.
export const ListMemory = createContext<Map<string, unknown> | null>(null);
