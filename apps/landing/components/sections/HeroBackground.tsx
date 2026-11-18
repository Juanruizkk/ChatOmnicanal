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
      {/* Halo de marca: se ve siempre, también con animaciones reducidas */}
      <div className="absolute -right-40 -top-40 size-[44rem] rounded-full bg-brand-cyan/20 blur-[120px]" />
      <div className="absolute -left-52 top-1/3 size-[36rem] rounded-full bg-brand-violet/15 blur-[120px]" />
      {!reduced && <HeroWaves preset="pentabot" />}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg" />
    </div>
  );
}
