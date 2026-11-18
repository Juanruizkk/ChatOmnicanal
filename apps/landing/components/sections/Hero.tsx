import BlurText from "@/components/reactbits/BlurText";
import { HeroBackground } from "./HeroBackground";
import { ChatDemo } from "./ChatDemo";
import { GlowButton } from "@/components/ui/GlowButton";
import { waLink } from "@/lib/links";

const headline = "Tus clientes preguntan. Tu negocio responde, a cualquier hora.";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden min-h-screen">
      <HeroBackground />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.15fr_1fr] lg:pb-28">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-semibold text-ink/80 backdrop-blur">
            <span aria-hidden className="size-2 rounded-full bg-brand-gradient" />
            Chatbot omnicanal · WhatsApp · Instagram · Messenger
          </p>
          <h1 aria-label={headline} className="text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-6xl">
            <BlurText text={headline} animateBy="words" delay={70} stepDuration={0.3} className="!flex-wrap" />
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Un bot responde las consultas de siempre (horarios, envíos, dirección, medios de pago) con la información
            que cargás vos. Cuando hace falta una persona, la conversación pasa a tu equipo en una sola bandeja.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <GlowButton href={waLink("Hola, quiero saber más sobre el servicio.")}>
              Hablemos por WhatsApp
            </GlowButton>
            <a
              href="#producto"
              className="rounded-full border border-line bg-surface/80 px-5 py-3 text-sm font-semibold backdrop-blur transition-colors hover:border-brand-blue/50 hover:text-brand-blue"
            >
              Ver cómo funciona
            </a>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <ChatDemo />
        </div>
      </div>
    </section>
  );
}
