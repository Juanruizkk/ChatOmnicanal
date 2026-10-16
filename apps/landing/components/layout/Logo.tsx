import Image from "next/image";
import logoSrc from "@/components/logos/pentabotlogo.jpeg";
import { site } from "@/site.config";

export function Logo({ height = 48 }: { height?: number }) {
  return (
    <Image
      src={logoSrc}
      alt={site.brand}
      height={height}
      width={0}
      style={{ width: "auto", height }}
      priority
    />
  );
}
