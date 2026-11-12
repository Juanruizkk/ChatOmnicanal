# Onboarding Wizard — Fase 3a: API de configuración — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Exponer los endpoints que el wizard usa para cargar/editar cada sección (perfil, política comercial, persona del bot, catálogo, FAQ), disparando la regeneración de chunks de config al guardar, y un endpoint de preview de la "memoria del bot".

**Architecture:** Un servicio por sección (patrón de `TenantProfileService`: `Get`/`Upsert` para 1:1, `List/Create/Update/Delete` para 1:N), cada uno inyecta `IKnowledgeProjectionService` y llama `RebuildConfigChunksAsync(tenantId)` tras guardar. Controllers finos `[Authorize]` con `ICurrentTenantService`. El endpoint `GET /api/onboarding/memory` reutiliza el `ConfigChunkProjector` puro (sin DB de chunks ni embeddings) para devolver la memoria en vivo.

**Tech Stack:** .NET 8, EF Core 8, xUnit + Testcontainers.

**Referencia:** spec `docs/superpowers/specs/2026-11-09-onboarding-wizard-pentabot-design.md`. Repo: `apps/api`, rama `feat/onboarding-wizard` (fases 1–2 ya commiteadas). Correr todo desde `apps/api`. No commitear `appsettings.Development.json`. Si la API bloquea DLLs: `Get-Process -Name ChatOmnicanal.API -ErrorAction SilentlyContinue | Stop-Process -Force`.

**Contratos confirmados del repo:**
- Controller pattern (ver `TenantProfileController`): `[ApiController]`, `[Route("api/...")]`, `[Authorize]`, ctor con el service + `ICurrentTenantService _currentTenant`; en cada acción `if (!_currentTenant.IsAuthenticated) return Unauthorized();` y usar `_currentTenant.TenantId`.
- Service pattern (ver `TenantProfileService`): ctor `IApplicationDbContext _db`; `AsNoTracking()` en lecturas; `FirstOrDefaultAsync(x => x.TenantId == tenantId)` para 1:1.
- `IKnowledgeProjectionService.RebuildConfigChunksAsync(Guid tenantId, CancellationToken)` (Fase 2, ya registrado scoped).
- `ConfigChunkProjector.Build(string businessName, TenantProfile, CommercialPolicy?, BotPersona?, IReadOnlyList<CatalogItem>, IReadOnlyList<Faq>) -> IReadOnlyList<ProjectedChunk>` y `ProjectedChunk(Category,Title,Content,Tags)` en `ChatOmnicanal.Application.Knowledge`.
- Tests de controller (ver `BotSimulateControllerTests`): `var (user, tenant) = await _fixture.SeedUserWithTenantAsync(); var client = _fixture.CreateAuthenticatedClient(user.ClerkId);` y luego `client.PutAsJsonAsync(...)`. El `DatabaseFixture` ya inyecta `TestEmbeddingService`, así que la proyección al guardar usa embeddings fake (sin llamadas externas).
- DI en `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`.

---

## Task 1: CommercialPolicy — servicio + endpoint + proyección al guardar

**Files:**
- Create: `src/ChatOmnicanal.Application/CommercialPolicies/CommercialPolicyDto.cs`
- Create: `src/ChatOmnicanal.Application/CommercialPolicies/UpsertCommercialPolicyRequest.cs`
- Create: `src/ChatOmnicanal.Application/CommercialPolicies/ICommercialPolicyService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Config/CommercialPolicyService.cs`
- Create: `src/ChatOmnicanal.API/Controllers/CommercialPolicyController.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/API/CommercialPolicyControllerTests.cs`

- [ ] **Step 1: DTO + request + interfaz**

`CommercialPolicyDto.cs`:
```csharp
namespace ChatOmnicanal.Application.CommercialPolicies;

public record CommercialPolicyDto(
    Guid Id, Guid TenantId,
    string? PaymentMethods, string? Installments, string? Promo,
    string? DeliveryMode, string? DeliveryZones, string? DeliveryCost, string? DeliveryTime, string? PickupInfo);
```
`UpsertCommercialPolicyRequest.cs`:
```csharp
namespace ChatOmnicanal.Application.CommercialPolicies;

public record UpsertCommercialPolicyRequest(
    string? PaymentMethods, string? Installments, string? Promo,
    string? DeliveryMode, string? DeliveryZones, string? DeliveryCost, string? DeliveryTime, string? PickupInfo);
```
`ICommercialPolicyService.cs`:
```csharp
namespace ChatOmnicanal.Application.CommercialPolicies;

public interface ICommercialPolicyService
{
    Task<CommercialPolicyDto?> GetAsync(Guid tenantId, CancellationToken ct = default);
    Task<CommercialPolicyDto> UpsertAsync(Guid tenantId, UpsertCommercialPolicyRequest request, CancellationToken ct = default);
}
```

- [ ] **Step 2: Implementación del servicio (con proyección al guardar)**

`src/ChatOmnicanal.Infrastructure/Config/CommercialPolicyService.cs`:
```csharp
using ChatOmnicanal.Application.CommercialPolicies;
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Config;

public class CommercialPolicyService : ICommercialPolicyService
{
    private readonly IApplicationDbContext _db;
    private readonly IKnowledgeProjectionService _projection;

    public CommercialPolicyService(IApplicationDbContext db, IKnowledgeProjectionService projection)
    {
        _db = db;
        _projection = projection;
    }

    public async Task<CommercialPolicyDto?> GetAsync(Guid tenantId, CancellationToken ct = default)
    {
        var p = await _db.CommercialPolicies.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        return p is null ? null : Map(p);
    }

    public async Task<CommercialPolicyDto> UpsertAsync(Guid tenantId, UpsertCommercialPolicyRequest r, CancellationToken ct = default)
    {
        var p = await _db.CommercialPolicies.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (p is null)
        {
            p = new CommercialPolicy { TenantId = tenantId };
            _db.CommercialPolicies.Add(p);
        }
        p.PaymentMethods = r.PaymentMethods;
        p.Installments = r.Installments;
        p.Promo = r.Promo;
        p.DeliveryMode = r.DeliveryMode;
        p.DeliveryZones = r.DeliveryZones;
        p.DeliveryCost = r.DeliveryCost;
        p.DeliveryTime = r.DeliveryTime;
        p.PickupInfo = r.PickupInfo;
        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _projection.RebuildConfigChunksAsync(tenantId, ct);
        return Map(p);
    }

    private static CommercialPolicyDto Map(CommercialPolicy p) =>
        new(p.Id, p.TenantId, p.PaymentMethods, p.Installments, p.Promo,
            p.DeliveryMode, p.DeliveryZones, p.DeliveryCost, p.DeliveryTime, p.PickupInfo);
}
```

- [ ] **Step 3: Controller**

`src/ChatOmnicanal.API/Controllers/CommercialPolicyController.cs`:
```csharp
using ChatOmnicanal.Application.CommercialPolicies;
using ChatOmnicanal.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/commercial-policy")]
[Authorize]
public class CommercialPolicyController : ControllerBase
{
    private readonly ICommercialPolicyService _service;
    private readonly ICurrentTenantService _currentTenant;

    public CommercialPolicyController(ICommercialPolicyService service, ICurrentTenantService currentTenant)
    {
        _service = service;
        _currentTenant = currentTenant;
    }

    [HttpGet]
    public async Task<ActionResult<CommercialPolicyDto>> Get(CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        var dto = await _service.GetAsync(_currentTenant.TenantId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut]
    public async Task<ActionResult<CommercialPolicyDto>> Upsert([FromBody] UpsertCommercialPolicyRequest request, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        return Ok(await _service.UpsertAsync(_currentTenant.TenantId, request, ct));
    }
}
```

- [ ] **Step 4: Registrar en DI**

En `DependencyInjection.cs`, después del bloque "Phase 3 — Bot Engine", agregar:
```csharp
        // Onboarding config sections
        services.AddScoped<ChatOmnicanal.Application.CommercialPolicies.ICommercialPolicyService, Config.CommercialPolicyService>();
```

- [ ] **Step 5: Test de integración**

`tests/ChatOmnicanal.Integration.Tests/API/CommercialPolicyControllerTests.cs`:
```csharp
using System.Net;
using System.Net.Http.Json;
using ChatOmnicanal.Application.CommercialPolicies;
using ChatOmnicanal.Integration.Tests.Infrastructure;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.API;

public class CommercialPolicyControllerTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public CommercialPolicyControllerTests(DatabaseFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Put_Then_Get_RoundTrips()
    {
        var (user, _) = await _fixture.SeedUserWithTenantAsync();
        var client = _fixture.CreateAuthenticatedClient(user.ClerkId);

        var put = await client.PutAsJsonAsync("/api/commercial-policy", new UpsertCommercialPolicyRequest(
            PaymentMethods: "[\"Efectivo\"]", Installments: "3 cuotas", Promo: null,
            DeliveryMode: "ambos", DeliveryZones: "Centro", DeliveryCost: "$2500", DeliveryTime: "48h", PickupInfo: "Retiro gratis"));
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var get = await client.GetFromJsonAsync<CommercialPolicyDto>("/api/commercial-policy");
        Assert.NotNull(get);
        Assert.Equal("ambos", get!.DeliveryMode);
        Assert.Equal("Centro", get.DeliveryZones);
    }
}
```

- [ ] **Step 6: Verificar y commitear**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~CommercialPolicyControllerTests"` → PASS.
```bash
git add src/ChatOmnicanal.Application/CommercialPolicies/ src/ChatOmnicanal.Infrastructure/Config/CommercialPolicyService.cs src/ChatOmnicanal.API/Controllers/CommercialPolicyController.cs src/ChatOmnicanal.Infrastructure/DependencyInjection.cs tests/ChatOmnicanal.Integration.Tests/API/CommercialPolicyControllerTests.cs
git commit -m "feat(api): CommercialPolicy endpoint + proyección al guardar (fase 3a)"
```

---

## Task 2: BotPersona — servicio + endpoint + proyección

**Files:**
- Create: `src/ChatOmnicanal.Application/BotPersonas/BotPersonaDto.cs`
- Create: `src/ChatOmnicanal.Application/BotPersonas/UpsertBotPersonaRequest.cs`
- Create: `src/ChatOmnicanal.Application/BotPersonas/IBotPersonaService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Config/BotPersonaService.cs`
- Create: `src/ChatOmnicanal.API/Controllers/BotPersonaController.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/API/BotPersonaControllerTests.cs`

- [ ] **Step 1: DTO + request + interfaz**

`BotPersonaDto.cs`:
```csharp
namespace ChatOmnicanal.Application.BotPersonas;

public record BotPersonaDto(
    Guid Id, Guid TenantId,
    string? Name, string? Tone, string? Greeting, string? NeverRules,
    bool HandoffOnComplaint, bool HandoffOnRequest, bool HandoffOnSpecial, bool HandoffOnPayment,
    string? HandoffNotifyTo, string? HandoffHours, string? HandoffMessage);
```
`UpsertBotPersonaRequest.cs`:
```csharp
namespace ChatOmnicanal.Application.BotPersonas;

public record UpsertBotPersonaRequest(
    string? Name, string? Tone, string? Greeting, string? NeverRules,
    bool HandoffOnComplaint, bool HandoffOnRequest, bool HandoffOnSpecial, bool HandoffOnPayment,
    string? HandoffNotifyTo, string? HandoffHours, string? HandoffMessage);
```
`IBotPersonaService.cs`:
```csharp
namespace ChatOmnicanal.Application.BotPersonas;

public interface IBotPersonaService
{
    Task<BotPersonaDto?> GetAsync(Guid tenantId, CancellationToken ct = default);
    Task<BotPersonaDto> UpsertAsync(Guid tenantId, UpsertBotPersonaRequest request, CancellationToken ct = default);
}
```

- [ ] **Step 2: Servicio**

`src/ChatOmnicanal.Infrastructure/Config/BotPersonaService.cs`:
```csharp
using ChatOmnicanal.Application.BotPersonas;
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Config;

public class BotPersonaService : IBotPersonaService
{
    private readonly IApplicationDbContext _db;
    private readonly IKnowledgeProjectionService _projection;

    public BotPersonaService(IApplicationDbContext db, IKnowledgeProjectionService projection)
    {
        _db = db;
        _projection = projection;
    }

    public async Task<BotPersonaDto?> GetAsync(Guid tenantId, CancellationToken ct = default)
    {
        var p = await _db.BotPersonas.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        return p is null ? null : Map(p);
    }

    public async Task<BotPersonaDto> UpsertAsync(Guid tenantId, UpsertBotPersonaRequest r, CancellationToken ct = default)
    {
        var p = await _db.BotPersonas.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (p is null)
        {
            p = new BotPersona { TenantId = tenantId };
            _db.BotPersonas.Add(p);
        }
        p.Name = r.Name;
        p.Tone = r.Tone;
        p.Greeting = r.Greeting;
        p.NeverRules = r.NeverRules;
        p.HandoffOnComplaint = r.HandoffOnComplaint;
        p.HandoffOnRequest = r.HandoffOnRequest;
        p.HandoffOnSpecial = r.HandoffOnSpecial;
        p.HandoffOnPayment = r.HandoffOnPayment;
        p.HandoffNotifyTo = r.HandoffNotifyTo;
        p.HandoffHours = r.HandoffHours;
        p.HandoffMessage = r.HandoffMessage;
        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _projection.RebuildConfigChunksAsync(tenantId, ct);
        return Map(p);
    }

    private static BotPersonaDto Map(BotPersona p) =>
        new(p.Id, p.TenantId, p.Name, p.Tone, p.Greeting, p.NeverRules,
            p.HandoffOnComplaint, p.HandoffOnRequest, p.HandoffOnSpecial, p.HandoffOnPayment,
            p.HandoffNotifyTo, p.HandoffHours, p.HandoffMessage);
}
```

- [ ] **Step 3: Controller**

`src/ChatOmnicanal.API/Controllers/BotPersonaController.cs`:
```csharp
using ChatOmnicanal.Application.BotPersonas;
using ChatOmnicanal.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/bot-persona")]
[Authorize]
public class BotPersonaController : ControllerBase
{
    private readonly IBotPersonaService _service;
    private readonly ICurrentTenantService _currentTenant;

    public BotPersonaController(IBotPersonaService service, ICurrentTenantService currentTenant)
    {
        _service = service;
        _currentTenant = currentTenant;
    }

    [HttpGet]
    public async Task<ActionResult<BotPersonaDto>> Get(CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        var dto = await _service.GetAsync(_currentTenant.TenantId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut]
    public async Task<ActionResult<BotPersonaDto>> Upsert([FromBody] UpsertBotPersonaRequest request, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        return Ok(await _service.UpsertAsync(_currentTenant.TenantId, request, ct));
    }
}
```

- [ ] **Step 4: DI**

En `DependencyInjection.cs`, bloque "Onboarding config sections", agregar:
```csharp
        services.AddScoped<ChatOmnicanal.Application.BotPersonas.IBotPersonaService, Config.BotPersonaService>();
```

- [ ] **Step 5: Test**

`tests/ChatOmnicanal.Integration.Tests/API/BotPersonaControllerTests.cs`:
```csharp
using System.Net;
using System.Net.Http.Json;
using ChatOmnicanal.Application.BotPersonas;
using ChatOmnicanal.Integration.Tests.Infrastructure;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.API;

public class BotPersonaControllerTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public BotPersonaControllerTests(DatabaseFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Put_Then_Get_RoundTrips()
    {
        var (user, _) = await _fixture.SeedUserWithTenantAsync();
        var client = _fixture.CreateAuthenticatedClient(user.ClerkId);

        var put = await client.PutAsJsonAsync("/api/bot-persona", new UpsertBotPersonaRequest(
            Name: "Dulce", Tone: "cercano", Greeting: "¡Hola!", NeverRules: "No inventar.",
            HandoffOnComplaint: true, HandoffOnRequest: true, HandoffOnSpecial: false, HandoffOnPayment: false,
            HandoffNotifyTo: "+54 381", HandoffHours: "9 a 20", HandoffMessage: "Te paso."));
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var get = await client.GetFromJsonAsync<BotPersonaDto>("/api/bot-persona");
        Assert.NotNull(get);
        Assert.Equal("Dulce", get!.Name);
        Assert.True(get.HandoffOnComplaint);
        Assert.False(get.HandoffOnSpecial);
    }
}
```

- [ ] **Step 6: Verificar y commitear**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~BotPersonaControllerTests"` → PASS.
```bash
git add src/ChatOmnicanal.Application/BotPersonas/ src/ChatOmnicanal.Infrastructure/Config/BotPersonaService.cs src/ChatOmnicanal.API/Controllers/BotPersonaController.cs src/ChatOmnicanal.Infrastructure/DependencyInjection.cs tests/ChatOmnicanal.Integration.Tests/API/BotPersonaControllerTests.cs
git commit -m "feat(api): BotPersona endpoint + proyección al guardar (fase 3a)"
```

---

## Task 3: Catalog — servicio CRUD + pegar lista + endpoint + proyección

**Files:**
- Create: `src/ChatOmnicanal.Application/Catalog/CatalogItemDto.cs`
- Create: `src/ChatOmnicanal.Application/Catalog/CatalogItemRequest.cs`
- Create: `src/ChatOmnicanal.Application/Catalog/ICatalogService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Config/CatalogService.cs`
- Create: `src/ChatOmnicanal.API/Controllers/CatalogController.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/API/CatalogControllerTests.cs`

- [ ] **Step 1: DTO + request + interfaz**

`CatalogItemDto.cs`:
```csharp
namespace ChatOmnicanal.Application.Catalog;

public record CatalogItemDto(Guid Id, string Name, string? Description, string? Price, int Order);
```
`CatalogItemRequest.cs`:
```csharp
namespace ChatOmnicanal.Application.Catalog;

public record CatalogItemRequest(string Name, string? Description, string? Price, int Order);

public record ParseListRequest(string Text);
```
`ICatalogService.cs`:
```csharp
namespace ChatOmnicanal.Application.Catalog;

public interface ICatalogService
{
    Task<List<CatalogItemDto>> ListAsync(Guid tenantId, CancellationToken ct = default);
    Task<CatalogItemDto> CreateAsync(Guid tenantId, CatalogItemRequest request, CancellationToken ct = default);
    Task<CatalogItemDto?> UpdateAsync(Guid tenantId, Guid id, CatalogItemRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken ct = default);
    Task<List<CatalogItemDto>> ParseListAsync(Guid tenantId, string text, CancellationToken ct = default);
}
```

- [ ] **Step 2: Servicio**

`src/ChatOmnicanal.Infrastructure/Config/CatalogService.cs`:
```csharp
using ChatOmnicanal.Application.Catalog;
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Config;

public class CatalogService : ICatalogService
{
    private readonly IApplicationDbContext _db;
    private readonly IKnowledgeProjectionService _projection;

    public CatalogService(IApplicationDbContext db, IKnowledgeProjectionService projection)
    {
        _db = db;
        _projection = projection;
    }

    public async Task<List<CatalogItemDto>> ListAsync(Guid tenantId, CancellationToken ct = default) =>
        await _db.CatalogItems.AsNoTracking()
            .Where(c => c.TenantId == tenantId).OrderBy(c => c.Order)
            .Select(c => new CatalogItemDto(c.Id, c.Name, c.Description, c.Price, c.Order))
            .ToListAsync(ct);

    public async Task<CatalogItemDto> CreateAsync(Guid tenantId, CatalogItemRequest r, CancellationToken ct = default)
    {
        var item = new CatalogItem { TenantId = tenantId, Name = r.Name, Description = r.Description, Price = r.Price, Order = r.Order };
        _db.CatalogItems.Add(item);
        await _db.SaveChangesAsync(ct);
        await _projection.RebuildConfigChunksAsync(tenantId, ct);
        return new CatalogItemDto(item.Id, item.Name, item.Description, item.Price, item.Order);
    }

    public async Task<CatalogItemDto?> UpdateAsync(Guid tenantId, Guid id, CatalogItemRequest r, CancellationToken ct = default)
    {
        var item = await _db.CatalogItems.FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == id, ct);
        if (item is null) return null;
        item.Name = r.Name;
        item.Description = r.Description;
        item.Price = r.Price;
        item.Order = r.Order;
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _projection.RebuildConfigChunksAsync(tenantId, ct);
        return new CatalogItemDto(item.Id, item.Name, item.Description, item.Price, item.Order);
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        var item = await _db.CatalogItems.FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == id, ct);
        if (item is null) return false;
        _db.CatalogItems.Remove(item);
        await _db.SaveChangesAsync(ct);
        await _projection.RebuildConfigChunksAsync(tenantId, ct);
        return true;
    }

    public async Task<List<CatalogItemDto>> ParseListAsync(Guid tenantId, string text, CancellationToken ct = default)
    {
        var startOrder = await _db.CatalogItems.Where(c => c.TenantId == tenantId).CountAsync(ct);
        var order = startOrder;
        foreach (var raw in (text ?? "").Split('\n'))
        {
            var line = raw.Trim();
            if (line.Length == 0) continue;
            // "Nombre - 28000" o "Nombre"; el último segmento tras '-' que sea numérico se toma como precio.
            string name = line, price = "";
            var dash = line.LastIndexOf('-');
            if (dash > 0)
            {
                var tail = line[(dash + 1)..].Trim();
                if (tail.Length > 0 && tail.Any(char.IsDigit))
                {
                    name = line[..dash].Trim();
                    price = tail;
                }
            }
            if (name.Length == 0) continue;
            _db.CatalogItems.Add(new CatalogItem { TenantId = tenantId, Name = name, Price = price.Length > 0 ? price : null, Order = order++ });
        }
        await _db.SaveChangesAsync(ct);
        await _projection.RebuildConfigChunksAsync(tenantId, ct);
        return await ListAsync(tenantId, ct);
    }
}
```

- [ ] **Step 3: Controller**

`src/ChatOmnicanal.API/Controllers/CatalogController.cs`:
```csharp
using ChatOmnicanal.Application.Catalog;
using ChatOmnicanal.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/catalog")]
[Authorize]
public class CatalogController : ControllerBase
{
    private readonly ICatalogService _service;
    private readonly ICurrentTenantService _currentTenant;

    public CatalogController(ICatalogService service, ICurrentTenantService currentTenant)
    {
        _service = service;
        _currentTenant = currentTenant;
    }

    [HttpGet]
    public async Task<ActionResult<List<CatalogItemDto>>> List(CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        return Ok(await _service.ListAsync(_currentTenant.TenantId, ct));
    }

    [HttpPost]
    public async Task<ActionResult<CatalogItemDto>> Create([FromBody] CatalogItemRequest request, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("El nombre es requerido.");
        return Ok(await _service.CreateAsync(_currentTenant.TenantId, request, ct));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CatalogItemDto>> Update(Guid id, [FromBody] CatalogItemRequest request, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        var dto = await _service.UpdateAsync(_currentTenant.TenantId, id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        return await _service.DeleteAsync(_currentTenant.TenantId, id, ct) ? NoContent() : NotFound();
    }

    [HttpPost("parse-list")]
    public async Task<ActionResult<List<CatalogItemDto>>> ParseList([FromBody] ParseListRequest request, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        return Ok(await _service.ParseListAsync(_currentTenant.TenantId, request.Text, ct));
    }
}
```

- [ ] **Step 4: DI**

En `DependencyInjection.cs`, bloque "Onboarding config sections":
```csharp
        services.AddScoped<ChatOmnicanal.Application.Catalog.ICatalogService, Config.CatalogService>();
```

- [ ] **Step 5: Test**

`tests/ChatOmnicanal.Integration.Tests/API/CatalogControllerTests.cs`:
```csharp
using System.Net.Http.Json;
using ChatOmnicanal.Application.Catalog;
using ChatOmnicanal.Integration.Tests.Infrastructure;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.API;

public class CatalogControllerTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public CatalogControllerTests(DatabaseFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Create_List_And_ParseList()
    {
        var (user, _) = await _fixture.SeedUserWithTenantAsync();
        var client = _fixture.CreateAuthenticatedClient(user.ClerkId);

        await client.PostAsJsonAsync("/api/catalog", new CatalogItemRequest("Torta", "12 porciones", "28000", 0));
        var list = await client.GetFromJsonAsync<List<CatalogItemDto>>("/api/catalog");
        Assert.Single(list!);
        Assert.Equal("Torta", list![0].Name);

        var parsed = await client.PostAsJsonAsync("/api/catalog/parse-list", new ParseListRequest("Cheesecake - 24000\nAlfajor - 1500"));
        var afterParse = await parsed.Content.ReadFromJsonAsync<List<CatalogItemDto>>();
        Assert.Equal(3, afterParse!.Count);
        Assert.Contains(afterParse, i => i.Name == "Cheesecake" && i.Price == "24000");
    }
}
```

- [ ] **Step 6: Verificar y commitear**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~CatalogControllerTests"` → PASS.
```bash
git add src/ChatOmnicanal.Application/Catalog/ src/ChatOmnicanal.Infrastructure/Config/CatalogService.cs src/ChatOmnicanal.API/Controllers/CatalogController.cs src/ChatOmnicanal.Infrastructure/DependencyInjection.cs tests/ChatOmnicanal.Integration.Tests/API/CatalogControllerTests.cs
git commit -m "feat(api): Catalog endpoint (CRUD + pegar lista) + proyección (fase 3a)"
```

---

## Task 4: Faq — servicio CRUD + endpoint + proyección

**Files:**
- Create: `src/ChatOmnicanal.Application/Faqs/FaqDto.cs`
- Create: `src/ChatOmnicanal.Application/Faqs/FaqRequest.cs`
- Create: `src/ChatOmnicanal.Application/Faqs/IFaqService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Config/FaqService.cs`
- Create: `src/ChatOmnicanal.API/Controllers/FaqController.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/API/FaqControllerTests.cs`

- [ ] **Step 1: DTO + request + interfaz**

`FaqDto.cs`:
```csharp
namespace ChatOmnicanal.Application.Faqs;

public record FaqDto(Guid Id, string Question, string? Answer, int Order);
```
`FaqRequest.cs`:
```csharp
namespace ChatOmnicanal.Application.Faqs;

public record FaqRequest(string Question, string? Answer, int Order);
```
`IFaqService.cs`:
```csharp
namespace ChatOmnicanal.Application.Faqs;

public interface IFaqService
{
    Task<List<FaqDto>> ListAsync(Guid tenantId, CancellationToken ct = default);
    Task<FaqDto> CreateAsync(Guid tenantId, FaqRequest request, CancellationToken ct = default);
    Task<FaqDto?> UpdateAsync(Guid tenantId, Guid id, FaqRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken ct = default);
}
```

- [ ] **Step 2: Servicio**

`src/ChatOmnicanal.Infrastructure/Config/FaqService.cs`:
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Faqs;
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Config;

public class FaqService : IFaqService
{
    private readonly IApplicationDbContext _db;
    private readonly IKnowledgeProjectionService _projection;

    public FaqService(IApplicationDbContext db, IKnowledgeProjectionService projection)
    {
        _db = db;
        _projection = projection;
    }

    public async Task<List<FaqDto>> ListAsync(Guid tenantId, CancellationToken ct = default) =>
        await _db.Faqs.AsNoTracking()
            .Where(f => f.TenantId == tenantId).OrderBy(f => f.Order)
            .Select(f => new FaqDto(f.Id, f.Question, f.Answer, f.Order))
            .ToListAsync(ct);

    public async Task<FaqDto> CreateAsync(Guid tenantId, FaqRequest r, CancellationToken ct = default)
    {
        var f = new Faq { TenantId = tenantId, Question = r.Question, Answer = r.Answer, Order = r.Order };
        _db.Faqs.Add(f);
        await _db.SaveChangesAsync(ct);
        await _projection.RebuildConfigChunksAsync(tenantId, ct);
        return new FaqDto(f.Id, f.Question, f.Answer, f.Order);
    }

    public async Task<FaqDto?> UpdateAsync(Guid tenantId, Guid id, FaqRequest r, CancellationToken ct = default)
    {
        var f = await _db.Faqs.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id, ct);
        if (f is null) return null;
        f.Question = r.Question;
        f.Answer = r.Answer;
        f.Order = r.Order;
        f.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _projection.RebuildConfigChunksAsync(tenantId, ct);
        return new FaqDto(f.Id, f.Question, f.Answer, f.Order);
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        var f = await _db.Faqs.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id, ct);
        if (f is null) return false;
        _db.Faqs.Remove(f);
        await _db.SaveChangesAsync(ct);
        await _projection.RebuildConfigChunksAsync(tenantId, ct);
        return true;
    }
}
```

- [ ] **Step 3: Controller**

`src/ChatOmnicanal.API/Controllers/FaqController.cs`:
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Faqs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/faq")]
[Authorize]
public class FaqController : ControllerBase
{
    private readonly IFaqService _service;
    private readonly ICurrentTenantService _currentTenant;

    public FaqController(IFaqService service, ICurrentTenantService currentTenant)
    {
        _service = service;
        _currentTenant = currentTenant;
    }

    [HttpGet]
    public async Task<ActionResult<List<FaqDto>>> List(CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        return Ok(await _service.ListAsync(_currentTenant.TenantId, ct));
    }

    [HttpPost]
    public async Task<ActionResult<FaqDto>> Create([FromBody] FaqRequest request, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Question)) return BadRequest("La pregunta es requerida.");
        return Ok(await _service.CreateAsync(_currentTenant.TenantId, request, ct));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<FaqDto>> Update(Guid id, [FromBody] FaqRequest request, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        var dto = await _service.UpdateAsync(_currentTenant.TenantId, id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        return await _service.DeleteAsync(_currentTenant.TenantId, id, ct) ? NoContent() : NotFound();
    }
}
```

- [ ] **Step 4: DI**

En `DependencyInjection.cs`, bloque "Onboarding config sections":
```csharp
        services.AddScoped<ChatOmnicanal.Application.Faqs.IFaqService, Config.FaqService>();
```

- [ ] **Step 5: Test**

`tests/ChatOmnicanal.Integration.Tests/API/FaqControllerTests.cs`:
```csharp
using System.Net.Http.Json;
using ChatOmnicanal.Application.Faqs;
using ChatOmnicanal.Integration.Tests.Infrastructure;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.API;

public class FaqControllerTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public FaqControllerTests(DatabaseFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Create_Then_List()
    {
        var (user, _) = await _fixture.SeedUserWithTenantAsync();
        var client = _fixture.CreateAuthenticatedClient(user.ClerkId);

        await client.PostAsJsonAsync("/api/faq", new FaqRequest("¿Hacen envíos?", "Sí, a todo el país.", 0));
        var list = await client.GetFromJsonAsync<List<FaqDto>>("/api/faq");
        Assert.Single(list!);
        Assert.Equal("¿Hacen envíos?", list![0].Question);
    }
}
```

- [ ] **Step 6: Verificar y commitear**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~FaqControllerTests"` → PASS.
```bash
git add src/ChatOmnicanal.Application/Faqs/ src/ChatOmnicanal.Infrastructure/Config/FaqService.cs src/ChatOmnicanal.API/Controllers/FaqController.cs src/ChatOmnicanal.Infrastructure/DependencyInjection.cs tests/ChatOmnicanal.Integration.Tests/API/FaqControllerTests.cs
git commit -m "feat(api): Faq endpoint (CRUD) + proyección al guardar (fase 3a)"
```

---

## Task 5: Extender `TenantProfile` (identidad) en DTO/request/service + proyección

**Files:**
- Modify: `src/ChatOmnicanal.Application/TenantProfiles/TenantProfileDto.cs`
- Modify: `src/ChatOmnicanal.Application/TenantProfiles/UpsertTenantProfileRequest.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/BotEngine/Services/TenantProfileService.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/API/TenantProfileIdentityTests.cs`

> Se agregan los 6 campos de identidad (Rubro, Description, Zone, SocialHandle, DirectionsNote, HolidaysNote) al final de los records (posicional, backward-compatible para el orden existente) y se cablea la proyección al guardar. Los campos legacy (Tone/ShippingInfo/PaymentMethods) se mantienen.

- [ ] **Step 1: Extender el DTO**

En `TenantProfileDto.cs`, agregar los 6 parámetros al final del record (después de `UpdatedAt`):
```csharp
public record TenantProfileDto(
    Guid Id,
    Guid TenantId,
    string? Address,
    string? Timezone,
    string? ContactPhone,
    string? ContactEmail,
    string? Tone,
    string BusinessHoursJson,
    string? ShippingInfo,
    string? PaymentMethods,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string? Rubro = null,
    string? Description = null,
    string? Zone = null,
    string? SocialHandle = null,
    string? DirectionsNote = null,
    string? HolidaysNote = null);
```

- [ ] **Step 2: Extender el request**

En `UpsertTenantProfileRequest.cs`, agregar al final:
```csharp
public record UpsertTenantProfileRequest(
    string? Address,
    string? Timezone,
    string? ContactPhone,
    string? ContactEmail,
    string? Tone,
    string? BusinessHoursJson,
    string? ShippingInfo,
    string? PaymentMethods,
    string? Rubro = null,
    string? Description = null,
    string? Zone = null,
    string? SocialHandle = null,
    string? DirectionsNote = null,
    string? HolidaysNote = null);
```

- [ ] **Step 3: Actualizar `TenantProfileService` (set de campos + proyección)**

En `TenantProfileService.cs`:
1. Agregar el campo e inyección de `IKnowledgeProjectionService`:
```csharp
    private readonly IApplicationDbContext _db;
    private readonly ChatOmnicanal.Application.Knowledge.IKnowledgeProjectionService _projection;

    public TenantProfileService(IApplicationDbContext db, ChatOmnicanal.Application.Knowledge.IKnowledgeProjectionService projection)
    {
        _db = db;
        _projection = projection;
    }
```
2. En el bloque de creación (nuevo profile) y en el de actualización, setear además:
```csharp
            profile.Rubro = request.Rubro;
            profile.Description = request.Description;
            profile.Zone = request.Zone;
            profile.SocialHandle = request.SocialHandle;
            profile.DirectionsNote = request.DirectionsNote;
            profile.HolidaysNote = request.HolidaysNote;
```
(en el `new TenantProfile { ... }` agregarlos como inicializadores con los mismos valores).
3. Después de `await _db.SaveChangesAsync(ct);` y antes del `return MapToDto(profile);`, agregar:
```csharp
        await _projection.RebuildConfigChunksAsync(tenantId, ct);
```
4. Actualizar `MapToDto` para incluir los nuevos campos:
```csharp
    private static TenantProfileDto MapToDto(TenantProfile p) =>
        new(p.Id, p.TenantId, p.Address, p.Timezone, p.ContactPhone, p.ContactEmail,
            p.Tone, p.BusinessHoursJson, p.ShippingInfo, p.PaymentMethods, p.CreatedAt, p.UpdatedAt,
            p.Rubro, p.Description, p.Zone, p.SocialHandle, p.DirectionsNote, p.HolidaysNote);
```

- [ ] **Step 4: Test**

`tests/ChatOmnicanal.Integration.Tests/API/TenantProfileIdentityTests.cs`:
```csharp
using System.Net.Http.Json;
using ChatOmnicanal.Application.TenantProfiles;
using ChatOmnicanal.Integration.Tests.Infrastructure;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.API;

public class TenantProfileIdentityTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public TenantProfileIdentityTests(DatabaseFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Upsert_PersistsIdentityFields()
    {
        var (user, _) = await _fixture.SeedUserWithTenantAsync();
        var client = _fixture.CreateAuthenticatedClient(user.ClerkId);

        var req = new UpsertTenantProfileRequest(
            Address: "Av. 1", Timezone: null, ContactPhone: null, ContactEmail: null,
            Tone: null, BusinessHoursJson: "{}", ShippingInfo: null, PaymentMethods: null,
            Rubro: "Pastelería", Description: "Tortas por encargo", Zone: "Yerba Buena",
            SocialHandle: "@dulce", DirectionsNote: "Frente a la plaza", HolidaysNote: "Feriados cerrado");
        await client.PutAsJsonAsync("/api/tenant-profile", req);

        var dto = await client.GetFromJsonAsync<TenantProfileDto>("/api/tenant-profile");
        Assert.Equal("Pastelería", dto!.Rubro);
        Assert.Equal("Tortas por encargo", dto.Description);
        Assert.Equal("Yerba Buena", dto.Zone);
    }
}
```

- [ ] **Step 5: Verificar y commitear**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~TenantProfileIdentityTests"` → PASS.
```bash
git add src/ChatOmnicanal.Application/TenantProfiles/ src/ChatOmnicanal.Infrastructure/BotEngine/Services/TenantProfileService.cs tests/ChatOmnicanal.Integration.Tests/API/TenantProfileIdentityTests.cs
git commit -m "feat(api): TenantProfile identidad + proyección al guardar (fase 3a)"
```

---

## Task 6: Endpoint de memoria — `GET /api/onboarding/memory`

**Files:**
- Create: `src/ChatOmnicanal.Application/Onboarding/IConfigMemoryService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Config/ConfigMemoryService.cs`
- Create: `src/ChatOmnicanal.API/Controllers/OnboardingController.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/API/OnboardingMemoryTests.cs`

> Reusa el `ConfigChunkProjector` puro: carga las entidades y devuelve los `ProjectedChunk` (sin tocar la tabla de chunks ni embeddings). Es el preview "memoria del bot" del wizard.

- [ ] **Step 1: Interfaz**

`src/ChatOmnicanal.Application/Onboarding/IConfigMemoryService.cs`:
```csharp
using ChatOmnicanal.Application.Knowledge;

namespace ChatOmnicanal.Application.Onboarding;

public interface IConfigMemoryService
{
    Task<IReadOnlyList<ProjectedChunk>> GetMemoryAsync(Guid tenantId, CancellationToken ct = default);
}
```

- [ ] **Step 2: Implementación**

`src/ChatOmnicanal.Infrastructure/Config/ConfigMemoryService.cs`:
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Application.Onboarding;
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Config;

public class ConfigMemoryService : IConfigMemoryService
{
    private readonly IApplicationDbContext _db;

    public ConfigMemoryService(IApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<ProjectedChunk>> GetMemoryAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant is null) return Array.Empty<ProjectedChunk>();

        var profile = await _db.TenantProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.TenantId == tenantId, ct)
                      ?? new TenantProfile { TenantId = tenantId, BusinessHoursJson = "{}" };
        var policy = await _db.CommercialPolicies.AsNoTracking().FirstOrDefaultAsync(p => p.TenantId == tenantId, ct);
        var persona = await _db.BotPersonas.AsNoTracking().FirstOrDefaultAsync(p => p.TenantId == tenantId, ct);
        var catalog = await _db.CatalogItems.AsNoTracking().Where(c => c.TenantId == tenantId).OrderBy(c => c.Order).ToListAsync(ct);
        var faqs = await _db.Faqs.AsNoTracking().Where(f => f.TenantId == tenantId).OrderBy(f => f.Order).ToListAsync(ct);

        return ConfigChunkProjector.Build(tenant.Name, profile, policy, persona, catalog, faqs);
    }
}
```

- [ ] **Step 3: Controller**

`src/ChatOmnicanal.API/Controllers/OnboardingController.cs`:
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Application.Onboarding;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/onboarding")]
[Authorize]
public class OnboardingController : ControllerBase
{
    private readonly IConfigMemoryService _memory;
    private readonly ICurrentTenantService _currentTenant;

    public OnboardingController(IConfigMemoryService memory, ICurrentTenantService currentTenant)
    {
        _memory = memory;
        _currentTenant = currentTenant;
    }

    [HttpGet("memory")]
    public async Task<ActionResult<IReadOnlyList<ProjectedChunk>>> GetMemory(CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        return Ok(await _memory.GetMemoryAsync(_currentTenant.TenantId, ct));
    }
}
```

- [ ] **Step 4: DI**

En `DependencyInjection.cs`, bloque "Onboarding config sections":
```csharp
        services.AddScoped<ChatOmnicanal.Application.Onboarding.IConfigMemoryService, Config.ConfigMemoryService>();
```

- [ ] **Step 5: Test**

`tests/ChatOmnicanal.Integration.Tests/API/OnboardingMemoryTests.cs`:
```csharp
using System.Net.Http.Json;
using ChatOmnicanal.Application.Catalog;
using ChatOmnicanal.Application.Knowledge;
using ChatOmnicanal.Application.TenantProfiles;
using ChatOmnicanal.Integration.Tests.Infrastructure;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.API;

public class OnboardingMemoryTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public OnboardingMemoryTests(DatabaseFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Memory_ReflectsConfiguredData()
    {
        var (user, _) = await _fixture.SeedUserWithTenantAsync();
        var client = _fixture.CreateAuthenticatedClient(user.ClerkId);

        await client.PutAsJsonAsync("/api/tenant-profile", new UpsertTenantProfileRequest(
            Address: null, Timezone: null, ContactPhone: null, ContactEmail: null,
            Tone: null, BusinessHoursJson: "{}", ShippingInfo: null, PaymentMethods: null,
            Rubro: "Pastelería", Description: "Tortas por encargo", Zone: "Centro"));
        await client.PostAsJsonAsync("/api/catalog", new CatalogItemRequest("Cheesecake", null, "24000", 0));

        var memory = await client.GetFromJsonAsync<List<ProjectedChunk>>("/api/onboarding/memory");
        Assert.Contains(memory!, c => c.Category == "Negocio");
        Assert.Contains(memory!, c => c.Category == "Productos" && c.Content.Contains("Cheesecake"));
    }
}
```

- [ ] **Step 6: Verificar y commitear**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~OnboardingMemoryTests"` → PASS.
```bash
git add src/ChatOmnicanal.Application/Onboarding/ src/ChatOmnicanal.Infrastructure/Config/ConfigMemoryService.cs src/ChatOmnicanal.API/Controllers/OnboardingController.cs src/ChatOmnicanal.Infrastructure/DependencyInjection.cs tests/ChatOmnicanal.Integration.Tests/API/OnboardingMemoryTests.cs
git commit -m "feat(api): GET /api/onboarding/memory (preview de la memoria del bot) (fase 3a)"
```

---

## Task 7: Verificación final de la fase

- [ ] **Step 1: Suite completa**

Run: `dotnet test`
Expected: PASS — los 113 previos + los nuevos de fase 3a, todo verde. Si algo falla, corregir y re-correr; no avanzar en rojo.

---

## Self-review (cobertura vs spec)

- **Endpoints por sección** (policy, persona, catálogo, FAQ) → Tasks 1–4. ✅
- **Extensión del perfil (identidad)** → Task 5. ✅
- **Disparo de la proyección al guardar** → cada servicio llama `RebuildConfigChunksAsync` tras `SaveChangesAsync` (Tasks 1–5). ✅
- **`GET /api/onboarding/memory`** → Task 6 (reusa el proyector puro). ✅
- **Pegar lista (catálogo)** → `POST /api/catalog/parse-list` (Task 3). ✅
- **Fuera de alcance (va en Fase 3b):** inyección de persona/identidad al system prompt (`SystemPromptBuilder`/`BotEngineService`). El conocimiento ya es recuperable por RAG.
- **Type consistency:** interfaces/DTOs/requests y rutas usados igual en service, controller y test; DI `AddScoped` para cada uno. `TenantProfileDto`/`UpsertTenantProfileRequest` extendidos con parámetros opcionales al final (no rompe call sites existentes). ✅
- **Riesgo anotado:** `TenantProfileService` cambia de constructor (suma `IKnowledgeProjectionService`); su registro DI existente sigue válido porque el proyector está registrado (Fase 2). El `DatabaseFixture` usa `TestEmbeddingService`, así que la proyección en tests no hace llamadas externas.
