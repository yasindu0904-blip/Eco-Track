import { createContext } from "react";

// The provider supplies the shared map; consumers outside it receive null.
export const ListMemory = createContext<Map<string, unknown> | null>(null);
