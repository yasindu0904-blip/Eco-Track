import { createContext } from "react";

export const ListMemory = createContext<Map<string, unknown> | null>(null);
