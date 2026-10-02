import Link from "next/link";
import { Logo } from "./Logo";
import { waLink } from "@/lib/links";

const nav = [
  { href: "/#producto", label: "Producto" },
  { href: "/#planes", label: "Planes" },
  { href: "/#preguntas", label: "Preguntas" },
  { href: "/#contacto", label: "Contacto" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Inicio">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-7 text-sm text-muted md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <a
          href={waLink("Hola, quiero saber más sobre el servicio.")}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-85"
        >
          Hablemos
        </a>
      </div>
    </header>
  );
}
