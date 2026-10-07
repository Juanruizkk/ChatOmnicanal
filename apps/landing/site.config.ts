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
  /** Precio mensual en ARS. `null` muestra "Consultar". */
  price: number | null;
  highlighted?: boolean;
};

export const site = {
  brand: "PentaBot",
  domain: "pentabot.site",
  description:
    "Respuestas automáticas para WhatsApp, Instagram y Messenger, con una bandeja compartida para que tu equipo tome cualquier conversación.",
  legal: {
    razonSocial: "RAZÓN SOCIAL S.A.S.",
    cuit: "30-00000000-0",
    domicilio: "Calle 123, Ciudad, Provincia, Argentina",
    /** Ciudad para la jurisdicción de los términos. */
    jurisdiccion: "Ciudad Autónoma de Buenos Aires",
  },
  contact: {
    email: "hola@pentabot.site",
    privacyEmail: "privacidad@pentabot.site",
    phone: "+54 9 11 0000-0000",
    /** Solo dígitos, formato internacional, para wa.me. */
    whatsapp: "5491100000000",
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
      name: "Básico",
      summary: "Para empezar a responder WhatsApp en automático.",
      channels: ["WhatsApp"],
      conversations: "Cupo mensual de conversaciones atendidas por el bot",
      features: [
        "Bandeja compartida",
        "Derivación a una persona",
        "Horario de atención y mensajes fuera de horario",
        "Carga de catálogo, políticas y preguntas frecuentes",
      ],
      price: null,
    },
    {
      name: "Pro",
      summary: "Los tres canales en una sola bandeja.",
      channels: ["WhatsApp", "Instagram", "Messenger"],
      conversations: "Cupo mensual ampliado",
      features: [
        "Todo lo del plan Básico",
        "Instagram y Messenger",
        "Etiquetado de conversaciones que llegan desde anuncios",
        "Más agentes en el equipo",
      ],
      price: null,
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
