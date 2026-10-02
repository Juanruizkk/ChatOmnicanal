import type { ComponentType, ReactNode } from "react";
import { Bot, CheckCheck, Clock, Send, ShieldAlert, Sparkles, User, UserCheck } from "lucide-react";
import { InstagramIcon, MessengerIcon, WhatsAppIcon } from "@/components/icons/Channels";
import { site } from "@/site.config";

type Channel = "whatsapp" | "instagram" | "messenger";

const channel: Record<Channel, { label: string; Icon: ComponentType<{ className?: string }>; className: string }> = {
  whatsapp: { label: "WhatsApp", Icon: WhatsAppIcon, className: "bg-wa/10 text-wa" },
  instagram: { label: "Instagram", Icon: InstagramIcon, className: "bg-ig/10 text-ig" },
  messenger: { label: "Messenger", Icon: MessengerIcon, className: "bg-ms/10 text-ms" },
};

const status = {
  bot: { label: "Bot atendiendo", Icon: Bot, className: "bg-bot/15 text-bot" },
  en_cola: { label: "En cola", Icon: Clock, className: "bg-ig/15 text-ig" },
  humano: { label: "Humano asignado", Icon: UserCheck, className: "bg-wa/15 text-wa" },
};

const conversations: {
  name: string;
  channel: Channel;
  time: string;
  preview: string;
  status: keyof typeof status;
  meta: string;
  active?: boolean;
}[] = [
  {
    name: "Martina Benítez",
    channel: "whatsapp",
    time: "10:28",
    preview: "¿Tienen stock de la lámpara nórdica y cuánto demora el envío?",
    status: "bot",
    meta: "23 h 48 m",
    active: true,
  },
  {
    name: "@lucas.gomez",
    channel: "instagram",
    time: "09:50",
    preview: "Hola! Necesito hablar con un vendedor por favor",
    status: "en_cola",
    meta: "Desde anuncio",
  },
  {
    name: "Carlos Varela",
    channel: "messenger",
    time: "Ayer",
    preview: "Muchas gracias por la confirmación del pago.",
    status: "humano",
    meta: "6 días",
  },
];

const points = [
  {
    title: "Pasa a una persona con todo el contexto",
    body: "Cuando el cliente pide hablar con alguien o el bot no tiene la respuesta, se pausa y tu equipo sigue la charla con el historial completo.",
  },
  {
    title: "Respeta tu horario",
    body: "Fuera de horario sigue respondiendo las consultas de siempre y le avisa al cliente cuándo lo atiende una persona.",
  },
  {
    title: "Sabés cuánto tiempo te queda",
    body: "Cada conversación muestra las horas que quedan para responder: 24 h en WhatsApp y hasta 7 días en Instagram y Messenger.",
  },
];

function Bubble({ from, children, footer }: { from: "user" | "bot"; children: string; footer: ReactNode }) {
  const isBot = from === "bot";
  return (
    <div className={`flex ${isBot ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-md rounded-2xl border bg-surface p-3.5 shadow-xs ${
          isBot ? "rounded-tr-sm border-bot/30" : "rounded-tl-sm border-line"
        }`}
      >
        {isBot && (
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] font-semibold text-bot">
            <Sparkles className="size-3" aria-hidden />
            Respuesta automática
          </p>
        )}
        <p className="text-xs leading-relaxed sm:text-sm">{children}</p>
        <div className="mt-1.5 font-mono text-[10px] text-muted">{footer}</div>
      </div>
    </div>
  );
}

export function InboxMockup() {
  const active = conversations[0];
  const ActiveIcon = channel[active.channel].Icon;

  return (
    <section className="border-y border-line bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-wider text-muted">Bandeja compartida</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Tu equipo entra cuando el bot no alcanza.
          </h2>
          <p className="mt-4 text-lg text-muted">
            Las conversaciones de los tres canales en un mismo lugar. Mirás cómo responde el bot y tomás el control con un
            clic cuando un cliente necesita a una persona.
          </p>
        </div>

        <figure
          aria-label="Ejemplo de la bandeja de conversaciones"
          className="mt-14 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-40px_rgb(0_0_0/0.35)]"
        >
          {/* Barra de la app */}
          <div className="flex items-center justify-between border-b border-line bg-bg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
              <span className="ml-2 hidden font-mono text-xs text-muted sm:inline">panel.{site.domain}/conversaciones</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-wa/10 px-2.5 py-0.5 font-mono text-xs text-wa">
                <span className="size-1.5 animate-pulse rounded-full bg-wa" />
                Canales conectados
              </span>
              <span className="hidden font-mono text-xs text-muted md:inline">Agente: Sofía</span>
            </div>
          </div>

          <div className="grid min-h-[500px] grid-cols-1 lg:grid-cols-12">
            {/* Lista de conversaciones */}
            <div className="flex flex-col border-line lg:col-span-4 lg:border-r">
              <div className="flex gap-1.5 border-b border-line p-3 text-xs text-muted">
                <span className="rounded-md border border-line bg-bg px-2.5 py-1 font-semibold text-ink">Todas (14)</span>
                <span className="px-2 py-1">En cola (2)</span>
                <span className="px-2 py-1">Humano (3)</span>
              </div>
              <ul className="flex-1 divide-y divide-line/70">
                {conversations.map((c) => {
                  const ch = channel[c.channel];
                  const st = status[c.status];
                  return (
                    <li
                      key={c.name}
                      className={`border-l-4 p-3.5 ${c.active ? "border-wa bg-bg/80" : "border-transparent"}`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`rounded p-1 ${ch.className}`}>
                            <ch.Icon className="size-3.5" />
                          </span>
                          <span className="text-xs font-semibold">{c.name}</span>
                          <span className="sr-only">· {ch.label}</span>
                        </div>
                        <span className="font-mono text-[11px] text-muted">{c.time}</span>
                      </div>
                      <p className="truncate text-xs text-muted">{c.preview}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${st.className}`}
                        >
                          <st.Icon className="size-3" aria-hidden />
                          {st.label}
                        </span>
                        <span className="font-mono text-[10px] text-muted">{c.meta}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Conversación abierta */}
            <div className="flex flex-col justify-between border-t border-line bg-bg/40 lg:col-span-8 lg:border-t-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-full bg-wa/10 text-xs font-bold text-wa">MB</div>
                  <div>
                    <p className="text-sm font-semibold">{active.name}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span className="inline-flex items-center gap-1 font-medium text-wa">
                        <ActiveIcon className="size-3" /> WhatsApp
                      </span>
                      <span aria-hidden>·</span>
                      <span className="font-mono text-ms">Quedan 23 h 48 m para responder</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-semibold text-bg">
                    <User className="size-3.5" aria-hidden />
                    Tomar control
                  </span>
                  <span className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted">Resolver</span>
                </div>
              </div>

              <div className="flex-1 space-y-4 p-4 sm:p-6">
                <Bubble from="user" footer={<p className="text-right">10:27 · WhatsApp</p>}>
                  Hola! Quería consultar si tienen stock de la lámpara nórdica de madera y cuánto tarda el envío a Palermo.
                </Bubble>
                <Bubble
                  from="bot"
                  footer={
                    <p className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-wa">Fuente: catálogo y envíos</span>
                      <span className="flex items-center gap-1">
                        10:27 <CheckCheck className="size-3 text-ms" aria-label="Leído" />
                      </span>
                    </p>
                  }
                >
                  ¡Hola Martina! Sí, tenemos stock de la lámpara nórdica en roble claro. Los envíos a Palermo salen en el día
                  por mensajería y llegan en menos de 24 h hábiles. El envío cuesta $4.500 y es gratis en compras desde
                  $40.000.
                </Bubble>
                <Bubble from="user" footer={<p className="text-right">10:28 · WhatsApp</p>}>
                  Genial, ¿puedo pagar con transferencia y retirarla por el local?
                </Bubble>
                <div className="flex justify-center">
                  <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-center font-mono text-[11px] text-muted">
                    <ShieldAlert className="size-3 shrink-0 text-ms" aria-hidden />
                    El bot sigue respondiendo. Tocá “Tomar control” para contestar vos.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-line bg-surface p-3">
                <p className="flex-1 truncate rounded-xl border border-line bg-bg px-4 py-2.5 text-xs text-muted">
                  Escribí para tomar el control de la conversación…
                </p>
                <span className="rounded-xl bg-ms p-2.5 text-white" aria-hidden>
                  <Send className="size-4" />
                </span>
              </div>
            </div>
          </div>
        </figure>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {points.map((p) => (
            <div key={p.title} className="rounded-xl border border-line bg-surface p-6">
              <h3 className="text-sm font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
