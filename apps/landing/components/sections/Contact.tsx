import { site } from "@/site.config";
import { mailto, telLink, waLink } from "@/lib/links";
import { Eyebrow } from "./SectionHeading";

export function Contact() {
  const items = [
    { label: "WhatsApp", value: site.contact.phone, href: waLink("Hola, quiero saber más sobre el servicio.") },
    { label: "Email", value: site.contact.email, href: mailto(site.contact.email) },
    { label: "Teléfono", value: site.contact.phone, href: telLink(site.contact.phone) },
  ];

  return (
    <section id="contacto" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="relative overflow-hidden rounded-3xl bg-navy px-6 py-12 text-white sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="absolute -right-20 -top-28 size-96 rounded-full bg-brand-gradient opacity-40 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 size-80 rounded-full bg-brand-violet opacity-25 blur-3xl"
        />
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <Eyebrow tone="light">Contacto</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">
              Contanos qué consultas te llegan y te mostramos cómo las respondería.
            </h2>
          </div>
          <ul className="divide-y divide-white/15 border-y border-white/15">
            {items.map((item) => (
              <li key={item.label}>
                <a href={item.href} className="group flex items-center justify-between gap-4 py-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{item.label}</span>
                  <span className="text-sm font-semibold transition-colors group-hover:text-brand-cyan">
                    {item.value}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
