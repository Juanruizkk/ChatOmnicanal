import { SectionHeading } from "./SectionHeading";

const steps = [
  {
    title: "Conectás tus canales",
    body: "Vinculás tu WhatsApp, tu Instagram profesional y tu página de Facebook desde el panel, con tu cuenta de Meta.",
  },
  {
    title: "Cargás la info de tu negocio",
    body: "Horarios, dirección, zonas y costos de envío, medios de pago y el tono de las respuestas. Si querés, sumás catálogo, políticas de cambio o preguntas frecuentes.",
  },
  {
    title: "Probás y activás",
    body: "Le hacés preguntas al bot en un chat de prueba dentro del panel. Cuando te convence, lo activás.",
  },
];

export function HowItWorks() {
  return (
    <section id="producto" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading eyebrow="Cómo funciona" title="Lo dejás andando vos, en una tarde.">
        No hace falta programar ni esperar a nadie: el alta, la conexión y la configuración se hacen desde el panel.
      </SectionHeading>
      <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="bg-surface p-6 sm:p-8">
            <span className="font-mono text-xs text-muted">Paso {i + 1}</span>
            <h3 className="mt-4 text-lg font-semibold tracking-tight">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
