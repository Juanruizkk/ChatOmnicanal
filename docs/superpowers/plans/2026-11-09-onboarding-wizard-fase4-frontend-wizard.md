# Onboarding Wizard — Fase 4: Tema de marca + wizard (frontend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Construir en `apps/web` el asistente de alta de 10 pasos de PentaBot (fiel al prototipo) con tema de marca, autosave por sección y panel "memoria del bot" en vivo, cableado a los endpoints reales de las fases 3a/3b.

**Architecture:** Tema de marca vía CSS vars (`index.css`) + `tailwind.config.js` (colores cian/violeta, fuentes Manrope/Inter). Data layer: tipos en `api.types.ts`, servicios axios (`services/*.ts`) y hooks TanStack Query (`hooks/*.ts`) por sección + memoria. UI: `WizardPage` full-screen (columna wizard + columna memoria) con 10 pasos como componentes, autosave debounced por sección. Routing: `/setup` dentro de `TenantRoute` (requiere tenant); `/onboarding` redirige al wizard tras crear el negocio.

**Tech Stack:** React 19, Vite, TypeScript, TanStack Query, Tailwind, axios, react-hook-form (ya instalados). **Sin runner de tests**: verificación = `npm run typecheck` + `npm run lint` + `npm run build` + prueba manual.

**Repo:** `apps/web` (repo git PROPIO, remote chatOmnicanal-web.git). **Crear rama** `feat/onboarding-wizard` antes de empezar (hoy está en `main` con cambios sin commitear del dev-bypass: NO commitear esos; solo `git add` los archivos de cada task). Correr `npm`/`git` desde `apps/web`.

**Fuente de verdad del UI/lógica:** el prototipo `c:/Users/juani/Downloads/Estruc.ConfiguracionPentaBot (1).html` (10 pasos, función `chunks()`/`CP`/`STEPS`, estados). Portar su markup y lógica por paso usando los componentes `components/ui/*` existentes (button, input, label, textarea, badge).

**Mapa paso → endpoint (fases 3a/3b, backend ya hecho):**
| Paso | Sección | Endpoint |
|------|---------|----------|
| 0 Bienvenida | — | — |
| 1 Tu negocio | identidad | `PUT /api/tenant-profile` (rubro, description, zone, socialHandle; name = tenant) |
| 2 Días y horarios | perfil | `PUT /api/tenant-profile` (businessHoursJson, address, directionsNote, holidaysNote) |
| 3 Productos | catálogo | `GET/POST/PUT/DELETE /api/catalog` + `POST /api/catalog/parse-list` |
| 4 Pagos y entregas | política | `GET/PUT /api/commercial-policy` |
| 5 FAQ | faq | `GET/POST/PUT/DELETE /api/faq` |
| 6 Cómo habla | persona | `PUT /api/bot-persona` (name, tone, greeting, neverRules) |
| 7 Pase a persona | persona | `PUT /api/bot-persona` (handoff*) |
| 8 Canales | canales | (ya existe `useChannels`/`SettingsChannelsPage`; reusar) |
| 9 Probar | simulador | `POST /api/bot/simulate` (ya existe) + panel memoria |
| (lateral) memoria | preview | `GET /api/onboarding/memory` |

---

## Task 1: Crear rama + tema de marca PentaBot

**Files:**
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/tailwind.config.js`

- [ ] **Step 1: Crear la rama feature**

Desde `apps/web`: `git checkout -b feat/onboarding-wizard` (confirmar con `git branch --show-current`).

- [ ] **Step 2: Cargar fuentes Manrope + Inter**

En `apps/web/index.html`, dentro de `<head>`, agregar (igual que el prototipo):
```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@700;800&display=swap">
```

- [ ] **Step 3: Tokens de marca en `index.css`**

En `src/index.css`, reemplazar los valores de `:root` por los de marca (azul como primary, tinta como foreground) y la fuente del body. Reemplazar el bloque `@layer base { :root { ... } body { ... } }` por:
```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 218 37% 27%;        /* tinta #2C3F5F */
    --card: 0 0% 100%;
    --card-foreground: 218 37% 27%;
    --popover: 0 0% 100%;
    --popover-foreground: 218 37% 27%;
    --primary: 211 87% 47%;           /* azul #1078E0 */
    --primary-foreground: 0 0% 100%;
    --secondary: 196 67% 92%;         /* cielo2 aprox */
    --secondary-foreground: 218 37% 27%;
    --muted: 199 60% 95%;             /* cielo aprox */
    --muted-foreground: 218 18% 44%;  /* tinta2 */
    --accent: 196 67% 92%;
    --accent-foreground: 218 37% 27%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 210 30% 90%;
    --input: 210 30% 90%;
    --ring: 211 87% 47%;
    --radius: 0.9rem;                 /* bordes redondeados de marca */
  }
  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
}
```

- [ ] **Step 4: Colores + fuentes de marca en Tailwind**

En `tailwind.config.js`, dentro de `theme.extend`, agregar `fontFamily` y los colores de marca (cian/violeta y estados), junto a los `colors` existentes:
```js
      colors: {
        /* ...los existentes (border, input, ring, background, ...) se mantienen... */
        brand: {
          azul: "#1078E0",
          cian: "#00B8D8",
          violeta: "#8B5CF6",
          tinta: "#2C3F5F",
          cielo: "#EAF6FB",
          cielo2: "#D6F0F8",
          noche: "#0E1526",
          ok: "#15803D",
          humano: "#B45309",
        },
      },
      fontFamily: {
        display: ["Manrope", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
```
> IMPORTANTE: no borrar los `colors` ni `borderRadius` existentes; solo AGREGAR `brand` dentro de `colors` y el nuevo `fontFamily`.

- [ ] **Step 5: Verificar build**

Run (desde `apps/web`): `npm run build`
Expected: compila sin errores.

- [ ] **Step 6: Commit**

```bash
git add index.html src/index.css tailwind.config.js
git commit -m "feat(web): tema de marca PentaBot (colores + Manrope/Inter) (fase 4)"
```

---

## Task 2: Data layer — tipos, servicios y hooks de las secciones + memoria

**Files:**
- Modify: `apps/web/src/types/api.types.ts`
- Create: `apps/web/src/services/commercialPolicy.ts`, `botPersona.ts`, `catalog.ts`, `faq.ts`, `onboardingMemory.ts`
- Create: `apps/web/src/hooks/useCommercialPolicy.ts`, `useBotPersona.ts`, `useCatalog.ts`, `useFaq.ts`, `useOnboardingMemory.ts`

- [ ] **Step 1: Tipos nuevos en `api.types.ts`**

Agregar al final de `src/types/api.types.ts`:
```typescript
// ── Onboarding wizard ────────────────────────────────────────────────────────
export interface CommercialPolicy {
  paymentMethods: string | null   // JSON array string
  installments: string | null
  promo: string | null
  deliveryMode: string | null     // "retiro" | "envio" | "ambos" | "ninguno"
  deliveryZones: string | null
  deliveryCost: string | null
  deliveryTime: string | null
  pickupInfo: string | null
}

export interface BotPersona {
  name: string | null
  tone: string | null
  greeting: string | null
  neverRules: string | null
  handoffOnComplaint: boolean
  handoffOnRequest: boolean
  handoffOnSpecial: boolean
  handoffOnPayment: boolean
  handoffNotifyTo: string | null
  handoffHours: string | null
  handoffMessage: string | null
}

export interface CatalogItem {
  id: string
  name: string
  description: string | null
  price: string | null
  order: number
}
export interface CatalogItemInput {
  name: string
  description: string | null
  price: string | null
  order: number
}

export interface Faq {
  id: string
  question: string
  answer: string | null
  order: number
}
export interface FaqInput {
  question: string
  answer: string | null
  order: number
}

export interface MemoryChunk {
  category: string
  title: string
  content: string
  tags: string[]
}
```
Además, extender la interfaz existente `TenantProfile` con los campos de identidad (agregar al final de la interfaz):
```typescript
  rubro?: string | null
  description?: string | null
  zone?: string | null
  socialHandle?: string | null
  directionsNote?: string | null
  holidaysNote?: string | null
```

- [ ] **Step 2: Servicios**

`src/services/commercialPolicy.ts`:
```typescript
import { apiClient } from "../lib/apiClient"
import type { CommercialPolicy } from "../types/api.types"

export async function getCommercialPolicy(): Promise<CommercialPolicy | null> {
  try {
    const res = await apiClient.get<CommercialPolicy>("/api/commercial-policy")
    return res.data
  } catch { return null }
}
export async function upsertCommercialPolicy(data: CommercialPolicy): Promise<CommercialPolicy> {
  const res = await apiClient.put<CommercialPolicy>("/api/commercial-policy", data)
  return res.data
}
```
`src/services/botPersona.ts`:
```typescript
import { apiClient } from "../lib/apiClient"
import type { BotPersona } from "../types/api.types"

export async function getBotPersona(): Promise<BotPersona | null> {
  try {
    const res = await apiClient.get<BotPersona>("/api/bot-persona")
    return res.data
  } catch { return null }
}
export async function upsertBotPersona(data: BotPersona): Promise<BotPersona> {
  const res = await apiClient.put<BotPersona>("/api/bot-persona", data)
  return res.data
}
```
`src/services/catalog.ts`:
```typescript
import { apiClient } from "../lib/apiClient"
import type { CatalogItem, CatalogItemInput } from "../types/api.types"

export async function listCatalog(): Promise<CatalogItem[]> {
  const res = await apiClient.get<CatalogItem[]>("/api/catalog")
  return res.data
}
export async function createCatalogItem(data: CatalogItemInput): Promise<CatalogItem> {
  const res = await apiClient.post<CatalogItem>("/api/catalog", data)
  return res.data
}
export async function updateCatalogItem(id: string, data: CatalogItemInput): Promise<CatalogItem> {
  const res = await apiClient.put<CatalogItem>(`/api/catalog/${id}`, data)
  return res.data
}
export async function deleteCatalogItem(id: string): Promise<void> {
  await apiClient.delete(`/api/catalog/${id}`)
}
export async function parseCatalogList(text: string): Promise<CatalogItem[]> {
  const res = await apiClient.post<CatalogItem[]>("/api/catalog/parse-list", { text })
  return res.data
}
```
`src/services/faq.ts`:
```typescript
import { apiClient } from "../lib/apiClient"
import type { Faq, FaqInput } from "../types/api.types"

export async function listFaq(): Promise<Faq[]> {
  const res = await apiClient.get<Faq[]>("/api/faq")
  return res.data
}
export async function createFaq(data: FaqInput): Promise<Faq> {
  const res = await apiClient.post<Faq>("/api/faq", data)
  return res.data
}
export async function updateFaq(id: string, data: FaqInput): Promise<Faq> {
  const res = await apiClient.put<Faq>(`/api/faq/${id}`, data)
  return res.data
}
export async function deleteFaq(id: string): Promise<void> {
  await apiClient.delete(`/api/faq/${id}`)
}
```
`src/services/onboardingMemory.ts`:
```typescript
import { apiClient } from "../lib/apiClient"
import type { MemoryChunk } from "../types/api.types"

export async function getOnboardingMemory(): Promise<MemoryChunk[]> {
  const res = await apiClient.get<MemoryChunk[]>("/api/onboarding/memory")
  return res.data
}
```

- [ ] **Step 3: Hooks**

`src/hooks/useCommercialPolicy.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getCommercialPolicy, upsertCommercialPolicy } from "../services/commercialPolicy"
import type { CommercialPolicy } from "../types/api.types"

export function useCommercialPolicy() {
  return useQuery({ queryKey: ["commercial-policy"], queryFn: getCommercialPolicy })
}
export function useUpsertCommercialPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CommercialPolicy) => upsertCommercialPolicy(data),
    onSuccess: (d) => {
      qc.setQueryData(["commercial-policy"], d)
      qc.invalidateQueries({ queryKey: ["onboarding-memory"] })
    },
  })
}
```
`src/hooks/useBotPersona.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getBotPersona, upsertBotPersona } from "../services/botPersona"
import type { BotPersona } from "../types/api.types"

export function useBotPersona() {
  return useQuery({ queryKey: ["bot-persona"], queryFn: getBotPersona })
}
export function useUpsertBotPersona() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BotPersona) => upsertBotPersona(data),
    onSuccess: (d) => {
      qc.setQueryData(["bot-persona"], d)
      qc.invalidateQueries({ queryKey: ["onboarding-memory"] })
    },
  })
}
```
`src/hooks/useCatalog.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listCatalog, createCatalogItem, updateCatalogItem, deleteCatalogItem, parseCatalogList } from "../services/catalog"
import type { CatalogItemInput } from "../types/api.types"

export function useCatalog() {
  return useQuery({ queryKey: ["catalog"], queryFn: listCatalog })
}
export function useCatalogMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["catalog"] })
    qc.invalidateQueries({ queryKey: ["onboarding-memory"] })
  }
  return {
    create: useMutation({ mutationFn: (d: CatalogItemInput) => createCatalogItem(d), onSuccess: invalidate }),
    update: useMutation({ mutationFn: (v: { id: string; data: CatalogItemInput }) => updateCatalogItem(v.id, v.data), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => deleteCatalogItem(id), onSuccess: invalidate }),
    parse: useMutation({ mutationFn: (text: string) => parseCatalogList(text), onSuccess: invalidate }),
  }
}
```
`src/hooks/useFaq.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listFaq, createFaq, updateFaq, deleteFaq } from "../services/faq"
import type { FaqInput } from "../types/api.types"

export function useFaq() {
  return useQuery({ queryKey: ["faq"], queryFn: listFaq })
}
export function useFaqMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["faq"] })
    qc.invalidateQueries({ queryKey: ["onboarding-memory"] })
  }
  return {
    create: useMutation({ mutationFn: (d: FaqInput) => createFaq(d), onSuccess: invalidate }),
    update: useMutation({ mutationFn: (v: { id: string; data: FaqInput }) => updateFaq(v.id, v.data), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => deleteFaq(id), onSuccess: invalidate }),
  }
}
```
`src/hooks/useOnboardingMemory.ts`:
```typescript
import { useQuery } from "@tanstack/react-query"
import { getOnboardingMemory } from "../services/onboardingMemory"

export function useOnboardingMemory() {
  return useQuery({ queryKey: ["onboarding-memory"], queryFn: getOnboardingMemory })
}
```

- [ ] **Step 4: Verificar typecheck**

Run: `npm run typecheck`
Expected: sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/types/api.types.ts src/services/commercialPolicy.ts src/services/botPersona.ts src/services/catalog.ts src/services/faq.ts src/services/onboardingMemory.ts src/hooks/useCommercialPolicy.ts src/hooks/useBotPersona.ts src/hooks/useCatalog.ts src/hooks/useFaq.ts src/hooks/useOnboardingMemory.ts
git commit -m "feat(web): data layer (tipos/servicios/hooks) de las secciones + memoria (fase 4)"
```

---

## Task 3: Shell del wizard + panel memoria + routing

**Files:**
- Create: `apps/web/src/pages/WizardPage.tsx`
- Create: `apps/web/src/components/wizard/MemoryPanel.tsx`
- Create: `apps/web/src/components/wizard/WizardSteps.tsx` (barra de dots/progreso)
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/src/pages/OnboardingPage.tsx`

- [ ] **Step 1: `MemoryPanel`** (consume `useOnboardingMemory`)

Crear `src/components/wizard/MemoryPanel.tsx`: componente que lista los `MemoryChunk` agrupados por `category`, mostrando `title` y un snippet de `content`, con estilo de marca (fondo `brand-cielo`, tarjetas redondeadas). Encabezado "La memoria de tu bot". Si está vacío, mensaje "Todavía no cargaste información.". Portar el aspecto del `<aside class="mem">` del prototipo.

- [ ] **Step 2: `WizardSteps`** (barra de progreso de 10 pasos)

Crear `src/components/wizard/WizardSteps.tsx`: recibe `steps: string[]`, `current: number`, `isDone: (i:number)=>boolean`, `onGoto: (i:number)=>void`. Renderiza los dots numerados (0 = •) con estados `now`/`done`, como `.steps/.dot` del prototipo.

- [ ] **Step 3: `WizardPage`** (shell + estado de paso + layout 2 columnas)

Crear `src/pages/WizardPage.tsx`:
- Estado `step` (0..9) en `useState`, persistido opcionalmente en `localStorage` (`pentabot-wizard-step`).
- Layout: header con logo/brand + "Tus respuestas se guardan solas"; grid 2 columnas (wizard izquierda, `<MemoryPanel/>` derecha, sticky en desktop) como `.layout` del prototipo.
- `<WizardSteps/>` arriba; abajo el componente del paso actual (Task 4) via un switch `renderStep(step)`.
- Navegación: botones Anterior/Siguiente (y "Ir a conversaciones" al terminar).
- Importará los componentes de paso creados en la Task 4 (si se ejecuta antes, dejar imports y un placeholder `<div/>` por paso que se completa en Task 4). 

- [ ] **Step 4: Routing**

En `src/router.tsx`:
1. Importar `WizardPage`.
2. Dentro de `TenantRoute` → `children`, agregar como **primer** child (hermano de `AppLayout`, full-screen):
```tsx
          { path: "setup", element: <WizardPage /> },
```
(queda: `children: [ { path: "setup", element: <WizardPage/> }, { element: <AppLayout/>, children: [...] } ]`).
En `src/pages/OnboardingPage.tsx`: cambiar el `navigate("/conversations", ...)` del `onSuccess` por `navigate("/setup", { replace: true })` (tras crear el negocio, va al wizard).

- [ ] **Step 5: Verificar**

Run: `npm run typecheck && npm run build`
Expected: compila. `/setup` navegable (en dev-bypass hay tenant).

- [ ] **Step 6: Commit**

```bash
git add src/pages/WizardPage.tsx src/components/wizard/MemoryPanel.tsx src/components/wizard/WizardSteps.tsx src/router.tsx src/pages/OnboardingPage.tsx
git commit -m "feat(web): shell del wizard + panel memoria + routing /setup (fase 4)"
```

---

## Task 4: Los 10 pasos del wizard (componentes) con autosave

**Files:**
- Create: `apps/web/src/components/wizard/steps/Step0Welcome.tsx` … `Step9Test.tsx` (10 archivos)
- Modify: `apps/web/src/pages/WizardPage.tsx` (wire de los pasos)

> Portar cada pantalla del prototipo HTML (funciones `R[0]`..`R[9]`) a un componente React, usando los `components/ui/*` existentes y los hooks de la Task 2. Autosave: cada paso guarda su sección al salir del campo (onBlur) o con debounce ~600ms usando el `useUpsert*`/`useFaqMutations`/`useCatalogMutations`. Tras guardar, los hooks invalidan `onboarding-memory` → el panel se actualiza solo.

- [ ] **Step 1: Pasos 1, 2 (perfil) y 6, 7 (persona)**

- `Step1Business.tsx`: nombre (del tenant, display), rubro (chips + input), description (textarea), zone, socialHandle → `useUpdateTenantProfile` (mergear con el profile actual para no pisar otros campos). 
- `Step2Hours.tsx`: días/horarios (toggle + time por día, serializa a `businessHoursJson` igual que `BusinessProfileForm`), address, directionsNote, holidaysNote → `useUpdateTenantProfile`.
- `Step6Voice.tsx`: name, tone (opciones cercano/profesional/canchero), greeting, neverRules (chips de `NUNCA` + textarea) → `useUpsertBotPersona` (mergear con persona actual).
- `Step7Handoff.tsx`: toggles OnComplaint/OnRequest/OnSpecial/OnPayment, notifyTo, hours, message → `useUpsertBotPersona` (merge).
> Para perfil y persona: cargar con `useTenantProfile`/`useBotPersona`, editar en estado local, y en autosave mandar el objeto completo (merge) para respetar el full-replace del backend.

- [ ] **Step 2: Pasos 3 (catálogo) y 5 (FAQ)**

- `Step3Catalog.tsx`: lista editable de items (`useCatalog` + `useCatalogMutations`: create/update/remove) + "pegar lista" (textarea → `parse`). Upload de archivo: mostrar la tarjeta deshabilitada con nota "Próximamente" (parsing diferido).
- `Step5Faq.tsx`: lista de FAQ (`useFaq` + `useFaqMutations`), cada una pregunta + respuesta; chip "Respondida/Falta respuesta".

- [ ] **Step 3: Paso 4 (pagos y entregas)**

- `Step4Payments.tsx`: medios de pago (chips multi → guardar como JSON array string en `paymentMethods`), installments, promo, deliveryMode (opciones retiro/envio/ambos/ninguno) + campos condicionales (zones/cost/time si envía; pickupInfo si retira) → `useUpsertCommercialPolicy`.

- [ ] **Step 4: Pasos 0, 8, 9**

- `Step0Welcome.tsx`: bienvenida (texto del prototipo R[0]).
- `Step8Channels.tsx`: reusar el contenido de `SettingsChannelsPage` (o un resumen con link); mínimo: explicar y linkear a `/settings/channels`. (La conexión real ya existe.)
- `Step9Test.tsx`: simulador — reusar el patrón de `SimulationPage`/`BotSimulationChat` (POST `/api/bot/simulate`) con chips de preguntas sugeridas; sin botón "Activar" (decisión: el bot responde apenas hay datos).

- [ ] **Step 5: Wire en `WizardPage`**

Actualizar `renderStep(step)` en `WizardPage.tsx` para montar `Step0..Step9` según el índice.

- [ ] **Step 6: Verificar**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/wizard/steps/ src/pages/WizardPage.tsx
git commit -m "feat(web): 10 pasos del wizard con autosave y memoria en vivo (fase 4)"
```

---

## Task 5: Verificación final

- [ ] **Step 1:** `npm run typecheck` → sin errores.
- [ ] **Step 2:** `npm run lint` → sin errores (warnings aceptables).
- [ ] **Step 3:** `npm run build` → build OK.
- [ ] **Step 4:** Reporte para prueba manual: indicar que con dev-bypass (`VITE_DEV_BYPASS_AUTH=true`) y la API en `:8080`, se navega a `/setup` para recorrer el wizard y ver la memoria poblarse.

---

## Self-review (cobertura vs spec)

- **Tema de marca** (colores azul/cian/violeta, Manrope/Inter, radios) → Task 1. ✅
- **Data layer por sección + memoria** → Task 2. ✅
- **Wizard de 10 pasos + autosave + panel memoria en vivo** → Tasks 3–4. ✅
- **Routing `/setup` dentro de TenantRoute + onboarding redirige** → Task 3. ✅
- **Upload de catálogo diferido** (manual + pegar lista ahora) → Task 4 Step 2. ✅
- **Sin "activar"** (paso 9 solo simulador) → Task 4 Step 4. ✅
- **Canales**: se reutiliza lo existente → Task 4 Step 4. ✅
- **Verificación sin tests unitarios** (no hay runner): typecheck/lint/build + manual → Task 5. ✅
- **Fuera de alcance (Fase 5):** refactor de las pantallas de Settings para editar el mismo modelo.
- **Riesgo:** perfil/persona son full-replace en el backend → los pasos deben mergear el objeto completo antes de guardar (anotado en Task 4 Step 1).
