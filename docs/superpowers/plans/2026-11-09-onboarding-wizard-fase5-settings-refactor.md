# Onboarding Wizard — Fase 5: Refactor de Settings al modelo compartido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que las pantallas de Settings editen el MISMO modelo estructurado que el wizard (única fuente de verdad), reutilizando los componentes de paso del wizard; eliminar el editor viejo que ya no refleja el modelo.

**Architecture:** Settings pasa a tener una sección "Configuración del bot" con páginas finas que montan los componentes de paso del wizard (`components/wizard/steps/Step*`), ya cableados a los endpoints de fases 3a/3b. Documentos, Canales y Agentes quedan igual. El `BusinessProfileForm` viejo (editaba tone/shipping/payment, campos que ahora viven en BotPersona/CommercialPolicy) se reemplaza por los editores estructurados.

**Tech Stack:** React 19, Vite, TS, Tailwind. **Sin runner de tests**: verificación = `npm run typecheck` + `npm run lint` + `npm run build` + prueba manual.

**Repo:** `apps/web`, rama `feat/onboarding-wizard` (Fase 4 ya commiteada ahí). Correr desde `apps/web`. Respetar el WIP pre-existente: `router.tsx` ya está modificado/sin commitear por fase 4 (lo seguimos editando sin commitear si hace falta, o se commitea aparte — ver más abajo).

**Prerrequisito de lectura:** antes de crear las páginas, leer las firmas/props reales de los componentes de paso en `src/components/wizard/steps/Step1Business.tsx`, `Step2Hours.tsx`, `Step3Catalog.tsx`, `Step4Payments.tsx`, `Step5Faq.tsx`, `Step6Voice.tsx`, `Step7Handoff.tsx`. Son autocontenidos (usan sus hooks). Si alguno requiere props del wizard (ej. callbacks de navegación), adaptarlo para que funcione standalone (props opcionales con default). Reutilizarlos tal cual siempre que sea posible.

---

## Task 1: Páginas de Settings que reutilizan los pasos del wizard

**Files:**
- Create: `src/pages/SettingsCatalogPage.tsx`, `SettingsPaymentsPage.tsx`, `SettingsFaqPage.tsx`, `SettingsBotPage.tsx`
- Modify: `src/pages/SettingsProfilePage.tsx`

- [ ] **Step 1: Leer las firmas de los `Step*`** (para saber qué props pasar). Ajustar los `Step*` que no sean standalone agregando props opcionales con defaults (sin romper su uso en `WizardPage`).

- [ ] **Step 2: Refactor `SettingsProfilePage`** para montar los editores de identidad + horarios (reutilizando `Step1Business` y `Step2Hours`) en vez de `BusinessProfileForm`:
```tsx
import { Step1Business } from "../components/wizard/steps/Step1Business"
import { Step2Hours } from "../components/wizard/steps/Step2Hours"

export function SettingsProfilePage() {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-3xl">
      <h1 className="text-lg font-semibold">Perfil del negocio</h1>
      <Step1Business />
      <Step2Hours />
    </div>
  )
}
```
(ajustar props según lo leído en el Step 1 de esta task).

- [ ] **Step 3: Crear las páginas nuevas**, cada una montando el paso correspondiente dentro del shell de Settings (patrón de `SettingsProfilePage`):
- `SettingsCatalogPage.tsx` → `Step3Catalog` (título "Catálogo de productos").
- `SettingsPaymentsPage.tsx` → `Step4Payments` (título "Pagos y entregas").
- `SettingsFaqPage.tsx` → `Step5Faq` (título "Preguntas frecuentes").
- `SettingsBotPage.tsx` → `Step6Voice` + `Step7Handoff` (título "Cómo habla tu bot").

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npm run build`
Expected: compila.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsCatalogPage.tsx src/pages/SettingsPaymentsPage.tsx src/pages/SettingsFaqPage.tsx src/pages/SettingsBotPage.tsx src/pages/SettingsProfilePage.tsx
git commit -m "feat(web): Settings edita el modelo estructurado reusando los pasos del wizard (fase 5)"
```
(si algún `Step*.tsx` requirió ajuste de props, incluir esos archivos en el `git add`.)

---

## Task 2: Routing + navegación (Sidebar)

**Files:**
- Modify: `src/router.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Rutas nuevas**

En `src/router.tsx`, dentro del `AppLayout` children (junto a las `settings/*` existentes), agregar:
```tsx
              { path: "settings/catalog", element: <SettingsCatalogPage /> },
              { path: "settings/payments", element: <SettingsPaymentsPage /> },
              { path: "settings/faq", element: <SettingsFaqPage /> },
              { path: "settings/bot", element: <SettingsBotPage /> },
```
e importar las 4 páginas arriba.
> Nota: `router.tsx` ya tiene cambios sin commitear de fase 4 (ruta `/setup`). Al commitear esta task, incluir `router.tsx` — asumí que para fase 5 ya se puede consolidar; si se prefiere no mezclar con el WIP del dev-bypass, dejar `router.tsx` sin commitear y anotarlo en el reporte.

- [ ] **Step 2: Navegación en el Sidebar**

En `src/components/layout/Sidebar.tsx`, actualizar `settingsNav` para incluir las nuevas secciones (con íconos de `lucide-react` ya importados o nuevos). Orden sugerido:
```tsx
const settingsNav = [
  { to: "/settings/profile", icon: Settings, label: "Perfil de negocio" },
  { to: "/settings/catalog", icon: FileText, label: "Catálogo" },
  { to: "/settings/payments", icon: Settings, label: "Pagos y entregas" },
  { to: "/settings/faq", icon: FileText, label: "Preguntas frecuentes" },
  { to: "/settings/bot", icon: Bot, label: "Cómo habla tu bot" },
  { to: "/settings/documents", icon: FileText, label: "Documentos RAG" },
  { to: "/settings/channels", icon: Radio, label: "Canales & Meta" },
  { to: "/settings/agents", icon: Users, label: "Agentes y equipo" },
]
```
(importar cualquier ícono nuevo que uses; `Settings`, `FileText`, `Bot`, `Radio`, `Users` ya están importados).
Además, agregar un acceso al wizard completo: un ítem en `mainNav` o un botón "Reconfigurar con el asistente" que lleve a `/setup` (opcional pero recomendado).

- [ ] **Step 3: Verificar**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: sin errores (warnings ok). Recordar: los 3 errores TS pre-existentes en páginas de admin (`TenantTable`, `AdminSettingsPage`, `AdminTenantDetailPage`) NO son de esta fase; no deben sumarse errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(web): navegación de Settings con las secciones del modelo (fase 5)"
```
(y `router.tsx` según lo decidido en Task 2 Step 1.)

---

## Task 3: Limpieza del editor viejo

**Files:**
- Delete/retire: `src/components/settings/BusinessProfileForm.tsx` (si ya no lo usa nadie)

- [ ] **Step 1: Verificar que `BusinessProfileForm` no se use** en ningún lado (`grep -r BusinessProfileForm src`). Si solo lo usaba `SettingsProfilePage` (ya refactorizada), eliminar el archivo. Si lo usa algo más, dejarlo y anotarlo.

- [ ] **Step 2: Verificar**

Run: `npm run typecheck && npm run build`
Expected: compila (sin referencias colgando).

- [ ] **Step 3: Commit**

```bash
git add -u src/components/settings/BusinessProfileForm.tsx
git commit -m "chore(web): retirar BusinessProfileForm (reemplazado por editores estructurados) (fase 5)"
```

---

## Task 4: Verificación final

- [ ] `npm run typecheck` → solo los 3 errores pre-existentes de admin; ninguno nuevo.
- [ ] `npm run lint` → sin errores nuevos (warnings ok).
- [ ] `npm run build` → OK.
- [ ] Reporte: confirmar que en `/settings/*` se editan las mismas secciones que el wizard y que los cambios se reflejan (via los hooks que invalidan `onboarding-memory`).

---

## Self-review (cobertura vs spec)

- **Settings edita el mismo modelo (única fuente de verdad)** → Tasks 1–2 reutilizan los `Step*` del wizard. ✅
- **Documentos / Canales / Agentes sin cambios** → no se tocan. ✅
- **Retiro del editor viejo divergente** (`BusinessProfileForm`, que editaba tone/shipping/payment ya migrados a persona/policy) → Task 3. ✅
- **Verificación sin tests** (no hay runner): typecheck/lint/build + manual. ✅
- **Riesgo/decisión:** `router.tsx` arrastra WIP del dev-bypass (fase 4 dejó `/setup` sin commitear); el implementer decide consolidar o dejar sin commitear y lo reporta. Los `Step*` deben funcionar standalone (ajustar props opcionales si hacía falta).
