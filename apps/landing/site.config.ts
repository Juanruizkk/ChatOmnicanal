/**
 * Datos del sitio. Todo lo que Meta verifica (razón social, domicilio,
 * teléfono, email del dominio, web) sale de acá: completar antes de publicar.
 *
 * Los valores de ejemplo están listados en `placeholders` y el build avisa
 * mientras alguno siga presente (ver `findPlaceholders`).
 */

export type Plan = {
  name: string;
  summary: string;
  channels: string[];
  conversations: string;
  features: string[];
  /** Precio mensual en USD. `null` muestra "Consultar". */
  price: number | null;
  /** Texto del botón del plan. */
  cta: string;
  /** Aclaración que se muestra debajo del precio. */
  note?: string;
  highlighted?: boolean;
};

export const site = {
  brand: "PentaBot",
  domain: "pentabot.site",
  description:
    "Respuestas automáticas para WhatsApp, Instagram y Messenger, con una bandeja compartida para que tu equipo tome cualquier conversación.",
  legal: {
    razonSocial: "PENTAJUL S.A.S.",
    cuit: "30-71944977-4",
    domicilio: "Lote 98 Dpto 98 - Barrio Golf Country Club, Yerba Buena, Tucumán, CP 4107, Argentina",
    /** Ciudad para la jurisdicción de los términos. */
    jurisdiccion: "Yerba Buena, Tucumán",
  },
  contact: {
    email: "contacto@pentabot.site",
    privacyEmail: "contacto@pentabot.site",
    phone: "+54 381 201-0253",
    /** Solo dígitos, formato internacional, para wa.me. */
    whatsapp: "543812010253",
  },
  /** Proveedores que procesan datos. Mientras no estén definidos se describen por categoría. */
  processors: {
    llm: "Groq" as string | null,
    hosting: "Vercel" as string | null,
  },
  /** Días tras la baja de la cuenta en los que se borran los datos. */
  retentionDays: 30,
  /** Días hábiles para responder un pedido de eliminación. */
  deletionResponseDays: 10,
  legalUpdatedAt: "2026-10-06",
  plans: [
    {
      name: "Un canal",
      summary: "Empezá por el canal donde más te escriben.",
      channels: ["WhatsApp, Instagram o Messenger"],
      conversations: "Cupo mensual de conversaciones atendidas por el bot",
      features: [
        "Bandeja compartida",
        "Derivación a una persona",
        "Horario de atención y mensajes fuera de horario",
        "Carga de catálogo, políticas y preguntas frecuentes",
      ],
      price: 50,
      cta: "Empezar con un canal",
      note: "Después podés sumar más canales por USD 30 al mes cada uno.",
    },
    {
      name: "Pack completo",
      summary: "Los tres canales en una sola bandeja, desde el primer día.",
      channels: ["WhatsApp", "Instagram", "Messenger"],
      conversations: "Cupo mensual ampliado",
      features: [
        "Todo lo del plan de un canal",
        "WhatsApp, Instagram y Messenger",
        "Etiquetado de conversaciones que llegan desde anuncios",
        "Más agentes en el equipo",
      ],
      price: 90,
      cta: "Quiero el pack completo",
      note: "Ahorrás USD 20 al mes frente a sumar los canales de a uno.",
      highlighted: true,
    },
  ] satisfies Plan[],
};

/** Valores de ejemplo que no pueden llegar a producción. */
const placeholders = [
  "TuMarca",
  "dominio.com",
  "RAZÓN SOCIAL",
  "00000000",
  "Calle 123",
  "0000-0000",
  "5491100000000",
];

export function findPlaceholders(): string[] {
  const found: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (placeholders.some((p) => value.includes(p))) found.push(path);
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk({ brand: site.brand, domain: site.domain, legal: site.legal, contact: site.contact }, "");
  return found;
}

export const siteUrl = `https://${site.domain}`;
