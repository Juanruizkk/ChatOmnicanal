import { site } from "@/site.config";
import { waLink } from "@/lib/links";
import { SectionHeading } from "./SectionHeading";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(price);

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
              className={`flex flex-col rounded-2xl border p-6 sm:p-8 ${
                plan.highlighted ? "border-ink/25 bg-bg" : "border-line bg-bg/50"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <h3 className="text-xl font-semibold tracking-tight">{plan.name}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {plan.channels.map((ch) => (
                    <span key={ch} className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted">
                      {ch}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">{plan.summary}</p>
              <p className="mt-6 text-3xl font-semibold tracking-tight">
                {plan.price === null ? "Consultar" : formatPrice(plan.price)}
                {plan.price !== null && <span className="text-base font-normal text-muted"> /mes</span>}
              </p>
              <p className="mt-1 text-sm text-muted">{plan.conversations}</p>
              <ul className="mt-6 space-y-2.5 border-t border-line pt-6 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span aria-hidden className="text-muted">
                      —
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={waLink(`Hola, quiero consultar por el plan ${plan.name}.`)}
                className={`mt-8 rounded-full px-5 py-3 text-center text-sm font-medium transition-opacity hover:opacity-85 ${
                  plan.highlighted ? "bg-ink text-bg" : "border border-line bg-surface"
                }`}
              >
                Consultar por el plan {plan.name}
              </a>
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
