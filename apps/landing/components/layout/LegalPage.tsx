import type { ReactNode } from "react";
import { site } from "@/site.config";

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

export function LegalPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-teal">
        Vigente desde el {formatDate(site.legalUpdatedAt)}
      </p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.025em] sm:text-5xl">{title}</h1>
      {intro && <div className="mt-6 text-lg text-muted">{intro}</div>}
      <div className="legal mt-10 border-t border-line pt-2">{children}</div>
    </article>
  );
}
