import { createContext, useCallback, useContext, useLayoutEffect, useRef } from "react";

export type HeaderOptions = {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  depth: number;
};

export const AppHeaderContext = createContext<{
  register: (id: symbol, options: HeaderOptions) => void;
  unregister: (id: symbol) => void;
} | null>(null);

export const ScreenDepthContext = createContext(0);
export const SafeAreaHandledContext = createContext(false);

export function usePageHeader(title: string, onBack?: () => void, backLabel = "Back") {
  const shell = useContext(AppHeaderContext);
  const depth = useContext(ScreenDepthContext);
  const id = useRef(Symbol("page-header")).current;
  const back = useRef(onBack);
  useLayoutEffect(() => { back.current = onBack; }, [onBack]);
  const goBack = useCallback(() => back.current?.(), []);
  const hasBack = Boolean(onBack);

  useLayoutEffect(() => {
    shell?.register(id, { title, depth, onBack: hasBack ? goBack : undefined, backLabel });
  }, [shell, id, title, depth, hasBack, goBack, backLabel]);
  useLayoutEffect(() => () => shell?.unregister(id), [shell, id]);
  return shell !== null;
}
