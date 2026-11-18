import Image from "next/image";
import isotipo from "@/components/logos/isotipo.png";
import { site } from "@/site.config";

/**
 * Logotipo de PentaBot: isotipo + nombre en dos tonos ("Penta" tinta, "Bot" cian),
 * igual que en el manual de marca. `tone="light"` es para fondos oscuros.
 */
export function Logo({
  size = 36,
  tone = "dark",
  tagline = false,
}: {
  size?: number;
  tone?: "dark" | "light";
  tagline?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label={site.brand} role="img">
      <Image src={isotipo} alt="" width={size} height={size} priority />
      <span className="flex flex-col leading-none">
        <span
          className="font-heading font-extrabold tracking-[-0.02em]"
          style={{ fontSize: Math.round(size * 0.62) }}
        >
          <span className={tone === "light" ? "text-white" : "text-ink"}>Penta</span>
          <span className="text-brand-cyan">Bot</span>
        </span>
        {tagline && (
          <span
            className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
              tone === "light" ? "text-white/60" : "text-muted"
            }`}
          >
            Chatbot omnicanal
          </span>
        )}
      </span>
    </span>
  );
}
