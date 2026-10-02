"use client";

import React, { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/useMedia";
import {
  WhatsAppIcon,
  InstagramIcon,
  MessengerIcon,
} from "@/components/icons/Channels";
import {
  Phone,
  Video,
  MoreVertical,
  Smile,
  Paperclip,
  Camera,
  Mic,
  Check,
  CheckCheck,
  Heart,
  Image as ImageIcon,
  Plus,
  Info,
  ChevronLeft,
  ThumbsUp,
  Sparkles,
} from "lucide-react";

type Channel = "whatsapp" | "instagram" | "messenger";

type Scene = {
  channel: Channel;
  label: string;
  contact: string;
  avatarText: string;
  avatarBg: string;
  question: string;
  questionTime: string;
  answer: string;
  answerTime: string;
  status: { text: string; tone: "bot" | "queue" };
};

const scenes: Scene[] = [
  {
    channel: "whatsapp",
    label: "WhatsApp",
    contact: "Lucía",
    avatarText: "L",
    avatarBg: "bg-emerald-600 text-white",
    question: "Hola! Hacen envíos a Rosario?",
    questionTime: "10:41",
    answer:
      "¡Hola Lucía! Sí, enviamos a Rosario por correo en 3 a 5 días hábiles. Cuesta $6.500 y es gratis en compras desde $80.000.",
    answerTime: "10:42",
    status: { text: "Respondió el bot", tone: "bot" },
  },
  {
    channel: "instagram",
    label: "Instagram",
    contact: "martin.gz",
    avatarText: "M",
    avatarBg: "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white",
    question: "hasta qué hora abren hoy?",
    questionTime: "14:15",
    answer:
      "Hoy sábado estamos de 10 a 14 h en Av. Corrientes 1234. El lunes volvemos de 9 a 19 h.",
    answerTime: "14:15",
    status: { text: "Respondió el bot", tone: "bot" },
  },
  {
    channel: "messenger",
    label: "Messenger",
    contact: "Carla Benítez",
    avatarText: "CB",
    avatarBg: "bg-blue-600 text-white",
    question: "Quiero hablar con alguien por un cambio",
    questionTime: "19:04",
    answer:
      "Te paso con una persona del equipo. Ahora estamos fuera de horario: te responden el lunes desde las 9 h.",
    answerTime: "19:05",
    status: { text: "En cola · lunes 9:00", tone: "queue" },
  },
];

type Phase = "question" | "typing" | "answer";
const timings: Record<Phase, number> = {
  question: 1200,
  typing: 1600,
  answer: 4500,
};

export function ChatDemo() {
  const [index, setIndex] = useState(0);
  const [currentPhase, setPhase] = useState<Phase>("question");
  const [manual, setManual] = useState(false);
  const reduceMotion = useReducedMotion();

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
    <div className="w-full max-w-[390px] select-none">
      {/* Selector de Canales con estilo nativo */}
      <div
        role="tablist"
        aria-label="Canal de ejemplo"
        className="mb-4 flex items-center justify-center gap-2 p-1 rounded-2xl bg-surface/80 border border-line backdrop-blur shadow-xs"
      >
        {scenes.map((s, i) => {
          const isSelected = i === index;
          return (
            <button
              key={s.channel}
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setManual(true);
                setIndex(i);
                setPhase("answer");
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-medium transition-all ${
                isSelected
                  ? s.channel === "whatsapp"
                    ? "bg-wa text-white shadow-xs font-semibold"
                    : s.channel === "instagram"
                    ? "bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 text-white shadow-xs font-semibold"
                    : "bg-ms text-white shadow-xs font-semibold"
                  : "text-muted hover:text-ink hover:bg-surface-subtle"
              }`}
            >
              {s.channel === "whatsapp" && <WhatsAppIcon className="w-3.5 h-3.5" />}
              {s.channel === "instagram" && <InstagramIcon className="w-3.5 h-3.5" />}
              {s.channel === "messenger" && <MessengerIcon className="w-3.5 h-3.5" />}
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dispositivo Móvil (Smartphone Replica) */}
      <div className="relative rounded-[2.5rem] p-3 bg-neutral-900/90 dark:bg-neutral-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] border border-neutral-700/60 ring-1 ring-white/10">
        {/* Dynamic Island / Speaker notch */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-4 bg-neutral-950 rounded-full z-30 flex items-center justify-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-neutral-800/80 inline-block" />
          <span className="w-8 h-1 rounded-full bg-neutral-800/80 inline-block" />
        </div>

        {/* Pantalla Interna del Chat */}
        <div className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-neutral-950 flex flex-col h-[460px]">
          {/* ======================================================== */}
          {/* 1. WHATSAPP REPLICA */}
          {/* ======================================================== */}
          {scene.channel === "whatsapp" && (
            <>
              {/* Header WhatsApp */}
              <div className="pt-6 pb-2.5 px-3 bg-[#008069] dark:bg-[#1f2c34] text-white flex items-center justify-between shadow-xs z-10 transition-colors">
                <div className="flex items-center gap-2">
                  <ChevronLeft className="w-5 h-5 -ml-1 opacity-90 cursor-pointer" />
                  <div className="relative w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-bold text-white shadow-xs">
                    {scene.avatarText}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#008069]" />
                  </div>
                  <div className="leading-tight text-left">
                    <div className="text-sm font-semibold flex items-center gap-1">
                      <span>{scene.contact}</span>
                    </div>
                    <span className="text-[11px] text-emerald-100 font-sans">
                      {phase === "typing" ? (
                        <span className="italic font-medium text-emerald-200">
                          escribiendo...
                        </span>
                      ) : (
                        "en línea"
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 text-white/90">
                  <Video className="w-4 h-4 cursor-pointer hover:opacity-80" />
                  <Phone className="w-4 h-4 cursor-pointer hover:opacity-80" />
                  <MoreVertical className="w-4 h-4 cursor-pointer hover:opacity-80" />
                </div>
              </div>

              {/* Chat Canvas WhatsApp con Wallpaper Doodle */}
              <div
                className="flex-1 p-3 overflow-y-auto flex flex-col justify-end space-y-2.5 relative bg-[#efeae2] dark:bg-[#0b141a]"
                style={{
                  backgroundImage: `radial-gradient(circle at 10px 10px, rgba(0,0,0,0.04) 2px, transparent 0)`,
                  backgroundSize: "24px 24px",
                }}
              >
                {/* Encrypted notice */}
                <div className="mx-auto my-1 max-w-[260px] bg-[#ffeecd]/85 dark:bg-[#182229]/90 border border-amber-200/50 dark:border-neutral-800 rounded-lg p-1.5 text-center text-[10px] text-amber-900 dark:text-amber-200/80 shadow-2xs leading-tight font-sans">
                  🔒 Los mensajes están cifrados de extremo a extremo.
                </div>

                {/* Date badge */}
                <div className="mx-auto mb-1 px-2.5 py-0.5 rounded-md bg-white/80 dark:bg-[#182229]/80 text-[10px] font-mono text-neutral-600 dark:text-neutral-400 uppercase tracking-wider shadow-2xs">
                  Hoy
                </div>

                {/* Mensaje de Usuario (Izquierda) */}
                <div className="self-start max-w-[82%] rounded-xl rounded-tl-xs bg-white dark:bg-[#202c33] p-2.5 text-xs text-neutral-900 dark:text-neutral-100 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] animate-[rise_.3s_ease-out]">
                  <p className="leading-relaxed">{scene.question}</p>
                  <span className="block mt-1 text-[10px] text-neutral-400 text-right font-mono">
                    {scene.questionTime}
                  </span>
                </div>

                {/* Indicador de "Escribiendo..." */}
                {phase === "typing" && (
                  <div className="self-end rounded-xl rounded-tr-xs bg-[#d9fdd3] dark:bg-[#005c4b] px-3 py-2 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] animate-[rise_.2s_ease-out]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-300 animate-bounce" />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-300 animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-300 animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                )}

                {/* Respuesta del Bot (Derecha) */}
                {phase === "answer" && (
                  <div className="self-end max-w-[85%] rounded-xl rounded-tr-xs bg-[#d9fdd3] dark:bg-[#005c4b] p-2.5 text-xs text-neutral-900 dark:text-neutral-100 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] animate-[rise_.35s_ease-out]">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Respuesta automática</span>
                    </div>
                    <p className="leading-relaxed">{scene.answer}</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                      <span>{scene.answerTime}</span>
                      <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Barra de Entrada WhatsApp */}
              <div className="p-2 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center gap-2 border-t border-black/5">
                <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-full px-3 py-1.5 flex items-center gap-2 text-neutral-500 shadow-2xs">
                  <Smile className="w-4 h-4 cursor-pointer hover:text-neutral-700" />
                  <span className="text-xs text-neutral-400 flex-1">Mensaje</span>
                  <Paperclip className="w-4 h-4 cursor-pointer hover:text-neutral-700 -rotate-45" />
                  <Camera className="w-4 h-4 cursor-pointer hover:text-neutral-700" />
                </div>
                <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-xs">
                  <Mic className="w-4 h-4" />
                </div>
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* 2. INSTAGRAM DIRECT REPLICA */}
          {/* ======================================================== */}
          {scene.channel === "instagram" && (
            <>
              {/* Header Instagram Direct */}
              <div className="pt-6 pb-2.5 px-3 bg-white dark:bg-black text-neutral-900 dark:text-white flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 z-10 transition-colors">
                <div className="flex items-center gap-2">
                  <ChevronLeft className="w-5 h-5 -ml-1 cursor-pointer" />
                  <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
                    <div className="w-7 h-7 rounded-full bg-white dark:bg-black p-0.5">
                      <div className="w-full h-full rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold">
                        {scene.avatarText}
                      </div>
                    </div>
                  </div>
                  <div className="leading-tight text-left">
                    <div className="text-sm font-semibold flex items-center gap-1">
                      <span>{scene.contact}</span>
                    </div>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {phase === "typing" ? (
                        <span className="font-medium text-rose-500">
                          Escribiendo...
                        </span>
                      ) : (
                        "Activo(a) ahora"
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 text-neutral-700 dark:text-neutral-300">
                  <Phone className="w-4 h-4 cursor-pointer hover:opacity-80" />
                  <Video className="w-4 h-4 cursor-pointer hover:opacity-80" />
                  <Info className="w-4 h-4 cursor-pointer hover:opacity-80" />
                </div>
              </div>

              {/* Chat Canvas Instagram */}
              <div className="flex-1 p-3 overflow-y-auto flex flex-col justify-end space-y-2.5 bg-white dark:bg-black">
                {/* Info preview profile */}
                <div className="mx-auto text-center my-1">
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Instagram Direct · Conversación cifrada
                  </span>
                </div>

                {/* Mensaje de Usuario (Izquierda en pastilla gris IG) */}
                <div className="self-start max-w-[82%] rounded-2xl rounded-bl-sm bg-[#efefef] dark:bg-[#262626] px-3.5 py-2.5 text-xs text-neutral-900 dark:text-neutral-100 animate-[rise_.3s_ease-out]">
                  <p className="leading-relaxed">{scene.question}</p>
                </div>

                {/* Indicador de "Escribiendo..." */}
                {phase === "typing" && (
                  <div className="self-end rounded-2xl rounded-br-sm bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-3.5 py-2.5 animate-[rise_.2s_ease-out]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                )}

                {/* Respuesta del Bot (Derecha con Gradiente Oficial de IG) */}
                {phase === "answer" && (
                  <div className="relative self-end max-w-[85%] animate-[rise_.35s_ease-out]">
                    <div className="rounded-2xl rounded-br-xs bg-gradient-to-r from-[#833ab4] via-[#c13584] to-[#e1306c] p-3 text-xs text-white shadow-sm">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-white/90 mb-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Respuesta automática</span>
                      </div>
                      <p className="leading-relaxed">{scene.answer}</p>
                    </div>

                    {/* Heart reaction badge */}
                    <div className="absolute -bottom-2 -left-2 bg-white dark:bg-neutral-800 rounded-full p-1 shadow-md border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
                      <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                    </div>

                    <div className="mt-1 mr-1 text-right text-[10px] text-neutral-400 font-mono">
                      Visto
                    </div>
                  </div>
                )}
              </div>

              {/* Barra de Entrada Instagram */}
              <div className="p-2 bg-white dark:bg-black border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="flex-1 bg-neutral-100 dark:bg-neutral-900 rounded-full px-3.5 py-1.5 flex items-center justify-between text-neutral-500">
                  <span className="text-xs text-neutral-400">Enviar mensaje...</span>
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Mic className="w-3.5 h-3.5 cursor-pointer" />
                    <ImageIcon className="w-3.5 h-3.5 cursor-pointer" />
                    <Heart className="w-3.5 h-3.5 cursor-pointer" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* 3. FACEBOOK MESSENGER REPLICA */}
          {/* ======================================================== */}
          {scene.channel === "messenger" && (
            <>
              {/* Header Messenger */}
              <div className="pt-6 pb-2.5 px-3 bg-white dark:bg-[#18191a] text-neutral-900 dark:text-white flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 z-10 transition-colors">
                <div className="flex items-center gap-2">
                  <ChevronLeft className="w-5 h-5 -ml-1 text-[#0084FF] cursor-pointer" />
                  <div className="relative w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    {scene.avatarText}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-[#18191a]" />
                  </div>
                  <div className="leading-tight text-left">
                    <div className="text-sm font-semibold flex items-center gap-1">
                      <span>{scene.contact}</span>
                    </div>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {phase === "typing" ? (
                        <span className="font-medium text-[#0084FF]">
                          Escribiendo...
                        </span>
                      ) : (
                        "Activo(a) hace 5 min"
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 text-[#0084FF]">
                  <Phone className="w-4 h-4 cursor-pointer hover:opacity-80" />
                  <Video className="w-4 h-4 cursor-pointer hover:opacity-80" />
                  <Info className="w-4 h-4 cursor-pointer hover:opacity-80" />
                </div>
              </div>

              {/* Chat Canvas Messenger */}
              <div className="flex-1 p-3 overflow-y-auto flex flex-col justify-end space-y-2.5 bg-[#f0f2f5] dark:bg-[#242526]">
                {/* Notice */}
                <div className="mx-auto text-center my-1">
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Facebook Messenger · Página conectada
                  </span>
                </div>

                {/* Mensaje de Usuario (Izquierda en pastilla gris Messenger) */}
                <div className="self-start max-w-[82%] rounded-2xl rounded-bl-sm bg-[#e4e6eb] dark:bg-[#3e4042] px-3.5 py-2.5 text-xs text-neutral-900 dark:text-neutral-100 animate-[rise_.3s_ease-out]">
                  <p className="leading-relaxed">{scene.question}</p>
                </div>

                {/* Indicador de "Escribiendo..." */}
                {phase === "typing" && (
                  <div className="self-end rounded-2xl rounded-br-sm bg-blue-100 dark:bg-blue-950/60 px-3.5 py-2.5 animate-[rise_.2s_ease-out]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0084FF] animate-bounce" />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[#0084FF] animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[#0084FF] animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                )}

                {/* Respuesta del Bot (Azul Eléctrico Messenger) */}
                {phase === "answer" && (
                  <div className="self-end max-w-[85%] space-y-1.5 animate-[rise_.35s_ease-out]">
                    <div className="rounded-2xl rounded-br-xs bg-[#0084FF] p-3 text-xs text-white shadow-xs">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-blue-100 mb-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Handoff inteligente</span>
                      </div>
                      <p className="leading-relaxed">{scene.answer}</p>
                    </div>

                    {/* Handoff queue status banner */}
                    <div className="rounded-lg bg-white/90 dark:bg-neutral-800/90 border border-blue-200 dark:border-blue-900/50 p-1.5 text-[10px] text-blue-900 dark:text-blue-300 font-mono text-center">
                      👤 Derivado a equipo humano · En cola lunes 9:00
                    </div>

                    <div className="text-right text-[10px] text-neutral-400 font-mono flex items-center justify-end gap-1">
                      <span>Entregado</span>
                      <Check className="w-3 h-3 text-[#0084FF]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Barra de Entrada Messenger */}
              <div className="p-2 bg-white dark:bg-[#18191a] border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
                <div className="flex items-center gap-2 text-[#0084FF]">
                  <Plus className="w-4 h-4 cursor-pointer" />
                  <Camera className="w-4 h-4 cursor-pointer" />
                  <ImageIcon className="w-4 h-4 cursor-pointer" />
                  <Mic className="w-4 h-4 cursor-pointer" />
                </div>
                <div className="flex-1 bg-[#f0f2f5] dark:bg-[#242526] rounded-full px-3 py-1 text-xs text-neutral-400">
                  Aa
                </div>
                <div className="text-[#0084FF] cursor-pointer hover:scale-110 transition-transform">
                  <ThumbsUp className="w-5 h-5 fill-current" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
