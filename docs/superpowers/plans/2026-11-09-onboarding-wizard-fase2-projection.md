# Onboarding Wizard — Fase 2: KnowledgeProjectionService + integración RAG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Proyectar los datos estructurados del negocio (perfil, política comercial, persona, catálogo, FAQ) a chunks categorizados del RAG (`Source="config"`), regenerándolos de forma determinista, para que el bot los recupere por similitud.

**Architecture:** Un proyector **puro** (`ConfigChunkProjector`, en Application) convierte entidades → `ProjectedChunk {Category,Title,Content,Tags}` (replica la función `chunks()` del prototipo). Un servicio de **orquestación** (`KnowledgeProjectionService`, en Infrastructure) carga las entidades, borra los chunks `Source="config"` del tenant, embebe los nuevos (batch) y los inserta bajo un `KnowledgeDoc` tipo `config`. La recuperación RAG existente (`KnowledgeService.SearchSimilarChunksAsync`) ya trata esos chunks como cualquier otro, así que la integración con el bot se da por retrieval (se verifica con test). La inyección al system prompt de identidad/persona se difiere a la Fase 3.

**Tech Stack:** .NET 8, EF Core 8 + Npgsql + pgvector, System.Text.Json, xUnit + Testcontainers.

**Referencia:** spec `docs/superpowers/specs/2026-11-09-onboarding-wizard-pentabot-design.md`. Repo de trabajo: `apps/api` (ya en rama `feat/onboarding-wizard`). Correr todo desde `apps/api`. No commitear `appsettings.Development.json`.

**Convenciones confirmadas:**
- `IEmbeddingService` (namespace `ChatOmnicanal.Infrastructure.BotEngine.Providers`): `Task<List<float[]>> GenerateEmbeddingsBatchAsync(IEnumerable<string>, CancellationToken)`.
- `KnowledgeChunk`: `TenantId, DocId (FK obligatorio a KnowledgeDoc), Content, ChunkIndex, Embedding (Pgvector.Vector?), Source, Category, UpdatedAt`.
- `BusinessHoursJson`: objeto JSON `{ "monday": {"open":"09:00","close":"18:00"}, "tuesday": null, ... }` (día cerrado = `null`).
- `CommercialPolicy.PaymentMethods`: string JSON array (ej. `["Efectivo","Transferencia"]`).
- DI en `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs` (bloque "Phase 3 — Bot Engine").
- Tests: unit puros van en `tests/ChatOmnicanal.Integration.Tests` sin `DatabaseFixture`; los de DB usan `IClassFixture<DatabaseFixture>` + `TestEmbeddingService` (vector fake 1536, `[0]=1`).

---

## Task 1: `ProjectedChunk` + `ConfigChunkProjector` (lógica pura)

**Files:**
- Create: `src/ChatOmnicanal.Application/Knowledge/ProjectedChunk.cs`
- Create: `src/ChatOmnicanal.Application/Knowledge/ConfigChunkProjector.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/Knowledge/ConfigChunkProjectorTests.cs`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/ChatOmnicanal.Integration.Tests/Knowledge/ConfigChunkProjectorTests.cs`:
```csharp
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Domain.Entities;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.Knowledge;

public class ConfigChunkProjectorTests
{
    private static (TenantProfile, CommercialPolicy, BotPersona, List<CatalogItem>, List<Faq>) FullSample()
    {
        var profile = new TenantProfile
        {
            Rubro = "Pastelería",
            Description = "Tortas por encargo",
            Zone = "Yerba Buena",
            SocialHandle = "@dulce",
            Address = "Av. Aconquija 1450",
            DirectionsNote = "Frente a la plaza",
            HolidaysNote = "Feriados cerramos",
            BusinessHoursJson = "{\"monday\":{\"open\":\"09:00\",\"close\":\"18:00\"},\"tuesday\":null}"
        };
        var policy = new CommercialPolicy
        {
            PaymentMethods = "[\"Efectivo\",\"Transferencia\"]",
            Installments = "Hasta 3 cuotas",
            Promo = "10% en efectivo",
            DeliveryMode = "ambos",
            DeliveryZones = "Yerba Buena",
            DeliveryCost = "Desde $2500",
            DeliveryTime = "48 horas",
            PickupInfo = "Retiro gratis en el local"
        };
        var persona = new BotPersona
        {
            Name = "Dulce", Tone = "cercano", Greeting = "¡Hola! Soy Dulce.",
            NeverRules = "No inventar precios.",
            HandoffOnComplaint = true, HandoffOnRequest = true,
            HandoffNotifyTo = "+54 9 381 555 0000", HandoffHours = "Lun a Sab 9 a 20",
            HandoffMessage = "Te paso con una persona."
        };
        var catalog = new List<CatalogItem>
        {
            new() { Name = "Torta de chocolate", Description = "12 porciones", Price = "28000", Order = 0 }
        };
        var faqs = new List<Faq>
        {
            new() { Question = "¿Hacen tortas personalizadas?", Answer = "Sí, con 48 horas.", Order = 0 },
            new() { Question = "¿Sin TACC?", Answer = "", Order = 1 } // sin respuesta: no genera chunk
        };
        return (profile, policy, persona, catalog, faqs);
    }

    [Fact]
    public void Build_GeneratesExpectedCategories()
    {
        var (profile, policy, persona, catalog, faqs) = FullSample();
        var chunks = ConfigChunkProjector.Build("Dulce Tentación", profile, policy, persona, catalog, faqs);

        var cats = chunks.Select(c => c.Category).ToHashSet();
        Assert.Contains("Negocio", cats);
        Assert.Contains("Horarios", cats);
        Assert.Contains("Ubicacion", cats);
        Assert.Contains("Productos", cats);
        Assert.Contains("Pagos", cats);
        Assert.Contains("Entregas", cats);
        Assert.Contains("FAQ", cats);
        Assert.Contains("Estilo", cats);
        Assert.Contains("Handoff", cats);
    }

    [Fact]
    public void Build_ProductChunk_IncludesNameAndPrice()
    {
        var (profile, policy, persona, catalog, faqs) = FullSample();
        var chunks = ConfigChunkProjector.Build("Dulce Tentación", profile, policy, persona, catalog, faqs);
        var product = Assert.Single(chunks, c => c.Category == "Productos");
        Assert.Contains("Torta de chocolate", product.Content);
        Assert.Contains("28000", product.Content);
    }

    [Fact]
    public void Build_SkipsFaqWithoutAnswer()
    {
        var (profile, policy, persona, catalog, faqs) = FullSample();
        var chunks = ConfigChunkProjector.Build("Dulce Tentación", profile, policy, persona, catalog, faqs);
        var faqChunks = chunks.Where(c => c.Category == "FAQ").ToList();
        Assert.Single(faqChunks);
        Assert.Contains("personalizadas", faqChunks[0].Title);
    }

    [Fact]
    public void Build_EmptyData_ReturnsNoChunks()
    {
        var chunks = ConfigChunkProjector.Build("Negocio X",
            new TenantProfile { BusinessHoursJson = "{}" }, null, null,
            new List<CatalogItem>(), new List<Faq>());
        Assert.Empty(chunks);
    }
}
```

- [ ] **Step 2: Verificar que falla (no compila: faltan tipos)**

Run: `dotnet build tests/ChatOmnicanal.Integration.Tests`
Expected: FAIL — no existen `ProjectedChunk` ni `ConfigChunkProjector`.

- [ ] **Step 3: Crear el record `ProjectedChunk`**

`src/ChatOmnicanal.Application/Knowledge/ProjectedChunk.cs`:
```csharp
namespace ChatOmnicanal.Application.Knowledge;

public record ProjectedChunk(string Category, string Title, string Content, IReadOnlyList<string> Tags);
```

- [ ] **Step 4: Implementar `ConfigChunkProjector`**

`src/ChatOmnicanal.Application/Knowledge/ConfigChunkProjector.cs`:
```csharp
using System.Text;
using System.Text.Json;
using ChatOmnicanal.Domain.Entities;

namespace ChatOmnicanal.Application.Knowledge;

/// <summary>
/// Convierte los datos estructurados del negocio en chunks categorizados para el RAG.
/// Lógica pura y determinista (sin I/O): replica la "memoria del bot" del prototipo de alta.
/// </summary>
public static class ConfigChunkProjector
{
    private static readonly (string Key, string Label)[] Days =
    {
        ("monday", "Lunes"), ("tuesday", "Martes"), ("wednesday", "Miércoles"),
        ("thursday", "Jueves"), ("friday", "Viernes"), ("saturday", "Sábado"), ("sunday", "Domingo")
    };

    public static IReadOnlyList<ProjectedChunk> Build(
        string businessName,
        TenantProfile profile,
        CommercialPolicy? policy,
        BotPersona? persona,
        IReadOnlyList<CatalogItem> catalog,
        IReadOnlyList<Faq> faqs)
    {
        var chunks = new List<ProjectedChunk>();

        // Negocio
        if (!string.IsNullOrWhiteSpace(businessName) || Has(profile.Description))
        {
            var sb = new StringBuilder();
            sb.Append(businessName);
            if (Has(profile.Rubro)) sb.Append(" es ").Append(profile.Rubro!.ToLowerInvariant()).Append('.');
            else sb.Append('.');
            if (Has(profile.Description)) sb.Append(' ').Append(profile.Description);
            if (Has(profile.Zone)) sb.Append(" Zona: ").Append(profile.Zone).Append('.');
            if (Has(profile.SocialHandle)) sb.Append(" Instagram: ").Append(profile.SocialHandle).Append('.');
            chunks.Add(new ProjectedChunk("Negocio", $"Qué es {businessName}", sb.ToString().Trim(),
                new[] { "negocio", "quienes", "somos", "que", "hacen", "venden" }));
        }

        // Horarios
        var hours = RenderHours(profile.BusinessHoursJson);
        if (Has(hours))
        {
            var text = Has(profile.HolidaysNote) ? $"{hours} {profile.HolidaysNote}" : hours;
            chunks.Add(new ProjectedChunk("Horarios", "Días y horarios de atención", text,
                new[] { "horario", "horarios", "abren", "cierran", "hora", "dias", "abierto", "feriado", "atencion" }));
        }

        // Ubicacion
        var ubic = string.Join(". ", new[] { profile.Address, profile.DirectionsNote, profile.Zone }
            .Where(Has).Select(x => x!.Trim().TrimEnd('.')));
        if (Has(ubic))
            chunks.Add(new ProjectedChunk("Ubicacion", "Dónde estamos", ubic + ".",
                new[] { "donde", "direccion", "ubicacion", "quedan", "llegar", "local", "lugar" }));

        // Productos (uno por item con nombre)
        foreach (var it in catalog.Where(i => Has(i.Name)))
        {
            var sb = new StringBuilder(it.Name!.Trim()).Append('.');
            if (Has(it.Description)) sb.Append(' ').Append(it.Description);
            if (Has(it.Price)) sb.Append(" Precio: ").Append(it.Price).Append('.');
            chunks.Add(new ProjectedChunk("Productos", it.Name!.Trim(), sb.ToString(),
                new[] { "precio", "sale", "cuesta", "valor", "cuanto", "producto" }));
        }

        // Pagos
        if (policy is not null && (Has(policy.PaymentMethods) || Has(policy.Installments) || Has(policy.Promo)))
        {
            var sb = new StringBuilder();
            var methods = ParseJsonArray(policy.PaymentMethods);
            if (methods.Count > 0) sb.Append("Aceptamos: ").Append(string.Join(", ", methods)).Append(". ");
            if (Has(policy.Installments)) sb.Append(policy.Installments).Append(". ");
            if (Has(policy.Promo)) sb.Append(policy.Promo);
            chunks.Add(new ProjectedChunk("Pagos", "Medios de pago", sb.ToString().Trim(),
                new[] { "pago", "pagar", "pagos", "tarjeta", "transferencia", "efectivo", "cuotas", "descuento", "promo" }));
        }

        // Entregas
        if (policy is not null && Has(policy.DeliveryMode))
        {
            string text = policy.DeliveryMode switch
            {
                "retiro" => $"Solo retiro en el local. {policy.PickupInfo}".Trim(),
                "envio" => $"Hacemos envíos. Zonas: {policy.DeliveryZones}. Costo: {policy.DeliveryCost}. Plazo: {policy.DeliveryTime}.",
                "ambos" => $"Hacemos envíos. Zonas: {policy.DeliveryZones}. Costo: {policy.DeliveryCost}. Plazo: {policy.DeliveryTime}. {policy.PickupInfo}".Trim(),
                "ninguno" => "No hacemos envíos ni retiros de productos.",
                _ => ""
            };
            if (Has(text))
                chunks.Add(new ProjectedChunk("Entregas", "Envíos y retiro", text,
                    new[] { "envio", "envios", "enviar", "delivery", "domicilio", "retiro", "retirar", "entrega" }));
        }

        // FAQ (una por pregunta con respuesta)
        foreach (var f in faqs.Where(f => Has(f.Answer) && Has(f.Question)))
            chunks.Add(new ProjectedChunk("FAQ", f.Question!.Trim(), f.Answer!.Trim(), Array.Empty<string>()));

        // Estilo del bot
        if (persona is not null && (Has(persona.Name) || Has(persona.Greeting)))
        {
            var sb = new StringBuilder($"Nombre: {persona.Name ?? "sin definir"}. Tono: {persona.Tone ?? "sin definir"}.");
            if (Has(persona.Greeting)) sb.Append(" Saludo: ").Append(persona.Greeting);
            if (Has(persona.NeverRules)) sb.Append(" Reglas: ").Append(persona.NeverRules!.Replace("\n", " "));
            chunks.Add(new ProjectedChunk("Estilo", $"Cómo habla {persona.Name ?? "el bot"}", sb.ToString(),
                new[] { "saludo", "hola", "buenas" }));
        }

        // Handoff / pase a persona
        if (persona is not null)
        {
            var triggers = new List<string>();
            if (persona.HandoffOnComplaint) triggers.Add("el cliente tiene un reclamo");
            if (persona.HandoffOnRequest) triggers.Add("el cliente pide hablar con una persona");
            if (persona.HandoffOnSpecial) triggers.Add("es un pedido especial o a medida");
            if (persona.HandoffOnPayment) triggers.Add("hay dudas con un pago");
            if (triggers.Count > 0 || Has(persona.HandoffNotifyTo))
            {
                var text = $"Pasa a una persona cuando: {string.Join("; ", triggers)}. " +
                           $"Se avisa a: {persona.HandoffNotifyTo}. Atención humana: {persona.HandoffHours}. " +
                           $"Mensaje: {persona.HandoffMessage}";
                chunks.Add(new ProjectedChunk("Handoff", "Cuándo pasa a una persona", text,
                    new[] { "persona", "humano", "agente", "reclamo", "hablar" }));
            }
        }

        return chunks;
    }

    private static bool Has(string? s) => !string.IsNullOrWhiteSpace(s);

    private static List<string> ParseJsonArray(string? json)
    {
        if (!Has(json)) return new List<string>();
        try
        {
            var arr = JsonSerializer.Deserialize<List<string>>(json!);
            return arr ?? new List<string>();
        }
        catch { return new List<string>(); }
    }

    private static string RenderHours(string? businessHoursJson)
    {
        if (!Has(businessHoursJson)) return "";
        List<string> parts = new();
        try
        {
            using var doc = JsonDocument.Parse(businessHoursJson!);
            var root = doc.RootElement;
            foreach (var (key, label) in Days)
            {
                if (root.TryGetProperty(key, out var day) && day.ValueKind == JsonValueKind.Object)
                {
                    var open = day.TryGetProperty("open", out var o) ? o.GetString() : null;
                    var close = day.TryGetProperty("close", out var c) ? c.GetString() : null;
                    if (Has(open) && Has(close))
                        parts.Add($"{label}: de {open} a {close} hs");
                }
            }
        }
        catch { return ""; }
        return parts.Count == 0 ? "" : string.Join(". ", parts) + ".";
    }
}
```

- [ ] **Step 5: Verificar que pasan**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~ConfigChunkProjectorTests"`
Expected: PASS (4 tests). No requiere Docker (no toca DB).

- [ ] **Step 6: Commit**

```bash
git add src/ChatOmnicanal.Application/Knowledge/ProjectedChunk.cs src/ChatOmnicanal.Application/Knowledge/ConfigChunkProjector.cs tests/ChatOmnicanal.Integration.Tests/Knowledge/ConfigChunkProjectorTests.cs
git commit -m "feat(api): ConfigChunkProjector — datos estructurados a chunks categorizados (fase 2)"
```

---

## Task 2: `KnowledgeProjectionService` (orquestación: persistir + embeber)

**Files:**
- Create: `src/ChatOmnicanal.Application/Knowledge/IKnowledgeProjectionService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/BotEngine/Services/KnowledgeProjectionService.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`

- [ ] **Step 1: Crear la interfaz**

`src/ChatOmnicanal.Application/Knowledge/IKnowledgeProjectionService.cs`:
```csharp
namespace ChatOmnicanal.Application.Knowledge;

public interface IKnowledgeProjectionService
{
    /// <summary>Regenera los chunks Source="config" del tenant a partir de sus datos estructurados.</summary>
    Task RebuildConfigChunksAsync(Guid tenantId, CancellationToken ct = default);
}
```

- [ ] **Step 2: Implementar el servicio**

`src/ChatOmnicanal.Infrastructure/BotEngine/Services/KnowledgeProjectionService.cs`:
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Infrastructure.BotEngine.Providers;
using Microsoft.EntityFrameworkCore;
using Pgvector;

namespace ChatOmnicanal.Infrastructure.BotEngine.Services;

public class KnowledgeProjectionService : IKnowledgeProjectionService
{
    private const string ConfigSource = "config";
    private const string ConfigDocType = "config";

    private readonly IApplicationDbContext _db;
    private readonly IEmbeddingService _embeddingService;

    public KnowledgeProjectionService(IApplicationDbContext db, IEmbeddingService embeddingService)
    {
        _db = db;
        _embeddingService = embeddingService;
    }

    public async Task RebuildConfigChunksAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant is null) return;

        var profile = await _db.TenantProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.TenantId == tenantId, ct)
                      ?? new TenantProfile { TenantId = tenantId, BusinessHoursJson = "{}" };
        var policy = await _db.CommercialPolicies.AsNoTracking().FirstOrDefaultAsync(p => p.TenantId == tenantId, ct);
        var persona = await _db.BotPersonas.AsNoTracking().FirstOrDefaultAsync(p => p.TenantId == tenantId, ct);
        var catalog = await _db.CatalogItems.AsNoTracking().Where(c => c.TenantId == tenantId).OrderBy(c => c.Order).ToListAsync(ct);
        var faqs = await _db.Faqs.AsNoTracking().Where(f => f.TenantId == tenantId).OrderBy(f => f.Order).ToListAsync(ct);

        var projected = ConfigChunkProjector.Build(tenant.Name, profile, policy, persona, catalog, faqs);

        // Borrar chunks de config previos del tenant.
        var oldChunks = _db.KnowledgeChunks.Where(c => c.TenantId == tenantId && c.Source == ConfigSource);
        _db.KnowledgeChunks.RemoveRange(oldChunks);

        // Asegurar el doc "config" del tenant.
        var doc = await _db.KnowledgeDocs.FirstOrDefaultAsync(d => d.TenantId == tenantId && d.Type == ConfigDocType, ct);
        if (doc is null)
        {
            doc = new KnowledgeDoc { TenantId = tenantId, Name = "Configuración del negocio", Type = ConfigDocType, Status = "ready" };
            _db.KnowledgeDocs.Add(doc);
        }
        doc.Status = "ready";
        doc.UpdatedAt = DateTime.UtcNow;

        if (projected.Count > 0)
        {
            var contents = projected.Select(p => $"{p.Title}\n{p.Content}").ToList();
            var embeddings = await _embeddingService.GenerateEmbeddingsBatchAsync(contents, ct);
            for (int i = 0; i < projected.Count; i++)
            {
                _db.KnowledgeChunks.Add(new KnowledgeChunk
                {
                    TenantId = tenantId,
                    DocId = doc.Id,
                    ChunkIndex = i,
                    Content = projected[i].Content,
                    Source = ConfigSource,
                    Category = projected[i].Category,
                    Embedding = new Vector(embeddings[i]),
                    UpdatedAt = DateTime.UtcNow
                });
            }
        }

        await _db.SaveChangesAsync(ct);
    }
}
```

- [ ] **Step 3: Registrar en DI**

En `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`, dentro del bloque "Phase 3 — Bot Engine" (después de la línea de `IKnowledgeService`), agregar:
```csharp
        services.AddScoped<ChatOmnicanal.Application.Knowledge.IKnowledgeProjectionService, BotEngine.Services.KnowledgeProjectionService>();
```

- [ ] **Step 4: Verificar que compila**

Run: `dotnet build`
Expected: PASS (si la API está corriendo y bloquea DLLs, primero `Get-Process -Name ChatOmnicanal.API -ErrorAction SilentlyContinue | Stop-Process -Force`).

- [ ] **Step 5: Commit**

```bash
git add src/ChatOmnicanal.Application/Knowledge/IKnowledgeProjectionService.cs src/ChatOmnicanal.Infrastructure/BotEngine/Services/KnowledgeProjectionService.cs src/ChatOmnicanal.Infrastructure/DependencyInjection.cs
git commit -m "feat(api): KnowledgeProjectionService — persiste chunks config con embeddings (fase 2)"
```

---

## Task 3: Test de integración — persistencia, regeneración y aislamiento

**Files:**
- Test: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/KnowledgeProjectionServiceTests.cs`

- [ ] **Step 1: Escribir el test que falla**

`tests/ChatOmnicanal.Integration.Tests/Infrastructure/KnowledgeProjectionServiceTests.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Infrastructure.BotEngine.Services;
using ChatOmnicanal.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.Infrastructure;

public class KnowledgeProjectionServiceTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public KnowledgeProjectionServiceTests(DatabaseFixture fixture) => _fixture = fixture;

    private KnowledgeProjectionService NewService(ApplicationDbContext db) =>
        new(db, new TestEmbeddingService());

    [Fact]
    public async Task Rebuild_CreatesConfigChunks_AndIsIdempotent()
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var tenant = new Tenant { Name = "Proyección Tenant" };
        db.Tenants.Add(tenant);
        db.TenantProfiles.Add(new TenantProfile { TenantId = tenant.Id, Rubro = "Pastelería", Description = "Tortas", BusinessHoursJson = "{}" });
        db.CatalogItems.Add(new CatalogItem { TenantId = tenant.Id, Name = "Torta", Price = "28000", Order = 0 });
        await db.SaveChangesAsync();

        var svc = NewService(db);
        await svc.RebuildConfigChunksAsync(tenant.Id);

        var first = await db.KnowledgeChunks.AsNoTracking()
            .Where(c => c.TenantId == tenant.Id && c.Source == "config").ToListAsync();
        Assert.Contains(first, c => c.Category == "Negocio");
        Assert.Contains(first, c => c.Category == "Productos");
        var countFirst = first.Count;

        // Regenerar no duplica.
        await svc.RebuildConfigChunksAsync(tenant.Id);
        var second = await db.KnowledgeChunks.AsNoTracking()
            .CountAsync(c => c.TenantId == tenant.Id && c.Source == "config");
        Assert.Equal(countFirst, second);
    }

    [Fact]
    public async Task Rebuild_DoesNotTouch_UploadedChunks_NorOtherTenants()
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var t1 = new Tenant { Name = "T1" };
        var t2 = new Tenant { Name = "T2" };
        db.Tenants.AddRange(t1, t2);
        db.TenantProfiles.Add(new TenantProfile { TenantId = t1.Id, Description = "Algo", BusinessHoursJson = "{}" });

        // chunk de archivo (upload) preexistente en t1: NO debe borrarse.
        var upDoc = new KnowledgeDoc { TenantId = t1.Id, Name = "manual.pdf", Type = "application/pdf", Status = "ready" };
        db.KnowledgeDocs.Add(upDoc);
        await db.SaveChangesAsync();
        db.KnowledgeChunks.Add(new KnowledgeChunk { TenantId = t1.Id, DocId = upDoc.Id, Content = "de archivo", Source = "archivo", UpdatedAt = DateTime.UtcNow });

        // config de t2: NO debe aparecer en t1.
        db.TenantProfiles.Add(new TenantProfile { TenantId = t2.Id, Description = "Otro negocio", BusinessHoursJson = "{}" });
        await db.SaveChangesAsync();

        var svc = NewService(db);
        await svc.RebuildConfigChunksAsync(t1.Id);

        var t1Upload = await db.KnowledgeChunks.AsNoTracking()
            .CountAsync(c => c.TenantId == t1.Id && c.Source == "archivo");
        Assert.Equal(1, t1Upload); // el upload sigue intacto

        var t2Config = await db.KnowledgeChunks.AsNoTracking()
            .CountAsync(c => c.TenantId == t2.Id && c.Source == "config");
        Assert.Equal(0, t2Config); // no se tocó t2
    }
}
```

- [ ] **Step 2: Verificar que falla, luego pasa**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~KnowledgeProjectionServiceTests"`
Expected: PASS (2 tests). Requiere Docker.

- [ ] **Step 3: Commit**

```bash
git add tests/ChatOmnicanal.Integration.Tests/Infrastructure/KnowledgeProjectionServiceTests.cs
git commit -m "test(api): KnowledgeProjectionService regeneración + aislamiento (fase 2)"
```

---

## Task 4: Test de integración RAG — el bot recupera los chunks de config

**Files:**
- Test: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/ConfigChunksRetrievalTests.cs`

> Objetivo: demostrar que, tras la proyección, `KnowledgeService.SearchSimilarChunksAsync` devuelve los chunks `config` (la integración con el bot se da por retrieval; no hace falta cambiar el pipeline). Con `TestEmbeddingService` todos los vectores son iguales, así que la búsqueda devuelve los chunks del tenant ordenados por distancia (todas 0) — alcanza para probar que los config chunks son recuperables y aislados por tenant.

- [ ] **Step 1: Escribir el test**

`tests/ChatOmnicanal.Integration.Tests/Infrastructure/ConfigChunksRetrievalTests.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Infrastructure.BotEngine.Services;
using ChatOmnicanal.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.Infrastructure;

public class ConfigChunksRetrievalTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public ConfigChunksRetrievalTests(DatabaseFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task ProjectedConfigChunks_AreRetrievableByKnowledgeService()
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var embedding = new TestEmbeddingService();

        var tenant = new Tenant { Name = "Retrieval Tenant" };
        db.Tenants.Add(tenant);
        db.TenantProfiles.Add(new TenantProfile { TenantId = tenant.Id, Rubro = "Pastelería", Description = "Tortas por encargo", BusinessHoursJson = "{}" });
        db.CatalogItems.Add(new CatalogItem { TenantId = tenant.Id, Name = "Cheesecake", Price = "24000", Order = 0 });
        await db.SaveChangesAsync();

        var projection = new KnowledgeProjectionService(db, embedding);
        await projection.RebuildConfigChunksAsync(tenant.Id);

        var knowledge = new KnowledgeService(db, embedding, Enumerable.Empty<ChatOmnicanal.Application.Knowledge.ITextExtractor>());
        var results = await knowledge.SearchSimilarChunksAsync(tenant.Id, "¿cuánto sale el cheesecake?", topK: 10, minSimilarity: 0.0);

        Assert.NotEmpty(results);
        Assert.Contains(results, r => r.Content.Contains("Cheesecake"));
    }
}
```

- [ ] **Step 2: Verificar que pasa**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~ConfigChunksRetrievalTests"`
Expected: PASS. Requiere Docker.

- [ ] **Step 3: Commit**

```bash
git add tests/ChatOmnicanal.Integration.Tests/Infrastructure/ConfigChunksRetrievalTests.cs
git commit -m "test(api): los chunks de config son recuperables por el RAG (fase 2)"
```

---

## Task 5: Verificación final de la fase

- [ ] **Step 1: Correr la suite completa**

Run: `dotnet test`
Expected: PASS — toda la suite en verde (los 106 previos + los nuevos de fase 2).

- [ ] **Step 2: (si algo falla) corregir y volver a correr** hasta verde. No avanzar con tests rojos.

---

## Self-review (cobertura vs spec)

- **`KnowledgeProjectionService` que regenera chunks categorizados al proyectar** → Tasks 1–3. ✅
- **Metadata source/category** → los chunks se crean con `Source="config"` + `Category` (Task 2). ✅
- **Re-indexado/regeneración determinista + no toca uploads ni otros tenants** → Task 3. ✅
- **Integración con el bot vía RAG** → Task 4 (retrieval). ✅
- **Reparto prompt vs RAG (inyección de identidad/persona al system prompt)** → **DIFERIDO a Fase 3** (requiere los DTOs/carga que traen los endpoints). Anotado aquí y en el spec. En Fase 2 todo el conocimiento es recuperable por RAG.
- **Type consistency:** `ProjectedChunk(Category,Title,Content,Tags)`, `IKnowledgeProjectionService.RebuildConfigChunksAsync`, `Source="config"`, `Category` usados igual en proyector, servicio y tests. ✅
- **DI:** `IKnowledgeProjectionService` → `KnowledgeProjectionService` (scoped), junto a los demás del Bot Engine. ✅
