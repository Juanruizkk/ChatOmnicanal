import type { NextConfig } from "next";
import { findPlaceholders } from "./site.config";

const pending = findPlaceholders();
if (pending.length > 0) {
  console.warn(
    `\n⚠  site.config.ts todavía tiene datos de ejemplo en: ${pending.join(", ")}.\n` +
      "   Completalos antes de publicar: Meta los compara con el Business Portfolio.\n",
  );
}

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
