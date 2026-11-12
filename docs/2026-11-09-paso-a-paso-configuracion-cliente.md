# Paso a paso: qué carga un cliente al configurarse (UI + endpoints)

> Documenta el flujo real de configuración de un tenant, pantalla por pantalla y endpoint por
> endpoint, tal como está implementado hoy. Sirve de base para la Ola 0 (golden set / eval): define
> exactamente **qué fuentes de información existen** y cómo cada una alimenta (o no) el RAG.
>
> Todos los endpoints bajo `/api/*` requieren `[Authorize]` y resuelven el tenant vía
> `TenantMiddleware` (en dev, con el dev-bypass: `Authorization: Bearer dev-bypass-token`).
> Base del frontend: rutas protegidas bajo `TenantRoute` (`apps/web/src/router.tsx`).

---

## Resumen: dos clases de fuente que alimentan al bot

| Fuente | Dónde se carga | Cómo llega al bot | ¿Pasa por RAG? |
|--------|----------------|-------------------|----------------|
| **Perfil del negocio** (`TenantProfile`) | Formulario estructurado | Se inyecta **directo** al system prompt (`SystemPromptBuilder`) | ❌ No — texto fijo en el prompt |
| **Documentos de conocimiento** (`KnowledgeDoc`/`KnowledgeChunk`) | Upload de archivo o texto libre | Chunk + embedding → búsqueda por similitud | ✅ Sí — esto **es** el RAG |
| **Canales** (`Channel`) | Formularios con credenciales Meta | Entrada/salida de mensajes | ❌ No (transporte) |

Esta distinción es la que el punto 2 del roadmap de RAG llama `source: formulario` vs `archivo`.

---

## Paso 0 — Alta de cuenta (Clerk)
- **UI:** `/sign-up` y `/sign-in` (`AuthLayout`, páginas de Clerk).
- **Backend:** el usuario se sincroniza vía webhook de Clerk (`ClerkWebhookController`) y/o
  `EnsureUserAsync`. No hay endpoint que el cliente llame a mano.

## Paso 1 — Crear el negocio (onboarding)
- **UI:** `/onboarding` → `OnboardingPage.tsx`. Único campo: **Nombre del negocio**. Botón *Continuar*.
- **Endpoint:** `POST /api/tenants`
  - Body: `{ "name": "Mi tienda" }` (`CreateTenantRequest`)
  - Reglas: nombre obligatorio; si el usuario ya pertenece a un negocio → `409 Conflict`
    (un usuario = un solo negocio).
  - Respuesta: `201 Created` con el tenant; el dueño queda como `owner`.
- Tras crearlo, redirige a `/conversations`. El resto se completa en **Configuración**.

## Paso 2 — Perfil del negocio  *(alimenta el prompt, no el RAG)*
- **UI:** `/settings/profile` → `SettingsProfilePage` → `BusinessProfileForm.tsx`.
- **Campos del formulario:**
  - **Información del negocio:** Dirección física (`address`), Zona horaria IANA (`timezone`),
    Tono de respuesta del bot (`tone`), Teléfono (`contactPhone`), Email (`contactEmail`).
  - **Horarios de atención:** toggle por día + hora apertura/cierre → se serializa a
    `businessHoursJson` (`{ "monday": {"open":"09:00","close":"18:00"}, ... }`; día apagado = `null`).
  - **Políticas y FAQ:** Información de envíos (`shippingInfo`), Medios de pago (`paymentMethods`) —
    ambos texto libre.
- **Endpoints:**
  - `GET /api/tenant-profile` → `TenantProfileDto` (o `404` si no hay perfil).
  - `PUT /api/tenant-profile` → upsert con `UpsertTenantProfileRequest` (mismos campos). Botón
    *Guardar Configuración*.
- **Nota RAG:** todos estos campos se concatenan tal cual en el system prompt
  (`SystemPromptBuilder.BuildSystemPrompt`). No se chunkean ni se embeben.

## Paso 3 — Documentos de conocimiento  *(esto es el RAG)*
- **UI:** `/settings/documents` → `SettingsDocumentsPage` → `DocumentUpload.tsx` + `DocumentsList.tsx`.
- **Dos formas de cargar:**
  1. **Subir archivo** (`.pdf`, `.txt`, `.md`): botón *Subir archivo*.
     - `POST /api/knowledge/upload` (`multipart/form-data`, campo `file`).
     - Extrae texto (`PdfTextExtractor`/`PlainTextExtractor`) → chunking
       (`RecursiveCharacterTextSplitter`, 800/overlap 100) → embeddings (OpenAI
       `text-embedding-3-small`) → guarda `KnowledgeChunk`s. Devuelve `KnowledgeDocDto` con
       `Status` (`processing`→`ready`/`error`) y cantidad de chunks.
  2. **Agregar FAQ o texto directo:** formulario con **Título/Pregunta** + **Contenido para el RAG**.
     - `POST /api/knowledge/text` → body `{ "title": "...", "content": "..." }` (`TextKnowledgeRequest`).
     - Mismo pipeline de chunk + embedding.
- **Listar / borrar:**
  - `GET /api/knowledge` → lista de `KnowledgeDocDto`.
  - `DELETE /api/knowledge/{docId}` → borra doc + sus chunks (hoy no hay "editar": se borra y recarga).
- **Nota RAG:** hoy el chunk guarda `TenantId/DocId/ChunkIndex/Content/Embedding/UpdatedAt`. **No**
  distingue `source` (archivo vs texto) ni `category` (FAQ/producto/política) — ese es el punto 2 del
  roadmap de mejoras.

## Paso 4 — Canales (WhatsApp / Instagram / Messenger)  *(transporte, no RAG)*
- **UI:** `/settings/channels` → `SettingsChannelsPage`. Incluye tarjeta con la **URL de webhook** y
  **Verify Token** para pegar en Meta Developers, y una tarjeta por canal.
- **Overview:** `GET /api/channels` → `ChannelsOverviewResponse` (estado de cada canal + `webhookInfo`).
- **Conectar (credenciales Meta, carga manual hoy):**
  - WhatsApp: `POST /api/channels/whatsapp` → `{ phoneNumberId, wabaId?, accessToken }`.
  - Instagram: `POST /api/channels/instagram` → `{ igUserId, accessToken }`.
  - Messenger: `POST /api/channels/messenger` → `{ pageId, accessToken }`.
  - El `accessToken` se guarda cifrado (AES-256-GCM, `AesGcmTokenEncryptor`).
- **Desconectar:** `DELETE /api/channels/{channelType}` (`WhatsApp|Instagram|Messenger`).

## Paso 5 — Agentes del equipo (opcional)  *(no RAG)*
- **UI:** `/settings/agents` → `SettingsAgentsPage` → `AgentsList` + `InviteAgentModal`.
- **Endpoints:**
  - `GET /api/memberships` / `GET /api/memberships/invitations`.
  - `POST /api/memberships/invite` → `{ email }` (invita vía Clerk).
  - `DELETE /api/memberships/invitations/{id}` / `DELETE /api/memberships/{membershipId}`.

## Paso 6 — Probar el bot (simulador)
- **UI:** `/simulation` → `SimulationPage`.
- **Endpoint:** `POST /api/bot/simulate` → `{ userMessage, history? }` → `BotResponse`
  (`replyText`, `shouldHandoff`, `handoffReason`, tokens, `retrievedChunks`).
- Es el punto de entrada ideal para la evaluación end-to-end de la Ola 0: dispara el pipeline
  completo (guardrails → RAG → prompt → LLM → guardrails) contra un tenant ya configurado.

---

## Qué define esto para la Ola 0
El golden set deberá construirse contra un **tenant demo** (a definir, distinto de PentaBot) que
tenga: perfil completo (paso 2) + documentos de conocimiento representativos (paso 3). Las preguntas
del golden set apuntan al RAG (paso 3) y a la respuesta end-to-end (paso 6); el perfil (paso 2) cubre
las preguntas de datos fijos (dirección, horarios, pagos) que hoy se responden desde el prompt, no
desde la búsqueda.
