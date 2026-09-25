import { useLayoutEffect } from "react";
import { useScrollMemory } from "./usePagedList";

export function useListScroll(key: string, ready = true) {
  const { read, write } = useScrollMemory(key);
  useLayoutEffect(() => {
    if (!ready) return;
    const saved = read();
    if (saved !== window.scrollY) window.scrollTo({ top: saved, behavior: "instant" });
    const remember = () => write(window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => { window.removeEventListener("scroll", remember); };
  }, [read, write, ready]);
}
