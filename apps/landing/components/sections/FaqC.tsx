import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHeading } from "./SectionHeading";

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: "¿Necesito un número de WhatsApp nuevo?",
    a: "No. Podés conectar el número que ya usás, incluso si hoy atendés con la app WhatsApp Business. La conexión se hace desde el panel, con tu cuenta de Meta.",
  },
  {
    q: "¿Qué pasa si me escriben fuera de horario?",
    a: "El bot sigue respondiendo las consultas de siempre. Si alguien pide hablar con una persona, le avisa cuándo lo van a atender y deja la conversación en cola para tu equipo.",
  },
  {
    q: "¿Puedo responder yo en cualquier momento?",
    a: "Sí. Desde la bandeja tomás el control de cualquier conversación y el bot deja de responder hasta que la marcás como resuelta.",
  },
  {
    q: "¿Qué cuesta WhatsApp aparte de la mensualidad?",
    a: "Las respuestas dentro de las 24 horas desde el último mensaje del cliente no tienen costo. Fuera de esa ventana, WhatsApp solo permite mensajes de plantilla, que Meta cobra en tu cuenta según su tarifa.",
  },
  {
    q: "¿El bot puede inventar respuestas?",
    a: "Responde únicamente con lo que cargaste. Si no tiene la información, lo dice y te pasa la conversación.",
  },
  {
    q: "¿Dónde quedan mis datos y los de mis clientes?",
    a: (
      <>
        Se usan solo para prestarte el servicio y no se venden ni se usan para publicidad. Podés pedir que se eliminen
        cuando quieras. El detalle está en la{" "}
        <Link href="/privacidad/" className="text-ink underline underline-offset-2">
          política de privacidad
        </Link>
        .
      </>
    ),
  },
];

export function FaqVariantC() {
  return (
    <section id="preguntas" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading eyebrow="Preguntas frecuentes" title="Lo que nos preguntan antes de empezar." />
        <div>
          {faqs.map((f, i) => (
            <details key={f.q} className="group border-b border-line last:border-0 [&[open]>summary]:text-ink">
              <summary className="flex cursor-pointer list-none select-none items-center gap-4 py-5 pr-1 [&::-webkit-details-marker]:hidden hover:bg-ink/[0.02] -mx-2 px-2 rounded-lg transition-colors">
                <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-muted/60 select-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-medium leading-snug">{f.q}</span>
                <span
                  aria-hidden
                  className="shrink-0 font-mono text-lg leading-none text-muted transition-transform duration-200 ease-in-out group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="ml-12 pb-5 pr-2 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
