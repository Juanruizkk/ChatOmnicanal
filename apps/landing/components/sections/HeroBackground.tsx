"use client";

import dynamic from "next/dynamic";
import { useMedia, useReducedMotion } from "@/lib/useMedia";

const Prism = dynamic(() => import("@/components/reactbits/Prism"), { ssr: false });

/** Prisma de React Bits detrás del hero. Con reduced motion queda solo el degradé estático. */
export function HeroBackground() {
  const reduced = useReducedMotion();
  const dark = useMedia("(prefers-color-scheme: dark)");

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_30%,color-mix(in_oklab,var(--ig)_14%,transparent),transparent),radial-gradient(50%_45%_at_90%_60%,color-mix(in_oklab,var(--wa)_14%,transparent),transparent),radial-gradient(45%_40%_at_55%_70%,color-mix(in_oklab,var(--ms)_12%,transparent),transparent)]" />
      {!reduced && (
        <div className={`absolute inset-0 ${dark ? "opacity-70" : "opacity-60"}`}>
          <Prism
            key={dark ? "dark" : "light"}
            animationType="rotate"
            timeScale={0.35}
            height={3.6}
            baseWidth={5.5}
            scale={3.4}
            glow={dark ? 0.9 : 1}
            noise={0}
            hueShift={0.35}
            colorFrequency={0.9}
            bloom={1}
            offset={{ x: 260, y: 40 }}
            lightMode={!dark}
            suspendWhenOffscreen
          />
        </div>
      )}
    </div>
  );
}
