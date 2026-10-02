import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { SectionHeading } from "./SectionHeading";

const channels = [
  {
    name: "WhatsApp",
    dot: "bg-wa",
    spot: "rgba(37, 211, 102, 0.14)",
    body: "Responde desde el número de tu negocio, incluso si ya usás la app WhatsApp Business.",
    detail: "Detecta las conversaciones que llegan desde anuncios Click-to-WhatsApp.",
  },
  {
    name: "Instagram",
    dot: "bg-ig",
    spot: "rgba(214, 41, 118, 0.14)",
    body: "Contesta los mensajes directos de tu cuenta profesional.",
    detail: "Podés sumar hasta 4 preguntas sugeridas para iniciar la charla.",
  },
  {
    name: "Messenger",
    dot: "bg-ms",
    spot: "rgba(10, 124, 255, 0.14)",
    body: "Atiende los mensajes que llegan a tu página de Facebook.",
    detail: "Detecta las conversaciones que llegan desde anuncios Click-to-Messenger.",
  },
] as const;

export function Channels() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
      <SectionHeading eyebrow="Canales" title="Responde en el mismo canal donde te escribieron.">
        Cada cliente recibe la respuesta por donde preguntó. Vos ves todo junto.
      </SectionHeading>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {channels.map((c) => (
          <SpotlightCard key={c.name} spotlightColor={c.spot} className="p-6 sm:p-7">
            <div className="flex items-center gap-2.5">
              <span className={`size-2.5 rounded-full ${c.dot}`} />
              <h3 className="text-lg font-semibold tracking-tight">{c.name}</h3>
            </div>
            <p className="mt-4 text-sm leading-relaxed">{c.body}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{c.detail}</p>
          </SpotlightCard>
        ))}
      </div>
    </section>
  );
}
