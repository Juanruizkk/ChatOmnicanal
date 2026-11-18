import Link from "next/link";
import { Logo } from "./Logo";
import { site } from "@/site.config";
import { mailto, telLink } from "@/lib/links";

/**
 * Datos legales visibles en todas las páginas. Meta los compara con los del
 * Business Portfolio durante la verificación del negocio.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-navy text-white/65">
      <div aria-hidden className="h-1 bg-brand-gradient" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo tone="light" tagline size={40} />
          <p className="max-w-xs text-sm">{site.description}</p>
        </div>

        <address className="space-y-1.5 text-sm not-italic">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-brand-cyan">Empresa</p>
          <p className="font-semibold text-white">{site.legal.razonSocial}</p>
          <p>CUIT {site.legal.cuit}</p>
          <p>{site.legal.domicilio}</p>
          <p>
            <a href={telLink(site.contact.phone)} className="transition-colors hover:text-white">
              {site.contact.phone}
            </a>
          </p>
          <p>
            <a href={mailto(site.contact.email)} className="transition-colors hover:text-white">
              {site.contact.email}
            </a>
          </p>
        </address>

        <nav aria-label="Legales" className="space-y-1.5 text-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-brand-cyan">Legales</p>
          <p>
            <Link href="/privacidad/" className="transition-colors hover:text-white">
              Política de privacidad
            </Link>
          </p>
          <p>
            <Link href="/terminos/" className="transition-colors hover:text-white">
              Términos y condiciones
            </Link>
          </p>
          <p>
            <Link href="/eliminacion-de-datos/" className="transition-colors hover:text-white">
              Eliminación de datos
            </Link>
          </p>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-white/50 sm:px-6">
          © {year} {site.legal.razonSocial}. WhatsApp, Instagram y Messenger son marcas de Meta Platforms, Inc.
        </p>
      </div>
    </footer>
  );
}
