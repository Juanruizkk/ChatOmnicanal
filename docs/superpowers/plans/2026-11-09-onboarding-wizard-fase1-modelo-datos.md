# Onboarding Wizard — Fase 1: Modelo de datos + migraciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al backend el modelo de datos estructurado que alimenta el asistente de alta de PentaBot (catálogo, FAQ, política comercial, persona del bot) y la metadata de chunk (source/category), sin romper lo existente.

**Architecture:** Entidades nuevas `ITenantScoped : BaseEntity` con su `IEntityTypeConfiguration` (auto-aplicada por `ApplyConfigurationsFromAssembly`), DbSets en `IApplicationDbContext` + `ApplicationDbContext`, y una única migración EF Core. Se **agregan** campos nuevos a `TenantProfile` y `KnowledgeChunk`; no se elimina nada todavía (deprecate-then-remove en fases posteriores, cuando migren los consumidores).

**Tech Stack:** .NET 8, EF Core 8 + Npgsql (PostgreSQL 16 + pgvector), xUnit + Testcontainers (pgvector/pg16).

**Referencia:** spec `docs/superpowers/specs/2026-11-09-onboarding-wizard-pentabot-design.md`.

> Convención de tests: los tests de integración viven en `apps/api/tests/ChatOmnicanal.Integration.Tests`, usan `IClassFixture<DatabaseFixture>` (levanta Postgres+pgvector y aplica `MigrateAsync`). Patrón de referencia: `Infrastructure/KnowledgeVectorSearchTests.cs`. Todos los comandos se corren desde `apps/api`. Requiere Docker corriendo.

---

## Task 1: Entidad `CatalogItem` (productos/precios del catálogo)

**Files:**
- Create: `src/ChatOmnicanal.Domain/Entities/CatalogItem.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Persistence/Configurations/CatalogItemConfiguration.cs`
- Modify: `src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/StructuredConfigEntitiesTests.cs`

- [ ] **Step 1: Crear la entidad**

`src/ChatOmnicanal.Domain/Entities/CatalogItem.cs`:
```csharp
using ChatOmnicanal.Domain.Common;

namespace ChatOmnicanal.Domain.Entities;

public class CatalogItem : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Precio tal como lo muestra el dueño (ej. "28000", "desde $2.500").
    // Fase posterior puede sumar un decimal normalizado para filtros/orden.
    public string? Price { get; set; }

    public int Order { get; set; }
}
```

- [ ] **Step 2: Crear la configuración EF**

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/CatalogItemConfiguration.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class CatalogItemConfiguration : IEntityTypeConfiguration<CatalogItem>
{
    public void Configure(EntityTypeBuilder<CatalogItem> builder)
    {
        builder.ToTable("catalog_items");
        builder.HasKey(c => c.Id);
        builder.HasIndex(c => c.TenantId);
        builder.Property(c => c.Name).HasMaxLength(200);
        builder.Property(c => c.Price).HasMaxLength(100);
    }
}
```

- [ ] **Step 3: Declarar el DbSet en la interfaz y el contexto**

En `IApplicationDbContext.cs`, agregar junto a los demás `DbSet`:
```csharp
    DbSet<CatalogItem> CatalogItems { get; }
```
En `ApplicationDbContext.cs`, agregar junto a los demás:
```csharp
    public DbSet<CatalogItem> CatalogItems => Set<CatalogItem>();
```

- [ ] **Step 4: Escribir el test que falla**

Crear `tests/ChatOmnicanal.Integration.Tests/Infrastructure/StructuredConfigEntitiesTests.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.Infrastructure;

public class StructuredConfigEntitiesTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public StructuredConfigEntitiesTests(DatabaseFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task CatalogItem_PersistsAndQueriesByTenant()
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var tenant = new Tenant { Name = "Catálogo Tenant" };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        db.CatalogItems.Add(new CatalogItem
        {
            TenantId = tenant.Id,
            Name = "Torta de chocolate",
            Description = "12 porciones",
            Price = "28000",
            Order = 0
        });
        await db.SaveChangesAsync();

        var items = await db.CatalogItems.AsNoTracking()
            .Where(c => c.TenantId == tenant.Id).ToListAsync();

        Assert.Single(items);
        Assert.Equal("Torta de chocolate", items[0].Name);
        Assert.Equal("28000", items[0].Price);
    }
}
```

- [ ] **Step 5: Verificar que falla**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~StructuredConfigEntitiesTests.CatalogItem_PersistsAndQueriesByTenant"`
Expected: FAIL — no existe la tabla `catalog_items` (la migración se crea en la Task 6).

> Nota: este test recién pasa cuando exista la migración (Task 6). Es esperado que falle hasta entonces; dejarlo escrito.

- [ ] **Step 6: Commit**

```bash
git add src/ChatOmnicanal.Domain/Entities/CatalogItem.cs src/ChatOmnicanal.Infrastructure/Persistence/Configurations/CatalogItemConfiguration.cs src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs tests/ChatOmnicanal.Integration.Tests/Infrastructure/StructuredConfigEntitiesTests.cs
git commit -m "feat(api): add CatalogItem entity (onboarding wizard fase 1)"
```

---

## Task 2: Entidad `Faq` (preguntas frecuentes)

**Files:**
- Create: `src/ChatOmnicanal.Domain/Entities/Faq.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Persistence/Configurations/FaqConfiguration.cs`
- Modify: `src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/StructuredConfigEntitiesTests.cs`

- [ ] **Step 1: Crear la entidad**

`src/ChatOmnicanal.Domain/Entities/Faq.cs`:
```csharp
using ChatOmnicanal.Domain.Common;

namespace ChatOmnicanal.Domain.Entities;

public class Faq : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public string Question { get; set; } = string.Empty;
    public string? Answer { get; set; }
    public int Order { get; set; }
}
```

- [ ] **Step 2: Crear la configuración EF**

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/FaqConfiguration.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class FaqConfiguration : IEntityTypeConfiguration<Faq>
{
    public void Configure(EntityTypeBuilder<Faq> builder)
    {
        builder.ToTable("faqs");
        builder.HasKey(f => f.Id);
        builder.HasIndex(f => f.TenantId);
        builder.Property(f => f.Question).HasMaxLength(500);
    }
}
```

- [ ] **Step 3: Declarar el DbSet**

En `IApplicationDbContext.cs`:
```csharp
    DbSet<Faq> Faqs { get; }
```
En `ApplicationDbContext.cs`:
```csharp
    public DbSet<Faq> Faqs => Set<Faq>();
```

- [ ] **Step 4: Agregar el test que falla**

Agregar al final de la clase `StructuredConfigEntitiesTests`:
```csharp
    [Fact]
    public async Task Faq_PersistsAndQueriesByTenant()
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var tenant = new Tenant { Name = "FAQ Tenant" };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        db.Faqs.Add(new Faq
        {
            TenantId = tenant.Id,
            Question = "¿Hacen envíos?",
            Answer = "Sí, a todo el país.",
            Order = 0
        });
        await db.SaveChangesAsync();

        var faqs = await db.Faqs.AsNoTracking()
            .Where(f => f.TenantId == tenant.Id).ToListAsync();

        Assert.Single(faqs);
        Assert.Equal("¿Hacen envíos?", faqs[0].Question);
    }
```

- [ ] **Step 5: Verificar que falla**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~StructuredConfigEntitiesTests.Faq_PersistsAndQueriesByTenant"`
Expected: FAIL — no existe la tabla `faqs` todavía.

- [ ] **Step 6: Commit**

```bash
git add src/ChatOmnicanal.Domain/Entities/Faq.cs src/ChatOmnicanal.Infrastructure/Persistence/Configurations/FaqConfiguration.cs src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs tests/ChatOmnicanal.Integration.Tests/Infrastructure/StructuredConfigEntitiesTests.cs
git commit -m "feat(api): add Faq entity (onboarding wizard fase 1)"
```

---

## Task 3: Entidad `CommercialPolicy` (pagos + entregas, 1:1 con tenant)

**Files:**
- Create: `src/ChatOmnicanal.Domain/Entities/CommercialPolicy.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Persistence/Configurations/CommercialPolicyConfiguration.cs`
- Modify: `src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/StructuredConfigEntitiesTests.cs`

- [ ] **Step 1: Crear la entidad**

`src/ChatOmnicanal.Domain/Entities/CommercialPolicy.cs`:
```csharp
using ChatOmnicanal.Domain.Common;

namespace ChatOmnicanal.Domain.Entities;

public class CommercialPolicy : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }

    // Medios de pago como JSON array de strings (ej. ["Efectivo","Transferencia"]).
    public string? PaymentMethods { get; set; }
    public string? Installments { get; set; }
    public string? Promo { get; set; }

    // retiro | envio | ambos | ninguno
    public string? DeliveryMode { get; set; }
    public string? DeliveryZones { get; set; }
    public string? DeliveryCost { get; set; }
    public string? DeliveryTime { get; set; }
    public string? PickupInfo { get; set; }
}
```

- [ ] **Step 2: Crear la configuración EF**

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/CommercialPolicyConfiguration.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class CommercialPolicyConfiguration : IEntityTypeConfiguration<CommercialPolicy>
{
    public void Configure(EntityTypeBuilder<CommercialPolicy> builder)
    {
        builder.ToTable("commercial_policies");
        builder.HasKey(p => p.Id);
        builder.HasIndex(p => p.TenantId).IsUnique();
        builder.Property(p => p.DeliveryMode).HasMaxLength(20);
    }
}
```

- [ ] **Step 3: Declarar el DbSet**

En `IApplicationDbContext.cs`:
```csharp
    DbSet<CommercialPolicy> CommercialPolicies { get; }
```
En `ApplicationDbContext.cs`:
```csharp
    public DbSet<CommercialPolicy> CommercialPolicies => Set<CommercialPolicy>();
```

- [ ] **Step 4: Agregar el test que falla**

Agregar a `StructuredConfigEntitiesTests`:
```csharp
    [Fact]
    public async Task CommercialPolicy_IsUniquePerTenant_AndPersists()
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var tenant = new Tenant { Name = "Policy Tenant" };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        db.CommercialPolicies.Add(new CommercialPolicy
        {
            TenantId = tenant.Id,
            PaymentMethods = "[\"Efectivo\",\"Transferencia\"]",
            DeliveryMode = "ambos",
            DeliveryZones = "Yerba Buena"
        });
        await db.SaveChangesAsync();

        var policy = await db.CommercialPolicies.AsNoTracking()
            .SingleAsync(p => p.TenantId == tenant.Id);
        Assert.Equal("ambos", policy.DeliveryMode);

        // Un segundo registro para el mismo tenant viola el índice único.
        db.CommercialPolicies.Add(new CommercialPolicy { TenantId = tenant.Id });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }
```

- [ ] **Step 5: Verificar que falla**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~StructuredConfigEntitiesTests.CommercialPolicy_IsUniquePerTenant_AndPersists"`
Expected: FAIL — no existe la tabla `commercial_policies` todavía.

- [ ] **Step 6: Commit**

```bash
git add src/ChatOmnicanal.Domain/Entities/CommercialPolicy.cs src/ChatOmnicanal.Infrastructure/Persistence/Configurations/CommercialPolicyConfiguration.cs src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs tests/ChatOmnicanal.Integration.Tests/Infrastructure/StructuredConfigEntitiesTests.cs
git commit -m "feat(api): add CommercialPolicy entity (onboarding wizard fase 1)"
```

---

## Task 4: Entidad `BotPersona` (voz + handoff, 1:1 con tenant)

**Files:**
- Create: `src/ChatOmnicanal.Domain/Entities/BotPersona.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Persistence/Configurations/BotPersonaConfiguration.cs`
- Modify: `src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/StructuredConfigEntitiesTests.cs`

- [ ] **Step 1: Crear la entidad**

`src/ChatOmnicanal.Domain/Entities/BotPersona.cs`:
```csharp
using ChatOmnicanal.Domain.Common;

namespace ChatOmnicanal.Domain.Entities;

public class BotPersona : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }

    public string? Name { get; set; }
    // cercano | profesional | canchero
    public string? Tone { get; set; }
    public string? Greeting { get; set; }
    public string? NeverRules { get; set; }

    public bool HandoffOnComplaint { get; set; }
    public bool HandoffOnRequest { get; set; }
    public bool HandoffOnSpecial { get; set; }
    public bool HandoffOnPayment { get; set; }
    public string? HandoffNotifyTo { get; set; }
    public string? HandoffHours { get; set; }
    public string? HandoffMessage { get; set; }
}
```

- [ ] **Step 2: Crear la configuración EF**

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/BotPersonaConfiguration.cs`:
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class BotPersonaConfiguration : IEntityTypeConfiguration<BotPersona>
{
    public void Configure(EntityTypeBuilder<BotPersona> builder)
    {
        builder.ToTable("bot_personas");
        builder.HasKey(p => p.Id);
        builder.HasIndex(p => p.TenantId).IsUnique();
        builder.Property(p => p.Name).HasMaxLength(100);
        builder.Property(p => p.Tone).HasMaxLength(50);
    }
}
```

- [ ] **Step 3: Declarar el DbSet**

En `IApplicationDbContext.cs`:
```csharp
    DbSet<BotPersona> BotPersonas { get; }
```
En `ApplicationDbContext.cs`:
```csharp
    public DbSet<BotPersona> BotPersonas => Set<BotPersona>();
```

- [ ] **Step 4: Agregar el test que falla**

Agregar a `StructuredConfigEntitiesTests`:
```csharp
    [Fact]
    public async Task BotPersona_PersistsHandoffFlags()
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var tenant = new Tenant { Name = "Persona Tenant" };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        db.BotPersonas.Add(new BotPersona
        {
            TenantId = tenant.Id,
            Name = "Dulce",
            Tone = "cercano",
            Greeting = "¡Hola! Soy Dulce.",
            HandoffOnComplaint = true,
            HandoffOnRequest = true,
            HandoffNotifyTo = "+54 9 381 555 0000"
        });
        await db.SaveChangesAsync();

        var persona = await db.BotPersonas.AsNoTracking()
            .SingleAsync(p => p.TenantId == tenant.Id);
        Assert.Equal("Dulce", persona.Name);
        Assert.True(persona.HandoffOnComplaint);
        Assert.False(persona.HandoffOnSpecial);
    }
```

- [ ] **Step 5: Verificar que falla**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~StructuredConfigEntitiesTests.BotPersona_PersistsHandoffFlags"`
Expected: FAIL — no existe la tabla `bot_personas` todavía.

- [ ] **Step 6: Commit**

```bash
git add src/ChatOmnicanal.Domain/Entities/BotPersona.cs src/ChatOmnicanal.Infrastructure/Persistence/Configurations/BotPersonaConfiguration.cs src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs tests/ChatOmnicanal.Integration.Tests/Infrastructure/StructuredConfigEntitiesTests.cs
git commit -m "feat(api): add BotPersona entity (onboarding wizard fase 1)"
```

---

## Task 5: Extender `TenantProfile` (identidad) y `KnowledgeChunk` (source/category)

**Files:**
- Modify: `src/ChatOmnicanal.Domain/Entities/TenantProfile.cs`
- Modify: `src/ChatOmnicanal.Domain/Entities/KnowledgeChunk.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/Persistence/Configurations/KnowledgeChunkConfiguration.cs`
- Test: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/StructuredConfigEntitiesTests.cs`

> No se tocan `TenantProfileService`, `TenantProfileDto` ni `SystemPromptBuilder` en esta fase: los campos nuevos son opcionales y quedan en null hasta que los cablee la Fase 3. Tampoco se elimina `Tone`/`ShippingInfo`/`PaymentMethods` (deprecate-then-remove).

- [ ] **Step 1: Agregar campos a `TenantProfile`**

En `src/ChatOmnicanal.Domain/Entities/TenantProfile.cs`, agregar dentro de la clase (después de `Tone`):
```csharp
    // Identidad del negocio (wizard paso 1 y 2)
    public string? Rubro { get; set; }
    public string? Description { get; set; }
    public string? Zone { get; set; }
    public string? SocialHandle { get; set; }
    public string? DirectionsNote { get; set; }
    public string? HolidaysNote { get; set; }
```

- [ ] **Step 2: Agregar campos a `KnowledgeChunk`**

En `src/ChatOmnicanal.Domain/Entities/KnowledgeChunk.cs`, agregar dentro de la clase (después de `Embedding`):
```csharp
    // Origen del chunk: "config" (derivado de los datos estructurados) o "archivo" (upload).
    public string? Source { get; set; }
    // Categoría: Negocio|Horarios|Ubicacion|Productos|Pagos|Entregas|FAQ|Estilo|Handoff
    public string? Category { get; set; }
```

- [ ] **Step 3: Mapear las columnas nuevas de `KnowledgeChunk`**

En `KnowledgeChunkConfiguration.cs`, dentro de `Configure`, agregar antes del `HasOne(...)`:
```csharp
        builder.Property(c => c.Source).HasMaxLength(20);
        builder.Property(c => c.Category).HasMaxLength(30);
        builder.HasIndex(c => new { c.TenantId, c.Source });
```

- [ ] **Step 4: Agregar el test que falla**

Agregar a `StructuredConfigEntitiesTests`:
```csharp
    [Fact]
    public async Task TenantProfile_And_KnowledgeChunk_NewFields_Persist()
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var tenant = new Tenant { Name = "Fields Tenant" };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        db.TenantProfiles.Add(new TenantProfile
        {
            TenantId = tenant.Id,
            Rubro = "Pastelería",
            Description = "Tortas por encargo",
            Zone = "Yerba Buena"
        });

        var doc = new KnowledgeDoc { TenantId = tenant.Id, Name = "cfg", Type = "config", Status = "ready" };
        db.KnowledgeDocs.Add(doc);
        await db.SaveChangesAsync();

        db.KnowledgeChunks.Add(new KnowledgeChunk
        {
            TenantId = tenant.Id,
            DocId = doc.Id,
            Content = "Pastelería en Yerba Buena",
            Source = "config",
            Category = "Negocio",
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var profile = await db.TenantProfiles.AsNoTracking().SingleAsync(p => p.TenantId == tenant.Id);
        Assert.Equal("Pastelería", profile.Rubro);

        var configChunks = await db.KnowledgeChunks.AsNoTracking()
            .Where(c => c.TenantId == tenant.Id && c.Source == "config").ToListAsync();
        Assert.Single(configChunks);
        Assert.Equal("Negocio", configChunks[0].Category);
    }
```

- [ ] **Step 5: Verificar que falla**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~StructuredConfigEntitiesTests.TenantProfile_And_KnowledgeChunk_NewFields_Persist"`
Expected: FAIL — las columnas nuevas no existen en la base todavía.

- [ ] **Step 6: Commit**

```bash
git add src/ChatOmnicanal.Domain/Entities/TenantProfile.cs src/ChatOmnicanal.Domain/Entities/KnowledgeChunk.cs src/ChatOmnicanal.Infrastructure/Persistence/Configurations/KnowledgeChunkConfiguration.cs tests/ChatOmnicanal.Integration.Tests/Infrastructure/StructuredConfigEntitiesTests.cs
git commit -m "feat(api): extend TenantProfile + KnowledgeChunk (source/category) (onboarding wizard fase 1)"
```

---

## Task 6: Generar la migración EF y poner los tests en verde

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Persistence/Migrations/<timestamp>_AddStructuredConfigEntities.cs` (lo genera EF)
- Modify: `src/ChatOmnicanal.Infrastructure/Persistence/Migrations/ApplicationDbContextModelSnapshot.cs` (lo actualiza EF)

- [ ] **Step 1: Generar la migración**

Desde `apps/api`:
```bash
dotnet ef migrations add AddStructuredConfigEntities --project src/ChatOmnicanal.Infrastructure --startup-project src/ChatOmnicanal.API --output-dir Persistence/Migrations
```
Expected: crea el archivo de migración + actualiza el snapshot, sin errores.

- [ ] **Step 2: Revisar la migración generada**

Abrir el archivo `*_AddStructuredConfigEntities.cs` y verificar que:
- Crea las tablas `catalog_items`, `faqs`, `commercial_policies`, `bot_personas`.
- Agrega columnas a `tenant_profiles` (rubro, description, zone, social_handle, directions_note, holidays_note).
- Agrega columnas `source` y `category` a `knowledge_chunks` + índice `(tenant_id, source)`.
- Crea índices únicos en `tenant_id` para `commercial_policies` y `bot_personas`.
- No dropea ninguna columna existente (Tone/ShippingInfo/PaymentMethods siguen).

- [ ] **Step 3: Correr toda la clase de tests (aplica la migración vía MigrateAsync)**

Run: `dotnet test tests/ChatOmnicanal.Integration.Tests --filter "FullyQualifiedName~StructuredConfigEntitiesTests"`
Expected: PASS — las 5 pruebas en verde.

- [ ] **Step 4: Correr la suite completa para no romper nada**

Run: `dotnet test`
Expected: PASS — toda la suite en verde (migración aplicada, nada roto).

- [ ] **Step 5: Commit**

```bash
git add src/ChatOmnicanal.Infrastructure/Persistence/Migrations/
git commit -m "feat(api): migration AddStructuredConfigEntities (onboarding wizard fase 1)"
```

---

## Self-review (cobertura vs spec)

- **Modelo de datos del spec** → Tasks 1–5 cubren `CatalogItem`, `Faq`, `CommercialPolicy`, `BotPersona`, extensión de `TenantProfile`, y `Source`/`Category` en `KnowledgeChunk`. ✅
- **Migración** → Task 6. ✅
- **No romper lo existente** → Task 6 Step 4 corre `dotnet test` completo; no se dropean columnas. ✅
- **Fuera de alcance de Fase 1** (correcto, van en fases siguientes): `KnowledgeProjectionService` (Fase 2), endpoints (Fase 3), wizard/tema (Fase 4), refactor Settings + remoción de campos deprecados + migración de datos de Tone/ShippingInfo/PaymentMethods (fase donde cambian los consumidores).
- **Type consistency**: nombres de DbSet (`CatalogItems`, `Faqs`, `CommercialPolicies`, `BotPersonas`) y propiedades usados igual en entidad, config y test. ✅
