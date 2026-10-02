# Landing del producto — Diseño

Fecha: 2026-10-02 · Autor: Juan

## Objetivo

Publicar un sitio público que cumpla lo que Meta pide para ser Tech Provider:

1. **Verificación del negocio**: el sitio tiene que mostrar el mismo nombre legal, domicilio, teléfono y email (del dominio) que se cargan en el Business Portfolio.
2. **Configuración básica de la app de Meta**: URL de política de privacidad (obligatoria), URL de términos y URL de instrucciones de eliminación de datos.
3. **App Review**: que el revisor entienda el producto (un SaaS de atención acotada al negocio, no un asistente de IA de propósito general).

De paso sirve como página comercial del producto.

**Criterio de terminado:** el sitio está publicado en Vercel con el dominio propio y HTTPS, las 4 páginas son accesibles, los datos legales del footer coinciden con `site.config.ts` y las URLs se pueden pegar en la app de Meta.

## Fuera de alcance

Blog, login/registro, formulario de contacto con backend, precios reales, logo definitivo, i18n (el sitio va solo en español), analytics.

## Stack

| Capa | Elección |
| --- | --- |
| Framework | Next.js (App Router) con `output: 'export'` (100% estático) |
| Lenguaje | TypeScript estricto |
| Estilos | Tailwind CSS |
| Tipografía | Geist Sans + Geist Mono (paquete `geist`) |
| Animaciones | Componentes de React Bits copiados al repo (variante TS + Tailwind) |
| Hosting | Vercel, con dominio propio |

Ubicación: `apps/landing/` dentro del monorepo definido en `docs/PLAN.md`. La landing es independiente del backend (Fastify) y del panel (Vite), y no comparte runtime con ellos.

## Configuración única

`apps/landing/site.config.ts` concentra todos los datos variables. Ningún componente tiene estos valores hardcodeados.

```ts
export const site = {
  brand: "NombreMarca",            // placeholder
  domain: "dominio.com",           // placeholder
  tagline: "...",
  legal: {
    razonSocial: "RAZÓN SOCIAL S.A.S.",  // placeholder
    cuit: "30-00000000-0",               // placeholder
    domicilio: "Calle 123, Ciudad, Provincia, Argentina",
  },
  contact: {
    email: "contacto@dominio.com",
    privacyEmail: "privacidad@dominio.com", // puede ser el mismo
    phone: "+54 9 ...",
    whatsapp: "549...",  // solo dígitos, para wa.me
  },
  legalUpdatedAt: "2026-10-02",
  plans: [ /* Básico, Pro: nombre, canales, cupo, precio: null => "Consultar" */ ],
} as const;
```

Mientras haya placeholders, el build muestra un warning en consola (los valores llevan un marcador detectable). Así no se publica sin completar.

## Páginas

### `/` — Home

Secciones, en orden:

1. **Header** fijo: logotipo de texto (la marca de la config), anclas (Producto, Planes, FAQ, Contacto) y CTA "Hablemos" (WhatsApp).
2. **Hero**: título "Respondé WhatsApp, Instagram y Messenger en automático", subtítulo con la propuesta (consultas básicas: horarios, envíos, dirección, medios de pago), CTA principal "Hablemos" (wa.me) y secundario "Ver cómo funciona". Fondo animado de React Bits (*Prism* o *Light Rays*, el que mejor rinda), en la gama de los canales (verde WhatsApp / violeta-magenta Instagram / azul Messenger).
3. **Cómo funciona**, 3 pasos: conectás tus canales → cargás la info de tu negocio → activás el bot.
4. **Canales**: tarjetas WhatsApp, Instagram y Messenger, cada una con una línea de lo que hace (incluye el etiquetado de anuncios Click-to-WhatsApp/Messenger).
5. **Panel unificado**: mockup del inbox hecho en HTML/CSS (no una imagen), con la lista de conversaciones, el canal, el estado (bot / humano / en cola), el botón "Tomar control" y el contador de ventana de 24 h. Texto sobre el handoff a humano y el horario de atención.
6. **Bot acotado a tu negocio**: explica que responde solo con la info cargada, declina temas ajenos y deriva a una persona. Refuerza ante Meta que no es un asistente de propósito general.
7. **Planes**: tarjetas desde `site.plans`; si el precio es `null` se muestra "Consultar". Nota: los templates de WhatsApp se facturan aparte en la cuenta de Meta del cliente.
8. **FAQ**: acordeón nativo (`<details>`). ¿Necesito número nuevo? ¿Qué pasa fuera de horario? ¿Puedo responder yo? ¿Qué cuesta WhatsApp? ¿Dónde se guardan mis datos?
9. **Contacto**: email (mailto), WhatsApp (wa.me) y teléfono.
10. **Footer**: razón social, CUIT, domicilio, teléfono, email, links a las 3 páginas legales y © año. **Este bloque es el que verifica Meta y se renderiza en todas las páginas.**

### `/privacidad` — Política de privacidad

Español, marco Ley 25.326 (Argentina). Contenido:

- Responsable: razón social, CUIT, domicilio y contacto.
- Roles: para los mensajes de los usuarios finales de cada cliente, la empresa actúa como **encargada de tratamiento** por cuenta del cliente (responsable); para los datos de los propios clientes (cuenta, facturación), como responsable.
- Datos tratados: datos de cuenta; mensajes, identificadores y nombre de perfil recibidos de WhatsApp/Instagram/Messenger mediante las APIs de Meta; documentos que sube el cliente; datos técnicos (logs).
- Finalidades: prestar el servicio (responder consultas, panel, derivación a humano), medición de uso y facturación, seguridad.
- Terceros/subencargados: Meta Platforms (canales), el proveedor de LLM (procesa el contenido de los mensajes para generar respuestas, sin usarlos para entrenamiento según sus condiciones de API) y el proveedor de hosting/base de datos. Los nombres concretos de los proveedores se completan en la config cuando estén definidos; mientras tanto se describen por categoría.
- Transferencias internacionales: aviso de que los proveedores pueden estar fuera de Argentina.
- Uso de datos de Meta: solo para prestar el servicio al cliente que conectó su cuenta; no se venden ni se usan para publicidad.
- Retención: mientras dure el servicio, y borrado a pedido o a los X días de dada de baja la cuenta (X en la config, por defecto 30).
- Derechos: acceso, rectificación, supresión; cómo ejercerlos (email); mención de la AAIP como órgano de control con su leyenda obligatoria.
- Seguridad: cifrado en tránsito, tokens cifrados en la base, acceso por roles.
- Cambios a la política y fecha de vigencia (`legalUpdatedAt`).

### `/terminos` — Términos y condiciones

Descripción del servicio, alta y cuenta, uso aceptable (cumplir las políticas de WhatsApp Business/Meta Commerce, sin spam, sin contenido ilegal), responsabilidad del cliente por la información que carga y por sus conversaciones, costos de Meta a cargo del cliente, planes y facturación (por referencia, montos a definir), disponibilidad sin garantía absoluta, limitación de responsabilidad, baja, cambios a los términos, ley aplicable (Argentina) y jurisdicción (tribunales del domicilio de la empresa).

### `/eliminacion-de-datos` — Instrucciones de eliminación de datos

Página que se carga como "Data deletion instructions URL" en la app de Meta:

- Cómo pedir la eliminación: email a `privacyEmail` con el asunto "Eliminación de datos", indicando el número de WhatsApp o la cuenta de IG/Facebook.
- Qué se borra (mensajes, contacto, conversaciones) y plazo de respuesta (por ejemplo, 10 días hábiles, consistente con la Ley 25.326).
- Para clientes: cómo desconectar los canales y pedir la baja de la cuenta.
- (No se implementa el *data deletion callback* de Meta en esta etapa.)

> Los textos legales son una base razonable redactada para este producto, no asesoramiento legal. Conviene que los revise un abogado antes de facturar.

## Estructura de archivos

```
apps/landing/
  site.config.ts
  next.config.ts            # output: 'export', images.unoptimized
  tailwind / postcss config
  app/
    layout.tsx              # fuentes Geist, metadata, Header + Footer
    page.tsx                # home: compone las secciones
    privacidad/page.tsx
    terminos/page.tsx
    eliminacion-de-datos/page.tsx
    icon.svg                # favicon placeholder (inicial de la marca)
    opengraph-image (estático)
  components/
    layout/Header.tsx, Footer.tsx, LegalPage.tsx
    sections/Hero.tsx, HowItWorks.tsx, Channels.tsx, InboxMockup.tsx,
             Scope.tsx, Plans.tsx, Faq.tsx, Contact.tsx
    reactbits/               # componentes copiados de React Bits, sin modificar su API
  lib/links.ts              # helpers: mailto(), waLink(), telLink()
```

Cada sección es un componente sin estado que lee de `site`. Las páginas legales usan un `LegalPage` común (título, fecha de vigencia y prosa con estilos tipográficos).

## Diseño visual

- Estética Vercel/Geist: fondo neutro, mucho aire, bordes de 1px, tipografía grande en el hero y Geist Mono para detalles (etiquetas de estado, contador de 24 h).
- Modo claro y oscuro según `prefers-color-scheme`, sin selector.
- Colores de acento por canal, usados con moderación (puntos de estado, bordes de las tarjetas).
- Animaciones: solo el fondo del hero y, opcionalmente, un efecto de texto en el título. Con `prefers-reduced-motion` se muestra un fondo estático.
- Mobile first, sin scroll horizontal en 360px.
- El componente WebGL del hero se carga con `dynamic(..., { ssr: false })` para no penalizar el primer render.

## SEO y metadata

`<title>` y description por página, Open Graph, `lang="es-AR"`, `sitemap.xml` y `robots.txt` estáticos, URLs canónicas con `site.domain`.

## Deploy

- Proyecto de Vercel apuntando a `apps/landing` (root directory), build con `next build`.
- Dominio propio con HTTPS (Vercel). El email del dominio se configura aparte (fuera de este spec).

## Verificación

- `next build` sin errores ni warnings de tipos (salvo el warning intencional de placeholders mientras existan).
- Lint OK.
- Revisión manual en el navegador, desktop y mobile (360px), modo claro y oscuro, y con reduced motion.
- Lighthouse: Accesibilidad ≥ 95, SEO ≥ 95, Performance ≥ 85 en mobile.
- Checklist Meta: el footer muestra razón social, domicilio, teléfono y email del dominio, y `/privacidad`, `/terminos` y `/eliminacion-de-datos` responden 200.
