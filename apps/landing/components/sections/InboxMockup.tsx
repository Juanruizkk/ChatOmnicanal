import { SectionHeading } from "./SectionHeading";

type Status = "bot" | "humano" | "en_cola" | "cerrada";

const statusStyle: Record<Status, { label: string; className: string }> = {
  bot: { label: "Bot", className: "bg-bot/12 text-bot" },
  humano: { label: "Humano", className: "bg-wa/12 text-wa" },
  en_cola: { label: "En cola", className: "bg-ig/12 text-ig" },
  cerrada: { label: "Resuelta", className: "bg-muted/12 text-muted" },
};

const conversations: {
  name: string;
  channel: "bg-wa" | "bg-ig" | "bg-ms";
  preview: string;
  status: Status;
  window: string;
  ad?: boolean;
  active?: boolean;
}[] = [
  { name: "Lucía", channel: "bg-wa", preview: "Perfecto, lo pido hoy entonces", status: "bot", window: "23 h", ad: true },
  { name: "Diego Ferraro", channel: "bg-wa", preview: "Me llegó roto el pedido", status: "humano", window: "21 h", active: true },
  { name: "@martin.gz", channel: "bg-ig", preview: "hasta qué hora abren hoy?", status: "bot", window: "18 h" },
  { name: "Carla Benítez", channel: "bg-ms", preview: "Quiero hablar con alguien por un cambio", status: "en_cola", window: "6 h" },
  { name: "Sofía R.", channel: "bg-wa", preview: "Gracias!!", status: "cerrada", window: "—" },
];

const points = [
  {
    title: "Tomás el control con un botón",
    body: "Mientras una persona atiende, el bot no interviene. Cuando resolvés la conversación, vuelve a responder él.",
  },
  {
    title: "Deriva solo cuando hace falta",
    body: "Si el cliente pide hablar con alguien, si hay un reclamo o si el bot no tiene la respuesta, avisa a tu equipo.",
  },
  {
    title: "Respeta tu horario",
    body: "Fuera de horario le dice al cliente cuándo lo van a atender y deja la conversación en cola.",
  },
  {
    title: "Sabés cuánto tiempo te queda",
    body: "Cada conversación muestra las horas que quedan para responder sin costo extra en WhatsApp.",
  },
];

export function InboxMockup() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.25fr] lg:items-center">
        <div>
          <SectionHeading eyebrow="Bandeja compartida" title="Tu equipo entra cuando el bot no alcanza.">
            Todas las conversaciones de los tres canales en un mismo lugar, con el estado de cada una a la vista. Sumás a
            tus agentes por invitación, sin compartir contraseñas.
          </SectionHeading>
          <dl className="mt-10 grid gap-6 sm:grid-cols-2">
            {points.map((p) => (
              <div key={p.title}>
                <dt className="text-sm font-semibold">{p.title}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure aria-label="Ejemplo de la bandeja de conversaciones" className="overflow-hidden rounded-2xl border border-line bg-bg">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Conversaciones</span>
            <div className="flex gap-1.5 font-mono text-[11px] text-muted">
              <span className="rounded-md border border-line bg-surface px-2 py-0.5 text-ink">Todas</span>
              <span className="rounded-md px-2 py-0.5">Humano</span>
              <span className="hidden rounded-md px-2 py-0.5 sm:inline">Anuncios</span>
            </div>
          </div>
          <ul>
            {conversations.map((c) => (
              <li
                key={c.name}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0 ${
                  c.active ? "bg-surface" : ""
                }`}
              >
                <span className={`size-2 rounded-full ${c.channel}`} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {c.name}
                    {c.ad && (
                      <span className="rounded border border-line px-1.5 font-mono text-[10px] font-normal text-muted">
                        Anuncio
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted">{c.preview}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${statusStyle[c.status].className}`}>
                    {statusStyle[c.status].label}
                  </span>
                  <span className="font-mono text-[11px] text-muted" title="Tiempo para responder">
                    {c.window}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3">
            <p className="text-xs text-muted">
              <span className="font-medium text-ink">Diego Ferraro</span> · quedan 21 h para responder
            </p>
            <div className="flex gap-2">
              <span className="rounded-full border border-line px-3 py-1 text-xs">Resolver</span>
              <span className="rounded-full bg-ink px-3 py-1 text-xs text-bg">Tomar control</span>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
