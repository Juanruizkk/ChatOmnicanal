import { SectionHeading } from "./SectionHeading";

const examples = [
  { q: "¿Aceptan Mercado Pago?", a: "Responde con tus medios de pago.", ok: true },
  { q: "¿Tienen talle 42 del modelo Runner?", a: "Busca en el catálogo que subiste.", ok: true },
  { q: "Escribime un poema", a: "Aclara que solo puede ayudar con consultas sobre tu negocio.", ok: false },
  { q: "¿Qué opinás de la economía?", a: "No opina: vuelve a lo que puede resolver.", ok: false },
];

export function Scope() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
        <SectionHeading eyebrow="Respuestas acotadas" title="Habla de tu negocio. De nada más.">
          El bot responde solo con la información que cargaste: el formulario y los documentos que subiste. No inventa
          precios ni promete cosas que no están ahí, y ante cualquier tema ajeno al negocio declina con amabilidad.
        </SectionHeading>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {examples.map((e) => (
            <li key={e.q} className="flex gap-4 px-5 py-4">
              <span
                aria-hidden
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full font-mono text-[11px] ${
                  e.ok ? "bg-wa/15 text-wa" : "bg-muted/15 text-muted"
                }`}
              >
                {e.ok ? "✓" : "–"}
              </span>
              <div>
                <p className="text-sm font-medium">“{e.q}”</p>
                <p className="mt-0.5 text-sm text-muted">
                  <span className="sr-only">{e.ok ? "Responde: " : "No responde: "}</span>
                  {e.a}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
