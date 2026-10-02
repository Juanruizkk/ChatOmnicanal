import { site } from "@/site.config";

/** Logotipo provisorio: la marca y tres puntos, uno por canal. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight">
      <span aria-hidden className="flex gap-[3px]">
        <span className="size-2 rounded-full bg-wa" />
        <span className="size-2 rounded-full bg-ig" />
        <span className="size-2 rounded-full bg-ms" />
      </span>
      {site.brand}
    </span>
  );
}
