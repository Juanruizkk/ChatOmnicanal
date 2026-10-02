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

export function FaqVariantB() {
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set([0]));

  const toggle = (i: number) => {
    setOpenIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <section id="preguntas" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading eyebrow="Preguntas frecuentes" title="Lo que nos preguntan antes de empezar." />
        <div className="flex flex-col gap-3">
          {faqs.map((f, i) => {
            const isOpen = openIndexes.has(i);
            return (
              <motion.div
                key={f.q}
                layout
                className={`overflow-hidden rounded-xl border transition-colors duration-200 ${
                  isOpen ? "border-ink/20 bg-surface shadow-sm" : "border-line bg-surface/60"
                }`}
              >
                <button
                  onClick={() => toggle(i)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className={`font-medium transition-colors ${isOpen ? "text-ink" : "text-ink/80"}`}>
                    {f.q}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="shrink-0 text-muted"
                    aria-hidden
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
                      <path d="M3 6l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
