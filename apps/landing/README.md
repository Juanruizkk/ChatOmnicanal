# Landing

Sitio público del producto: home, política de privacidad, términos y eliminación de datos.
Next.js con export estático (`out/`). Diseño en `docs/superpowers/specs/2026-10-02-landing-design.md`.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # genera out/
npm run lint
```

## Antes de publicar

Completar `site.config.ts`: marca, dominio, razón social, CUIT, domicilio, teléfono, WhatsApp y emails del dominio.
Mientras queden datos de ejemplo, `next build` muestra un aviso con los campos pendientes.

## Deploy en Vercel

1. Importar el repo en Vercel con **Root Directory** = `apps/landing` (framework: Next.js, se detecta solo).
2. Agregar el dominio propio en *Settings → Domains* y configurar los DNS que indica Vercel.

## URLs para la app de Meta

| Campo en la app de Meta | URL |
| --- | --- |
| Privacy Policy URL | `https://<dominio>/privacidad/` |
| Terms of Service URL | `https://<dominio>/terminos/` |
| User data deletion → Data deletion instructions URL | `https://<dominio>/eliminacion-de-datos/` |
| Website (Business Verification) | `https://<dominio>/` |

El footer de todas las páginas muestra razón social, CUIT, domicilio, teléfono y email: tienen que coincidir con
lo cargado en el Business Portfolio.

## Componentes de React Bits

En `components/reactbits/` (copiados, variante TS + Tailwind): `Prism` (fondo del hero), `SpotlightCard`
(tarjetas de canales) y `BlurText` (título). Ajustes locales: `SpotlightCard` usa los colores del sitio y
`BlurText` renderiza `span` y respeta reduced motion.
