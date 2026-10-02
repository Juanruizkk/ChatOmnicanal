import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { InboxMockup } from "@/components/sections/InboxMockup";
import { Scope } from "@/components/sections/Scope";
import { Plans } from "@/components/sections/Plans";
import { Contact } from "@/components/sections/Contact";

// Channel variants
import { ChannelsVariantA } from "@/components/sections/ChannelsA";
import { ChannelsVariantB } from "@/components/sections/ChannelsB";
import { ChannelsVariantC } from "@/components/sections/ChannelsC";

// FAQ variants
import { FaqVariantA } from "@/components/sections/FaqA";
import { FaqVariantB } from "@/components/sections/FaqB";
import { FaqVariantC } from "@/components/sections/FaqC";

function VariantLabel({ label, description }: { label: string; description: string }) {
  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 border-y border-dashed border-ink/20 bg-ink/[0.03] px-6 py-2 backdrop-blur-sm">
      <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-bg">
        {label}
      </span>
      <span className="font-mono text-xs text-muted">{description}</span>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />

      {/* ── Channels ── */}
      <VariantLabel label="Canales A" description="SpotlightCard + iconos + lift al hover" />
      <ChannelsVariantA />

      <VariantLabel label="Canales B" description="GlareCard 3D tilt + glare con el mouse" />
      <ChannelsVariantB />

      <VariantLabel label="Canales C" description="Stripe lateral + deslizamiento editorial" />
      <ChannelsVariantC />

      <InboxMockup />
      <Scope />
      <Plans />

      {/* ── FAQ ── */}
      <VariantLabel label="FAQ A" description="Accordion motion — altura animada, + rota a ×" />
      <FaqVariantA />

      <VariantLabel label="FAQ B" description="Cards independientes — múltiples abiertos, chevron" />
      <FaqVariantB />

      <VariantLabel label="FAQ C" description="<details> nativo — numerado, hover sutil" />
      <FaqVariantC />

      <Contact />
    </>
  );
}
