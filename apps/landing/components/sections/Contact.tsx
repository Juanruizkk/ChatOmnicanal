import { site } from "@/site.config";
import { mailto, telLink, waLink } from "@/lib/links";

export function Contact() {
  const items = [
    { label: "WhatsApp", value: site.contact.phone, href: waLink("Hola, quiero saber más sobre el servicio.") },
    { label: "Email", value: site.contact.email, href: mailto(site.contact.email) },
    { label: "Teléfono", value: site.contact.phone, href: telLink(site.contact.phone) },
  ];

  return (
    <section id="contacto" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-12 sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 size-72 rounded-full bg-[conic-gradient(from_200deg,var(--wa),var(--ms),var(--ig),var(--wa))] opacity-20 blur-3xl"
        />
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted">Contacto</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              Contanos qué consultas te llegan y te mostramos cómo las respondería.
            </h2>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {items.map((item) => (
              <li key={item.label}>
                <a href={item.href} className="group flex items-center justify-between gap-4 py-4">
                  <span className="font-mono text-xs uppercase tracking-wider text-muted">{item.label}</span>
                  <span className="text-sm font-medium group-hover:underline group-hover:underline-offset-4">
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
