"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/useMedia";

const GradientWaves = dynamic(() => import("@/components/GradientWaves"), {
  ssr: false,
});

export function HeroBackground() {
  const reduced = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black_65%,transparent)]"
    >
      {!reduced && (
        <div className="absolute inset-0 flex items-center justify-center opacity-70 dark:opacity-60">
          <div style={{ width: "1080px", height: "1080px", position: "relative" }}>
            <GradientWaves
              horizonColor="#5227FF"
              waveColor="#FF9FFC"
              crestColor="#FFFFFF"
              speed={0.4}
              amplitude={2.5}
              waveScale={0.6}
              waveRatio={0.9}
              swell={35}
              turbulence={20}
              tilt={1.11}
              zoom={1}
              height={5.5}
              fogDepth={15}
              detail="medium"
              brightness={1}
              opacity={1}
              grain
              grainIntensity={0.05}
              mouseInteraction
              parallaxStrength={0.5}
            />
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg" />
    </div>
  );
}
