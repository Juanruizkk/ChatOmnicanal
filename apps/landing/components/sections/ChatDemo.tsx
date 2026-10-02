"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/useMedia";

type Channel = "whatsapp" | "instagram" | "messenger";

type Scene = {
  channel: Channel;
  label: string;
  contact: string;
  question: string;
  answer: string;
  status: { text: string; tone: "bot" | "queue" };
};

const scenes: Scene[] = [
  {
    channel: "whatsapp",
    label: "WhatsApp",
    contact: "Lucía",
    question: "Hola! Hacen envíos a Rosario?",
    answer:
      "¡Hola Lucía! Sí, enviamos a Rosario por correo en 3 a 5 días hábiles. Cuesta $6.500 y es gratis en compras desde $80.000.",
    status: { text: "Respondió el bot", tone: "bot" },
  },
  {
    channel: "instagram",
    label: "Instagram",
    contact: "@martin.gz",
    question: "hasta qué hora abren hoy?",
    answer: "Hoy sábado estamos de 10 a 14 h en Av. Corrientes 1234. El lunes volvemos de 9 a 19 h.",
    status: { text: "Respondió el bot", tone: "bot" },
  },
  {
    channel: "messenger",
    label: "Messenger",
    contact: "Carla Benítez",
    question: "Quiero hablar con alguien por un cambio",
    answer:
      "Te paso con una persona del equipo. Ahora estamos fuera de horario: te responden el lunes desde las 9 h.",
    status: { text: "En cola · lunes 9:00", tone: "queue" },
  },
];

const channelColor: Record<Channel, string> = {
  whatsapp: "bg-wa",
  instagram: "bg-ig",
  messenger: "bg-ms",
};

type Phase = "question" | "typing" | "answer";
const timings: Record<Phase, number> = { question: 900, typing: 1400, answer: 4200 };

export function ChatDemo() {
  const [index, setIndex] = useState(0);
  const [currentPhase, setPhase] = useState<Phase>("question");
  const [manual, setManual] = useState(false);
  const reduceMotion = useReducedMotion();
  // Con reduced motion no hay secuencia: se muestra la conversación completa.
  const auto = !manual && !reduceMotion;
  const phase: Phase = auto ? currentPhase : "answer";

  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => {
      if (phase === "question") setPhase("typing");
      else if (phase === "typing") setPhase("answer");
      else {
        setIndex((i) => (i + 1) % scenes.length);
        setPhase("question");
      }
    }, timings[phase]);
    return () => clearTimeout(id);
  }, [auto, phase]);

  const scene = scenes[index];

  return (
    <div className="w-full max-w-md">
      <div role="tablist" aria-label="Canal de ejemplo" className="mb-3 flex gap-1.5">
        {scenes.map((s, i) => (
          <button
            key={s.channel}
            role="tab"
            aria-selected={i === index}
            onClick={() => {
              setManual(true);
              setIndex(i);
            }}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              i === index ? "border-ink/20 bg-surface text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <span className={`size-1.5 rounded-full ${channelColor[s.channel]}`} />
            {s.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        aria-live="polite"
        className="overflow-hidden rounded-2xl border border-line bg-surface/90 shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)] backdrop-blur"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className={`size-2 rounded-full ${channelColor[scene.channel]}`} />
            <span className="text-sm font-medium">{scene.contact}</span>
            <span className="text-xs text-muted">· {scene.label}</span>
          </div>
          <span
            className={`font-mono text-[11px] transition-opacity duration-300 ${phase === "answer" ? "opacity-100" : "opacity-0"} ${
              scene.status.tone === "queue" ? "text-ig" : "text-bot"
            }`}
          >
            {scene.status.text}
          </span>
        </div>

        <div className="flex min-h-56 flex-col gap-3 p-4">
          <p key={`q-${index}`} className="max-w-[80%] self-start rounded-2xl rounded-tl-sm bg-bg px-3.5 py-2.5 text-sm animate-[rise_.35s_ease-out]">
            {scene.question}
          </p>

          {phase === "typing" && (
            <p
              aria-label="El bot está escribiendo"
              className="flex gap-1 self-end rounded-2xl rounded-tr-sm bg-bot/10 px-3.5 py-3.5"
            >
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-bounce rounded-full bg-bot/70"
                  style={{ animationDelay: `${d * 120}ms` }}
                />
              ))}
            </p>
          )}

          {phase === "answer" && (
            <div key={`a-${index}`} className="max-w-[85%] self-end animate-[rise_.35s_ease-out]">
              <p className="rounded-2xl rounded-tr-sm bg-bot px-3.5 py-2.5 text-sm text-white dark:text-[#0e0b1f]">
                {scene.answer}
              </p>
              <p className="mt-1 text-right font-mono text-[10px] uppercase tracking-wider text-muted">Bot</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
