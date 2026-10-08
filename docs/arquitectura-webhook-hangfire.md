# Arquitectura: Webhook → Hangfire → Procesamiento de mensajes

Explica el flujo completo que recorre un mensaje entrante desde que Meta llama el webhook hasta que el bot responde.

---

## ¿Por qué Hangfire?

Meta exige que el endpoint del webhook responda `200 OK` en menos de 20 segundos. El procesamiento real (LLM, RAG, guardrails, persistencia) puede exceder ese límite. Hangfire actúa como cola de jobs respaldada por PostgreSQL: el controller encola el trabajo y responde de inmediato; un worker interno lo ejecuta de forma asíncrona. Si el worker falla, Hangfire reintenta automáticamente.

**Paquetes usados:**
- `Hangfire.AspNetCore` v1.8.14
- `Hangfire.PostgreSql` v1.20.9

Configuración: [`apps/api/src/ChatOmnicanal.Infrastructure/DependencyInjection.cs:71-77`](../apps/api/src/ChatOmnicanal.Infrastructure/DependencyInjection.cs)  
Dashboard: `GET /hangfire` — registrado en [`apps/api/src/ChatOmnicanal.API/Program.cs:26`](../apps/api/src/ChatOmnicanal.API/Program.cs)

---

## Flujo completo paso a paso

### 1. Meta llama el webhook

`POST /api/webhooks/whatsapp` con body JSON y header `X-Hub-Signature-256`.

Archivo: [`apps/api/src/ChatOmnicanal.API/Controllers/WhatsAppWebhookController.cs`](../apps/api/src/ChatOmnicanal.API/Controllers/WhatsAppWebhookController.cs)

```
WhatsAppWebhookController.Receive()
  ├─ Lee body como string crudo
  ├─ WhatsAppSignatureValidator.Validate(appSecret, body, signature)
  │    └─ HMAC-SHA256 en tiempo constante — si falla → 401
  ├─ BackgroundJob.Enqueue<ProcessWhatsAppMessageJob>(j => j.ExecuteAsync(body))
  │    └─ Hangfire serializa el job en PostgreSQL
  └─ return Ok()  ← Meta recibe 200 en milisegundos
```

Validación de firma: [`apps/api/src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppSignatureValidator.cs`](../apps/api/src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppSignatureValidator.cs)

Los mismos controllers existen para Instagram y Messenger:
- [`apps/api/src/ChatOmnicanal.API/Controllers/InstagramWebhookController.cs`](../apps/api/src/ChatOmnicanal.API/Controllers/InstagramWebhookController.cs)
- [`apps/api/src/ChatOmnicanal.API/Controllers/MessengerWebhookController.cs`](../apps/api/src/ChatOmnicanal.API/Controllers/MessengerWebhookController.cs)

---

### 2. Hangfire ejecuta el job

Archivo: [`apps/api/src/ChatOmnicanal.Infrastructure/Jobs/ProcessWhatsAppMessageJob.cs`](../apps/api/src/ChatOmnicanal.Infrastructure/Jobs/ProcessWhatsAppMessageJob.cs)

```
ProcessWhatsAppMessageJob.ExecuteAsync(body)
  ├─ JsonDocument.Parse(body)
  ├─ WhatsAppAdapter.IsStatusUpdate(payload)?
  │    ├─ SÍ → ParseStatus() → MessageProcessingService.UpdateDeliveryStatusAsync()
  │    │         └─ Busca Message por ExternalId, actualiza DeliveryStatus/Billable/Category
  │    └─ NO → WhatsAppAdapter.ParseInbound(payload) → InboundMessage record
  └─ MessageProcessingService.ProcessAsync(inbound)
```

`InboundMessage` es un record inmutable con: `ChannelType`, `ChannelExternalId`, `MessageExternalId`, `ContactExternalId`, `ContactName`, `Content`, `ReceivedAt`, `ReferralJson`.  
Archivo: [`apps/api/src/ChatOmnicanal.Application/Channels/InboundMessage.cs`](../apps/api/src/ChatOmnicanal.Application/Channels/InboundMessage.cs)

Jobs análogos para otros canales:
- [`apps/api/src/ChatOmnicanal.Infrastructure/Jobs/ProcessInstagramMessageJob.cs`](../apps/api/src/ChatOmnicanal.Infrastructure/Jobs/ProcessInstagramMessageJob.cs)
- [`apps/api/src/ChatOmnicanal.Infrastructure/Jobs/ProcessMessengerMessageJob.cs`](../apps/api/src/ChatOmnicanal.Infrastructure/Jobs/ProcessMessengerMessageJob.cs)

---

### 3. Parseo del payload — `WhatsAppAdapter`

Archivo: [`apps/api/src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppAdapter.cs`](../apps/api/src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppAdapter.cs)

Navega la estructura `entry[].changes[].value` del webhook de Meta. Extrae:
- `phone_number_id` (identifica el canal)
- `from` (waId del contacto)
- `id` (messageId, usado para idempotencia)
- `text.body` (contenido — solo tipo `text` por ahora)
- `contacts[].profile.name` (nombre del contacto, opcional)
- `referral` (si vino por anuncio CTWA)

---

### 4. Persistencia e idempotencia — `MessageProcessingService`

Archivo: [`apps/api/src/ChatOmnicanal.Infrastructure/Services/MessageProcessingService.cs`](../apps/api/src/ChatOmnicanal.Infrastructure/Services/MessageProcessingService.cs)

```
ProcessAsync(inbound)
  ├─ 1. Idempotencia: ¿ya existe Message con ese ExternalId? → return si SÍ
  ├─ 2. Resolver Channel activo por PhoneNumberId / IgUserId / PageId
  ├─ 3. Find-or-create Contact (TenantId + ChannelType + ExternalId)
  ├─ 4. Find-or-create Conversation abierta (Status != Closed)
  │       nueva  → Status = Bot
  │       existe → actualiza LastUserMessageAt
  ├─ 5. Crear Message (Inbound, Author=User, ExternalId=messageId)
  ├─ SaveChangesAsync()  ← todo en una sola transacción
  └─ 6. ConversationStateRouter.RouteInboundMessageAsync(conversation, message)
```

> La idempotencia es crítica porque Meta reintenta webhooks si no recibe `200` a tiempo. Sin esta guarda, el mismo mensaje se procesaría varias veces.

---

### 5. Enrutamiento por estado — `ConversationStateRouter`

Archivo: [`apps/api/src/ChatOmnicanal.Infrastructure/Conversations/ConversationStateRouter.cs`](../apps/api/src/ChatOmnicanal.Infrastructure/Conversations/ConversationStateRouter.cs)

```
RouteInboundMessageAsync(conversation, message)
  ├─ NotifyMessageReceivedAsync()  ← SignalR → dashboard en tiempo real
  └─ switch(conversation.Status)
       ├─ Bot / Closed(reabierto) → HandleBotTurnAsync()
       └─ Human / InQueue        → no responde el bot (mensaje ya guardado)
```

---

### 6. Turno del bot — `HandleBotTurnAsync`

Dentro de [`ConversationStateRouter.cs:81`](../apps/api/src/ChatOmnicanal.Infrastructure/Conversations/ConversationStateRouter.cs)

```
HandleBotTurnAsync()
  ├─ Carga últimos 6 mensajes como historial (BotChatMessage[])
  ├─ BotEngineService.ProcessMessageAsync(BotRequest)
  │    └─ Groq LLM + RAG sobre KnowledgeChunks + Guardrails
  ├─ botResponse.ShouldHandoff?
  │    ├─ SÍ → HandleHandoffAsync()
  │    │         ├─ BusinessHoursService.IsOpen()?
  │    │         │    ├─ SÍ  → conversation.TransitionToHuman()
  │    │         │    └─ NO  → conversation.TransitionToQueue() + mensaje "fuera de horario"
  │    │         └─ NotifyConversationStatusChangedAsync()  ← SignalR
  │    └─ NO → SaveAndSendBotReplyAsync()
```

---

### 7. Guardar y despachar la respuesta — `SaveAndSendBotReplyAsync`

Dentro de [`ConversationStateRouter.cs:154`](../apps/api/src/ChatOmnicanal.Infrastructure/Conversations/ConversationStateRouter.cs)

```
SaveAndSendBotReplyAsync(replyText)
  ├─ Crea Message (Outbound, Author=Bot, ExternalId=bot_{guid})
  ├─ SaveChangesAsync()
  ├─ NotifyMessageReceivedAsync()  ← SignalR al agente del dashboard
  └─ switch(channel.Type)
       ├─ WhatsApp  → WhatsAppSender.SendTextAsync()   → API de Meta
       ├─ Instagram → InstagramSender.SendTextAsync()  → API de Meta
       └─ Messenger → MessengerSender.SendTextAsync()  → API de Meta
```

Sender de WhatsApp: [`apps/api/src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppSender.cs`](../apps/api/src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppSender.cs)

---

## Diagrama de secuencia

```
Meta              Controller (ms)         Hangfire Worker (async)            Meta
 │                     │                          │
 │── POST webhook ────▶│                          │
 │                     │── Enqueue job ──────────▶│
 │◀─── 200 OK ─────────│                          │
 │                     │               ParseInbound()
 │                     │               Idempotencia (ExternalId)
 │                     │               Find/Create Contact + Conversation
 │                     │               Persiste Message (SaveChanges)
 │                     │               StateRouter → Bot / Human / Queue
 │                     │               BotEngine (LLM + RAG + Guardrails)
 │                     │               SignalR → dashboard del agente
 │◀────────────────────────────────── Sender.SendTextAsync()
```

---

## Registro de los jobs en DI

[`apps/api/src/ChatOmnicanal.Infrastructure/DependencyInjection.cs:54-66`](../apps/api/src/ChatOmnicanal.Infrastructure/DependencyInjection.cs)

```csharp
services.AddScoped<ProcessWhatsAppMessageJob>();
services.AddScoped<ProcessInstagramMessageJob>();
services.AddScoped<ProcessMessengerMessageJob>();
```

Los tres jobs están registrados como `Scoped` para que Hangfire les inyecte dependencias por ejecución.
