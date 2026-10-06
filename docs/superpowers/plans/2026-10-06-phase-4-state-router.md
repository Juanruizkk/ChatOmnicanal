# Phase 4 — Conversation State Router & Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la máquina de estados de conversación (`Bot` → `Human` → `InQueue` → `Closed`), cálculo de horarios de atención con zona horaria del tenant, cálculo de ventana de 24 horas para Meta (WhatsApp, IG, Messenger), orquestación de handoff automático y acciones de agentes humanos (tomar control, responder, resolver).

**Architecture:** 
- **Máquina de Estados de Conversación:**
  - `Bot`: El mensaje entrante es procesado por `IBotEngineService`. Si el bot responde, se persiste el mensaje saliente y se envía al usuario por el canal correspondiente. Si hay handoff (pedido de humano o falta de contexto RAG), el router evalúa el horario de atención.
  - `Human`: La conversación está en manos de un agente humano. El bot **no responde** automáticamente; el mensaje entrante solo se persiste y actualiza la ventana de 24h.
  - `InQueue`: El usuario solicitó atención fuera del horario laboral. El bot envió el mensaje de fuera de horario indicando cuándo lo atenderán y la conversación queda pausada a la espera de que abra el negocio y un agente la tome.
  - `Closed`: Conversación resuelta por un agente. Si llega un nuevo mensaje del usuario, se reabre automáticamente en estado `Bot` (`ReopenAsBot()`) para volver a ser atendido por la IA.
- **Cálculo de Horarios (`IBusinessHoursService`):**
  - Parsea el `BusinessHoursJson` del `TenantProfile` (ej. `{"monday":{"open":"09:00","close":"18:00","closed":false}, ...}`).
  - Convierte la hora UTC actual a la zona horaria del tenant (`TimeZoneInfo.FindSystemTimeZoneById(profile.Timezone)`).
  - Evalúa si el negocio está abierto o calcula la próxima apertura ("mañana a las 09:00 hs", "el lunes a las 09:00 hs").
- **Cálculo de Ventana de 24h (`IMessagingWindowService`):**
  - Calcula el tiempo restante desde `LastUserMessageAt` para respetar las políticas de Meta (24h para WhatsApp, 7 días con tag `HUMAN_AGENT` para Instagram/Messenger).
- **Control y Gestión de Conversaciones (`IConversationService` + `ConversationsController`):**
  - Endpoints para listar conversaciones con filtros (estado, canal, agente), ver detalle con historial, tomar control (`take-control`), resolver (`resolve`), reabrir (`reopen`) y enviar mensajes de agentes humanos.

**Tech Stack:** .NET 8, C#, EF Core 8, PostgreSQL, Hangfire, xUnit, Testcontainers.

---

## File Map

```
src/ChatOmnicanal.Application/
  Conversations/
    IConversationService.cs
    IConversationStateRouter.cs
    IBusinessHoursService.cs
    IMessagingWindowService.cs
    ConversationDto.cs
    ConversationDetailDto.cs
    ConversationListFilter.cs
    MessagingWindowDto.cs
    BusinessHoursSchedule.cs
    SendMessageRequest.cs

src/ChatOmnicanal.Infrastructure/
  Conversations/
    BusinessHoursService.cs
    MessagingWindowService.cs
    ConversationStateRouter.cs
    ConversationService.cs
  Services/
    Modify: MessageProcessingService.cs (conectar con IConversationStateRouter)
  Modify: DependencyInjection.cs

src/ChatOmnicanal.API/
  Controllers/
    ConversationsController.cs

tests/ChatOmnicanal.Domain.Tests/
  Conversations/
    BusinessHoursServiceTests.cs
    MessagingWindowServiceTests.cs
    ConversationStateMachineTests.cs

tests/ChatOmnicanal.Integration.Tests/
  API/
    ConversationsControllerTests.cs
  Routing/
    ConversationStateRouterIntegrationTests.cs
```

---

## Task 1: Servicios de Horario de Atención y Ventana de 24 Horas

**Files:**
- Create: `src/ChatOmnicanal.Application/Conversations/BusinessHoursSchedule.cs`
- Create: `src/ChatOmnicanal.Application/Conversations/IBusinessHoursService.cs`
- Create: `src/ChatOmnicanal.Application/Conversations/MessagingWindowDto.cs`
- Create: `src/ChatOmnicanal.Application/Conversations/IMessagingWindowService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Conversations/BusinessHoursService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Conversations/MessagingWindowService.cs`
- Create: `tests/ChatOmnicanal.Domain.Tests/Conversations/BusinessHoursServiceTests.cs`
- Create: `tests/ChatOmnicanal.Domain.Tests/Conversations/MessagingWindowServiceTests.cs`

- [ ] **Step 1.1: Modelos de Horarios y Ventana 24h**

`src/ChatOmnicanal.Application/Conversations/BusinessHoursSchedule.cs`:
```csharp
namespace ChatOmnicanal.Application.Conversations;

public record DaySchedule(string? Open, string? Close, bool Closed);

public class BusinessHoursSchedule : Dictionary<string, DaySchedule>
{
    public static readonly string[] DaysOfWeek =
        ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
}
```

`src/ChatOmnicanal.Application/Conversations/IBusinessHoursService.cs`:
```csharp
namespace ChatOmnicanal.Application.Conversations;

public interface IBusinessHoursService
{
    // Evalúa si en el instante utcNow el negocio está abierto según su perfil
    bool IsOpen(string businessHoursJson, string? timezoneId, DateTime utcNow);

    // Obtiene un texto descriptivo del próximo horario de apertura ("mañana a las 09:00 hs", "el lunes a las 09:00 hs")
    string GetNextOpeningDescription(string businessHoursJson, string? timezoneId, DateTime utcNow);
}
```

`src/ChatOmnicanal.Application/Conversations/MessagingWindowDto.cs`:
```csharp
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Application.Conversations;

public record MessagingWindowDto(
    bool IsWithin24Hours,
    int RemainingMinutes,
    DateTime? ExpiresAt,
    bool CanSendFreeForm,
    bool CanSendHumanAgentTag);
```

`src/ChatOmnicanal.Application/Conversations/IMessagingWindowService.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;

namespace ChatOmnicanal.Application.Conversations;

public interface IMessagingWindowService
{
    MessagingWindowDto CalculateWindow(Conversation conversation, DateTime utcNow);
}
```

- [ ] **Step 1.2: Implementar `BusinessHoursService`**

`src/ChatOmnicanal.Infrastructure/Conversations/BusinessHoursService.cs`:
```csharp
using System.Text.Json;
using ChatOmnicanal.Application.Conversations;

namespace ChatOmnicanal.Infrastructure.Conversations;

public class BusinessHoursService : IBusinessHoursService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public bool IsOpen(string businessHoursJson, string? timezoneId, DateTime utcNow)
    {
        if (string.IsNullOrWhiteSpace(businessHoursJson) || businessHoursJson == "{}")
            return true; // Si no configuró horarios, se asume siempre abierto

        var tz = GetTimeZone(timezoneId);
        var localTime = TimeZoneInfo.ConvertTimeFromUtc(utcNow, tz);
        var dayKey = localTime.DayOfWeek.ToString().ToLowerInvariant();

        var schedule = ParseSchedule(businessHoursJson);
        if (schedule == null || !schedule.TryGetValue(dayKey, out var day) || day.Closed)
            return false;

        if (string.IsNullOrWhiteSpace(day.Open) || string.IsNullOrWhiteSpace(day.Close))
            return false;

        if (!TimeSpan.TryParse(day.Open, out var openTime) || !TimeSpan.TryParse(day.Close, out var closeTime))
            return false;

        var currentTime = localTime.TimeOfDay;
        return currentTime >= openTime && currentTime < closeTime;
    }

    public string GetNextOpeningDescription(string businessHoursJson, string? timezoneId, DateTime utcNow)
    {
        var tz = GetTimeZone(timezoneId);
        var localTime = TimeZoneInfo.ConvertTimeFromUtc(utcNow, tz);
        var schedule = ParseSchedule(businessHoursJson);

        if (schedule == null || schedule.Count == 0)
            return "próximamente";

        for (int i = 0; i < 7; i++)
        {
            var checkDate = localTime.AddDays(i);
            var dayKey = checkDate.DayOfWeek.ToString().ToLowerInvariant();

            if (schedule.TryGetValue(dayKey, out var day) && !day.Closed && !string.IsNullOrWhiteSpace(day.Open))
            {
                if (i == 0)
                {
                    if (TimeSpan.TryParse(day.Open, out var openTime) && localTime.TimeOfDay < openTime)
                        return $"hoy a las {day.Open} hs";
                }
                else if (i == 1)
                {
                    return $"mañana a las {day.Open} hs";
                }
                else
                {
                    var dayNameEs = GetSpanishDayName(checkDate.DayOfWeek);
                    return $"el {dayNameEs} a las {day.Open} hs";
                }
            }
        }

        return "en el próximo horario comercial";
    }

    private static TimeZoneInfo GetTimeZone(string? timezoneId)
    {
        if (string.IsNullOrWhiteSpace(timezoneId))
            return TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
        }
        catch
        {
            return TimeZoneInfo.Utc;
        }
    }

    private static BusinessHoursSchedule? ParseSchedule(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<BusinessHoursSchedule>(json, JsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private static string GetSpanishDayName(DayOfWeek day) => day switch
    {
        DayOfWeek.Monday => "lunes",
        DayOfWeek.Tuesday => "martes",
        DayOfWeek.Wednesday => "miércoles",
        DayOfWeek.Thursday => "jueves",
        DayOfWeek.Friday => "viernes",
        DayOfWeek.Saturday => "sábado",
        DayOfWeek.Sunday => "domingo",
        _ => "día"
    };
}
```

- [ ] **Step 1.3: Implementar `MessagingWindowService`**

`src/ChatOmnicanal.Infrastructure/Conversations/MessagingWindowService.cs`:
```csharp
using ChatOmnicanal.Application.Conversations;
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Infrastructure.Conversations;

public class MessagingWindowService : IMessagingWindowService
{
    public MessagingWindowDto CalculateWindow(Conversation conversation, DateTime utcNow)
    {
        if (!conversation.LastUserMessageAt.HasValue)
        {
            return new MessagingWindowDto(
                IsWithin24Hours: false,
                RemainingMinutes: 0,
                ExpiresAt: null,
                CanSendFreeForm: false,
                CanSendHumanAgentTag: false);
        }

        var expires24h = conversation.LastUserMessageAt.Value.AddHours(24);
        var remainingMinutes = (int)(expires24h - utcNow).TotalMinutes;
        var isWithin24h = remainingMinutes > 0;

        // Tag HUMAN_AGENT en Instagram y Messenger permite responder hasta 7 días después
        var isWithin7Days = (conversation.LastUserMessageAt.Value.AddDays(7) - utcNow).TotalMinutes > 0;
        var canSendHumanAgentTag = isWithin7Days && (conversation.Channel?.Type == ChannelType.Instagram || conversation.Channel?.Type == ChannelType.Messenger);

        return new MessagingWindowDto(
            IsWithin24Hours: isWithin24h,
            RemainingMinutes: isWithin24h ? remainingMinutes : 0,
            ExpiresAt: expires24h,
            CanSendFreeForm: isWithin24h,
            CanSendHumanAgentTag: canSendHumanAgentTag);
    }
}
```

- [ ] **Step 1.4: Tests Unitarios de Horarios y Ventana 24h**

`tests/ChatOmnicanal.Domain.Tests/Conversations/BusinessHoursServiceTests.cs`:
```csharp
using ChatOmnicanal.Infrastructure.Conversations;
using Xunit;

namespace ChatOmnicanal.Domain.Tests.Conversations;

public class BusinessHoursServiceTests
{
    private readonly BusinessHoursService _service = new();

    private const string SampleHours = """
    {
      "monday": { "open": "09:00", "close": "18:00", "closed": false },
      "tuesday": { "open": "09:00", "close": "18:00", "closed": false },
      "saturday": { "open": "10:00", "close": "14:00", "closed": false },
      "sunday": { "open": "00:00", "close": "00:00", "closed": true }
    }
    """;

    [Fact]
    public void IsOpen_DuringBusinessHours_ReturnsTrue()
    {
        // Lunes 10:00 AM UTC-3 (13:00 UTC)
        var monday10AmUtc = new DateTime(2026, 10, 5, 13, 0, 0, DateTimeKind.Utc);
        var isOpen = _service.IsOpen(SampleHours, "America/Argentina/Buenos_Aires", monday10AmUtc);

        Assert.True(isOpen);
    }

    [Fact]
    public void IsOpen_OutsideBusinessHours_ReturnsFalse()
    {
        // Lunes 21:00 PM UTC-3 (00:00 UTC martes)
        var monday9PmUtc = new DateTime(2026, 10, 6, 0, 0, 0, DateTimeKind.Utc);
        var isOpen = _service.IsOpen(SampleHours, "America/Argentina/Buenos_Aires", monday9PmUtc);

        Assert.False(isOpen);
    }

    [Fact]
    public void IsOpen_OnClosedDay_ReturnsFalse()
    {
        // Domingo 12:00 PM UTC-3 (15:00 UTC)
        var sunday12PmUtc = new DateTime(2026, 10, 4, 15, 0, 0, DateTimeKind.Utc);
        var isOpen = _service.IsOpen(SampleHours, "America/Argentina/Buenos_Aires", sunday12PmUtc);

        Assert.False(isOpen);
    }

    [Fact]
    public void GetNextOpeningDescription_WhenClosedOnSunday_ReturnsMonday()
    {
        var sunday12PmUtc = new DateTime(2026, 10, 4, 15, 0, 0, DateTimeKind.Utc);
        var next = _service.GetNextOpeningDescription(SampleHours, "America/Argentina/Buenos_Aires", sunday12PmUtc);

        Assert.Contains("mañana a las 09:00 hs", next);
    }
}
```

---

## Task 2: Router de Estados de Conversación (`ConversationStateRouter`)

**Files:**
- Create: `src/ChatOmnicanal.Application/Conversations/IConversationStateRouter.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Conversations/ConversationStateRouter.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/Services/MessageProcessingService.cs`
- Create: `tests/ChatOmnicanal.Domain.Tests/Conversations/ConversationStateMachineTests.cs`

- [ ] **Step 2.1: Crear contrato `IConversationStateRouter`**

`src/ChatOmnicanal.Application/Conversations/IConversationStateRouter.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;

namespace ChatOmnicanal.Application.Conversations;

public interface IConversationStateRouter
{
    // Procesa el mensaje entrante según el estado actual de la conversación
    Task RouteInboundMessageAsync(Conversation conversation, Message inboundMessage, CancellationToken ct = default);
}
```

- [ ] **Step 2.2: Implementar `ConversationStateRouter`**

`src/ChatOmnicanal.Infrastructure/Conversations/ConversationStateRouter.cs`:
```csharp
using ChatOmnicanal.Application.BotEngine;
using ChatOmnicanal.Application.Channels;
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Conversations;
using ChatOmnicanal.Application.TenantProfiles;
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatOmnicanal.Infrastructure.Conversations;

public class ConversationStateRouter : IConversationStateRouter
{
    private readonly IApplicationDbContext _db;
    private readonly IBotEngineService _botEngine;
    private readonly ITenantProfileService _profileService;
    private readonly IBusinessHoursService _businessHours;
    private readonly IWhatsAppSender _whatsAppSender;
    private readonly ILogger<ConversationStateRouter> _logger;

    public ConversationStateRouter(
        IApplicationDbContext db,
        IBotEngineService botEngine,
        ITenantProfileService profileService,
        IBusinessHoursService businessHours,
        IWhatsAppSender whatsAppSender,
        ILogger<ConversationStateRouter> logger)
    {
        _db = db;
        _botEngine = botEngine;
        _profileService = profileService;
        _businessHours = businessHours;
        _whatsAppSender = whatsAppSender;
        _logger = logger;
    }

    public async Task RouteInboundMessageAsync(Conversation conversation, Message inboundMessage, CancellationToken ct = default)
    {
        switch (conversation.Status)
        {
            case ConversationStatus.Closed:
                // Si la conversación estaba cerrada, reabrirla como Bot
                conversation.ReopenAsBot();
                await _db.SaveChangesAsync(ct);
                await HandleBotTurnAsync(conversation, inboundMessage, ct);
                break;

            case ConversationStatus.Bot:
                await HandleBotTurnAsync(conversation, inboundMessage, ct);
                break;

            case ConversationStatus.Human:
            case ConversationStatus.InQueue:
                // El bot NO responde. Se mantiene el estado y el mensaje ya quedó registrado en el historial.
                _logger.LogInformation("Conversation {Id} is in {Status} status. Bot will not reply.", conversation.Id, conversation.Status);
                break;
        }
    }

    private async Task HandleBotTurnAsync(Conversation conversation, Message inboundMessage, CancellationToken ct)
    {
        // 1. Obtener historial reciente de la conversación (últimos 6 mensajes)
        var historyMessages = await _db.Messages
            .AsNoTracking()
            .Where(m => m.ConversationId == conversation.Id && m.Id != inboundMessage.Id)
            .OrderByDescending(m => m.CreatedAt)
            .Take(6)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new BotChatMessage(
                m.Author == MessageAuthor.User ? "user" : "assistant",
                m.Content))
            .ToListAsync(ct);

        // 2. Ejecutar Bot Engine
        var botRequest = new BotRequest(
            TenantId: conversation.TenantId,
            ConversationId: conversation.Id,
            ChannelType: conversation.Channel.Type,
            UserMessage: inboundMessage.Content,
            ConversationHistory: historyMessages);

        var botResponse = await _botEngine.ProcessMessageAsync(botRequest, ct);

        // 3. Evaluar si hubo señal de handoff
        if (botResponse.ShouldHandoff)
        {
            await HandleHandoffAsync(conversation, botResponse.ReplyText, ct);
            return;
        }

        // 4. Si el bot responde normalmente, guardar mensaje saliente y despachar
        await SaveAndSendBotReplyAsync(conversation, botResponse.ReplyText, ct);
    }

    private async Task HandleHandoffAsync(Conversation conversation, string? handoffMessage, CancellationToken ct)
    {
        var profile = await _profileService.GetProfileAsync(conversation.TenantId, ct);
        var isBusinessOpen = _businessHours.IsOpen(profile?.BusinessHoursJson ?? "{}", profile?.Timezone, DateTime.UtcNow);

        if (isBusinessOpen)
        {
            conversation.TransitionToHuman();
            var reply = !string.IsNullOrWhiteSpace(handoffMessage)
                ? handoffMessage
                : "Te comunico con un asesor de nuestro equipo para continuar la conversación.";

            await SaveAndSendBotReplyAsync(conversation, reply, ct);
            _logger.LogInformation("Conversation {Id} transitioned to Human during business hours.", conversation.Id);
        }
        else
        {
            conversation.TransitionToQueue();
            var nextOpening = _businessHours.GetNextOpeningDescription(profile?.BusinessHoursJson ?? "{}", profile?.Timezone, DateTime.UtcNow);
            var queueMessage = $"Actualmente nos encontramos fuera del horario de atención. Te responderemos {nextOpening}.";

            await SaveAndSendBotReplyAsync(conversation, queueMessage, ct);
            _logger.LogInformation("Conversation {Id} transitioned to InQueue outside business hours.", conversation.Id);
        }

        await _db.SaveChangesAsync(ct);
    }

    private async Task SaveAndSendBotReplyAsync(Conversation conversation, string replyText, CancellationToken ct)
    {
        var botMessage = new Message
        {
            TenantId = conversation.TenantId,
            ConversationId = conversation.Id,
            Direction = MessageDirection.Outbound,
            Author = MessageAuthor.Bot,
            Content = replyText,
            ExternalId = $"bot_{Guid.NewGuid():N}",
            DeliveryStatus = "sent",
            UpdatedAt = DateTime.UtcNow
        };

        _db.Messages.Add(botMessage);
        await _db.SaveChangesAsync(ct);

        // Enviar por el canal (WhatsApp por ahora)
        if (conversation.Channel.Type == ChannelType.WhatsApp && !string.IsNullOrWhiteSpace(conversation.Channel.PhoneNumberId))
        {
            try
            {
                await _whatsAppSender.SendTextMessageAsync(
                    conversation.Channel.PhoneNumberId,
                    conversation.Contact.ExternalId,
                    replyText,
                    ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending WhatsApp bot reply to {WaId}", conversation.Contact.ExternalId);
            }
        }
    }
}
```

- [ ] **Step 2.3: Conectar `MessageProcessingService` con `IConversationStateRouter`**

Modificar `apps/api/src/ChatOmnicanal.Infrastructure/Services/MessageProcessingService.cs` para inyectar `IConversationStateRouter` y llamarlo tras persistir el mensaje:
```csharp
await _stateRouter.RouteInboundMessageAsync(conversation, message, ct);
```

- [ ] **Step 2.4: Tests Unitarios de Transiciones de Estado**

`tests/ChatOmnicanal.Domain.Tests/Conversations/ConversationStateMachineTests.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;
using Xunit;

namespace ChatOmnicanal.Domain.Tests.Conversations;

public class ConversationStateMachineTests
{
    [Fact]
    public void AssignAgent_TransitionsToHuman_And_SetsAssignedAgent()
    {
        var conv = new Conversation { Status = ConversationStatus.Bot };
        var agentId = Guid.NewGuid();

        conv.AssignAgent(agentId);

        Assert.Equal(ConversationStatus.Human, conv.Status);
        Assert.Equal(agentId, conv.AssignedAgentId);
    }

    [Fact]
    public void Resolve_TransitionsToClosed_And_ClearsAgent()
    {
        var conv = new Conversation { Status = ConversationStatus.Human, AssignedAgentId = Guid.NewGuid() };

        conv.Resolve();

        Assert.Equal(ConversationStatus.Closed, conv.Status);
        Assert.Null(conv.AssignedAgentId);
    }

    [Fact]
    public void ReopenAsBot_TransitionsToBot_WhenNewMessageArrives()
    {
        var conv = new Conversation { Status = ConversationStatus.Closed };

        conv.ReopenAsBot();

        Assert.Equal(ConversationStatus.Bot, conv.Status);
        Assert.Null(conv.AssignedAgentId);
    }
}
```

---

## Task 3: Servicio y Endpoints de Gestión de Conversaciones (`ConversationsController`)

**Files:**
- Create: `src/ChatOmnicanal.Application/Conversations/ConversationDto.cs`
- Create: `src/ChatOmnicanal.Application/Conversations/ConversationDetailDto.cs`
- Create: `src/ChatOmnicanal.Application/Conversations/ConversationListFilter.cs`
- Create: `src/ChatOmnicanal.Application/Conversations/SendMessageRequest.cs`
- Create: `src/ChatOmnicanal.Application/Conversations/IConversationService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Conversations/ConversationService.cs`
- Create: `src/ChatOmnicanal.API/Controllers/ConversationsController.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`

- [ ] **Step 3.1: DTOs y Contratos de Conversaciones**

`src/ChatOmnicanal.Application/Conversations/ConversationDto.cs`:
```csharp
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Application.Conversations;

public record ConversationDto(
    Guid Id,
    Guid TenantId,
    ChannelType ChannelType,
    string ContactName,
    string ContactExternalId,
    ConversationStatus Status,
    Guid? AssignedAgentId,
    string? AssignedAgentName,
    DateTime? LastUserMessageAt,
    string? LastMessageSnippet,
    DateTime? LastMessageAt,
    MessagingWindowDto MessagingWindow,
    string? ReferralJson,
    DateTime CreatedAt);
```

`src/ChatOmnicanal.Application/Conversations/ConversationDetailDto.cs`:
```csharp
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Application.Conversations;

public record MessageDto(
    Guid Id,
    MessageDirection Direction,
    MessageAuthor Author,
    string Content,
    string? DeliveryStatus,
    DateTime CreatedAt);

public record ConversationDetailDto(
    Guid Id,
    Guid TenantId,
    ChannelType ChannelType,
    string ContactName,
    string ContactExternalId,
    ConversationStatus Status,
    Guid? AssignedAgentId,
    string? AssignedAgentName,
    MessagingWindowDto MessagingWindow,
    string? ReferralJson,
    List<MessageDto> Messages,
    DateTime CreatedAt);
```

`src/ChatOmnicanal.Application/Conversations/ConversationListFilter.cs`:
```csharp
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Application.Conversations;

public record ConversationListFilter(
    ConversationStatus? Status = null,
    ChannelType? ChannelType = null,
    Guid? AssignedAgentId = null,
    string? SearchQuery = null,
    int Page = 1,
    int PageSize = 20);
```

`src/ChatOmnicanal.Application/Conversations/SendMessageRequest.cs`:
```csharp
namespace ChatOmnicanal.Application.Conversations;

public record SendMessageRequest(string Content);
```

`src/ChatOmnicanal.Application/Conversations/IConversationService.cs`:
```csharp
namespace ChatOmnicanal.Application.Conversations;

public interface IConversationService
{
    Task<List<ConversationDto>> GetConversationsAsync(Guid tenantId, ConversationListFilter filter, CancellationToken ct = default);
    Task<ConversationDetailDto?> GetConversationDetailAsync(Guid tenantId, Guid conversationId, CancellationToken ct = default);
    Task<ConversationDto> TakeControlAsync(Guid tenantId, Guid conversationId, Guid agentUserId, CancellationToken ct = default);
    Task<ConversationDto> ResolveAsync(Guid tenantId, Guid conversationId, CancellationToken ct = default);
    Task<ConversationDto> ReopenAsBotAsync(Guid tenantId, Guid conversationId, CancellationToken ct = default);
    Task<MessageDto> SendAgentMessageAsync(Guid tenantId, Guid conversationId, Guid agentUserId, string content, CancellationToken ct = default);
}
```

- [ ] **Step 3.2: Implementar `ConversationService`**

`src/ChatOmnicanal.Infrastructure/Conversations/ConversationService.cs`:
```csharp
using ChatOmnicanal.Application.Channels;
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Conversations;
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Conversations;

public class ConversationService : IConversationService
{
    private readonly IApplicationDbContext _db;
    private readonly IMessagingWindowService _windowService;
    private readonly IWhatsAppSender _whatsAppSender;

    public ConversationService(
        IApplicationDbContext db,
        IMessagingWindowService windowService,
        IWhatsAppSender whatsAppSender)
    {
        _db = db;
        _windowService = windowService;
        _whatsAppSender = whatsAppSender;
    }

    public async Task<List<ConversationDto>> GetConversationsAsync(Guid tenantId, ConversationListFilter filter, CancellationToken ct = default)
    {
        var query = _db.Conversations
            .AsNoTracking()
            .Include(c => c.Channel)
            .Include(c => c.Contact)
            .Include(c => c.AssignedAgent)
            .Include(c => c.Messages)
            .Where(c => c.TenantId == tenantId);

        if (filter.Status.HasValue)
            query = query.Where(c => c.Status == filter.Status.Value);

        if (filter.ChannelType.HasValue)
            query = query.Where(c => c.Channel.Type == filter.ChannelType.Value);

        if (filter.AssignedAgentId.HasValue)
            query = query.Where(c => c.AssignedAgentId == filter.AssignedAgentId.Value);

        if (!string.IsNullOrWhiteSpace(filter.SearchQuery))
        {
            var search = filter.SearchQuery.Trim().ToLower();
            query = query.Where(c =>
                c.Contact.Name.ToLower().Contains(search) ||
                c.Contact.ExternalId.Contains(search) ||
                c.Messages.Any(m => m.Content.ToLower().Contains(search)));
        }

        var conversations = await query
            .OrderByDescending(c => c.Messages.Max(m => (DateTime?)m.CreatedAt) ?? c.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(ct);

        var utcNow = DateTime.UtcNow;
        return conversations.Select(c =>
        {
            var lastMsg = c.Messages.OrderByDescending(m => m.CreatedAt).FirstOrDefault();
            var window = _windowService.CalculateWindow(c, utcNow);

            return new ConversationDto(
                c.Id,
                c.TenantId,
                c.Channel.Type,
                c.Contact.Name ?? c.Contact.ExternalId,
                c.Contact.ExternalId,
                c.Status,
                c.AssignedAgentId,
                c.AssignedAgent?.Name,
                c.LastUserMessageAt,
                lastMsg?.Content,
                lastMsg?.CreatedAt,
                window,
                c.ReferralJson,
                c.CreatedAt);
        }).ToList();
    }

    public async Task<ConversationDetailDto?> GetConversationDetailAsync(Guid tenantId, Guid conversationId, CancellationToken ct = default)
    {
        var conversation = await _db.Conversations
            .AsNoTracking()
            .Include(c => c.Channel)
            .Include(c => c.Contact)
            .Include(c => c.AssignedAgent)
            .Include(c => c.Messages)
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == conversationId, ct);

        if (conversation == null) return null;

        var window = _windowService.CalculateWindow(conversation, DateTime.UtcNow);
        var messages = conversation.Messages
            .OrderBy(m => m.CreatedAt)
            .Select(m => new MessageDto(m.Id, m.Direction, m.Author, m.Content, m.DeliveryStatus, m.CreatedAt))
            .ToList();

        return new ConversationDetailDto(
            conversation.Id,
            conversation.TenantId,
            conversation.Channel.Type,
            conversation.Contact.Name ?? conversation.Contact.ExternalId,
            conversation.Contact.ExternalId,
            conversation.Status,
            conversation.AssignedAgentId,
            conversation.AssignedAgent?.Name,
            window,
            conversation.ReferralJson,
            messages,
            conversation.CreatedAt);
    }

    public async Task<ConversationDto> TakeControlAsync(Guid tenantId, Guid conversationId, Guid agentUserId, CancellationToken ct = default)
    {
        var conversation = await _db.Conversations
            .Include(c => c.Channel)
            .Include(c => c.Contact)
            .Include(c => c.AssignedAgent)
            .Include(c => c.Messages)
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == conversationId, ct)
            ?? throw new KeyNotFoundException("Conversación no encontrada.");

        conversation.AssignAgent(agentUserId);
        await _db.SaveChangesAsync(ct);

        var window = _windowService.CalculateWindow(conversation, DateTime.UtcNow);
        var lastMsg = conversation.Messages.OrderByDescending(m => m.CreatedAt).FirstOrDefault();

        return new ConversationDto(
            conversation.Id, conversation.TenantId, conversation.Channel.Type,
            conversation.Contact.Name ?? conversation.Contact.ExternalId, conversation.Contact.ExternalId,
            conversation.Status, conversation.AssignedAgentId, conversation.AssignedAgent?.Name,
            conversation.LastUserMessageAt, lastMsg?.Content, lastMsg?.CreatedAt, window,
            conversation.ReferralJson, conversation.CreatedAt);
    }

    public async Task<ConversationDto> ResolveAsync(Guid tenantId, Guid conversationId, CancellationToken ct = default)
    {
        var conversation = await _db.Conversations
            .Include(c => c.Channel)
            .Include(c => c.Contact)
            .Include(c => c.AssignedAgent)
            .Include(c => c.Messages)
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == conversationId, ct)
            ?? throw new KeyNotFoundException("Conversación no encontrada.");

        conversation.Resolve();
        await _db.SaveChangesAsync(ct);

        var window = _windowService.CalculateWindow(conversation, DateTime.UtcNow);
        var lastMsg = conversation.Messages.OrderByDescending(m => m.CreatedAt).FirstOrDefault();

        return new ConversationDto(
            conversation.Id, conversation.TenantId, conversation.Channel.Type,
            conversation.Contact.Name ?? conversation.Contact.ExternalId, conversation.Contact.ExternalId,
            conversation.Status, conversation.AssignedAgentId, null,
            conversation.LastUserMessageAt, lastMsg?.Content, lastMsg?.CreatedAt, window,
            conversation.ReferralJson, conversation.CreatedAt);
    }

    public async Task<ConversationDto> ReopenAsBotAsync(Guid tenantId, Guid conversationId, CancellationToken ct = default)
    {
        var conversation = await _db.Conversations
            .Include(c => c.Channel)
            .Include(c => c.Contact)
            .Include(c => c.AssignedAgent)
            .Include(c => c.Messages)
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == conversationId, ct)
            ?? throw new KeyNotFoundException("Conversación no encontrada.");

        conversation.ReopenAsBot();
        await _db.SaveChangesAsync(ct);

        var window = _windowService.CalculateWindow(conversation, DateTime.UtcNow);
        var lastMsg = conversation.Messages.OrderByDescending(m => m.CreatedAt).FirstOrDefault();

        return new ConversationDto(
            conversation.Id, conversation.TenantId, conversation.Channel.Type,
            conversation.Contact.Name ?? conversation.Contact.ExternalId, conversation.Contact.ExternalId,
            conversation.Status, conversation.AssignedAgentId, null,
            conversation.LastUserMessageAt, lastMsg?.Content, lastMsg?.CreatedAt, window,
            conversation.ReferralJson, conversation.CreatedAt);
    }

    public async Task<MessageDto> SendAgentMessageAsync(Guid tenantId, Guid conversationId, Guid agentUserId, string content, CancellationToken ct = default)
    {
        var conversation = await _db.Conversations
            .Include(c => c.Channel)
            .Include(c => c.Contact)
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == conversationId, ct)
            ?? throw new KeyNotFoundException("Conversación no encontrada.");

        if (conversation.Status == ConversationStatus.Bot)
        {
            conversation.AssignAgent(agentUserId);
        }

        var message = new Message
        {
            TenantId = tenantId,
            ConversationId = conversation.Id,
            Direction = MessageDirection.Outbound,
            Author = MessageAuthor.Agent,
            Content = content,
            ExternalId = $"agent_{Guid.NewGuid():N}",
            DeliveryStatus = "sent",
            UpdatedAt = DateTime.UtcNow
        };

        _db.Messages.Add(message);
        await _db.SaveChangesAsync(ct);

        if (conversation.Channel.Type == ChannelType.WhatsApp && !string.IsNullOrWhiteSpace(conversation.Channel.PhoneNumberId))
        {
            await _whatsAppSender.SendTextMessageAsync(
                conversation.Channel.PhoneNumberId,
                conversation.Contact.ExternalId,
                content,
                ct);
        }

        return new MessageDto(message.Id, message.Direction, message.Author, message.Content, message.DeliveryStatus, message.CreatedAt);
    }
}
```

- [ ] **Step 3.3: Implementar `ConversationsController`**

`src/ChatOmnicanal.API/Controllers/ConversationsController.cs`:
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Conversations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/conversations")]
[Authorize]
public class ConversationsController : ControllerBase
{
    private readonly IConversationService _conversationService;
    private readonly ICurrentTenantService _currentTenant;

    public ConversationsController(IConversationService conversationService, ICurrentTenantService currentTenant)
    {
        _conversationService = conversationService;
        _currentTenant = currentTenant;
    }

    [HttpGet]
    public async Task<ActionResult<List<ConversationDto>>> List([FromQuery] ConversationListFilter filter, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        var list = await _conversationService.GetConversationsAsync(_currentTenant.TenantId, filter, ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ConversationDetailDto>> GetDetail(Guid id, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        var detail = await _conversationService.GetConversationDetailAsync(_currentTenant.TenantId, id, ct);
        if (detail == null) return NotFound("Conversación no encontrada.");
        return Ok(detail);
    }

    [HttpPost("{id:guid}/take-control")]
    public async Task<ActionResult<ConversationDto>> TakeControl(Guid id, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        var result = await _conversationService.TakeControlAsync(_currentTenant.TenantId, id, Guid.Empty, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/resolve")]
    public async Task<ActionResult<ConversationDto>> Resolve(Guid id, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        var result = await _conversationService.ResolveAsync(_currentTenant.TenantId, id, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/reopen")]
    public async Task<ActionResult<ConversationDto>> Reopen(Guid id, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        var result = await _conversationService.ReopenAsBotAsync(_currentTenant.TenantId, id, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/messages")]
    public async Task<ActionResult<MessageDto>> SendMessage(Guid id, [FromBody] SendMessageRequest request, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Content)) return BadRequest("El contenido del mensaje es requerido.");

        var message = await _conversationService.SendAgentMessageAsync(_currentTenant.TenantId, id, Guid.Empty, request.Content, ct);
        return Ok(message);
    }
}
```

- [ ] **Step 3.4: Registrar servicios en `DependencyInjection.cs`**

```csharp
services.AddSingleton<IBusinessHoursService, BusinessHoursService>();
services.AddSingleton<IMessagingWindowService, MessagingWindowService>();
services.AddScoped<IConversationStateRouter, ConversationStateRouter>();
services.AddScoped<IConversationService, ConversationService>();
```

---

## Task 4: Tests de Integración y Validación del Router

**Files:**
- Create: `tests/ChatOmnicanal.Integration.Tests/API/ConversationsControllerTests.cs`
- Create: `tests/ChatOmnicanal.Integration.Tests/Routing/ConversationStateRouterIntegrationTests.cs`

- [ ] **Step 4.1: Tests de Integración de `ConversationsController`**

Validar listado de conversaciones, obtención de detalle con ventana de 24h, endpoints de `take-control`, `resolve` y `reopen`.

- [ ] **Step 4.2: Tests de Integración del Pipeline de Enrutamiento**

Validar que cuando llega un mensaje de WhatsApp:
1. En estado `Bot` y pregunta de negocio → el bot responde automáticamente.
2. En estado `Bot` y pedido de humano en horario laboral → cambia a `Human`.
3. En estado `Bot` y pedido de humano fuera de horario → cambia a `InQueue` y envía mensaje con próximo horario.
4. En estado `Human` o `InQueue` → el bot no responde.
5. En estado `Closed` → un nuevo mensaje reabre la conversación en `Bot` y responde.

- [ ] **Step 4.3: Ejecución de la suite completa de pruebas**

```bash
dotnet test apps/api/ChatOmnicanal.sln
```

---

## Criterios de Terminado (Acceptance Criteria)

1. [ ] La máquina de estados procesa correctamente las 4 transiciones: `Bot` → `Human`, `Bot` → `InQueue`, `Human` → `Closed`, `Closed` → `Bot`.
2. [ ] El cálculo de horario de atención evalúa con precisión zonas horarias (ej. `America/Argentina/Buenos_Aires`) y calcula el texto de apertura próximo.
3. [ ] El cálculo de la ventana de 24h devuelve los minutos restantes y los flags `CanSendFreeForm` y `CanSendHumanAgentTag`.
4. [ ] El bot NO responde a mensajes cuando la conversación está en `Human` o `InQueue`.
5. [ ] Los endpoints `/take-control`, `/resolve`, `/reopen` y `/messages` permiten a agentes humanos operar la conversación desde el panel.
6. [ ] Todos los tests unitarios y de integración pasan al 100%.
