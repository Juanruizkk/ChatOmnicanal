# Phase 6 — Instagram + Messenger Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar recepción y envío de mensajes por Instagram DM y Facebook Messenger siguiendo exactamente el mismo patrón `IChannelAdapter` / `IChannelSender` establecido en Phase 2 para WhatsApp.

**Architecture:**
- **Adapters (parseo):** `InstagramAdapter` y `MessengerAdapter` implementan `IChannelAdapter`. Parsean el payload de Meta (objeto `"instagram"` y `"page"` respectivamente) hacia el `InboundMessage` normalizado que ya consume `MessageProcessingService`.
- **Senders (envío):** `IInstagramSender` e `IMessengerSender` (nuevas interfaces, misma forma que `IWhatsAppSender`) con implementaciones HTTP hacia la Graph API v19.0. `ConversationStateRouter` y `ConversationService` extienden su bloque de envío con `switch` sobre `channel.Type`.
- **Webhook controllers:** `InstagramWebhookController` (`/api/webhooks/instagram`) y `MessengerWebhookController` (`/api/webhooks/messenger`) replican exactamente `WhatsAppWebhookController` — validan `X-Hub-Signature-256` con `WhatsAppSignatureValidator` (mismo HMAC-SHA256), devuelven `hub.challenge` en GET, encolan Hangfire job en POST.

**Tech Stack:** .NET 8, ASP.NET Core, Hangfire, Meta Graph API v19.0, xUnit, Testcontainers.

---

## Context del codebase

Antes de empezar, leer estos archivos para entender los patrones existentes:
- `src/ChatOmnicanal.Application/Channels/IChannelAdapter.cs` — interfaz a implementar
- `src/ChatOmnicanal.Application/Channels/InboundMessage.cs` — tipo normalizado de retorno
- `src/ChatOmnicanal.Application/Channels/IWhatsAppSender.cs` — modelo a replicar para IInstagramSender/IMessengerSender
- `src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppAdapter.cs` — parser a replicar
- `src/ChatOmnicanal.Infrastructure/Channels/WhatsApp/WhatsAppSender.cs` — sender a replicar
- `src/ChatOmnicanal.API/Controllers/WhatsAppWebhookController.cs` — controller a replicar
- `src/ChatOmnicanal.Infrastructure/Jobs/ProcessWhatsAppMessageJob.cs` — job a replicar
- `src/ChatOmnicanal.Infrastructure/Services/MessageProcessingService.cs` — lookup de Channel a extender
- `src/ChatOmnicanal.Infrastructure/Conversations/ConversationStateRouter.cs` — sending a extender
- `src/ChatOmnicanal.Infrastructure/Conversations/ConversationService.cs` — sending a extender
- `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs` — registros a agregar
- `tests/ChatOmnicanal.Integration.Tests/Infrastructure/DatabaseFixture.cs` — test doubles a agregar
- `tests/ChatOmnicanal.Integration.Tests/API/WhatsAppWebhookTests.cs` — patrón de test a replicar

---

## File Map

```
src/ChatOmnicanal.Application/Channels/
  IInstagramSender.cs          [CREATE]
  IMessengerSender.cs          [CREATE]

src/ChatOmnicanal.Infrastructure/Channels/
  Instagram/
    InstagramAdapter.cs        [CREATE]
    InstagramSender.cs         [CREATE]
  Messenger/
    MessengerAdapter.cs        [CREATE]
    MessengerSender.cs         [CREATE]

src/ChatOmnicanal.Infrastructure/Jobs/
  ProcessInstagramMessageJob.cs  [CREATE]
  ProcessMessengerMessageJob.cs  [CREATE]

src/ChatOmnicanal.API/Controllers/
  InstagramWebhookController.cs  [CREATE]
  MessengerWebhookController.cs  [CREATE]

src/ChatOmnicanal.Infrastructure/Services/
  MessageProcessingService.cs    [MODIFY — channel lookup multi-canal]

src/ChatOmnicanal.Infrastructure/Conversations/
  ConversationStateRouter.cs     [MODIFY — inyectar + despachar IG/Messenger]
  ConversationService.cs         [MODIFY — inyectar + despachar IG/Messenger]

src/ChatOmnicanal.Infrastructure/
  DependencyInjection.cs         [MODIFY — registrar nuevos servicios]

tests/ChatOmnicanal.Integration.Tests/Infrastructure/
  DatabaseFixture.cs             [MODIFY — test doubles para IInstagramSender/IMessengerSender]

tests/ChatOmnicanal.Domain.Tests/Channels/
  InstagramAdapterTests.cs       [CREATE]
  MessengerAdapterTests.cs       [CREATE]

tests/ChatOmnicanal.Integration.Tests/API/
  InstagramWebhookTests.cs       [CREATE]
  MessengerWebhookTests.cs       [CREATE]
```

---

## Task 1: Application contracts — IInstagramSender e IMessengerSender

**Files:**
- Create: `src/ChatOmnicanal.Application/Channels/IInstagramSender.cs`
- Create: `src/ChatOmnicanal.Application/Channels/IMessengerSender.cs`

- [ ] **Step 1.1: Crear IInstagramSender**

`src/ChatOmnicanal.Application/Channels/IInstagramSender.cs`:
```csharp
namespace ChatOmnicanal.Application.Channels;

public interface IInstagramSender
{
    Task SendTextAsync(
        string igUserId,
        string accessToken,
        string igsid,
        string content,
        CancellationToken ct = default);
}
```

- [ ] **Step 1.2: Crear IMessengerSender**

`src/ChatOmnicanal.Application/Channels/IMessengerSender.cs`:
```csharp
namespace ChatOmnicanal.Application.Channels;

public interface IMessengerSender
{
    Task SendTextAsync(
        string pageId,
        string accessToken,
        string psid,
        string content,
        CancellationToken ct = default);
}
```

- [ ] **Step 1.3: Verificar compilación**

```bash
dotnet build src/ChatOmnicanal.Application/ChatOmnicanal.Application.csproj
```
Expected: Build succeeded.

- [ ] **Step 1.4: Commit**

```bash
git add src/ChatOmnicanal.Application/Channels/IInstagramSender.cs
git add src/ChatOmnicanal.Application/Channels/IMessengerSender.cs
git commit -m "feat(phase-6): add IInstagramSender and IMessengerSender contracts"
```

---

## Task 2: Instagram adapter (TDD)

**Files:**
- Create: `tests/ChatOmnicanal.Domain.Tests/Channels/InstagramAdapterTests.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Channels/Instagram/InstagramAdapter.cs`

### Estructura del webhook de Instagram

Meta envía un payload con `"object": "instagram"`. Mensaje entrante:
```json
{
  "object": "instagram",
  "entry": [{
    "id": "17841234567890",
    "time": 1700000000,
    "messaging": [{
      "sender": { "id": "6789012345678901" },
      "recipient": { "id": "17841234567890" },
      "timestamp": 1700000000000,
      "message": {
        "mid": "aWdXXXtest123abc",
        "text": "Hola, quiero info"
      }
    }]
  }]
}
```

Status update (read receipt):
```json
{
  "object": "instagram",
  "entry": [{
    "id": "17841234567890",
    "messaging": [{
      "sender": { "id": "6789012345678901" },
      "recipient": { "id": "17841234567890" },
      "timestamp": 1700000001000,
      "read": { "mid": "aWdXXXtest123abc" }
    }]
  }]
}
```

Nota: El `timestamp` de Instagram está en **milisegundos** (a diferencia de WhatsApp que usa segundos).

- [ ] **Step 2.1: Escribir los tests que deben FALLAR**

`tests/ChatOmnicanal.Domain.Tests/Channels/InstagramAdapterTests.cs`:
```csharp
using System.Text.Json;
using ChatOmnicanal.Domain.Enums;
using ChatOmnicanal.Infrastructure.Channels.Instagram;
using Xunit;

namespace ChatOmnicanal.Domain.Tests.Channels;

public class InstagramAdapterTests
{
    private readonly InstagramAdapter _adapter = new();

    [Fact]
    public void ChannelType_IsInstagram()
    {
        Assert.Equal(ChannelType.Instagram, _adapter.ChannelType);
    }

    [Fact]
    public void ParseInbound_WithTextMessage_ReturnsMappedMessage()
    {
        var payload = ParsePayload("""
        {
          "object": "instagram",
          "entry": [{
            "id": "17841234567890",
            "time": 1700000000,
            "messaging": [{
              "sender": { "id": "6789012345678901" },
              "recipient": { "id": "17841234567890" },
              "timestamp": 1700000000000,
              "message": {
                "mid": "aWdXXXtest123abc",
                "text": "Hola, quiero info"
              }
            }]
          }]
        }
        """);

        var result = _adapter.ParseInbound(payload);

        Assert.NotNull(result);
        Assert.Equal(ChannelType.Instagram, result.ChannelType);
        Assert.Equal("17841234567890", result.ChannelExternalId);   // igUserId = recipient.id
        Assert.Equal("aWdXXXtest123abc", result.MessageExternalId);
        Assert.Equal("6789012345678901", result.ContactExternalId); // IGSID = sender.id
        Assert.Equal("Hola, quiero info", result.Content);
        // timestamp 1700000000000 ms → DateTimeOffset.FromUnixTimeMilliseconds
        Assert.Equal(
            DateTimeOffset.FromUnixTimeMilliseconds(1700000000000).UtcDateTime,
            result.ReceivedAt);
    }

    [Fact]
    public void ParseInbound_WithReadReceipt_ReturnsNull()
    {
        // Un "read" no tiene "message" — debe ignorarse
        var payload = ParsePayload("""
        {
          "object": "instagram",
          "entry": [{
            "id": "17841234567890",
            "messaging": [{
              "sender": { "id": "6789012345678901" },
              "recipient": { "id": "17841234567890" },
              "timestamp": 1700000001000,
              "read": { "mid": "aWdXXXtest123abc" }
            }]
          }]
        }
        """);

        var result = _adapter.ParseInbound(payload);

        Assert.Null(result);
    }

    [Fact]
    public void ParseInbound_WithEmptyEntry_ReturnsNull()
    {
        var payload = ParsePayload("""{ "object": "instagram", "entry": [] }""");
        Assert.Null(_adapter.ParseInbound(payload));
    }

    [Fact]
    public void IsStatusUpdate_WithReadEvent_ReturnsTrue()
    {
        var payload = ParsePayload("""
        {
          "object": "instagram",
          "entry": [{
            "id": "17841234567890",
            "messaging": [{
              "sender": { "id": "6789012345678901" },
              "recipient": { "id": "17841234567890" },
              "timestamp": 1700000001000,
              "read": { "mid": "aWdXXXtest123abc" }
            }]
          }]
        }
        """);

        Assert.True(_adapter.IsStatusUpdate(payload));
    }

    [Fact]
    public void IsStatusUpdate_WithTextMessage_ReturnsFalse()
    {
        var payload = ParsePayload("""
        {
          "object": "instagram",
          "entry": [{
            "id": "17841234567890",
            "messaging": [{
              "sender": { "id": "6789012345678901" },
              "recipient": { "id": "17841234567890" },
              "timestamp": 1700000000000,
              "message": { "mid": "aWdXXXtest123abc", "text": "Hola" }
            }]
          }]
        }
        """);

        Assert.False(_adapter.IsStatusUpdate(payload));
    }

    [Fact]
    public void ParseStatus_WithReadEvent_ReturnsIdAndStatus()
    {
        var payload = ParsePayload("""
        {
          "object": "instagram",
          "entry": [{
            "id": "17841234567890",
            "messaging": [{
              "sender": { "id": "6789012345678901" },
              "recipient": { "id": "17841234567890" },
              "timestamp": 1700000001000,
              "read": { "mid": "aWdXXXtest123abc" }
            }]
          }]
        }
        """);

        var result = _adapter.ParseStatus(payload);

        Assert.NotNull(result);
        Assert.Equal("aWdXXXtest123abc", result.Value.ExternalId);
        Assert.Equal("read", result.Value.Status);
        Assert.Null(result.Value.Billable);
        Assert.Null(result.Value.Category);
    }

    private static JsonElement ParsePayload(string json)
        => JsonDocument.Parse(json).RootElement;
}
```

- [ ] **Step 2.2: Correr tests para verificar que FALLAN**

```bash
dotnet test tests/ChatOmnicanal.Domain.Tests --filter "FullyQualifiedName~InstagramAdapterTests"
```
Expected: FAIL — "ChatOmnicanal.Infrastructure.Channels.Instagram.InstagramAdapter not found".

- [ ] **Step 2.3: Implementar InstagramAdapter**

`src/ChatOmnicanal.Infrastructure/Channels/Instagram/InstagramAdapter.cs`:
```csharp
using System.Text.Json;
using ChatOmnicanal.Application.Channels;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Infrastructure.Channels.Instagram;

public class InstagramAdapter : IChannelAdapter
{
    public ChannelType ChannelType => ChannelType.Instagram;

    public InboundMessage? ParseInbound(JsonElement payload)
    {
        // Estructura: { "object": "instagram", "entry": [{ "id": "IG_USER_ID", "messaging": [{ ... }] }] }
        if (!payload.TryGetProperty("entry", out var entries)) return null;

        foreach (var entry in entries.EnumerateArray())
        {
            var igUserId = entry.TryGetProperty("id", out var entryId) ? entryId.GetString() : null;
            if (!entry.TryGetProperty("messaging", out var messaging)) continue;

            foreach (var msg in messaging.EnumerateArray())
            {
                // Solo procesar si tiene "message" (no read receipts, echoes, etc.)
                if (!msg.TryGetProperty("message", out var messageObj)) continue;

                // Ignorar mensajes "is_echo" (mensajes enviados por la propia página)
                if (messageObj.TryGetProperty("is_echo", out var echo) && echo.GetBoolean()) continue;

                // Ignorar mensajes sin texto (stickers, attachments, etc.)
                if (!messageObj.TryGetProperty("text", out var textProp)) continue;

                var mid = messageObj.GetProperty("mid").GetString()!;
                var igsid = msg.GetProperty("sender").GetProperty("id").GetString()!;
                var recipientId = msg.TryGetProperty("recipient", out var recipient)
                    ? recipient.GetProperty("id").GetString()
                    : igUserId;

                // Instagram timestamp en milisegundos
                var timestamp = msg.TryGetProperty("timestamp", out var ts)
                    ? DateTimeOffset.FromUnixTimeMilliseconds(ts.GetInt64()).UtcDateTime
                    : DateTime.UtcNow;

                var content = textProp.GetString() ?? "";

                // Instagram no incluye nombre del contacto en el webhook — se puede obtener por Graph API Profile
                // Por ahora lo dejamos null; puede enriquecerse más adelante.
                string? contactName = null;

                string? referralJson = null;
                if (msg.TryGetProperty("referral", out var referral))
                    referralJson = referral.GetRawText();

                return new InboundMessage(
                    ChannelType: ChannelType.Instagram,
                    ChannelExternalId: recipientId ?? igUserId ?? "",
                    MessageExternalId: mid,
                    ContactExternalId: igsid,
                    ContactName: contactName,
                    Content: content,
                    ReceivedAt: timestamp,
                    ReferralJson: referralJson);
            }
        }

        return null;
    }

    public bool IsStatusUpdate(JsonElement payload)
    {
        if (!payload.TryGetProperty("entry", out var entries)) return false;
        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("messaging", out var messaging)) continue;
            foreach (var msg in messaging.EnumerateArray())
            {
                if (msg.TryGetProperty("read", out _)) return true;
                if (msg.TryGetProperty("delivery", out _)) return true;
            }
        }
        return false;
    }

    public (string ExternalId, string Status, bool? Billable, string? Category)? ParseStatus(JsonElement payload)
    {
        if (!payload.TryGetProperty("entry", out var entries)) return null;
        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("messaging", out var messaging)) continue;
            foreach (var msg in messaging.EnumerateArray())
            {
                if (msg.TryGetProperty("read", out var readEvent) &&
                    readEvent.TryGetProperty("mid", out var mid))
                {
                    return (mid.GetString()!, "read", null, null);
                }

                if (msg.TryGetProperty("delivery", out var delivery) &&
                    delivery.TryGetProperty("mids", out var mids))
                {
                    var firstMid = mids.EnumerateArray().FirstOrDefault().GetString();
                    if (firstMid != null)
                        return (firstMid, "delivered", null, null);
                }
            }
        }
        return null;
    }
}
```

- [ ] **Step 2.4: Correr tests para verificar que PASAN**

```bash
dotnet test tests/ChatOmnicanal.Domain.Tests --filter "FullyQualifiedName~InstagramAdapterTests"
```
Expected: 6 passed, 0 failed.

- [ ] **Step 2.5: Commit**

```bash
git add tests/ChatOmnicanal.Domain.Tests/Channels/InstagramAdapterTests.cs
git add src/ChatOmnicanal.Infrastructure/Channels/Instagram/InstagramAdapter.cs
git commit -m "feat(phase-6): add InstagramAdapter with TDD"
```

---

## Task 3: Instagram sender

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Channels/Instagram/InstagramSender.cs`

La Graph API de Instagram DM:
```
POST https://graph.facebook.com/v19.0/{ig-user-id}/messages
Authorization: Bearer {access_token}
Content-Type: application/json
{ "recipient": { "id": "{igsid}" }, "message": { "text": "..." } }
```

- [ ] **Step 3.1: Crear InstagramSender**

`src/ChatOmnicanal.Infrastructure/Channels/Instagram/InstagramSender.cs`:
```csharp
using System.Net.Http.Json;
using ChatOmnicanal.Application.Channels;
using Microsoft.Extensions.Logging;

namespace ChatOmnicanal.Infrastructure.Channels.Instagram;

public class InstagramSender : IInstagramSender
{
    private readonly HttpClient _http;
    private readonly ILogger<InstagramSender> _logger;

    public InstagramSender(HttpClient http, ILogger<InstagramSender> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task SendTextAsync(
        string igUserId,
        string accessToken,
        string igsid,
        string content,
        CancellationToken ct = default)
    {
        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://graph.facebook.com/v19.0/{igUserId}/messages");

        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        request.Content = JsonContent.Create(new
        {
            recipient = new { id = igsid },
            message = new { text = content }
        });

        var response = await _http.SendAsync(request, ct);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("Instagram send failed {Status}: {Error}", response.StatusCode, error);
            response.EnsureSuccessStatusCode();
        }
    }
}
```

- [ ] **Step 3.2: Verificar compilación**

```bash
dotnet build src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```
Expected: Build succeeded.

- [ ] **Step 3.3: Commit**

```bash
git add src/ChatOmnicanal.Infrastructure/Channels/Instagram/InstagramSender.cs
git commit -m "feat(phase-6): add InstagramSender (Graph API v19.0)"
```

---

## Task 4: Messenger adapter (TDD)

**Files:**
- Create: `tests/ChatOmnicanal.Domain.Tests/Channels/MessengerAdapterTests.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Channels/Messenger/MessengerAdapter.cs`

### Estructura del webhook de Messenger

Meta envía un payload con `"object": "page"`. Mensaje entrante:
```json
{
  "object": "page",
  "entry": [{
    "id": "123456789012345",
    "time": 1700000000,
    "messaging": [{
      "sender": { "id": "1234567890" },
      "recipient": { "id": "123456789012345" },
      "timestamp": 1700000000000,
      "message": {
        "mid": "mid.1700000000000:abc123",
        "text": "Buenos dias"
      }
    }]
  }]
}
```

Status update (delivery):
```json
{
  "object": "page",
  "entry": [{
    "id": "123456789012345",
    "messaging": [{
      "sender": { "id": "1234567890" },
      "recipient": { "id": "123456789012345" },
      "timestamp": 1700000001000,
      "delivery": {
        "mids": ["mid.1700000000000:abc123"],
        "watermark": 1700000001000
      }
    }]
  }]
}
```

Nota: el `timestamp` de Messenger también está en **milisegundos**.

- [ ] **Step 4.1: Escribir los tests que deben FALLAR**

`tests/ChatOmnicanal.Domain.Tests/Channels/MessengerAdapterTests.cs`:
```csharp
using System.Text.Json;
using ChatOmnicanal.Domain.Enums;
using ChatOmnicanal.Infrastructure.Channels.Messenger;
using Xunit;

namespace ChatOmnicanal.Domain.Tests.Channels;

public class MessengerAdapterTests
{
    private readonly MessengerAdapter _adapter = new();

    [Fact]
    public void ChannelType_IsMessenger()
    {
        Assert.Equal(ChannelType.Messenger, _adapter.ChannelType);
    }

    [Fact]
    public void ParseInbound_WithTextMessage_ReturnsMappedMessage()
    {
        var payload = ParsePayload("""
        {
          "object": "page",
          "entry": [{
            "id": "123456789012345",
            "time": 1700000000,
            "messaging": [{
              "sender": { "id": "1234567890" },
              "recipient": { "id": "123456789012345" },
              "timestamp": 1700000000000,
              "message": {
                "mid": "mid.1700000000000:abc123",
                "text": "Buenos dias"
              }
            }]
          }]
        }
        """);

        var result = _adapter.ParseInbound(payload);

        Assert.NotNull(result);
        Assert.Equal(ChannelType.Messenger, result.ChannelType);
        Assert.Equal("123456789012345", result.ChannelExternalId);  // pageId = recipient.id
        Assert.Equal("mid.1700000000000:abc123", result.MessageExternalId);
        Assert.Equal("1234567890", result.ContactExternalId);        // PSID = sender.id
        Assert.Equal("Buenos dias", result.Content);
        Assert.Equal(
            DateTimeOffset.FromUnixTimeMilliseconds(1700000000000).UtcDateTime,
            result.ReceivedAt);
    }

    [Fact]
    public void ParseInbound_WithDeliveryEvent_ReturnsNull()
    {
        var payload = ParsePayload("""
        {
          "object": "page",
          "entry": [{
            "id": "123456789012345",
            "messaging": [{
              "sender": { "id": "1234567890" },
              "recipient": { "id": "123456789012345" },
              "timestamp": 1700000001000,
              "delivery": {
                "mids": ["mid.1700000000000:abc123"],
                "watermark": 1700000001000
              }
            }]
          }]
        }
        """);

        Assert.Null(_adapter.ParseInbound(payload));
    }

    [Fact]
    public void ParseInbound_WithEchoMessage_ReturnsNull()
    {
        var payload = ParsePayload("""
        {
          "object": "page",
          "entry": [{
            "id": "123456789012345",
            "messaging": [{
              "sender": { "id": "123456789012345" },
              "recipient": { "id": "1234567890" },
              "timestamp": 1700000000000,
              "message": {
                "mid": "mid.1700000000000:echo",
                "text": "Mensaje enviado por la página",
                "is_echo": true
              }
            }]
          }]
        }
        """);

        Assert.Null(_adapter.ParseInbound(payload));
    }

    [Fact]
    public void ParseInbound_WithEmptyEntry_ReturnsNull()
    {
        var payload = ParsePayload("""{ "object": "page", "entry": [] }""");
        Assert.Null(_adapter.ParseInbound(payload));
    }

    [Fact]
    public void IsStatusUpdate_WithDeliveryEvent_ReturnsTrue()
    {
        var payload = ParsePayload("""
        {
          "object": "page",
          "entry": [{
            "id": "123456789012345",
            "messaging": [{
              "sender": { "id": "1234567890" },
              "recipient": { "id": "123456789012345" },
              "timestamp": 1700000001000,
              "delivery": {
                "mids": ["mid.1700000000000:abc123"],
                "watermark": 1700000001000
              }
            }]
          }]
        }
        """);

        Assert.True(_adapter.IsStatusUpdate(payload));
    }

    [Fact]
    public void IsStatusUpdate_WithTextMessage_ReturnsFalse()
    {
        var payload = ParsePayload("""
        {
          "object": "page",
          "entry": [{
            "id": "123456789012345",
            "messaging": [{
              "sender": { "id": "1234567890" },
              "recipient": { "id": "123456789012345" },
              "timestamp": 1700000000000,
              "message": { "mid": "mid.abc", "text": "Hola" }
            }]
          }]
        }
        """);

        Assert.False(_adapter.IsStatusUpdate(payload));
    }

    [Fact]
    public void ParseStatus_WithDeliveryEvent_ReturnsFirstMidAndStatus()
    {
        var payload = ParsePayload("""
        {
          "object": "page",
          "entry": [{
            "id": "123456789012345",
            "messaging": [{
              "sender": { "id": "1234567890" },
              "recipient": { "id": "123456789012345" },
              "timestamp": 1700000001000,
              "delivery": {
                "mids": ["mid.1700000000000:abc123"],
                "watermark": 1700000001000
              }
            }]
          }]
        }
        """);

        var result = _adapter.ParseStatus(payload);

        Assert.NotNull(result);
        Assert.Equal("mid.1700000000000:abc123", result.Value.ExternalId);
        Assert.Equal("delivered", result.Value.Status);
        Assert.Null(result.Value.Billable);
        Assert.Null(result.Value.Category);
    }

    private static JsonElement ParsePayload(string json)
        => JsonDocument.Parse(json).RootElement;
}
```

- [ ] **Step 4.2: Correr tests para verificar que FALLAN**

```bash
dotnet test tests/ChatOmnicanal.Domain.Tests --filter "FullyQualifiedName~MessengerAdapterTests"
```
Expected: FAIL — "ChatOmnicanal.Infrastructure.Channels.Messenger.MessengerAdapter not found".

- [ ] **Step 4.3: Implementar MessengerAdapter**

`src/ChatOmnicanal.Infrastructure/Channels/Messenger/MessengerAdapter.cs`:
```csharp
using System.Text.Json;
using ChatOmnicanal.Application.Channels;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Infrastructure.Channels.Messenger;

public class MessengerAdapter : IChannelAdapter
{
    public ChannelType ChannelType => ChannelType.Messenger;

    public InboundMessage? ParseInbound(JsonElement payload)
    {
        // Estructura: { "object": "page", "entry": [{ "id": "PAGE_ID", "messaging": [{ ... }] }] }
        if (!payload.TryGetProperty("entry", out var entries)) return null;

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("messaging", out var messaging)) continue;

            foreach (var msg in messaging.EnumerateArray())
            {
                // Solo procesar si tiene "message" (no delivery, read, etc.)
                if (!msg.TryGetProperty("message", out var messageObj)) continue;

                // Ignorar mensajes "is_echo" (mensajes enviados por la propia página)
                if (messageObj.TryGetProperty("is_echo", out var echo) && echo.GetBoolean()) continue;

                // Ignorar mensajes sin texto (stickers, attachments, etc.)
                if (!messageObj.TryGetProperty("text", out var textProp)) continue;

                var mid = messageObj.GetProperty("mid").GetString()!;
                var psid = msg.GetProperty("sender").GetProperty("id").GetString()!;
                var pageId = msg.GetProperty("recipient").GetProperty("id").GetString()!;

                // Messenger timestamp en milisegundos
                var timestamp = msg.TryGetProperty("timestamp", out var ts)
                    ? DateTimeOffset.FromUnixTimeMilliseconds(ts.GetInt64()).UtcDateTime
                    : DateTime.UtcNow;

                var content = textProp.GetString() ?? "";

                string? referralJson = null;
                if (msg.TryGetProperty("referral", out var referral))
                    referralJson = referral.GetRawText();

                return new InboundMessage(
                    ChannelType: ChannelType.Messenger,
                    ChannelExternalId: pageId,
                    MessageExternalId: mid,
                    ContactExternalId: psid,
                    ContactName: null,
                    Content: content,
                    ReceivedAt: timestamp,
                    ReferralJson: referralJson);
            }
        }

        return null;
    }

    public bool IsStatusUpdate(JsonElement payload)
    {
        if (!payload.TryGetProperty("entry", out var entries)) return false;
        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("messaging", out var messaging)) continue;
            foreach (var msg in messaging.EnumerateArray())
            {
                if (msg.TryGetProperty("delivery", out _)) return true;
                if (msg.TryGetProperty("read", out _)) return true;
            }
        }
        return false;
    }

    public (string ExternalId, string Status, bool? Billable, string? Category)? ParseStatus(JsonElement payload)
    {
        if (!payload.TryGetProperty("entry", out var entries)) return null;
        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("messaging", out var messaging)) continue;
            foreach (var msg in messaging.EnumerateArray())
            {
                if (msg.TryGetProperty("delivery", out var delivery) &&
                    delivery.TryGetProperty("mids", out var mids))
                {
                    var firstMid = mids.EnumerateArray().FirstOrDefault().GetString();
                    if (firstMid != null)
                        return (firstMid, "delivered", null, null);
                }

                if (msg.TryGetProperty("read", out var readEvent) &&
                    readEvent.TryGetProperty("watermark", out var watermark))
                {
                    // Messenger "read" usa watermark, no mid — usamos watermark como ID aproximado
                    return ($"read_{watermark.GetInt64()}", "read", null, null);
                }
            }
        }
        return null;
    }
}
```

- [ ] **Step 4.4: Correr tests para verificar que PASAN**

```bash
dotnet test tests/ChatOmnicanal.Domain.Tests --filter "FullyQualifiedName~MessengerAdapterTests"
```
Expected: 7 passed, 0 failed.

- [ ] **Step 4.5: Commit**

```bash
git add tests/ChatOmnicanal.Domain.Tests/Channels/MessengerAdapterTests.cs
git add src/ChatOmnicanal.Infrastructure/Channels/Messenger/MessengerAdapter.cs
git commit -m "feat(phase-6): add MessengerAdapter with TDD"
```

---

## Task 5: Messenger sender

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Channels/Messenger/MessengerSender.cs`

La Graph API de Messenger:
```
POST https://graph.facebook.com/v19.0/{page-id}/messages
Authorization: Bearer {access_token}
Content-Type: application/json
{ "recipient": { "id": "{psid}" }, "message": { "text": "..." } }
```

- [ ] **Step 5.1: Crear MessengerSender**

`src/ChatOmnicanal.Infrastructure/Channels/Messenger/MessengerSender.cs`:
```csharp
using System.Net.Http.Json;
using ChatOmnicanal.Application.Channels;
using Microsoft.Extensions.Logging;

namespace ChatOmnicanal.Infrastructure.Channels.Messenger;

public class MessengerSender : IMessengerSender
{
    private readonly HttpClient _http;
    private readonly ILogger<MessengerSender> _logger;

    public MessengerSender(HttpClient http, ILogger<MessengerSender> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task SendTextAsync(
        string pageId,
        string accessToken,
        string psid,
        string content,
        CancellationToken ct = default)
    {
        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://graph.facebook.com/v19.0/{pageId}/messages");

        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        request.Content = JsonContent.Create(new
        {
            recipient = new { id = psid },
            message = new { text = content }
        });

        var response = await _http.SendAsync(request, ct);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("Messenger send failed {Status}: {Error}", response.StatusCode, error);
            response.EnsureSuccessStatusCode();
        }
    }
}
```

- [ ] **Step 5.2: Verificar compilación**

```bash
dotnet build src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```
Expected: Build succeeded.

- [ ] **Step 5.3: Commit**

```bash
git add src/ChatOmnicanal.Infrastructure/Channels/Messenger/MessengerSender.cs
git commit -m "feat(phase-6): add MessengerSender (Graph API v19.0)"
```

---

## Task 6: Hangfire jobs

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Jobs/ProcessInstagramMessageJob.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Jobs/ProcessMessengerMessageJob.cs`

Estos jobs replican exactamente `ProcessWhatsAppMessageJob`. La única diferencia es el adapter inyectado.

- [ ] **Step 6.1: Crear ProcessInstagramMessageJob**

`src/ChatOmnicanal.Infrastructure/Jobs/ProcessInstagramMessageJob.cs`:
```csharp
using System.Text.Json;
using ChatOmnicanal.Application.Channels;
using ChatOmnicanal.Infrastructure.Channels.Instagram;
using Microsoft.Extensions.Logging;

namespace ChatOmnicanal.Infrastructure.Jobs;

public class ProcessInstagramMessageJob
{
    private readonly IMessageProcessingService _processingService;
    private readonly InstagramAdapter _adapter;
    private readonly ILogger<ProcessInstagramMessageJob> _logger;

    public ProcessInstagramMessageJob(
        IMessageProcessingService processingService,
        InstagramAdapter adapter,
        ILogger<ProcessInstagramMessageJob> logger)
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
            _logger.LogDebug("Instagram webhook payload has no processable message, ignoring.");
            return;
        }

        await _processingService.ProcessAsync(inbound);
    }
}
```

- [ ] **Step 6.2: Crear ProcessMessengerMessageJob**

`src/ChatOmnicanal.Infrastructure/Jobs/ProcessMessengerMessageJob.cs`:
```csharp
using System.Text.Json;
using ChatOmnicanal.Application.Channels;
using ChatOmnicanal.Infrastructure.Channels.Messenger;
using Microsoft.Extensions.Logging;

namespace ChatOmnicanal.Infrastructure.Jobs;

public class ProcessMessengerMessageJob
{
    private readonly IMessageProcessingService _processingService;
    private readonly MessengerAdapter _adapter;
    private readonly ILogger<ProcessMessengerMessageJob> _logger;

    public ProcessMessengerMessageJob(
        IMessageProcessingService processingService,
        MessengerAdapter adapter,
        ILogger<ProcessMessengerMessageJob> logger)
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
            _logger.LogDebug("Messenger webhook payload has no processable message, ignoring.");
            return;
        }

        await _processingService.ProcessAsync(inbound);
    }
}
```

- [ ] **Step 6.3: Verificar compilación**

```bash
dotnet build src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```
Expected: Build succeeded.

- [ ] **Step 6.4: Commit**

```bash
git add src/ChatOmnicanal.Infrastructure/Jobs/ProcessInstagramMessageJob.cs
git add src/ChatOmnicanal.Infrastructure/Jobs/ProcessMessengerMessageJob.cs
git commit -m "feat(phase-6): add ProcessInstagramMessageJob and ProcessMessengerMessageJob"
```

---

## Task 7: Webhook controllers

**Files:**
- Create: `src/ChatOmnicanal.API/Controllers/InstagramWebhookController.cs`
- Create: `src/ChatOmnicanal.API/Controllers/MessengerWebhookController.cs`

Replican exactamente `WhatsAppWebhookController`. Claves de configuración necesarias:
- `Instagram:AppSecret`, `Instagram:VerifyToken`
- `Messenger:AppSecret`, `Messenger:VerifyToken`

El `WhatsAppSignatureValidator` se reutiliza tal cual (misma validación HMAC-SHA256 que usa Meta para todos sus canales).

- [ ] **Step 7.1: Crear InstagramWebhookController**

`src/ChatOmnicanal.API/Controllers/InstagramWebhookController.cs`:
```csharp
using ChatOmnicanal.Infrastructure.Channels.WhatsApp;
using ChatOmnicanal.Infrastructure.Jobs;
using Hangfire;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/webhooks/instagram")]
public class InstagramWebhookController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<InstagramWebhookController> _logger;

    public InstagramWebhookController(IConfiguration config, ILogger<InstagramWebhookController> logger)
    {
        _config = config;
        _logger = logger;
    }

    [HttpGet]
    public IActionResult Verify(
        [FromQuery(Name = "hub.mode")] string mode,
        [FromQuery(Name = "hub.challenge")] string challenge,
        [FromQuery(Name = "hub.verify_token")] string verifyToken)
    {
        var expectedToken = _config["Instagram:VerifyToken"]
            ?? throw new InvalidOperationException("Instagram:VerifyToken not configured.");

        if (mode == "subscribe" && verifyToken == expectedToken)
        {
            _logger.LogInformation("Instagram webhook verified successfully.");
            return Ok(int.Parse(challenge));
        }

        _logger.LogWarning("Instagram webhook verification failed. Mode={Mode}, Token mismatch.", mode);
        return StatusCode(403);
    }

    [HttpPost]
    public async Task<IActionResult> Receive()
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        var appSecret = _config["Instagram:AppSecret"]
            ?? throw new InvalidOperationException("Instagram:AppSecret not configured.");

        var signature = Request.Headers["X-Hub-Signature-256"].ToString();
        if (!WhatsAppSignatureValidator.Validate(appSecret, body, signature))
        {
            _logger.LogWarning("Instagram webhook signature validation failed.");
            return Unauthorized();
        }

        BackgroundJob.Enqueue<ProcessInstagramMessageJob>(j => j.ExecuteAsync(body));

        return Ok();
    }
}
```

- [ ] **Step 7.2: Crear MessengerWebhookController**

`src/ChatOmnicanal.API/Controllers/MessengerWebhookController.cs`:
```csharp
using ChatOmnicanal.Infrastructure.Channels.WhatsApp;
using ChatOmnicanal.Infrastructure.Jobs;
using Hangfire;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/webhooks/messenger")]
public class MessengerWebhookController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<MessengerWebhookController> _logger;

    public MessengerWebhookController(IConfiguration config, ILogger<MessengerWebhookController> logger)
    {
        _config = config;
        _logger = logger;
    }

    [HttpGet]
    public IActionResult Verify(
        [FromQuery(Name = "hub.mode")] string mode,
        [FromQuery(Name = "hub.challenge")] string challenge,
        [FromQuery(Name = "hub.verify_token")] string verifyToken)
    {
        var expectedToken = _config["Messenger:VerifyToken"]
            ?? throw new InvalidOperationException("Messenger:VerifyToken not configured.");

        if (mode == "subscribe" && verifyToken == expectedToken)
        {
            _logger.LogInformation("Messenger webhook verified successfully.");
            return Ok(int.Parse(challenge));
        }

        _logger.LogWarning("Messenger webhook verification failed. Mode={Mode}, Token mismatch.", mode);
        return StatusCode(403);
    }

    [HttpPost]
    public async Task<IActionResult> Receive()
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        var appSecret = _config["Messenger:AppSecret"]
            ?? throw new InvalidOperationException("Messenger:AppSecret not configured.");

        var signature = Request.Headers["X-Hub-Signature-256"].ToString();
        if (!WhatsAppSignatureValidator.Validate(appSecret, body, signature))
        {
            _logger.LogWarning("Messenger webhook signature validation failed.");
            return Unauthorized();
        }

        BackgroundJob.Enqueue<ProcessMessengerMessageJob>(j => j.ExecuteAsync(body));

        return Ok();
    }
}
```

- [ ] **Step 7.3: Verificar compilación**

```bash
dotnet build src/ChatOmnicanal.API/ChatOmnicanal.API.csproj
```
Expected: Build succeeded.

- [ ] **Step 7.4: Commit**

```bash
git add src/ChatOmnicanal.API/Controllers/InstagramWebhookController.cs
git add src/ChatOmnicanal.API/Controllers/MessengerWebhookController.cs
git commit -m "feat(phase-6): add InstagramWebhookController and MessengerWebhookController"
```

---

## Task 8: Actualizar MessageProcessingService — lookup multi-canal

**Files:**
- Modify: `src/ChatOmnicanal.Infrastructure/Services/MessageProcessingService.cs`

El problema actual: el lookup de Channel en `ProcessAsync` filtra solo por `PhoneNumberId`, que es específico de WhatsApp. Para Instagram se debe buscar por `IgUserId` y para Messenger por `PageId`.

- [ ] **Step 8.1: Reemplazar el bloque de lookup de Channel**

Localizar este bloque en `MessageProcessingService.cs` (alrededor de las líneas 38-49):
```csharp
// 2. Resolver Channel por PhoneNumberId (o equivalente)
var channel = await _db.Channels
    .FirstOrDefaultAsync(c =>
        c.Type == inbound.ChannelType &&
        c.PhoneNumberId == inbound.ChannelExternalId &&
        c.Status == ChannelStatus.Active, ct);
```

Reemplazarlo con:
```csharp
// 2. Resolver Channel según el tipo de canal
var channel = await _db.Channels
    .FirstOrDefaultAsync(c =>
        c.Type == inbound.ChannelType &&
        c.Status == ChannelStatus.Active &&
        (
            (inbound.ChannelType == ChannelType.WhatsApp  && c.PhoneNumberId == inbound.ChannelExternalId) ||
            (inbound.ChannelType == ChannelType.Instagram && c.IgUserId      == inbound.ChannelExternalId) ||
            (inbound.ChannelType == ChannelType.Messenger && c.PageId        == inbound.ChannelExternalId)
        ), ct);
```

- [ ] **Step 8.2: Verificar compilación**

```bash
dotnet build src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```
Expected: Build succeeded.

- [ ] **Step 8.3: Commit**

```bash
git add src/ChatOmnicanal.Infrastructure/Services/MessageProcessingService.cs
git commit -m "feat(phase-6): extend MessageProcessingService channel lookup for Instagram and Messenger"
```

---

## Task 9: Actualizar ConversationStateRouter y ConversationService — envío multi-canal

**Files:**
- Modify: `src/ChatOmnicanal.Infrastructure/Conversations/ConversationStateRouter.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/Conversations/ConversationService.cs`

Ambas clases actualmente solo saben enviar por WhatsApp. Se agregan `IInstagramSender` e `IMessengerSender` como nuevas dependencias y se extiende el bloque de envío con un `switch` sobre `channel.Type`.

**NOTA sobre conflictos con Phase 5:** Si Phase 5 también modificó `ConversationStateRouter.cs` o `ConversationService.cs`, al hacer merge habrá conflictos. La resolución es: conservar todos los cambios de Phase 5 y agregar encima los nuevos campos `_instagramSender` y `_messengerSender` + el switch de envío extendido.

### ConversationStateRouter

- [ ] **Step 9.1: Agregar IInstagramSender e IMessengerSender al constructor de ConversationStateRouter**

En `ConversationStateRouter.cs`:

1. Agregar los using necesarios al inicio del archivo (si no están ya):
```csharp
using ChatOmnicanal.Application.Channels;
```

2. Agregar los dos nuevos campos privados junto a `_whatsAppSender`:
```csharp
private readonly IInstagramSender _instagramSender;
private readonly IMessengerSender _messengerSender;
```

3. Extender el constructor para incluir los nuevos parámetros (agregar después del parámetro `IWhatsAppSender whatsAppSender`):
```csharp
IInstagramSender instagramSender,
IMessengerSender messengerSender,
```

4. Asignar en el cuerpo del constructor:
```csharp
_instagramSender = instagramSender;
_messengerSender = messengerSender;
```

5. En `SaveAndSendBotReplyAsync`, reemplazar el bloque de envío que actualmente es:
```csharp
// Enviar por el canal (WhatsApp por ahora)
if (channel?.Type == ChannelType.WhatsApp && !string.IsNullOrWhiteSpace(channel.PhoneNumberId) && contact != null)
{
    try
    {
        await _whatsAppSender.SendTextAsync(
            channel.PhoneNumberId,
            channel.EncryptedAccessToken ?? "",
            contact.ExternalId,
            replyText,
            ct);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error sending WhatsApp bot reply to {WaId}", contact.ExternalId);
    }
}
```

Con:
```csharp
if (channel != null && contact != null)
{
    try
    {
        switch (channel.Type)
        {
            case ChannelType.WhatsApp when !string.IsNullOrWhiteSpace(channel.PhoneNumberId):
                await _whatsAppSender.SendTextAsync(
                    channel.PhoneNumberId!, channel.EncryptedAccessToken ?? "",
                    contact.ExternalId, replyText, ct);
                break;

            case ChannelType.Instagram when !string.IsNullOrWhiteSpace(channel.IgUserId):
                await _instagramSender.SendTextAsync(
                    channel.IgUserId!, channel.EncryptedAccessToken ?? "",
                    contact.ExternalId, replyText, ct);
                break;

            case ChannelType.Messenger when !string.IsNullOrWhiteSpace(channel.PageId):
                await _messengerSender.SendTextAsync(
                    channel.PageId!, channel.EncryptedAccessToken ?? "",
                    contact.ExternalId, replyText, ct);
                break;

            default:
                _logger.LogWarning("No sender configured for channel type {Type}", channel.Type);
                break;
        }
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error sending bot reply via {ChannelType} to {ContactId}",
            channel.Type, contact.ExternalId);
    }
}
```

### ConversationService

- [ ] **Step 9.2: Agregar IInstagramSender e IMessengerSender a ConversationService**

En `ConversationService.cs`:

1. Agregar los dos nuevos campos privados:
```csharp
private readonly IInstagramSender _instagramSender;
private readonly IMessengerSender _messengerSender;
```

2. Extender el constructor (agregar después del parámetro `IWhatsAppSender whatsAppSender`):
```csharp
IInstagramSender instagramSender,
IMessengerSender messengerSender,
```

3. Asignar en el cuerpo del constructor:
```csharp
_instagramSender = instagramSender;
_messengerSender = messengerSender;
```

4. En `SendAgentMessageAsync`, reemplazar el bloque de envío que actualmente es:
```csharp
if (conversation.Channel.Type == ChannelType.WhatsApp && !string.IsNullOrWhiteSpace(conversation.Channel.PhoneNumberId))
{
    await _whatsAppSender.SendTextAsync(
        conversation.Channel.PhoneNumberId,
        conversation.Channel.EncryptedAccessToken ?? "",
        conversation.Contact.ExternalId,
        content,
        ct);
}
```

Con:
```csharp
switch (conversation.Channel.Type)
{
    case ChannelType.WhatsApp when !string.IsNullOrWhiteSpace(conversation.Channel.PhoneNumberId):
        await _whatsAppSender.SendTextAsync(
            conversation.Channel.PhoneNumberId!, conversation.Channel.EncryptedAccessToken ?? "",
            conversation.Contact.ExternalId, content, ct);
        break;

    case ChannelType.Instagram when !string.IsNullOrWhiteSpace(conversation.Channel.IgUserId):
        await _instagramSender.SendTextAsync(
            conversation.Channel.IgUserId!, conversation.Channel.EncryptedAccessToken ?? "",
            conversation.Contact.ExternalId, content, ct);
        break;

    case ChannelType.Messenger when !string.IsNullOrWhiteSpace(conversation.Channel.PageId):
        await _messengerSender.SendTextAsync(
            conversation.Channel.PageId!, conversation.Channel.EncryptedAccessToken ?? "",
            conversation.Contact.ExternalId, content, ct);
        break;
}
```

- [ ] **Step 9.3: Verificar compilación**

```bash
dotnet build ChatOmnicanal.sln
```
Expected: Build succeeded. Si hay errores de "no constructor argument", significa que el DI no está registrado todavía — es normal en este paso; continuará en Task 10.

- [ ] **Step 9.4: Commit**

```bash
git add src/ChatOmnicanal.Infrastructure/Conversations/ConversationStateRouter.cs
git add src/ChatOmnicanal.Infrastructure/Conversations/ConversationService.cs
git commit -m "feat(phase-6): extend ConversationStateRouter and ConversationService for Instagram and Messenger sending"
```

---

## Task 10: DI Registration + DatabaseFixture test doubles

**Files:**
- Modify: `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`
- Modify: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/DatabaseFixture.cs`

### DependencyInjection.cs

- [ ] **Step 10.1: Agregar nuevos using al inicio del archivo**

Al bloque de usings de `DependencyInjection.cs`, agregar:
```csharp
using ChatOmnicanal.Infrastructure.Channels.Instagram;
using ChatOmnicanal.Infrastructure.Channels.Messenger;
```

- [ ] **Step 10.2: Registrar los nuevos servicios de Phase 6**

Agregar después del bloque de Phase 2 (después de `services.AddHangfireServer();`):
```csharp
// Phase 6 — Instagram channel
services.AddScoped<InstagramAdapter>();
services.AddScoped<IChannelAdapter, InstagramAdapter>();
services.AddHttpClient<IInstagramSender, InstagramSender>();
services.AddScoped<ProcessInstagramMessageJob>();

// Phase 6 — Messenger channel
services.AddScoped<MessengerAdapter>();
services.AddScoped<IChannelAdapter, MessengerAdapter>();
services.AddHttpClient<IMessengerSender, MessengerSender>();
services.AddScoped<ProcessMessengerMessageJob>();
```

También agregar los usings de las interfaces al top del archivo:
```csharp
using ChatOmnicanal.Application.Channels;
```
(ya debería estar; verificar que incluya `IInstagramSender` y `IMessengerSender` que están en el mismo namespace)

### DatabaseFixture.cs

- [ ] **Step 10.3: Agregar test doubles para IInstagramSender e IMessengerSender**

En `DatabaseFixture.cs`, dentro del bloque `builder.ConfigureServices(services => { ... })`, agregar después del bloque de `TestWhatsAppSender`:

```csharp
var igSenderDesc = services.SingleOrDefault(d => d.ServiceType == typeof(ChatOmnicanal.Application.Channels.IInstagramSender));
if (igSenderDesc != null) services.Remove(igSenderDesc);
services.AddSingleton<ChatOmnicanal.Application.Channels.IInstagramSender>(new TestInstagramSender());

var msgSenderDesc = services.SingleOrDefault(d => d.ServiceType == typeof(ChatOmnicanal.Application.Channels.IMessengerSender));
if (msgSenderDesc != null) services.Remove(msgSenderDesc);
services.AddSingleton<ChatOmnicanal.Application.Channels.IMessengerSender>(new TestMessengerSender());
```

Al final del archivo (junto con `TestWhatsAppSender`, `TestEmbeddingService`, etc.), agregar:

```csharp
public class TestInstagramSender : ChatOmnicanal.Application.Channels.IInstagramSender
{
    public Task SendTextAsync(
        string igUserId,
        string accessToken,
        string igsid,
        string content,
        CancellationToken ct = default)
        => Task.CompletedTask;
}

public class TestMessengerSender : ChatOmnicanal.Application.Channels.IMessengerSender
{
    public Task SendTextAsync(
        string pageId,
        string accessToken,
        string psid,
        string content,
        CancellationToken ct = default)
        => Task.CompletedTask;
}
```

- [ ] **Step 10.4: Verificar build completo**

```bash
dotnet build ChatOmnicanal.sln
```
Expected: Build succeeded, 0 errors.

- [ ] **Step 10.5: Correr tests existentes para verificar que no se rompe nada**

```bash
dotnet test ChatOmnicanal.sln
```
Expected: Todos los tests anteriores siguen pasando.

- [ ] **Step 10.6: Commit**

```bash
git add src/ChatOmnicanal.Infrastructure/DependencyInjection.cs
git add tests/ChatOmnicanal.Integration.Tests/Infrastructure/DatabaseFixture.cs
git commit -m "feat(phase-6): register Instagram and Messenger services in DI, add test doubles"
```

---

## Task 11: Tests de integración — Instagram y Messenger webhooks

**Files:**
- Create: `tests/ChatOmnicanal.Integration.Tests/API/InstagramWebhookTests.cs`
- Create: `tests/ChatOmnicanal.Integration.Tests/API/MessengerWebhookTests.cs`

Replican el patrón de `WhatsAppWebhookTests.cs` ajustando payloads, config keys y jobs.

- [ ] **Step 11.1: Crear InstagramWebhookTests**

`tests/ChatOmnicanal.Integration.Tests/API/InstagramWebhookTests.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;
using ChatOmnicanal.Infrastructure.Channels.WhatsApp;
using ChatOmnicanal.Infrastructure.Jobs;
using ChatOmnicanal.Infrastructure.Persistence;
using ChatOmnicanal.Integration.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Text;

namespace ChatOmnicanal.Integration.Tests.API;

public class InstagramWebhookTests : IClassFixture<DatabaseFixture>
{
    private const string AppSecret = "test_ig_secret";
    private const string VerifyToken = "test_ig_verify_token";
    private readonly DatabaseFixture _fixture;
    private readonly HttpClient _client;

    public InstagramWebhookTests(DatabaseFixture fixture)
    {
        _fixture = fixture;

        var factory = fixture.Factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Instagram:AppSecret", AppSecret);
            builder.UseSetting("Instagram:VerifyToken", VerifyToken);
        });
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Verify_WithCorrectToken_ReturnsChallenge()
    {
        var response = await _client.GetAsync(
            $"/api/webhooks/instagram?hub.mode=subscribe&hub.challenge=99999&hub.verify_token={VerifyToken}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal("99999", body);
    }

    [Fact]
    public async Task Verify_WithWrongToken_ReturnsForbid()
    {
        var response = await _client.GetAsync(
            "/api/webhooks/instagram?hub.mode=subscribe&hub.challenge=99999&hub.verify_token=wrong_token");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Receive_WithInvalidSignature_Returns401()
    {
        var igUserId = $"ig_{Guid.NewGuid():N}";
        var payload = BuildInstagramPayload(igUserId, "6789012345678901", "mid_test_1", "Hola desde IG");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/instagram")
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
        var (_, tenant) = await _fixture.SeedUserWithTenantAsync();
        var igUserId = $"ig_{Guid.NewGuid():N}";
        await SeedInstagramChannelAsync(tenant.Id, igUserId);

        var igsid = "6789012345678901";
        var mid = $"mid_{Guid.NewGuid():N}";
        var payload = BuildInstagramPayload(igUserId, igsid, mid, "Quiero info del producto");

        var signature = WhatsAppSignatureValidator.ComputeSignature(AppSecret, payload);

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/instagram")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-Hub-Signature-256", $"sha256={signature}");

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Procesar el job directamente (Hangfire in-memory en tests)
        using var scope = _fixture.Factory.Services.CreateScope();
        var job = scope.ServiceProvider.GetRequiredService<ProcessInstagramMessageJob>();
        await job.ExecuteAsync(payload);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var message = db.Messages.FirstOrDefault(m => m.ExternalId == mid);
        Assert.NotNull(message);
        Assert.Equal("Quiero info del producto", message.Content);
    }

    [Fact]
    public async Task Receive_DuplicateMessage_IsIdempotent()
    {
        var (_, tenant) = await _fixture.SeedUserWithTenantAsync();
        var igUserId = $"ig_{Guid.NewGuid():N}";
        await SeedInstagramChannelAsync(tenant.Id, igUserId);

        var mid = $"mid_{Guid.NewGuid():N}";
        var payload = BuildInstagramPayload(igUserId, "6789000000000001", mid, "Mensaje duplicado IG");

        using var scope = _fixture.Factory.Services.CreateScope();
        var job = scope.ServiceProvider.GetRequiredService<ProcessInstagramMessageJob>();

        await job.ExecuteAsync(payload);
        await job.ExecuteAsync(payload);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var count = db.Messages.Count(m => m.ExternalId == mid);
        Assert.Equal(1, count);
    }

    private async Task SeedInstagramChannelAsync(Guid tenantId, string igUserId)
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Channels.Add(new Channel
        {
            TenantId = tenantId,
            Type = ChannelType.Instagram,
            Status = ChannelStatus.Active,
            IgUserId = igUserId,
            EncryptedAccessToken = "test_ig_token"
        });
        await db.SaveChangesAsync();
    }

    private static string BuildInstagramPayload(
        string igUserId, string igsid, string mid, string text)
    {
        return $$"""
        {
          "object": "instagram",
          "entry": [{
            "id": "{{igUserId}}",
            "time": 1700000000,
            "messaging": [{
              "sender": { "id": "{{igsid}}" },
              "recipient": { "id": "{{igUserId}}" },
              "timestamp": 1700000000000,
              "message": {
                "mid": "{{mid}}",
                "text": "{{text}}"
              }
            }]
          }]
        }
        """;
    }
}
```

- [ ] **Step 11.2: Crear MessengerWebhookTests**

`tests/ChatOmnicanal.Integration.Tests/API/MessengerWebhookTests.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;
using ChatOmnicanal.Infrastructure.Channels.WhatsApp;
using ChatOmnicanal.Infrastructure.Jobs;
using ChatOmnicanal.Infrastructure.Persistence;
using ChatOmnicanal.Integration.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Text;

namespace ChatOmnicanal.Integration.Tests.API;

public class MessengerWebhookTests : IClassFixture<DatabaseFixture>
{
    private const string AppSecret = "test_msng_secret";
    private const string VerifyToken = "test_msng_verify_token";
    private readonly DatabaseFixture _fixture;
    private readonly HttpClient _client;

    public MessengerWebhookTests(DatabaseFixture fixture)
    {
        _fixture = fixture;

        var factory = fixture.Factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Messenger:AppSecret", AppSecret);
            builder.UseSetting("Messenger:VerifyToken", VerifyToken);
        });
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Verify_WithCorrectToken_ReturnsChallenge()
    {
        var response = await _client.GetAsync(
            $"/api/webhooks/messenger?hub.mode=subscribe&hub.challenge=77777&hub.verify_token={VerifyToken}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal("77777", body);
    }

    [Fact]
    public async Task Verify_WithWrongToken_ReturnsForbid()
    {
        var response = await _client.GetAsync(
            "/api/webhooks/messenger?hub.mode=subscribe&hub.challenge=77777&hub.verify_token=wrong_token");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Receive_WithInvalidSignature_Returns401()
    {
        var pageId = $"page_{Guid.NewGuid():N}";
        var payload = BuildMessengerPayload(pageId, "1234567890", "mid.test.1", "Hola desde Messenger");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/messenger")
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
        var (_, tenant) = await _fixture.SeedUserWithTenantAsync();
        var pageId = $"page_{Guid.NewGuid():N}";
        await SeedMessengerChannelAsync(tenant.Id, pageId);

        var psid = "1234567890";
        var mid = $"mid.{Guid.NewGuid():N}";
        var payload = BuildMessengerPayload(pageId, psid, mid, "Hola, necesito ayuda");

        var signature = WhatsAppSignatureValidator.ComputeSignature(AppSecret, payload);

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/messenger")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-Hub-Signature-256", $"sha256={signature}");

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _fixture.Factory.Services.CreateScope();
        var job = scope.ServiceProvider.GetRequiredService<ProcessMessengerMessageJob>();
        await job.ExecuteAsync(payload);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var message = db.Messages.FirstOrDefault(m => m.ExternalId == mid);
        Assert.NotNull(message);
        Assert.Equal("Hola, necesito ayuda", message.Content);
    }

    [Fact]
    public async Task Receive_DuplicateMessage_IsIdempotent()
    {
        var (_, tenant) = await _fixture.SeedUserWithTenantAsync();
        var pageId = $"page_{Guid.NewGuid():N}";
        await SeedMessengerChannelAsync(tenant.Id, pageId);

        var mid = $"mid.{Guid.NewGuid():N}";
        var payload = BuildMessengerPayload(pageId, "9999999999", mid, "Duplicado Messenger");

        using var scope = _fixture.Factory.Services.CreateScope();
        var job = scope.ServiceProvider.GetRequiredService<ProcessMessengerMessageJob>();

        await job.ExecuteAsync(payload);
        await job.ExecuteAsync(payload);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var count = db.Messages.Count(m => m.ExternalId == mid);
        Assert.Equal(1, count);
    }

    private async Task SeedMessengerChannelAsync(Guid tenantId, string pageId)
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Channels.Add(new Channel
        {
            TenantId = tenantId,
            Type = ChannelType.Messenger,
            Status = ChannelStatus.Active,
            PageId = pageId,
            EncryptedAccessToken = "test_page_token"
        });
        await db.SaveChangesAsync();
    }

    private static string BuildMessengerPayload(
        string pageId, string psid, string mid, string text)
    {
        return $$"""
        {
          "object": "page",
          "entry": [{
            "id": "{{pageId}}",
            "time": 1700000000,
            "messaging": [{
              "sender": { "id": "{{psid}}" },
              "recipient": { "id": "{{pageId}}" },
              "timestamp": 1700000000000,
              "message": {
                "mid": "{{mid}}",
                "text": "{{text}}"
              }
            }]
          }]
        }
        """;
    }
}
```

- [ ] **Step 11.3: Correr suite completa**

```bash
dotnet test ChatOmnicanal.sln
```
Expected: Todos los tests pasan. Los nuevos son:
- `InstagramAdapterTests` (6 tests) ✓
- `MessengerAdapterTests` (7 tests) ✓
- `InstagramWebhookTests` (4 tests) ✓
- `MessengerWebhookTests` (4 tests) ✓

- [ ] **Step 11.4: Commit final**

```bash
git add tests/ChatOmnicanal.Integration.Tests/API/InstagramWebhookTests.cs
git add tests/ChatOmnicanal.Integration.Tests/API/MessengerWebhookTests.cs
git commit -m "test(phase-6): add Instagram and Messenger webhook integration tests"
```

---

## Criterios de Terminado (Acceptance Criteria)

1. [ ] Instagram webhook `/api/webhooks/instagram` verifica `hub.challenge` (GET) y valida `X-Hub-Signature-256` (POST).
2. [ ] Messenger webhook `/api/webhooks/messenger` verifica `hub.challenge` (GET) y valida `X-Hub-Signature-256` (POST).
3. [ ] Un mensaje de texto entrante de Instagram crea un `Contact` + `Conversation` + `Message` con `ChannelType.Instagram`.
4. [ ] Un mensaje de texto entrante de Messenger crea un `Contact` + `Conversation` + `Message` con `ChannelType.Messenger`.
5. [ ] Los mensajes duplicados (reintentos de Meta) son idempotentes — se ignoran si ya existen por `ExternalId`.
6. [ ] El bot puede responder en conversaciones de Instagram y Messenger a través de `InstagramSender` y `MessengerSender`.
7. [ ] Agentes humanos pueden enviar mensajes desde `ConversationsController` en canales Instagram y Messenger.
8. [ ] Los read receipts de Instagram y delivery confirmations de Messenger actualizan `DeliveryStatus` en el mensaje.
9. [ ] Todos los tests de fases anteriores (WhatsApp, Bot Engine, State Router) siguen pasando.
