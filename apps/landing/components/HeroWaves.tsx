"use client";

import dynamic from "next/dynamic";

const GradientWaves = dynamic(() => import("@/components/GradientWaves"), {
  ssr: false,
});

// ─── Variantes ────────────────────────────────────────────────────────────────
//
//  "violeta"  — Profundidad eléctrica. Azul índigo + olas violeta + cresta lavanda.
//               La más cercana a la dirección original, pero mucho más presente.
//
//  "aurora"   — Mar esmeralda. Horizonte selva + olas verde menta + cresta dorada.
//               Fresca, orgánica, diferenciadora.
//
//  "cosmos"   — Firmamento. Navy profundo + olas celeste brillante + cresta hielo.
//               Sofisticada y confiable; ideal para SaaS B2B.
//
//  "magenta"  — Energía. Carmín + olas rosa eléctrico + cresta pétalo.
//               Audaz y memorable; llama a la acción.
//
// Para cambiar la variante activa, modificá la prop `preset` en <HeroWaves />.
// ──────────────────────────────────────────────────────────────────────────────

const PRESETS = {
  violeta: {
    horizonColor: "#1E0059",
    waveColor: "#6D00FF",
    crestColor: "#C4B5FD",
    speed: 0.35,
    amplitude: 3.5,
    waveScale: 0.65,
    waveRatio: 0.88,
    swell: 38,
    turbulence: 22,
    tilt: 1.08,
    zoom: 1,
    height: 6.5,
    fogDepth: 2,
    detail: "medium" as const,
    brightness: 1.8,
    opacity: 1,
    grain: true,
    grainIntensity: 0.06,
    mouseInteraction: true,
    parallaxStrength: 0.5,
  },

  aurora: {
    horizonColor: "#012A1A",
    waveColor: "#00D97E",
    crestColor: "#FFD000",
    speed: 0.28,
    amplitude: 3.2,
    waveScale: 0.58,
    waveRatio: 0.92,
    swell: 30,
    turbulence: 16,
    tilt: 1.05,
    zoom: 1,
    height: 5.8,
    fogDepth: 2,
    detail: "medium" as const,
    brightness: 1.8,
    opacity: 1,
    grain: true,
    grainIntensity: 0.05,
    mouseInteraction: true,
    parallaxStrength: 0.45,
  },

  cosmos: {
    horizonColor: "#020B1F",
    waveColor: "#0080FF",
    crestColor: "#7DD3FC",
    speed: 0.3,
    amplitude: 3,
    waveScale: 0.62,
    waveRatio: 0.9,
    swell: 32,
    turbulence: 14,
    tilt: 1.12,
    zoom: 1,
    height: 6,
    fogDepth: 2,
    detail: "medium" as const,
    brightness: 1.9,
    opacity: 1,
    grain: true,
    grainIntensity: 0.05,
    mouseInteraction: true,
    parallaxStrength: 0.5,
  },

  magenta: {
    horizonColor: "#5C001A",
    waveColor: "#FF0050",
    crestColor: "#FF85A1",
    speed: 0.4,
    amplitude: 4.5,
    waveScale: 0.72,
    waveRatio: 0.85,
    swell: 48,
    turbulence: 26,
    tilt: 1.14,
    zoom: 1,
    height: 4.5,
    fogDepth: 10,
    detail: "medium" as const,
    brightness: 2.2,
    opacity: 1,
    grain: true,
    grainIntensity: 0.06,
    mouseInteraction: true,
    parallaxStrength: 0.55,
  },
} as const;

type Preset = keyof typeof PRESETS;

interface HeroWavesProps {
  preset?: Preset;
}

// ← cambiá "violeta" por cualquiera de: "aurora" | "cosmos" | "magenta"
export function HeroWaves({ preset = "violeta" }: HeroWavesProps) {
  return (
    <div className="absolute inset-0">
      <GradientWaves {...PRESETS[preset]} />
    </div>
  );
}
