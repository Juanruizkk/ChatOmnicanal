# Spec: Asistente de alta (onboarding wizard) de PentaBot

**Fecha:** 2026-11-09
**Estado:** Diseño aprobado — pendiente de plan de implementación.
**Autor:** Juan Ruiz (+ Claude)

## Contexto y problema

El onboarding actual pide un solo campo (nombre del negocio) y la configuración queda repartida en
pantallas sueltas de Settings. El dueño de un negocio chico no tiene una guía que lo lleve de la mano
a cargar todo lo que el bot necesita para responder bien.

El prototipo `Estruc.ConfiguracionPentaBot.html` define el flujo deseado: un **asistente de alta de 10
pantallas** (un paso por pantalla), con un panel lateral de "memoria del bot" que muestra en vivo el
conocimiento categorizado que se va armando. Este spec lleva ese prototipo al producto real
(`apps/api` + `apps/web`) con un **modelo de datos estructurado** y siguiendo el manual de marca de
PentaBot.

**Resultado buscado:** un cliente completa el wizard en ~15 min y el bot queda listo para responder
(identidad, horarios, catálogo, pagos/envíos, FAQ, voz y reglas de handoff), con el conocimiento
persistido de forma estructurada y proyectado automáticamente al RAG.

Beneficio lateral: adelanta los puntos **2 (metadata de chunk: source + category)** y **3
(re-indexado al editar)** del roadmap de mejoras de RAG.

## Decisiones tomadas (cerradas)

1. **Backend estructurado completo** (no mapeo rápido a lo existente).
2. **Wizard = configuración principal**; las pantallas de Settings se refactorizan para editar el
   **mismo modelo** (única fuente de verdad).
3. **Sin estado "activar bot"**: responde apenas hay datos. El paso 9 es solo simulador de prueba.
4. **Parsing de catálogo por archivo (PDF/foto/Excel) queda fuera** de esta fase: ahora es carga
   manual + "pegar lista". El upload con extracción automática se difiere.
5. **Autosave** por sección. El ejemplo precargado (pastelería) solo como "ver ejemplo" opcional, no
   por defecto en producción.

## No-objetivos (explícitos)

- Extracción automática de productos/precios desde archivos (fase posterior).
- Conexión autogestiva de canales por OAuth (sigue siendo carga manual de credenciales, como hoy —
  Fase 6/7 del proyecto).
- Búsqueda híbrida / reranker / query rewriting (otros puntos del roadmap de RAG).

---

## Modelo de datos (apps/api)

Todas las entidades son `ITenantScoped : BaseEntity`, con su `IEntityTypeConfiguration` y migración EF.

### Extender `TenantProfile` (identidad del negocio)
Campos nuevos: `Rubro`, `Description` (qué hace/vende), `Zone` (zona/ciudad), `SocialHandle`
(IG/web), `DirectionsNote` (cómo llegar), `HolidaysNote` (feriados). Mantiene los actuales:
`Address`, `Timezone`, `ContactPhone`, `ContactEmail`, `BusinessHoursJson`.
> `Tone`, `ShippingInfo` y `PaymentMethods` actuales se **migran** a las entidades nuevas
> (`BotPersona.Tone`, `CommercialPolicy`) y se eliminan de `TenantProfile` para no duplicar verdad.

### `CommercialPolicy` (1:1 con tenant) — nueva
`PaymentMethods` (lista; JSON o tabla hija simple), `Installments` (cuotas), `Promo`,
`DeliveryMode` (`retiro|envio|ambos|ninguno`), `DeliveryZones`, `DeliveryCost`, `DeliveryTime`,
`PickupInfo`.

### `BotPersona` (1:1 con tenant) — nueva
`Name`, `Tone` (`cercano|profesional|canchero`), `Greeting` (saludo), `NeverRules` (texto),
y handoff: `OnComplaint`, `OnRequest`, `OnSpecial`, `OnPayment` (bool), `NotifyTo`, `Hours`,
`Message`.

### `CatalogItem` (1:N) — nueva
`Name`, `Description`, `Price` (texto o decimal normalizado), `Order`.

### `Faq` (1:N) — nueva
`Question`, `Answer`, `Order`.

### Extender `KnowledgeChunk`
Agregar `Source` (`config` | `archivo`) y `Category`
(`Negocio|Horarios|Ubicacion|Productos|Pagos|Entregas|FAQ|Estilo|Handoff`). Migración que marca los
chunks existentes como `archivo`. (Esto es el punto 2 del roadmap de RAG.)

`Channel` queda **sin cambios** (ya existe para WhatsApp/Instagram/Messenger).

---

## Proyección a conocimiento — `KnowledgeProjectionService`

Servicio nuevo en `Infrastructure/BotEngine`. Al guardar **cualquier** sección del wizard/Settings:

1. Borra los `KnowledgeChunk` del tenant con `Source="config"`.
2. Regenera chunks categorizados replicando la función `chunks()` del prototipo. Un chunk por:
   - **Negocio** (nombre + rubro + description + zona + IG)
   - **Horarios** (texto derivado de `BusinessHoursJson` + feriados)
   - **Ubicacion** (address + cómo llegar + zona)
   - **Productos** (uno por `CatalogItem`: nombre + descripción + precio)
   - **Pagos** (medios + cuotas + promo)
   - **Entregas** (texto según `DeliveryMode` + zonas/costo/plazo/retiro)
   - **FAQ** (uno por `Faq` con respuesta cargada)
   - **Estilo** (nombre/tono/saludo/reglas del bot)
   - **Handoff** (triggers activos + a quién avisar + horario + mensaje)
3. Cada chunk lleva `Category` + etiquetas (keywords) + embedding (pipeline actual de
   `KnowledgeService`). Los chunks `Source="archivo"` (uploads) **no se tocan**. (Punto 3 del roadmap:
   re-indexado al editar.)

> Se reutiliza el embedding/splitter existente de `KnowledgeService`. La diferencia es el origen
> (datos estructurados vs archivo) y que se regenera transaccionalmente por tenant.

---

## Integración con el bot (`BotEngineService` / `SystemPromptBuilder`)

Regla de reparto (ajustable con la evaluación de la Ola 0 más adelante):

- **Directo al system prompt** (contexto fijo, siempre necesario): identidad (nombre/rubro/zona),
  horarios, contacto, persona (nombre/tono/saludo/reglas "nunca") y reglas de handoff. Lo arma
  `SystemPromptBuilder` leyendo las entidades estructuradas (hoy ya lee `TenantProfile`).
- **Vía RAG** (lookup, variable/grande): catálogo, FAQ, pagos, envíos, ubicación detallada → se
  recuperan de los chunks `Source="config"` por similitud, como hoy.

La proyección genera chunks de **todas** las categorías (para que el panel "memoria" muestre todo y
el retrieval pueda sacar cualquier cosa), pero el prompt no re-inyecta identidad/persona (evita
duplicar). Sin gate de activación: el bot responde con lo que haya.

---

## API (apps/api) — endpoints por sección

Patrón actual: `[Authorize]` + `ICurrentTenantService`. Nuevos/ajustados:

- `GET/PUT /api/tenant-profile` — identidad + horarios (extendido).
- `GET/PUT /api/commercial-policy` — pagos + entregas.
- `GET/PUT /api/bot-persona` — voz + handoff.
- `GET/POST/PUT/DELETE /api/catalog` — items de catálogo (+ `POST /api/catalog/parse-list` para
  "pegar lista": texto → items, sin IA).
- `GET/POST/PUT/DELETE /api/faq` — preguntas frecuentes.
- `GET /api/knowledge` — ya existe (docs/archivos).
- `GET /api/channels` — ya existe.
- `GET /api/onboarding/memory` — **preview**: devuelve los chunks `Source="config"` proyectados
  (para el panel "memoria del bot" y el checklist de completitud).

Cada `PUT/POST/DELETE` que cambie datos dispara `KnowledgeProjectionService`.

---

## Frontend (apps/web)

### Tema de marca PentaBot
Llevar los tokens del prototipo al theme de Tailwind: colores (`azul #1078E0`, `cian #00B8D8`,
`violeta #8B5CF6`, `tinta`, `cielo`, `noche`, estados `ok`/`humano`), fuentes **Manrope** (display)
+ **Inter** (body), radios redondeados y estética de burbujas. Respetar reglas del manual (degradé
solo en isotipo, violeta mínimo, proporción 70/20/10).

### Wizard de 10 pasos (reemplaza el onboarding actual)
Layout del prototipo: asistente a la izquierda (un paso por pantalla, dots numerados de progreso),
**panel "memoria del bot" a la derecha** (consume `GET /api/onboarding/memory`), autosave por sección
(PUT debounced), navegación anterior/siguiente + ir a un paso. Mapa paso → datos:

| Paso | Pantalla | Entidad/sección |
|------|----------|-----------------|
| 0 | Bienvenida | — |
| 1 | Tu negocio | `TenantProfile` (nombre, rubro, description, zona, IG) |
| 2 | Días y horarios | `TenantProfile` (hours, address, directions, holidays) |
| 3 | Productos y precios | `CatalogItem[]` (manual + pegar lista; upload de archivo **oculto/próximamente**) |
| 4 | Pagos y entregas | `CommercialPolicy` |
| 5 | Preguntas frecuentes | `Faq[]` |
| 6 | Cómo habla tu bot | `BotPersona` (voz) |
| 7 | Cuándo pasa a una persona | `BotPersona` (handoff) |
| 8 | Tus canales | `Channel` (existente) |
| 9 | Probar | Simulador (`POST /api/bot/simulate`) + checklist de completitud. **Sin "activar".** |

### Refactor de Settings
Las pantallas de Settings pasan a editar las **mismas** entidades (misma fuente de verdad). Se
agregan secciones para catálogo, FAQ, pagos/envíos, persona y handoff; `BusinessProfileForm` se
ajusta al perfil extendido; Canales y Agentes quedan igual.

---

## Fases de implementación (orden sugerido)

1. **Modelo de datos + migraciones**: entidades nuevas/extendidas + `Source`/`Category` en
   `KnowledgeChunk` + migrar datos existentes (`Tone`/`ShippingInfo`/`PaymentMethods`, chunks →
   `archivo`).
2. **`KnowledgeProjectionService`** + wiring al guardar + integración con `SystemPromptBuilder`/RAG +
   tests (proyección determinista, aislamiento por tenant, re-generación).
3. **API** por sección + `GET /api/onboarding/memory` + tests de controller.
4. **Tema de marca** + **wizard de 10 pasos** (con autosave y panel memoria).
5. **Refactor de Settings** al modelo compartido.

Cada fase es entregable por separado; 1→2→3 son backend, 4→5 frontend.

## Verificación

- **Backend:** `dotnet test` en `apps/api` en verde tras cada migración. Tests nuevos para
  `KnowledgeProjectionService` (regeneración + aislamiento por tenant, al estilo
  `KnowledgeVectorSearchTests`) y para cada controller nuevo (al estilo `BotSimulateControllerTests`).
- **End-to-end:** levantar app (API `:8080` + Vite), recorrer el wizard con un negocio de prueba,
  ver la "memoria" poblarse y validar en `/simulation` que el bot responde con esos datos y deriva
  cuando corresponde.
- **Frontend:** `npm run typecheck` + `npm run lint` sin errores.

## Riesgos / cuestiones abiertas

- **Reparto prompt vs RAG**: la regla inicial es un supuesto; se validará con la Ola 0 (golden set).
- **Migración de datos existentes**: si hay tenants con `Tone/ShippingInfo/PaymentMethods` cargados,
  la migración debe preservarlos hacia las entidades nuevas.
- **Tamaño del refactor de Settings** (Fase 5): puede crecer; se puede entregar pantalla por pantalla.
- **`Price` de `CatalogItem`**: decidir en el plan si se guarda como texto libre (como el prototipo)
  o decimal normalizado (mejor para futuro, pero exige parseo). Recomendación: texto mostrado +
  decimal opcional.
