# Phase 2 — Canal WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el canal WhatsApp completo: verificación del webhook de Meta, validación de firma, procesamiento asíncrono con Hangfire, normalización de mensajes entrantes en Contact + Conversation + Message, envío de respuestas via Cloud API, y procesamiento de webhooks de status de entrega.

**Architecture:** El webhook de Meta es un endpoint público (Meta llama directamente, sin auth de Clerk). Al recibir un mensaje, el controller encola un Hangfire job inmediatamente y devuelve 200. El job resuelve el TenantId buscando el Channel por PhoneNumberId, luego crea o encuentra el Contact y la Conversation, persiste el Message con idempotencia por ExternalId, y queda listo para que la Fase 3 (bot) lo procese. El patrón IChannelAdapter permite agregar Instagram y Messenger después sin tocar el núcleo.

**Tech Stack:** .NET 8, ASP.NET Core, Hangfire, EF Core 8, PostgreSQL, HttpClient (Meta Graph API), xUnit, Testcontainers

> **Nota sobre paralelismo:** Esta fase puede ejecutarse en un worktree paralelo a la Fase 1 porque el webhook resuelve el TenantId por `Channel.PhoneNumberId` (no por JWT). No depende del TenantMiddleware de la Fase 1.

---

## Pre-requisitos — Configurar app de Meta (manual)

1. Felipe crea la app en Meta Business (tipo Business, caso de uso WhatsApp)
2. En la app: Configuración → WhatsApp → añadir número de prueba
3. Copiar el **Phone Number ID** y el **WhatsApp Business Account ID**
4. Generar un **System User Access Token** (con permiso `whatsapp_business_messaging`)
5. Definir un **Verify Token** (cualquier string, ej: `chatomnicanal_webhook_2026`)
6. Agregar al archivo `apps/api/src/ChatOmnicanal.API/appsettings.Development.json`:

```json
{
  "WhatsApp": {
    "AppSecret": "tu_app_secret_de_meta",
    "VerifyToken": "chatomnicanal_webhook_2026"
  },
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5435;Database=chatomnicanal;Username=postgres;Password=postgres"
  }
}
```

7. Insertar un Channel de prueba en la DB (el job lo busca por PhoneNumberId):

```sql
INSERT INTO channels (id, tenant_id, type, status, phone_number_id, encrypted_access_token, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'TU_TENANT_ID_AQUI',
  'WhatsApp',
  'Active',
  'TU_PHONE_NUMBER_ID',
  'TU_ACCESS_TOKEN',
  now(), now()
);
```

---

## File Map

```
src/ChatOmnicanal.Application/
  Channels/
    IChannelAdapter.cs          # contrato del adaptador de canal
    InboundMessage.cs           # modelo normalizado de mensaje entrante
    IMessageProcessingService.cs # procesa el mensaje normalizado
    IWhatsAppSender.cs          # envía mensajes via Cloud API

src/ChatOmnicanal.Infrastructure/
  Channels/
    WhatsApp/
      WhatsAppAdapter.cs        # implementa IChannelAdapter para WhatsApp
      WhatsAppSender.cs         # implementa IWhatsAppSender
      WhatsAppSignatureValidator.cs  # valida X-Hub-Signature-256
  Jobs/
    ProcessWhatsAppMessageJob.cs  # Hangfire job
  Services/
    MessageProcessingService.cs   # implementa IMessageProcessingService
  Modify: DependencyInjection.cs

src/ChatOmnicanal.API/
  Controllers/
    WhatsAppWebhookController.cs

tests/ChatOmnicanal.Domain.Tests/
  (sin cambios — las entidades ya tienen sus tests)

tests/ChatOmnicanal.Integration.Tests/
  API/
    WhatsAppWebhookTests.cs

tests/ChatOmnicanal.Domain.Tests/
  Channels/
    WhatsAppSignatureValidatorTests.cs   # unit tests
```

---

## Task 1: Application — Interfaces y modelos de canal

**Files:**
- Create: `src/ChatOmnicanal.Application/Channels/InboundMessage.cs`
- Create: `src/ChatOmnicanal.Application/Channels/IChannelAdapter.cs`
- Create: `src/ChatOmnicanal.Application/Channels/IMessageProcessingService.cs`
- Create: `src/ChatOmnicanal.Application/Channels/IWhatsAppSender.cs`

- [ ] **Step 1.1: Crear InboundMessage**

`src/ChatOmnicanal.Application/Channels/InboundMessage.cs`
```csharp
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Application.Channels;

public record InboundMessage(
    ChannelType ChannelType,

    // ID externo del canal (PhoneNumberId para WhatsApp, PageId para Messenger, IgUserId para IG)
    string ChannelExternalId,

    // ID externo del mensaje (para idempotencia — Meta reintenta webhooks)
    string MessageExternalId,

    // ID externo del contacto (waId, IGSID o PSID)
    string ContactExternalId,

    string? ContactName,
    string Content,
    DateTime ReceivedAt,

    // JSON del objeto referral si vino por anuncio (nullable)
    string? ReferralJson
);
```

- [ ] **Step 1.2: Crear IChannelAdapter**

`src/ChatOmnicanal.Application/Channels/IChannelAdapter.cs`
```csharp
using System.Text.Json;

namespace ChatOmnicanal.Application.Channels;

public interface IChannelAdapter
{
    Domain.Enums.ChannelType ChannelType { get; }

    // Parsea el payload crudo del webhook → InboundMessage normalizado
    // Retorna null si el payload no contiene un mensaje de usuario (ej: status de entrega)
    InboundMessage? ParseInbound(JsonElement payload);

    // Retorna true si el payload es un webhook de status de entrega (delivered, read, failed)
    bool IsStatusUpdate(JsonElement payload);

    // Parsea el status del webhook → (externalMessageId, status, billable, category)
    (string ExternalId, string Status, bool? Billable, string? Category)? ParseStatus(JsonElement payload);
}
```

- [ ] **Step 1.3: Crear IMessageProcessingService**

`src/ChatOmnicanal.Application/Channels/IMessageProcessingService.cs`
```csharp
namespace ChatOmnicanal.Application.Channels;

public interface IMessageProcessingService
{
    // Persiste el mensaje en Contact + Conversation + Message
    // Resuelve el TenantId desde Channel.PhoneNumberId (o equivalente por canal)
    Task ProcessAsync(InboundMessage message, CancellationToken ct = default);

    // Actualiza el estado de entrega de un mensaje ya persistido
    Task UpdateDeliveryStatusAsync(
        string externalMessageId,
        string status,
        bool? billable,
        string? category,
        CancellationToken ct = default);
}
```

- [ ] **Step 1.4: Crear IWhatsAppSender**

`src/ChatOmnicanal.Application/Channels/IWhatsAppSender.cs`
```csharp
namespace ChatOmnicanal.Application.Channels;

public interface IWhatsAppSender
{
    Task SendTextAsync(
        string phoneNumberId,
        string accessToken,
        string toWaId,
        string content,
        CancellationToken ct = default);
}
```

- [ ] **Step 1.5: Compilar Application**

```bash
dotnet build src/ChatOmnicanal.Application/ChatOmnicanal.Application.csproj
```

Expected: `Build succeeded`.

- [ ] **Step 1.6: Commit**

```bash
git add .
git commit -m "feat(phase-2): add IChannelAdapter, InboundMessage, IMessageProcessingService interfaces"
```

---

## Task 2: Unit tests — WhatsAppSignatureValidator (TDD)

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppSignatureValidator.cs`
- Create: `tests/ChatOmnicanal.Domain.Tests/Channels/WhatsAppSignatureValidatorTests.cs`

- [ ] **Step 2.1: Escribir los tests ANTES de implementar**

`tests/ChatOmnicanal.Domain.Tests/Channels/WhatsAppSignatureValidatorTests.cs`
```csharp
using ChatOmnicanal.Infrastructure.Channels.WhatsApp;

namespace ChatOmnicanal.Domain.Tests.Channels;

public class WhatsAppSignatureValidatorTests
{
    private const string AppSecret = "test_app_secret_12345";

    [Fact]
    public void Validate_WithCorrectSignature_ReturnsTrue()
    {
        var body = """{"object":"whatsapp_business_account","entry":[]}""";
        var expectedSig = WhatsAppSignatureValidator.ComputeSignature(AppSecret, body);

        var result = WhatsAppSignatureValidator.Validate(AppSecret, body, $"sha256={expectedSig}");

        Assert.True(result);
    }

    [Fact]
    public void Validate_WithWrongSecret_ReturnsFalse()
    {
        var body = """{"object":"whatsapp_business_account"}""";
        var sig = WhatsAppSignatureValidator.ComputeSignature("wrong_secret", body);

        var result = WhatsAppSignatureValidator.Validate(AppSecret, body, $"sha256={sig}");

        Assert.False(result);
    }

    [Fact]
    public void Validate_WithMalformedHeader_ReturnsFalse()
    {
        var result = WhatsAppSignatureValidator.Validate(AppSecret, "body", "notasha256header");

        Assert.False(result);
    }

    [Fact]
    public void Validate_WithEmptyHeader_ReturnsFalse()
    {
        var result = WhatsAppSignatureValidator.Validate(AppSecret, "body", "");

        Assert.False(result);
    }

    [Fact]
    public void Validate_WithTamperedBody_ReturnsFalse()
    {
        var originalBody = """{"object":"whatsapp_business_account"}""";
        var sig = WhatsAppSignatureValidator.ComputeSignature(AppSecret, originalBody);

        var result = WhatsAppSignatureValidator.Validate(AppSecret, "tampered_body", $"sha256={sig}");

        Assert.False(result);
    }
}
```

- [ ] **Step 2.2: Correr para verificar que fallan (clase no existe aún)**

```bash
dotnet test tests/ChatOmnicanal.Domain.Tests/ChatOmnicanal.Domain.Tests.csproj --verbosity normal
```

Expected: errores de compilación (WhatsAppSignatureValidator no existe). Esto es correcto.

- [ ] **Step 2.3: Implementar WhatsAppSignatureValidator**

`src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppSignatureValidator.cs`
```csharp
using System.Security.Cryptography;
using System.Text;

namespace ChatOmnicanal.Infrastructure.Channels.WhatsApp;

public static class WhatsAppSignatureValidator
{
    public static bool Validate(string appSecret, string body, string signatureHeader)
    {
        if (string.IsNullOrEmpty(signatureHeader) || !signatureHeader.StartsWith("sha256="))
            return false;

        var receivedHash = signatureHeader["sha256=".Length..];
        var expectedHash = ComputeSignature(appSecret, body);

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(receivedHash),
            Encoding.UTF8.GetBytes(expectedHash));
    }

    public static string ComputeSignature(string appSecret, string body)
    {
        var key = Encoding.UTF8.GetBytes(appSecret);
        var data = Encoding.UTF8.GetBytes(body);
        var hash = HMACSHA256.HashData(key, data);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
```

- [ ] **Step 2.4: Agregar referencia al proyecto Domain.Tests**

```bash
dotnet add tests/ChatOmnicanal.Domain.Tests/ChatOmnicanal.Domain.Tests.csproj reference src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```

- [ ] **Step 2.5: Correr tests hasta que pasen**

```bash
dotnet test tests/ChatOmnicanal.Domain.Tests/ChatOmnicanal.Domain.Tests.csproj --verbosity normal
```

Expected: `5 passed` (los 5 nuevos de firma + los 6 de Conversation existentes = 11 total... verificar el número exacto).

- [ ] **Step 2.6: Commit**

```bash
git add .
git commit -m "feat(phase-2): add WhatsAppSignatureValidator with unit tests (TDD)"
```

---

## Task 3: Infrastructure — WhatsAppAdapter

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppAdapter.cs`

- [ ] **Step 3.1: Implementar WhatsAppAdapter**

`src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppAdapter.cs`
```csharp
using System.Text.Json;
using ChatOmnicanal.Application.Channels;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Infrastructure.Channels.WhatsApp;

public class WhatsAppAdapter : IChannelAdapter
{
    public ChannelType ChannelType => ChannelType.WhatsApp;

    public InboundMessage? ParseInbound(JsonElement payload)
    {
        // Estructura del webhook de Meta:
        // { "object": "whatsapp_business_account", "entry": [{ "changes": [{ "value": { ... } }] }] }
        if (!payload.TryGetProperty("entry", out var entries)) return null;

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes)) continue;
            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value)) continue;

                // Solo procesar mensajes entrantes (no status updates aquí)
                if (!value.TryGetProperty("messages", out var messages)) continue;
                if (!value.TryGetProperty("metadata", out var metadata)) continue;

                var phoneNumberId = metadata.GetProperty("phone_number_id").GetString()!;

                foreach (var msg in messages.EnumerateArray())
                {
                    var msgType = msg.TryGetProperty("type", out var t) ? t.GetString() : null;
                    if (msgType != "text") continue; // Solo texto por ahora

                    var messageId = msg.GetProperty("id").GetString()!;
                    var waId = msg.GetProperty("from").GetString()!;
                    var timestamp = msg.TryGetProperty("timestamp", out var ts)
                        ? DateTimeOffset.FromUnixTimeSeconds(long.Parse(ts.GetString()!)).UtcDateTime
                        : DateTime.UtcNow;

                    var content = msg.TryGetProperty("text", out var textProp) &&
                                  textProp.TryGetProperty("body", out var body)
                        ? body.GetString() ?? ""
                        : "";

                    // Nombre del contacto (puede estar en contacts array)
                    string? contactName = null;
                    if (value.TryGetProperty("contacts", out var contacts))
                    {
                        foreach (var contact in contacts.EnumerateArray())
                        {
                            if (contact.TryGetProperty("wa_id", out var contactWaId) &&
                                contactWaId.GetString() == waId &&
                                contact.TryGetProperty("profile", out var profile) &&
                                profile.TryGetProperty("name", out var name))
                            {
                                contactName = name.GetString();
                                break;
                            }
                        }
                    }

                    // Referral (si vino por anuncio CTWA)
                    string? referralJson = null;
                    if (msg.TryGetProperty("referral", out var referral))
                        referralJson = referral.GetRawText();

                    return new InboundMessage(
                        ChannelType: ChannelType.WhatsApp,
                        ChannelExternalId: phoneNumberId,
                        MessageExternalId: messageId,
                        ContactExternalId: waId,
                        ContactName: contactName,
                        Content: content,
                        ReceivedAt: timestamp,
                        ReferralJson: referralJson);
                }
            }
        }

        return null;
    }

    public bool IsStatusUpdate(JsonElement payload)
    {
        if (!payload.TryGetProperty("entry", out var entries)) return false;
        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes)) continue;
            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value)) continue;
                if (value.TryGetProperty("statuses", out _)) return true;
            }
        }
        return false;
    }

    public (string ExternalId, string Status, bool? Billable, string? Category)? ParseStatus(JsonElement payload)
    {
        if (!payload.TryGetProperty("entry", out var entries)) return null;
        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes)) continue;
            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value)) continue;
                if (!value.TryGetProperty("statuses", out var statuses)) continue;
                foreach (var status in statuses.EnumerateArray())
                {
                    var id = status.GetProperty("id").GetString()!;
                    var statusStr = status.GetProperty("status").GetString()!;

                    bool? billable = null;
                    string? category = null;
                    if (status.TryGetProperty("pricing", out var pricing))
                    {
                        if (pricing.TryGetProperty("billable", out var b)) billable = b.GetBoolean();
                        if (pricing.TryGetProperty("category", out var c)) category = c.GetString();
                    }

                    return (id, statusStr, billable, category);
                }
            }
        }
        return null;
    }
}
```

- [ ] **Step 3.2: Compilar Infrastructure**

```bash
dotnet build src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```

Expected: `Build succeeded`.

- [ ] **Step 3.3: Commit**

```bash
git add .
git commit -m "feat(phase-2): add WhatsAppAdapter implementing IChannelAdapter"
```

---

## Task 4: Infrastructure — MessageProcessingService

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Services/MessageProcessingService.cs`

- [ ] **Step 4.1: Implementar MessageProcessingService**

`src/ChatOmnicanal.Infrastructure/Services/MessageProcessingService.cs`
```csharp
using ChatOmnicanal.Application.Channels;
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatOmnicanal.Infrastructure.Services;

public class MessageProcessingService : IMessageProcessingService
{
    private readonly IApplicationDbContext _db;
    private readonly ILogger<MessageProcessingService> _logger;

    public MessageProcessingService(IApplicationDbContext db, ILogger<MessageProcessingService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task ProcessAsync(InboundMessage inbound, CancellationToken ct = default)
    {
        // 1. Idempotencia: si el mensaje ya existe, ignorarlo (Meta reintenta webhooks)
        var exists = await _db.Messages
            .AnyAsync(m => m.ExternalId == inbound.MessageExternalId, ct);
        if (exists)
        {
            _logger.LogDebug("Message {ExternalId} already processed, skipping.", inbound.MessageExternalId);
            return;
        }

        // 2. Resolver Channel por PhoneNumberId (o equivalente)
        var channel = await _db.Channels
            .FirstOrDefaultAsync(c =>
                c.Type == inbound.ChannelType &&
                c.PhoneNumberId == inbound.ChannelExternalId &&
                c.Status == ChannelStatus.Active, ct);

        if (channel is null)
        {
            _logger.LogWarning("No active channel found for {ChannelType} {ExternalId}",
                inbound.ChannelType, inbound.ChannelExternalId);
            return;
        }

        // 3. Encontrar o crear Contact
        var contact = await _db.Contacts.FirstOrDefaultAsync(c =>
            c.TenantId == channel.TenantId &&
            c.ChannelType == inbound.ChannelType &&
            c.ExternalId == inbound.ContactExternalId, ct);

        if (contact is null)
        {
            contact = new Contact
            {
                TenantId = channel.TenantId,
                ChannelType = inbound.ChannelType,
                ExternalId = inbound.ContactExternalId,
                Name = inbound.ContactName
            };
            _db.Contacts.Add(contact);
        }
        else if (inbound.ContactName is not null && contact.Name != inbound.ContactName)
        {
            contact.Name = inbound.ContactName;
        }

        // 4. Encontrar conversación abierta o crear una nueva
        var conversation = await _db.Conversations
            .Where(c =>
                c.TenantId == channel.TenantId &&
                c.ChannelId == channel.Id &&
                c.ContactId == contact.Id &&
                c.Status != ConversationStatus.Closed)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (conversation is null)
        {
            conversation = new Conversation
            {
                TenantId = channel.TenantId,
                ChannelId = channel.Id,
                ContactId = contact.Id,
                Status = ConversationStatus.Bot,
                LastUserMessageAt = inbound.ReceivedAt,
                ReferralJson = inbound.ReferralJson
            };
            _db.Conversations.Add(conversation);
        }
        else
        {
            conversation.LastUserMessageAt = inbound.ReceivedAt;
            // Si la conversación estaba cerrada y llega un mensaje nuevo, reabrirla
            if (conversation.Status == ConversationStatus.Closed)
                conversation.ReopenAsBot();
        }

        // 5. Persistir Message
        var message = new Message
        {
            TenantId = channel.TenantId,
            ConversationId = conversation.Id,
            Direction = MessageDirection.Inbound,
            Author = MessageAuthor.User,
            Content = inbound.Content,
            ExternalId = inbound.MessageExternalId
        };
        _db.Messages.Add(message);

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Processed message {ExternalId} for tenant {TenantId}, conversation {ConversationId}",
            inbound.MessageExternalId, channel.TenantId, conversation.Id);
    }

    public async Task UpdateDeliveryStatusAsync(
        string externalMessageId,
        string status,
        bool? billable,
        string? category,
        CancellationToken ct = default)
    {
        var message = await _db.Messages
            .FirstOrDefaultAsync(m => m.ExternalId == externalMessageId, ct);

        if (message is null)
        {
            _logger.LogDebug("Status update for unknown message {ExternalId}", externalMessageId);
            return;
        }

        message.DeliveryStatus = status;
        message.Billable = billable;
        message.MetaCategory = category;

        // Alarma: si Meta clasifica el mensaje como general_purpose_ai o lo marca billable
        if (billable == true || category == "general_purpose_ai")
            _logger.LogWarning(
                "BILLING ALERT: message {ExternalId} is billable={Billable}, category={Category}",
                externalMessageId, billable, category);

        await _db.SaveChangesAsync(ct);
    }
}
```

- [ ] **Step 4.2: Commit**

```bash
git add .
git commit -m "feat(phase-2): add MessageProcessingService with idempotency and contact/conversation resolution"
```

---

## Task 5: Infrastructure — WhatsAppSender y Hangfire Job

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppSender.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Jobs/ProcessWhatsAppMessageJob.cs`

- [ ] **Step 5.1: Crear WhatsAppSender**

`src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppSender.cs`
```csharp
using System.Net.Http.Json;
using ChatOmnicanal.Application.Channels;
using Microsoft.Extensions.Logging;

namespace ChatOmnicanal.Infrastructure.Channels.WhatsApp;

public class WhatsAppSender : IWhatsAppSender
{
    private readonly HttpClient _http;
    private readonly ILogger<WhatsAppSender> _logger;

    public WhatsAppSender(HttpClient http, ILogger<WhatsAppSender> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task SendTextAsync(
        string phoneNumberId,
        string accessToken,
        string toWaId,
        string content,
        CancellationToken ct = default)
    {
        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://graph.facebook.com/v19.0/{phoneNumberId}/messages");

        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        request.Content = JsonContent.Create(new
        {
            messaging_product = "whatsapp",
            to = toWaId,
            type = "text",
            text = new { body = content }
        });

        var response = await _http.SendAsync(request, ct);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("WhatsApp send failed {Status}: {Error}", response.StatusCode, error);
            response.EnsureSuccessStatusCode();
        }
    }
}
```

- [ ] **Step 5.2: Crear ProcessWhatsAppMessageJob**

`src/ChatOmnicanal.Infrastructure/Jobs/ProcessWhatsAppMessageJob.cs`
```csharp
using System.Text.Json;
using ChatOmnicanal.Application.Channels;
using ChatOmnicanal.Infrastructure.Channels.WhatsApp;
using Microsoft.Extensions.Logging;

namespace ChatOmnicanal.Infrastructure.Jobs;

public class ProcessWhatsAppMessageJob
{
    private readonly IMessageProcessingService _processingService;
    private readonly WhatsAppAdapter _adapter;
    private readonly ILogger<ProcessWhatsAppMessageJob> _logger;

    public ProcessWhatsAppMessageJob(
        IMessageProcessingService processingService,
        WhatsAppAdapter adapter,
        ILogger<ProcessWhatsAppMessageJob> logger)
    {
        _processingService = processingService;
        _adapter = adapter;
        _logger = logger;
    }

    public async Task ExecuteAsync(string payloadJson)
    {
        using var doc = JsonDocument.Parse(payloadJson);
        var payload = doc.RootElement;

        if (_adapter.IsStatusUpdate(payload))
        {
            var statusInfo = _adapter.ParseStatus(payload);
            if (statusInfo.HasValue)
            {
                await _processingService.UpdateDeliveryStatusAsync(
                    statusInfo.Value.ExternalId,
                    statusInfo.Value.Status,
                    statusInfo.Value.Billable,
                    statusInfo.Value.Category);
            }
            return;
        }

        var inbound = _adapter.ParseInbound(payload);
        if (inbound is null)
        {
            _logger.LogDebug("Webhook payload has no processable message, ignoring.");
            return;
        }

        await _processingService.ProcessAsync(inbound);
    }
}
```

- [ ] **Step 5.3: Compilar**

```bash
dotnet build src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```

Expected: `Build succeeded`.

- [ ] **Step 5.4: Commit**

```bash
git add .
git commit -m "feat(phase-2): add WhatsAppSender and ProcessWhatsAppMessageJob"
```

---

## Task 6: API — WhatsAppWebhookController

**Files:**
- Create: `src/ChatOmnicanal.API/Controllers/WhatsAppWebhookController.cs`

- [ ] **Step 6.1: Crear el controller**

`src/ChatOmnicanal.API/Controllers/WhatsAppWebhookController.cs`
```csharp
using ChatOmnicanal.Infrastructure.Channels.WhatsApp;
using ChatOmnicanal.Infrastructure.Jobs;
using Hangfire;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/webhooks/whatsapp")]
public class WhatsAppWebhookController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<WhatsAppWebhookController> _logger;

    public WhatsAppWebhookController(IConfiguration config, ILogger<WhatsAppWebhookController> logger)
    {
        _config = config;
        _logger = logger;
    }

    // Meta llama a GET para verificar el webhook
    [HttpGet]
    public IActionResult Verify(
        [FromQuery(Name = "hub.mode")] string mode,
        [FromQuery(Name = "hub.challenge")] string challenge,
        [FromQuery(Name = "hub.verify_token")] string verifyToken)
    {
        var expectedToken = _config["WhatsApp:VerifyToken"]
            ?? throw new InvalidOperationException("WhatsApp:VerifyToken not configured.");

        if (mode == "subscribe" && verifyToken == expectedToken)
        {
            _logger.LogInformation("WhatsApp webhook verified successfully.");
            return Ok(int.Parse(challenge));
        }

        _logger.LogWarning("WhatsApp webhook verification failed. Mode={Mode}, Token mismatch.", mode);
        return Forbid();
    }

    // Meta envía POST con cada evento
    [HttpPost]
    public async Task<IActionResult> Receive()
    {
        // Leer body crudo (necesitamos el string para validar la firma)
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        // Validar firma X-Hub-Signature-256
        var appSecret = _config["WhatsApp:AppSecret"]
            ?? throw new InvalidOperationException("WhatsApp:AppSecret not configured.");

        var signature = Request.Headers["X-Hub-Signature-256"].ToString();
        if (!WhatsAppSignatureValidator.Validate(appSecret, body, signature))
        {
            _logger.LogWarning("WhatsApp webhook signature validation failed.");
            return Unauthorized();
        }

        // Responder 200 inmediatamente — Meta requiere respuesta en < 20 segundos
        // El procesamiento real ocurre en el Hangfire job
        BackgroundJob.Enqueue<ProcessWhatsAppMessageJob>(j => j.ExecuteAsync(body));

        return Ok();
    }
}
```

- [ ] **Step 6.2: Registrar nuevos servicios en DependencyInjection**

Agregar al método `AddInfrastructure` en `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`, dentro del bloque existente:

```csharp
// Agregar después de services.AddHangfireServer():

services.AddScoped<IMessageProcessingService, MessageProcessingService>();
services.AddScoped<WhatsAppAdapter>();
services.AddScoped<IChannelAdapter, WhatsAppAdapter>();
services.AddHttpClient<IWhatsAppSender, WhatsAppSender>();
services.AddScoped<ProcessWhatsAppMessageJob>();
```

También agregar los usings necesarios al principio del archivo:
```csharp
using ChatOmnicanal.Application.Channels;
using ChatOmnicanal.Infrastructure.Channels.WhatsApp;
using ChatOmnicanal.Infrastructure.Jobs;
```

- [ ] **Step 6.3: Compilar toda la solución**

```bash
dotnet build ChatOmnicanal.sln
```

Expected: `Build succeeded`.

- [ ] **Step 6.4: Commit**

```bash
git add .
git commit -m "feat(phase-2): add WhatsAppWebhookController with signature validation and Hangfire enqueue"
```

---

## Task 7: Tests de integración del webhook

**Files:**
- Create: `tests/ChatOmnicanal.Integration.Tests/API/WhatsAppWebhookTests.cs`

- [ ] **Step 7.1: Escribir los tests**

`tests/ChatOmnicanal.Integration.Tests/API/WhatsAppWebhookTests.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;
using ChatOmnicanal.Infrastructure.Channels.WhatsApp;
using ChatOmnicanal.Infrastructure.Persistence;
using ChatOmnicanal.Integration.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Text;

namespace ChatOmnicanal.Integration.Tests.API;

public class WhatsAppWebhookTests : IClassFixture<DatabaseFixture>
{
    private const string AppSecret = "test_webhook_secret";
    private const string VerifyToken = "test_verify_token";
    private readonly DatabaseFixture _fixture;
    private readonly HttpClient _client;

    public WhatsAppWebhookTests(DatabaseFixture fixture)
    {
        _fixture = fixture;

        // Crear un factory con config de WhatsApp de prueba
        var factory = fixture.Factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("WhatsApp:AppSecret", AppSecret);
            builder.UseSetting("WhatsApp:VerifyToken", VerifyToken);
        });
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Verify_WithCorrectToken_ReturnsChallenge()
    {
        var response = await _client.GetAsync(
            $"/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=12345&hub.verify_token={VerifyToken}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal("12345", body);
    }

    [Fact]
    public async Task Verify_WithWrongToken_ReturnsForbid()
    {
        var response = await _client.GetAsync(
            "/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=wrong_token");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Receive_WithInvalidSignature_Returns401()
    {
        var payload = BuildWhatsAppPayload("test_phone_id", "521234567890", "wamid_test_1", "Hola");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/whatsapp")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-Hub-Signature-256", "sha256=invalidsignature");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Receive_WithValidSignature_Returns200AndCreatesMessage()
    {
        // Seed: tenant + channel
        var (_, tenant) = await _fixture.SeedUserWithTenantAsync();
        var phoneNumberId = $"phone_{Guid.NewGuid():N}";
        await SeedChannelAsync(tenant.Id, phoneNumberId);

        var waId = "521234567890";
        var messageId = $"wamid_{Guid.NewGuid():N}";
        var payload = BuildWhatsAppPayload(phoneNumberId, waId, messageId, "Hola, quiero info");

        var signature = WhatsAppSignatureValidator.ComputeSignature(AppSecret, payload);

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/whatsapp")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-Hub-Signature-256", $"sha256={signature}");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Procesar el job directamente (Hangfire usa in-memory en tests)
        using var scope = _fixture.Factory.Services.CreateScope();
        var job = scope.ServiceProvider.GetRequiredService<Infrastructure.Jobs.ProcessWhatsAppMessageJob>();
        await job.ExecuteAsync(payload);

        // Verificar que el mensaje fue persistido
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var message = db.Messages.FirstOrDefault(m => m.ExternalId == messageId);
        Assert.NotNull(message);
        Assert.Equal("Hola, quiero info", message.Content);
    }

    [Fact]
    public async Task Receive_DuplicateMessage_IsIdempotent()
    {
        var (_, tenant) = await _fixture.SeedUserWithTenantAsync();
        var phoneNumberId = $"phone_{Guid.NewGuid():N}";
        await SeedChannelAsync(tenant.Id, phoneNumberId);

        var messageId = $"wamid_{Guid.NewGuid():N}";
        var payload = BuildWhatsAppPayload(phoneNumberId, "521111111111", messageId, "Duplicado");

        using var scope = _fixture.Factory.Services.CreateScope();
        var job = scope.ServiceProvider.GetRequiredService<Infrastructure.Jobs.ProcessWhatsAppMessageJob>();

        // Procesar dos veces
        await job.ExecuteAsync(payload);
        await job.ExecuteAsync(payload);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var count = db.Messages.Count(m => m.ExternalId == messageId);
        Assert.Equal(1, count); // Solo uno, a pesar de dos llamadas
    }

    private async Task SeedChannelAsync(Guid tenantId, string phoneNumberId)
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Channels.Add(new Channel
        {
            TenantId = tenantId,
            Type = ChannelType.WhatsApp,
            Status = ChannelStatus.Active,
            PhoneNumberId = phoneNumberId,
            EncryptedAccessToken = "test_token"
        });
        await db.SaveChangesAsync();
    }

    private static string BuildWhatsAppPayload(
        string phoneNumberId, string waId, string messageId, string text)
    {
        return $$"""
        {
          "object": "whatsapp_business_account",
          "entry": [{
            "changes": [{
              "value": {
                "metadata": { "phone_number_id": "{{phoneNumberId}}" },
                "messages": [{
                  "id": "{{messageId}}",
                  "from": "{{waId}}",
                  "timestamp": "1700000000",
                  "type": "text",
                  "text": { "body": "{{text}}" }
                }],
                "contacts": [{
                  "wa_id": "{{waId}}",
                  "profile": { "name": "Test User" }
                }]
              }
            }]
          }]
        }
        """;
    }
}
```

- [ ] **Step 7.2: Correr todos los tests**

```bash
dotnet test ChatOmnicanal.sln --verbosity normal
```

Expected: todos en verde.

- [ ] **Step 7.3: Commit**

```bash
git add .
git commit -m "test(phase-2): add WhatsApp webhook integration tests (verify, signature, idempotency)"
```

---

## Task 8: Verificación end-to-end con número de prueba de Meta

> Este task es manual. Requiere que Docker esté corriendo y que hayas completado los pre-requisitos de configuración de Meta.

- [ ] **Step 8.1: Levantar el stack**

```bash
docker compose up -d
```

- [ ] **Step 8.2: Exponer el webhook con ngrok**

```bash
ngrok http 8080
```

Copiar la URL HTTPS (ej: `https://abc123.ngrok.io`).

- [ ] **Step 8.3: Configurar el webhook en Meta**

En el panel de la app de Meta:
- Webhook URL: `https://abc123.ngrok.io/api/webhooks/whatsapp`
- Verify Token: el valor de `WhatsApp:VerifyToken` en appsettings
- Suscribirse a: `messages`

Expected: Meta llama al GET y responde "Verified".

- [ ] **Step 8.4: Enviar un mensaje de prueba**

Desde el número de prueba de Meta, enviar un mensaje de WhatsApp al número configurado.

Expected en los logs de la API:
```
Processed message wamid_XXX for tenant TenantId, conversation ConvId
```

- [ ] **Step 8.5: Verificar en la DB**

```bash
docker exec -it <postgres_container> psql -U postgres -d chatomnicanal -c "SELECT * FROM messages ORDER BY created_at DESC LIMIT 5;"
```

Expected: el mensaje del paso 8.4 aparece en la tabla.

---

## Criterio de terminado de Fase 2

- `GET /api/webhooks/whatsapp` con token correcto retorna el challenge.
- `GET /api/webhooks/whatsapp` con token incorrecto retorna 403.
- `POST /api/webhooks/whatsapp` con firma inválida retorna 401.
- `POST /api/webhooks/whatsapp` con firma válida retorna 200 y encola el job.
- El job crea Contact + Conversation + Message en la DB.
- Mensajes duplicados (mismo ExternalId) se ignoran silenciosamente (idempotencia).
- Webhooks de status actualizan `delivery_status`, `billable` y `meta_category` del mensaje.
- Un mensaje con `billable=true` o `category=general_purpose_ai` genera un log de WARNING.
- Todos los tests en verde.
