"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
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

function FaqItem({ q, a, isOpen, onToggle }: { q: string; a: ReactNode; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-line last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left font-medium transition-colors hover:text-ink/70"
        aria-expanded={isOpen}
      >
        <span>{q}</span>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="shrink-0 font-mono text-xl leading-none text-muted"
          aria-hidden
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-8 text-sm leading-relaxed text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqVariantA() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="preguntas" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading eyebrow="Preguntas frecuentes" title="Lo que nos preguntan antes de empezar." />
        <div className="border-t border-line">
          {faqs.map((f, i) => (
            <FaqItem
              key={f.q}
              q={f.q}
              a={f.a}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
