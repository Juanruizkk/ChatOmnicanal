"use client";

import { site } from "@/site.config";
import { waLink } from "@/lib/links";
import { SectionHeading } from "./SectionHeading";
import { GlowButton } from "@/components/ui/GlowButton";

const formatPrice = (price: number) => `USD ${price}`;

export function Plans() {
  return (
    <section id="planes" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading eyebrow="Planes" title="Una mensualidad, sin sorpresas.">
          Pagás por conversaciones atendidas por el bot, no por mensaje. El costo de la inteligencia artificial ya está
          incluido.
        </SectionHeading>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {site.plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl p-6 sm:p-8 ${
                plan.highlighted
                  ? "border-brand-gradient shadow-[0_30px_70px_-40px_rgb(31_116_224/0.55)]"
                  : "border border-line bg-bg/50"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white sm:left-8">
                  Recomendado
                </span>
              )}
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <h3 className="text-xl font-extrabold tracking-tight">{plan.name}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {plan.channels.map((ch) => (
                    <span key={ch} className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted">
                      {ch}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">{plan.summary}</p>
              <p className="mt-6 font-heading text-3xl font-extrabold tracking-tight">
                {plan.price === null ? "Consultar" : formatPrice(plan.price)}
                {plan.price !== null && <span className="text-base font-normal text-muted"> /mes</span>}
              </p>
              <p className="mt-1 text-sm text-muted">{plan.conversations}</p>
              {plan.note && <p className="mt-3 text-sm font-semibold text-brand-teal">{plan.note}</p>}
              <ul className="mt-6 space-y-2.5 border-t border-line pt-6 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span aria-hidden className="font-bold text-brand-teal">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <GlowButton
                  href={waLink(`Hola, me interesa el plan ${plan.name} de PentaBot.`)}
                  variant={plan.highlighted ? "dark" : "light"}
                >
                  {plan.cta}
                </GlowButton>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-3xl text-sm text-muted">
          Los mensajes de plantilla de WhatsApp (por ejemplo, cuando tu equipo responde pasadas las 24 horas) los cobra
          Meta directamente en tu cuenta, según su tarifa vigente. Las respuestas del bot dentro de la conversación no
          tienen ese costo.
        </p>
      </div>
    </section>
  );
}
