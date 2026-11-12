# Onboarding Wizard — Fase 3b: Persona/identidad al system prompt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que el system prompt del bot incorpore, como contexto siempre-presente, la persona del bot (nombre, tono, saludo, reglas "nunca", disparadores de handoff) y la identidad del negocio (rubro, descripción, zona), en vez de depender solo del RAG.

**Architecture:** Se agrega un parámetro `BotPersonaDto? persona` a `ISystemPromptBuilder.BuildSystemPrompt`. `SystemPromptBuilder` usa la persona para tono/nombre/saludo/reglas y una sección de handoff; y agrega identidad desde el `TenantProfileDto` (que ya trae `Rubro/Description/Zone` desde la fase 3a). `BotEngineService` carga la persona vía `IBotPersonaService` (ya existe) y la pasa al builder. El catálogo/FAQ/pagos/envíos siguen por RAG.

**Tech Stack:** .NET 8, xUnit (+ Testcontainers para la suite completa).

**Referencia:** spec `...pentabot-design.md`. Repo: `apps/api`, rama `feat/onboarding-wizard` (fases 1, 2, 3a commiteadas). Correr desde `apps/api`. No commitear `appsettings.Development.json`. Si la API bloquea DLLs: `Get-Process -Name ChatOmnicanal.API -ErrorAction SilentlyContinue | Stop-Process -Force`.

**Contratos confirmados:**
- `ISystemPromptBuilder` (`ChatOmnicanal.Application.BotEngine`) hoy: `string BuildSystemPrompt(string tenantName, TenantProfileDto? profile, List<KnowledgeSearchResult> ragChunks)`.
- `BotPersonaDto` (`ChatOmnicanal.Application.BotPersonas`): `(Guid Id, Guid TenantId, string? Name, string? Tone, string? Greeting, string? NeverRules, bool HandoffOnComplaint, bool HandoffOnRequest, bool HandoffOnSpecial, bool HandoffOnPayment, string? HandoffNotifyTo, string? HandoffHours, string? HandoffMessage)`.
- `IBotPersonaService.GetAsync(Guid tenantId, CancellationToken)` → `BotPersonaDto?` (fase 3a, registrado scoped).
- `BotEngineService` ctor actual: `(IApplicationDbContext, ITenantProfileService, IKnowledgeService, IGuardrailsService, ISystemPromptBuilder, ILlmProvider)`; llama al builder en la línea `~65`.
- `SystemPromptBuilder` es singleton y stateless; `BotEngineService` scoped. Agregar un param al ctor de BotEngineService funciona por DI (no hay construcción manual en el código; sí en nada de tests — se usa vía DI en `BotSimulateControllerTests`).
- Unit test existente a actualizar: `tests/ChatOmnicanal.Domain.Tests/BotEngine/SystemPromptBuilderTests.cs` (llama al builder con 3 args).

---

## Task 1: Extender `ISystemPromptBuilder` + `SystemPromptBuilder` + unit tests

**Files:**
- Modify: `src/ChatOmnicanal.Application/BotEngine/ISystemPromptBuilder.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/BotEngine/Services/SystemPromptBuilder.cs`
- Modify: `tests/ChatOmnicanal.Domain.Tests/BotEngine/SystemPromptBuilderTests.cs`

- [ ] **Step 1: Actualizar la interfaz**

`src/ChatOmnicanal.Application/BotEngine/ISystemPromptBuilder.cs` (reemplazar el contenido):
```csharp
using ChatOmnicanal.Application.BotPersonas;
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Application.TenantProfiles;

namespace ChatOmnicanal.Application.BotEngine;

public interface ISystemPromptBuilder
{
    string BuildSystemPrompt(
        string tenantName,
        TenantProfileDto? profile,
        BotPersonaDto? persona,
        List<KnowledgeSearchResult> ragChunks);
}
```

- [ ] **Step 2: Reemplazar la implementación**

`src/ChatOmnicanal.Infrastructure/BotEngine/Services/SystemPromptBuilder.cs` (reemplazar el contenido completo):
```csharp
using System.Text;
using ChatOmnicanal.Application.BotEngine;
using ChatOmnicanal.Application.BotPersonas;
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Application.TenantProfiles;

namespace ChatOmnicanal.Infrastructure.BotEngine.Services;

public class SystemPromptBuilder : ISystemPromptBuilder
{
    public string BuildSystemPrompt(
        string tenantName,
        TenantProfileDto? profile,
        BotPersonaDto? persona,
        List<KnowledgeSearchResult> ragChunks)
    {
        var sb = new StringBuilder();

        var botName = !string.IsNullOrWhiteSpace(persona?.Name) ? persona!.Name! : "el asistente virtual";
        var tone = !string.IsNullOrWhiteSpace(persona?.Tone) ? persona!.Tone!
            : (!string.IsNullOrWhiteSpace(profile?.Tone) ? profile!.Tone! : "amable, servicial, conciso y profesional");

        sb.AppendLine($"Eres {botName}, el asistente virtual oficial de **{tenantName}**.");
        sb.AppendLine($"Tu tono debe ser: {tone}.");
        if (!string.IsNullOrWhiteSpace(persona?.Greeting))
            sb.AppendLine($"Tu saludo de bienvenida es: \"{persona!.Greeting}\".");
        sb.AppendLine();

        sb.AppendLine("### REGLAS FUNDAMENTALES:");
        sb.AppendLine("1. Responde ÚNICAMENTE sobre el negocio, sus productos, servicios, horarios, envíos, métodos de pago y políticas.");
        sb.AppendLine("2. NUNCA respondas preguntas de cultura general, poemas, recetas, programación ni temas ajenos al negocio. Si te preguntan algo ajeno, declina cordialmente indicando que solo puedes responder sobre el negocio.");
        sb.AppendLine("3. Si el usuario te pide hablar con un humano o un asesor, o si la pregunta requiere información que NO posees en el contexto ni en el perfil, incluye la etiqueta `[HANDOFF]` al final de tu respuesta para derivar la conversación al equipo humano.");
        sb.AppendLine("4. Sé claro, breve y utiliza viñetas cuando detalles horarios o medios de pago.");
        if (!string.IsNullOrWhiteSpace(persona?.NeverRules))
            sb.AppendLine($"5. Reglas del negocio que NUNCA debés incumplir: {persona!.NeverRules!.Replace("\n", " ")}");
        sb.AppendLine();

        if (persona is not null)
        {
            var triggers = new List<string>();
            if (persona.HandoffOnComplaint) triggers.Add("el cliente tiene un reclamo");
            if (persona.HandoffOnRequest) triggers.Add("el cliente pide hablar con una persona");
            if (persona.HandoffOnSpecial) triggers.Add("es un pedido especial o a medida");
            if (persona.HandoffOnPayment) triggers.Add("hay dudas con un pago");
            if (triggers.Count > 0)
            {
                sb.AppendLine("### CUÁNDO DERIVAR A UNA PERSONA (incluí `[HANDOFF]` al final):");
                sb.AppendLine("- Derivá cuando: " + string.Join("; ", triggers) + ".");
                if (!string.IsNullOrWhiteSpace(persona.HandoffMessage))
                    sb.AppendLine($"- Al derivar, usá este mensaje: \"{persona.HandoffMessage}\".");
                sb.AppendLine();
            }
        }

        sb.AppendLine("### INFORMACIÓN GENERAL DEL NEGOCIO:");
        if (profile != null)
        {
            if (!string.IsNullOrWhiteSpace(profile.Rubro))
                sb.AppendLine($"- Rubro: {profile.Rubro}");
            if (!string.IsNullOrWhiteSpace(profile.Description))
                sb.AppendLine($"- Qué hace: {profile.Description}");
            if (!string.IsNullOrWhiteSpace(profile.Zone))
                sb.AppendLine($"- Zona: {profile.Zone}");
            if (!string.IsNullOrWhiteSpace(profile.Address))
                sb.AppendLine($"- Dirección / Ubicación: {profile.Address}");
            if (!string.IsNullOrWhiteSpace(profile.ContactPhone))
                sb.AppendLine($"- Teléfono de contacto: {profile.ContactPhone}");
            if (!string.IsNullOrWhiteSpace(profile.ContactEmail))
                sb.AppendLine($"- Email de contacto: {profile.ContactEmail}");
            if (!string.IsNullOrWhiteSpace(profile.BusinessHoursJson) && profile.BusinessHoursJson != "{}")
                sb.AppendLine($"- Horarios de atención: {profile.BusinessHoursJson}");
            if (!string.IsNullOrWhiteSpace(profile.ShippingInfo))
                sb.AppendLine($"- Métodos y costos de envío: {profile.ShippingInfo}");
            if (!string.IsNullOrWhiteSpace(profile.PaymentMethods))
                sb.AppendLine($"- Medios de pago aceptados: {profile.PaymentMethods}");
        }
        else
        {
            sb.AppendLine("Sin datos de perfil cargados.");
        }
        sb.AppendLine();

        if (ragChunks != null && ragChunks.Any())
        {
            sb.AppendLine("### INFORMACIÓN ADICIONAL / CATÁLOGOS / FAQ:");
            foreach (var chunk in ragChunks)
            {
                sb.AppendLine($"--- Fragmento (Similitud: {chunk.Similarity:P0}) ---");
                sb.AppendLine(chunk.Content);
            }
            sb.AppendLine("-------------------------------------------------");
            sb.AppendLine();
        }

        return sb.ToString();
    }
}
```

- [ ] **Step 3: Actualizar el unit test existente + agregar uno de persona**

`tests/ChatOmnicanal.Domain.Tests/BotEngine/SystemPromptBuilderTests.cs` (reemplazar el contenido completo):
```csharp
using ChatOmnicanal.Application.BotPersonas;
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Application.TenantProfiles;
using ChatOmnicanal.Infrastructure.BotEngine.Services;
using Xunit;

namespace ChatOmnicanal.Domain.Tests.BotEngine;

public class SystemPromptBuilderTests
{
    private readonly SystemPromptBuilder _builder = new();

    private static TenantProfileDto SampleProfile() => new(
        Id: Guid.NewGuid(),
        TenantId: Guid.NewGuid(),
        Address: "Av. Santa Fe 1234, CABA",
        Timezone: "America/Argentina/Buenos_Aires",
        ContactPhone: "+54 11 5555-5555",
        ContactEmail: "contacto@mitienda.com",
        Tone: "cordial y directo",
        BusinessHoursJson: "Lunes a Viernes de 9 a 18 hs",
        ShippingInfo: "Envíos a todo el país vía Andreani",
        PaymentMethods: "Efectivo, Transferencia y Tarjetas",
        CreatedAt: DateTime.UtcNow,
        UpdatedAt: DateTime.UtcNow,
        Rubro: "Pastelería",
        Description: "Tortas por encargo");

    [Fact]
    public void BuildSystemPrompt_Includes_TenantName_And_ProfileData()
    {
        var chunks = new List<KnowledgeSearchResult>
        {
            new(Guid.NewGuid(), Guid.NewGuid(), "Política de cambios: 30 días con ticket.", 0.85)
        };

        var prompt = _builder.BuildSystemPrompt("Mi Tienda SaaS", SampleProfile(), persona: null, chunks);

        Assert.Contains("Mi Tienda SaaS", prompt);
        Assert.Contains("Av. Santa Fe 1234", prompt);
        Assert.Contains("Envíos a todo el país", prompt);
        Assert.Contains("Efectivo, Transferencia", prompt);
        Assert.Contains("Política de cambios: 30 días", prompt);
        Assert.Contains("[HANDOFF]", prompt);
        Assert.Contains("Pastelería", prompt);       // identidad (fase 3a/3b)
        Assert.Contains("Tortas por encargo", prompt);
    }

    [Fact]
    public void BuildSystemPrompt_UsesPersona_NameToneAndHandoffTriggers()
    {
        var persona = new BotPersonaDto(
            Id: Guid.NewGuid(), TenantId: Guid.NewGuid(),
            Name: "Dulce", Tone: "canchero", Greeting: "¡Buenas! Soy Dulce.",
            NeverRules: "No inventar precios.",
            HandoffOnComplaint: true, HandoffOnRequest: true, HandoffOnSpecial: false, HandoffOnPayment: false,
            HandoffNotifyTo: "+54 381", HandoffHours: "9 a 20", HandoffMessage: "Te paso con el equipo.");

        var prompt = _builder.BuildSystemPrompt("Dulce Tentación", SampleProfile(), persona,
            new List<KnowledgeSearchResult>());

        Assert.Contains("Dulce", prompt);                    // nombre del bot
        Assert.Contains("canchero", prompt);                 // tono de la persona
        Assert.Contains("No inventar precios", prompt);      // regla "nunca"
        Assert.Contains("reclamo", prompt);                  // trigger de handoff activo
        Assert.Contains("Te paso con el equipo", prompt);    // mensaje de handoff
    }
}
```

- [ ] **Step 4: Verificar los unit tests (rápido, sin Docker)**

Run: `dotnet test tests/ChatOmnicanal.Domain.Tests --filter "FullyQualifiedName~SystemPromptBuilderTests"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ChatOmnicanal.Application/BotEngine/ISystemPromptBuilder.cs src/ChatOmnicanal.Infrastructure/BotEngine/Services/SystemPromptBuilder.cs tests/ChatOmnicanal.Domain.Tests/BotEngine/SystemPromptBuilderTests.cs
git commit -m "feat(api): system prompt incorpora persona + identidad del negocio (fase 3b)"
```

---

## Task 2: Cablear `BotEngineService` para cargar y pasar la persona

**Files:**
- Modify: `src/ChatOmnicanal.Infrastructure/BotEngine/Services/BotEngineService.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/API/BotSimulatePersonaTests.cs`

- [ ] **Step 1: Inyectar `IBotPersonaService` y pasar la persona al builder**

En `BotEngineService.cs`:
1. Agregar el `using`:
```csharp
using ChatOmnicanal.Application.BotPersonas;
```
2. Agregar el campo y el parámetro al constructor (junto a los existentes):
```csharp
    private readonly IBotPersonaService _personaService;
```
En el ctor, agregar el parámetro `IBotPersonaService personaService` y la asignación `_personaService = personaService;`.
3. En `ProcessMessageAsync`, después de obtener `profile` (paso "2. Obtener Tenant & Perfil") y antes de construir el prompt, cargar la persona:
```csharp
        var persona = await _personaService.GetAsync(request.TenantId, ct);
```
4. Cambiar la llamada al builder (línea ~65) para pasar la persona:
```csharp
        var systemPrompt = _promptBuilder.BuildSystemPrompt(tenant.Name, profile, persona, ragChunks);
```

- [ ] **Step 2: Verificar que compila**

Run: `dotnet build` (si falla por DLLs bloqueados, frenar la API como arriba y reintentar).
Expected: PASS.

- [ ] **Step 3: Test de integración — la persona configurada se usa**

`tests/ChatOmnicanal.Integration.Tests/API/BotSimulatePersonaTests.cs`:
```csharp
using System.Net;
using System.Net.Http.Json;
using ChatOmnicanal.Application.BotPersonas;
using ChatOmnicanal.Integration.Tests.Infrastructure;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.API;

public class BotSimulatePersonaTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public BotSimulatePersonaTests(DatabaseFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Simulate_Works_WithPersonaConfigured()
    {
        var (user, _) = await _fixture.SeedUserWithTenantAsync();
        var client = _fixture.CreateAuthenticatedClient(user.ClerkId);

        // Configurar persona (dispara proyección internamente; no debe romper el pipeline).
        var put = await client.PutAsJsonAsync("/api/bot-persona", new UpsertBotPersonaRequest(
            Name: "Dulce", Tone: "cercano", Greeting: "¡Hola!", NeverRules: "No inventar precios.",
            HandoffOnComplaint: true, HandoffOnRequest: true, HandoffOnSpecial: false, HandoffOnPayment: false,
            HandoffNotifyTo: "+54 381", HandoffHours: "9 a 20", HandoffMessage: "Te paso con el equipo."));
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        // El simulador responde sin errores con la persona cargada.
        var resp = await client.PostAsJsonAsync("/api/bot/simulate",
            new ChatOmnicanal.API.Controllers.SimulateChatRequest("¿Qué horarios tienen?", null));
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }
}
```

- [ ] **Step 4: Verificar**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~BotSimulatePersonaTests"`
Expected: PASS. (Usa `TestLlmProvider`/`TestEmbeddingService` del fixture.)

- [ ] **Step 5: Commit**

```bash
git add src/ChatOmnicanal.Infrastructure/BotEngine/Services/BotEngineService.cs tests/ChatOmnicanal.Integration.Tests/API/BotSimulatePersonaTests.cs
git commit -m "feat(api): BotEngineService carga la persona y la pasa al prompt (fase 3b)"
```

---

## Task 3: Verificación final

- [ ] **Step 1: Suite completa**

Run: `dotnet test`
Expected: PASS — los 119 previos + los nuevos de fase 3b, todo verde. En rojo: corregir y re-correr; no cerrar en rojo.

---

## Self-review (cobertura vs spec)

- **Inyección de persona/identidad al system prompt** → Task 1 (builder) + Task 2 (wiring). ✅
- **Reparto prompt vs RAG**: identidad/persona/handoff al prompt; catálogo/FAQ/pagos/envíos siguen por RAG (sin cambios). ✅
- **Compatibilidad**: el test unit existente se actualiza a la nueva firma (persona null) y sigue validando el comportamiento previo (nombre, dirección, envíos, pagos, [HANDOFF]). ✅
- **Sin construcción manual de `BotEngineService`** fuera de DI → el nuevo parámetro se resuelve solo (IBotPersonaService registrado en 3a). ✅
- **Type consistency**: `BuildSystemPrompt(tenantName, profile, persona, ragChunks)` usado igual en interfaz, impl, builder-tests y `BotEngineService`. ✅
