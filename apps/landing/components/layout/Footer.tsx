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
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted">{site.description}</p>
        </div>

        <address className="space-y-1.5 text-sm not-italic text-muted">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-ink">Empresa</p>
          <p className="text-ink">{site.legal.razonSocial}</p>
          <p>CUIT {site.legal.cuit}</p>
          <p>{site.legal.domicilio}</p>
          <p>
            <a href={telLink(site.contact.phone)} className="hover:text-ink">
              {site.contact.phone}
            </a>
          </p>
          <p>
            <a href={mailto(site.contact.email)} className="hover:text-ink">
              {site.contact.email}
            </a>
          </p>
        </address>

        <nav aria-label="Legales" className="space-y-1.5 text-sm text-muted">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-ink">Legales</p>
          <p>
            <Link href="/privacidad/" className="hover:text-ink">
              Política de privacidad
            </Link>
          </p>
          <p>
            <Link href="/terminos/" className="hover:text-ink">
              Términos y condiciones
            </Link>
          </p>
          <p>
            <Link href="/eliminacion-de-datos/" className="hover:text-ink">
              Eliminación de datos
            </Link>
          </p>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted sm:px-6">
          © {year} {site.legal.razonSocial}. WhatsApp, Instagram y Messenger son marcas de Meta Platforms, Inc.
        </p>
      </div>
    </footer>
  );
}
