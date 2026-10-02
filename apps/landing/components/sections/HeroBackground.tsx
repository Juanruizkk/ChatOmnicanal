"use client";

import { useReducedMotion } from "@/lib/useMedia";
import { HeroWaves } from "@/components/HeroWaves";

export function HeroBackground() {
  const reduced = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black_88%,transparent)]"
    >
      {!reduced && <HeroWaves preset="magenta" />}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg" />
    </div>
  );
}
