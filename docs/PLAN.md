# Plan de implementación — Chatbot omnicanal SaaS

> Contexto de producto: ver `docs/alcance.md` (exportado del doc de alcance).
> Este archivo define el orden de trabajo, el stack y los criterios de terminado.

## Cómo trabajar (instrucciones para Claude Code)

- Avanzar **una fase por vez**. No empezar la siguiente sin que se cumplan los criterios de "Terminado" de la actual.
- Antes de cada fase, proponer el diseño (modelos, endpoints, estructura de carpetas) y esperar confirmación.
- Si una decisión no está definida acá ni en el alcance, **preguntar** en lugar de asumir.
- Cada fase termina con tests pasando, migraciones aplicadas y un resumen de lo hecho.
- Nunca commitear secretos. Todo token de Meta o del LLM va en variables de entorno o cifrado en la base.

## Stack

| Capa | Tecnología |
| --- | --- |
| Backend API | .NET 8 + ASP.NET Core — Controllers → Services → Repositories + Mappers |
| ORM / DB | EF Core 8 + PostgreSQL 16 con `pgvector` |
| Cola / jobs | Hangfire (persiste en PostgreSQL) |
| Auth | Clerk |
| Frontend (panel) | React 18 + Vite + TypeScript — repo separado |
| Tiempo real | SignalR |
| Infra local | Docker Compose (postgres + pgvector, api, worker) |
| Deploy | Dokploy |
| LLM | Proveedor configurable detrás de una interfaz (`ILlmProvider`) |

Arquitectura: Clean Architecture — Domain → Application → Infrastructure → API.

### Estructura de repos (dos repos separados)

**chatomnicanal-api**
```
ChatOmnicanal.sln
src/
  ChatOmnicanal.Domain/        # Entidades, enums, sin dependencias externas
  ChatOmnicanal.Application/   # Interfaces, casos de uso, DTOs
  ChatOmnicanal.Infrastructure/ # EF Core, Hangfire, repositorios
  ChatOmnicanal.API/           # ASP.NET Core controllers, Program.cs
  ChatOmnicanal.Worker/        # Hangfire workers
tests/
  ChatOmnicanal.Domain.Tests/
  ChatOmnicanal.Integration.Tests/
docker-compose.yml
```

**chatomnicanal-web**
```
src/
  components/
  pages/
  hooks/
  services/   # llamadas a la API
vite.config.ts
```

## Modelo de datos base

Todas las tablas de negocio llevan `tenant_id`. Ninguna query sin filtro de tenant.

- **tenants**: nombre, plan, estado.
- **users** / **memberships**: usuario, tenant, rol (`owner`, `agent`).
- **tenant_profile**: datos del formulario (horarios por día, dirección, envíos, medios de pago, contacto, tono).
- **channels**: tipo (`whatsapp`, `instagram`, `messenger`), IDs externos (WABA, phone_number_id, page_id, ig_user_id), token cifrado, estado.
- **contacts**: identidad del usuario final por canal (wa_id, IGSID, PSID), nombre.
- **conversations**: canal, contacto, estado (`bot`, `humano`, `en_cola`, `cerrada`), agente asignado, `last_user_message_at`, `referral` (JSON del anuncio, si vino por pauta).
- **messages**: conversación, dirección (`in`/`out`), autor (`user`, `bot`, `agent`), contenido, `external_id` único (idempotencia), estado de entrega.
- **knowledge_docs** / **knowledge_chunks**: documentos subidos y chunks con `embedding vector`.
- **usage_events**: tenant, canal, conversación, tokens de entrada/salida, tipo de evento.

## Fases

### Fase 0 — Setup

- Monorepo, TypeScript estricto, lint, formato.
- Docker Compose con postgres+pgvector, redis, api, worker, web.
- Esquema inicial y migraciones con Drizzle.
- CI básico: lint + tests.

**Terminado:** `docker compose up` levanta todo, health checks responden, CI en verde.

### Fase 1 — Núcleo multi-tenant

- Registro, login, sesiones.
- Tenants, memberships y roles.
- Invitación de agentes por email (sin compartir contraseñas).
- Middleware que inyecta y valida `tenant_id` en cada request.

**Terminado:** dos tenants de prueba no pueden ver datos del otro (test que lo verifique).

### Fase 2 — Canal WhatsApp (modo desarrollo)

Se trabaja con el número de prueba de Meta y la app en acceso estándar.

- Endpoint de verificación de webhook (`hub.challenge`).
- Validación de firma `X-Hub-Signature-256`.
- El webhook responde 200 de inmediato y encola el payload; el worker lo procesa.
- Idempotencia por `external_id` (Meta reintenta webhooks).
- Normalizar mensaje entrante → `contact` + `conversation` + `message`.
- Servicio de envío de mensajes de texto vía Cloud API.
- Procesar webhooks de status (entregado, leído, fallido) y registrar `pricing.billable` y `category`.
- Diseñar el canal como **adaptador** (`ChannelAdapter`: `parseInbound`, `send`) para sumar IG y Messenger después sin tocar el núcleo.

**Terminado:** un mensaje enviado al número de prueba aparece en la base y se puede responder con un endpoint interno.

### Fase 3 — Motor del bot

- CRUD del `tenant_profile` (formulario).
- System prompt construido desde el perfil como datos estructurados (no va al RAG).
- Subida de documentos (PDF, texto, URL) → extracción → chunking → embeddings → `knowledge_chunks`.
- Recuperación por similitud filtrada por `tenant_id`.
- Guardrails:
  - Responde solo sobre el negocio; declina temas ajenos.
  - Moderación por reglas antes del LLM.
  - Detecta pedido de humano, baja confianza o tema sensible → señal de handoff.
- Registrar tokens consumidos en `usage_events`.
- Interfaz `LlmProvider` con una implementación inicial.

**Terminado:** suite de casos de prueba (preguntas de horario, envío, dirección, fuera de tema, pedido de humano) con respuestas esperadas pasando.

### Fase 4 — Router de estado y handoff

Máquina de estados de la conversación:

- `bot` → responde el motor.
- `bot` → `humano`: usuario pide humano en horario, o handoff por baja confianza/tema sensible.
- `bot` → `en_cola`: usuario pide humano fuera de horario; el bot avisa cuándo lo atienden.
- `humano` / `en_cola`: el bot no responde.
- `humano` → `cerrada`: el agente resuelve.
- `cerrada` → `bot`: llega un nuevo mensaje del usuario.

Además:

- Cálculo de horario de atención con zona horaria del tenant.
- Cálculo de ventana de 24 h desde `last_user_message_at`.

**Terminado:** tests de cada transición, incluido el caso fuera de horario.

### Fase 5 — Panel

- Bandeja unificada con filtros (canal, estado, agente, origen orgánico/anuncio).
- Vista de conversación con historial; mensajes del bot marcados.
- Botones "Tomar control" y "Resolver".
- Envío de mensajes del agente.
- Contador de ventana de 24 h por conversación.
- Actualización en tiempo real.
- Notificación al agente cuando una conversación pasa a `humano` o `en_cola`.
- Pantallas de configuración: formulario del negocio, documentos, agentes.
- Chat de simulación para probar el bot sin canal real.

**Terminado:** flujo completo de punta a punta con el número de prueba: usuario escribe → bot responde → usuario pide humano → agente toma, responde y resuelve → bot vuelve.

### Fase 6 — Instagram y Messenger

- Adaptadores `instagram` y `messenger` sobre `ChannelAdapter`.
- Conexión por OAuth de la cuenta profesional de IG y de la Página de Facebook.
- Etiqueta `HUMAN_AGENT` para respuestas humanas después de 24 h (hasta 7 días).
- Ice breakers configurables para Instagram.
- Lectura del objeto `referral` en los tres canales para etiquetar conversaciones de anuncios.

**Terminado:** el mismo flujo de la Fase 5 funciona en IG y Messenger con cuentas de prueba.

### Fase 7 — Onboarding y comercial

Requiere la app aprobada como Tech Provider.

- Embedded Signup en el panel (SDK de JS de Facebook): recibir WABA ID y phone number ID, intercambiar el código por token, suscribir la app a los webhooks de la WABA, registrar el número.
- Soporte de coexistencia (clientes que ya usan la app WhatsApp Business).
- Planes con cupo de conversaciones atendidas por el bot y canales habilitados.
- Medición de uso por tenant y canal; comportamiento al llegar al tope (excedente o pausa).
- Alarma: mensaje del bot con `billable: true` o `category: general_purpose_ai`.

**Terminado:** un tenant nuevo se registra, conecta su WhatsApp por Embedded Signup, completa el formulario y el bot responde sin intervención manual.

## Fuera de alcance

No implementar sin pedido explícito: pedidos/pagos/turnos en el chat, campañas masivas, integraciones con ERP/CRM, transcripción de audio, interpretación de imágenes.

## Decisiones pendientes

- Proveedor y modelo de LLM por defecto.
- Modelo de embeddings.
- Hosting de producción.
- Montos de planes y excedente.
