"use client";

import { useSyncExternalStore } from "react";

/**
 * Lee una media query. Durante el prerender y la hidratación devuelve `false`,
 * así el HTML estático coincide y recién después se aplica la preferencia real.
 */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");
