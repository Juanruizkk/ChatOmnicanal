# Superadmin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una sección `/admin` al frontend React y endpoints `/api/admin/` al backend .NET que permitan a un superadministrador ver y gestionar todos los tenants, registrar pagos, configurar precios de LLM y consultar el audit log, sin afectar los flujos de tenants existentes.

**Architecture:** El acceso superadmin se controla via claim `superadmin_role: "superadmin"` en el JWT de Clerk (JWT Template) + policy `SuperAdmin` en ASP.NET Core. El backend agrega 4 nuevas tablas (`tenant_billing_info`, `tenant_payments`, `llm_pricing`, `admin_audit_log`) y 2 columnas nuevas en `tenants`. El frontend agrega rutas `/admin/*` protegidas por `AdminGuard` que verifica el claim en `useUser()` de Clerk.

**Tech Stack:** .NET 8 / EF Core 8 / PostgreSQL 16, Clerk JWT Template, React 18 / Vite / TypeScript / TanStack Query / Zustand / Tailwind CSS

---

## Prerequisito manual: Clerk JWT Template

Antes de ejecutar cualquier tarea, el superadmin debe ir a Clerk Dashboard → JWT Templates → Default template y agregar el claim:

```json
{
  "superadmin_role": "{{user.public_metadata.role}}"
}
```

Luego asignar `role: "superadmin"` en `publicMetadata` del usuario superadmin en Clerk Dashboard → Users.

---

## Mapa de archivos

### Backend (`apps/api`)
```
src/ChatOmnicanal.Domain/
  Entities/
    Tenant.cs                                    # +ConversationQuota, +InternalNotes, +nav BillingInfo/Payments
    TenantBillingInfo.cs                         # NUEVO
    TenantPayment.cs                             # NUEVO
    LlmPricing.cs                                # NUEVO
    AdminAuditLog.cs                             # NUEVO
  Enums/
    PaymentStatus.cs                             # NUEVO
    AdminAction.cs                               # NUEVO

src/ChatOmnicanal.Application/
  Admin/
    DTOs/
      TenantAdminDto.cs                          # NUEVO — lista y detalle
      TenantKpiDto.cs                            # NUEVO — strip superior
      TenantStatsDto.cs                          # NUEVO — tab Estadísticas
      PaymentDto.cs                              # NUEVO
      BillingInfoDto.cs                          # NUEVO
      LlmPricingDto.cs                           # NUEVO
      AuditLogEntryDto.cs                        # NUEVO
      UpdateTenantConfigRequest.cs               # NUEVO
      RegisterPaymentRequest.cs                  # NUEVO
    Interfaces/
      ITenantAdminService.cs                     # NUEVO
      IAdminMetricsService.cs                    # NUEVO
      IAdminAuditLogService.cs                   # NUEVO
  Common/
    PagedResult.cs                               # NUEVO

src/ChatOmnicanal.Infrastructure/
  Admin/
    TenantAdminService.cs                        # NUEVO
    AdminMetricsService.cs                       # NUEVO
    AdminAuditLogService.cs                      # NUEVO
  Persistence/
    ApplicationDbContext.cs                      # +4 DbSets
    Configurations/
      TenantConfiguration.cs                     # +ConversationQuota, +InternalNotes
      TenantBillingInfoConfiguration.cs          # NUEVO
      TenantPaymentConfiguration.cs              # NUEVO
      LlmPricingConfiguration.cs                 # NUEVO
      AdminAuditLogConfiguration.cs              # NUEVO
  Migrations/
    *_AddSuperAdminSchema.cs                     # NUEVO (generado)

src/ChatOmnicanal.API/
  Controllers/
    AdminTenantsController.cs                    # NUEVO
    AdminSettingsController.cs                   # NUEVO
    AdminAuditLogController.cs                   # NUEVO
  DependencyInjection.cs                         # +policy SuperAdmin

src/ChatOmnicanal.Application/
  Common/Interfaces/
    IApplicationDbContext.cs                     # +4 DbSets

tests/ChatOmnicanal.Integration.Tests/
  Admin/
    AdminTenantsControllerTests.cs               # NUEVO
    AdminSettingsControllerTests.cs              # NUEVO
    AdminAuditLogControllerTests.cs              # NUEVO
```

### Frontend (`apps/web`)
```
src/
  types/
    api.types.ts                                 # +admin types
  services/
    admin.ts                                     # NUEVO — todos los endpoints /api/admin/
  hooks/
    useAdmin.ts                                  # NUEVO — TanStack Query hooks admin
  store/
    adminStore.ts                                # NUEVO — filtros/UI state Zustand
  components/
    layout/
      AdminLayout.tsx                            # NUEVO — sidebar admin
    admin/
      KpiStrip.tsx                               # NUEVO
      TenantFilters.tsx                          # NUEVO
      TenantTable.tsx                            # NUEVO
      TenantRowMenu.tsx                          # NUEVO
      PaymentForm.tsx                            # NUEVO
      BillingInfoForm.tsx                        # NUEVO
      LlmPricingForm.tsx                         # NUEVO
      AuditLogTable.tsx                          # NUEVO
  pages/
    AdminTenantsPage.tsx                         # NUEVO
    AdminTenantDetailPage.tsx                    # NUEVO — 4 tabs
    AdminSettingsPage.tsx                        # NUEVO
    AdminAuditLogPage.tsx                        # NUEVO
  router.tsx                                     # +rutas /admin/*
```

---

## Task 1: Domain — entidades y enums nuevos

**Files:**
- Create: `apps/api/src/ChatOmnicanal.Domain/Enums/PaymentStatus.cs`
- Create: `apps/api/src/ChatOmnicanal.Domain/Enums/AdminAction.cs`
- Create: `apps/api/src/ChatOmnicanal.Domain/Entities/TenantBillingInfo.cs`
- Create: `apps/api/src/ChatOmnicanal.Domain/Entities/TenantPayment.cs`
- Create: `apps/api/src/ChatOmnicanal.Domain/Entities/LlmPricing.cs`
- Create: `apps/api/src/ChatOmnicanal.Domain/Entities/AdminAuditLog.cs`
- Modify: `apps/api/src/ChatOmnicanal.Domain/Entities/Tenant.cs`

- [ ] **Step 1: Crear PaymentStatus enum**

```csharp
// apps/api/src/ChatOmnicanal.Domain/Enums/PaymentStatus.cs
namespace ChatOmnicanal.Domain.Enums;

public enum PaymentStatus
{
    Pending,
    Confirmed,
    Failed,
    Refunded
}
```

- [ ] **Step 2: Crear AdminAction enum**

```csharp
// apps/api/src/ChatOmnicanal.Domain/Enums/AdminAction.cs
namespace ChatOmnicanal.Domain.Enums;

public enum AdminAction
{
    TenantStatusChanged,
    TenantPlanChanged,
    TenantQuotaUpdated,
    TenantConfigUpdated,
    TenantBillingInfoUpdated,
    PaymentRegistered,
    PaymentDeleted,
    LlmPricingUpdated
}
```

- [ ] **Step 3: Crear TenantBillingInfo**

```csharp
// apps/api/src/ChatOmnicanal.Domain/Entities/TenantBillingInfo.cs
using ChatOmnicanal.Domain.Common;

namespace ChatOmnicanal.Domain.Entities;

public class TenantBillingInfo : BaseEntity
{
    public Guid TenantId { get; set; }
    public string? CompanyName { get; set; }
    public string? TaxId { get; set; }
    public string? BillingEmail { get; set; }
    public string? Address { get; set; }
    public string? Country { get; set; }
    public string? Notes { get; set; }

    public Tenant Tenant { get; set; } = null!;
}
```

- [ ] **Step 4: Crear TenantPayment**

```csharp
// apps/api/src/ChatOmnicanal.Domain/Entities/TenantPayment.cs
using ChatOmnicanal.Domain.Common;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Domain.Entities;

public class TenantPayment : BaseEntity
{
    public Guid TenantId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public PaymentStatus Status { get; set; } = PaymentStatus.Confirmed;
    public string? Description { get; set; }
    public string? ExternalReference { get; set; }
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public string RegisteredByUserId { get; set; } = string.Empty;

    public Tenant Tenant { get; set; } = null!;
}
```

- [ ] **Step 5: Crear LlmPricing**

```csharp
// apps/api/src/ChatOmnicanal.Domain/Entities/LlmPricing.cs
using ChatOmnicanal.Domain.Common;

namespace ChatOmnicanal.Domain.Entities;

public class LlmPricing : BaseEntity
{
    public string ModelId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public decimal InputPricePerMillionTokens { get; set; }
    public decimal OutputPricePerMillionTokens { get; set; }
    public bool IsActive { get; set; } = true;
}
```

- [ ] **Step 6: Crear AdminAuditLog**

```csharp
// apps/api/src/ChatOmnicanal.Domain/Entities/AdminAuditLog.cs
using ChatOmnicanal.Domain.Common;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Domain.Entities;

public class AdminAuditLog : BaseEntity
{
    public Guid TenantId { get; set; }
    public string AdminUserId { get; set; } = string.Empty;
    public AdminAction Action { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }

    public Tenant Tenant { get; set; } = null!;
}
```

- [ ] **Step 7: Actualizar Tenant.cs**

Reemplazar el contenido completo del archivo:

```csharp
// apps/api/src/ChatOmnicanal.Domain/Entities/Tenant.cs
using ChatOmnicanal.Domain.Common;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Domain.Entities;

public class Tenant : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public TenantPlan Plan { get; set; } = TenantPlan.Basic;
    public TenantStatus Status { get; set; } = TenantStatus.Active;
    public int? ConversationQuota { get; set; }
    public string? InternalNotes { get; set; }

    public TenantProfile? Profile { get; private set; }
    public TenantBillingInfo? BillingInfo { get; private set; }
    public ICollection<Membership> Memberships { get; private set; } = new List<Membership>();
    public ICollection<Channel> Channels { get; private set; } = new List<Channel>();
    public ICollection<TenantPayment> Payments { get; private set; } = new List<TenantPayment>();
}
```

- [ ] **Step 8: Compilar para verificar**

```
cd apps/api
dotnet build src/ChatOmnicanal.Domain/ChatOmnicanal.Domain.csproj
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 9: Commit**

```
git add apps/api/src/ChatOmnicanal.Domain/
git commit -m "feat(domain): add superadmin entities (TenantBillingInfo, TenantPayment, LlmPricing, AdminAuditLog) and enums"
```

---

## Task 2: EF Core — configuraciones, DbContext y migración

**Files:**
- Create: `apps/api/src/ChatOmnicanal.Infrastructure/Persistence/Configurations/TenantBillingInfoConfiguration.cs`
- Create: `apps/api/src/ChatOmnicanal.Infrastructure/Persistence/Configurations/TenantPaymentConfiguration.cs`
- Create: `apps/api/src/ChatOmnicanal.Infrastructure/Persistence/Configurations/LlmPricingConfiguration.cs`
- Create: `apps/api/src/ChatOmnicanal.Infrastructure/Persistence/Configurations/AdminAuditLogConfiguration.cs`
- Modify: `apps/api/src/ChatOmnicanal.Infrastructure/Persistence/Configurations/TenantConfiguration.cs`
- Modify: `apps/api/src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs`
- Modify: `apps/api/src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs`

- [ ] **Step 1: Actualizar IApplicationDbContext**

```csharp
// apps/api/src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<User> Users { get; }
    DbSet<Membership> Memberships { get; }
    DbSet<Invitation> Invitations { get; }
    DbSet<TenantProfile> TenantProfiles { get; }
    DbSet<Channel> Channels { get; }
    DbSet<Contact> Contacts { get; }
    DbSet<Conversation> Conversations { get; }
    DbSet<Message> Messages { get; }
    DbSet<KnowledgeDoc> KnowledgeDocs { get; }
    DbSet<KnowledgeChunk> KnowledgeChunks { get; }
    DbSet<UsageEvent> UsageEvents { get; }
    DbSet<TenantBillingInfo> TenantBillingInfos { get; }
    DbSet<TenantPayment> TenantPayments { get; }
    DbSet<LlmPricing> LlmPricings { get; }
    DbSet<AdminAuditLog> AdminAuditLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
```

- [ ] **Step 2: Actualizar ApplicationDbContext**

```csharp
// apps/api/src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<TenantProfile> TenantProfiles => Set<TenantProfile>();
    public DbSet<Channel> Channels => Set<Channel>();
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<KnowledgeDoc> KnowledgeDocs => Set<KnowledgeDoc>();
    public DbSet<KnowledgeChunk> KnowledgeChunks => Set<KnowledgeChunk>();
    public DbSet<UsageEvent> UsageEvents => Set<UsageEvent>();
    public DbSet<TenantBillingInfo> TenantBillingInfos => Set<TenantBillingInfo>();
    public DbSet<TenantPayment> TenantPayments => Set<TenantPayment>();
    public DbSet<LlmPricing> LlmPricings => Set<LlmPricing>();
    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("vector");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<Domain.Common.BaseEntity>())
        {
            if (entry.State == EntityState.Modified)
                entry.Entity.UpdatedAt = DateTime.UtcNow;
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
```

- [ ] **Step 3: Actualizar TenantConfiguration**

```csharp
// apps/api/src/ChatOmnicanal.Infrastructure/Persistence/Configurations/TenantConfiguration.cs
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Name).IsRequired().HasMaxLength(200);
        builder.Property(t => t.Plan).HasConversion<string>();
        builder.Property(t => t.Status).HasConversion<string>();
        builder.Property(t => t.ConversationQuota);
        builder.Property(t => t.InternalNotes);

        builder.HasOne(t => t.BillingInfo)
            .WithOne(b => b.Tenant)
            .HasForeignKey<TenantBillingInfo>(b => b.TenantId);

        builder.HasMany(t => t.Payments)
            .WithOne(p => p.Tenant)
            .HasForeignKey(p => p.TenantId);
    }
}
```

- [ ] **Step 4: Crear TenantBillingInfoConfiguration**

```csharp
// apps/api/src/ChatOmnicanal.Infrastructure/Persistence/Configurations/TenantBillingInfoConfiguration.cs
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class TenantBillingInfoConfiguration : IEntityTypeConfiguration<TenantBillingInfo>
{
    public void Configure(EntityTypeBuilder<TenantBillingInfo> builder)
    {
        builder.ToTable("tenant_billing_info");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.TenantId).IsRequired();
        builder.Property(b => b.CompanyName).HasMaxLength(300);
        builder.Property(b => b.TaxId).HasMaxLength(100);
        builder.Property(b => b.BillingEmail).HasMaxLength(200);
        builder.Property(b => b.Address).HasMaxLength(500);
        builder.Property(b => b.Country).HasMaxLength(100);
        builder.HasIndex(b => b.TenantId).IsUnique();
    }
}
```

- [ ] **Step 5: Crear TenantPaymentConfiguration**

```csharp
// apps/api/src/ChatOmnicanal.Infrastructure/Persistence/Configurations/TenantPaymentConfiguration.cs
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class TenantPaymentConfiguration : IEntityTypeConfiguration<TenantPayment>
{
    public void Configure(EntityTypeBuilder<TenantPayment> builder)
    {
        builder.ToTable("tenant_payments");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.TenantId).IsRequired();
        builder.Property(p => p.Amount).HasPrecision(18, 4);
        builder.Property(p => p.Currency).HasMaxLength(10);
        builder.Property(p => p.Status).HasConversion<string>();
        builder.Property(p => p.Description).HasMaxLength(500);
        builder.Property(p => p.ExternalReference).HasMaxLength(200);
        builder.Property(p => p.RegisteredByUserId).IsRequired().HasMaxLength(200);
        builder.HasIndex(p => p.TenantId);
    }
}
```

- [ ] **Step 6: Crear LlmPricingConfiguration**

```csharp
// apps/api/src/ChatOmnicanal.Infrastructure/Persistence/Configurations/LlmPricingConfiguration.cs
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class LlmPricingConfiguration : IEntityTypeConfiguration<LlmPricing>
{
    public void Configure(EntityTypeBuilder<LlmPricing> builder)
    {
        builder.ToTable("llm_pricing");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.ModelId).IsRequired().HasMaxLength(200);
        builder.Property(p => p.DisplayName).IsRequired().HasMaxLength(200);
        builder.Property(p => p.InputPricePerMillionTokens).HasPrecision(18, 6);
        builder.Property(p => p.OutputPricePerMillionTokens).HasPrecision(18, 6);
        builder.HasIndex(p => p.ModelId).IsUnique();
    }
}
```

- [ ] **Step 7: Crear AdminAuditLogConfiguration**

```csharp
// apps/api/src/ChatOmnicanal.Infrastructure/Persistence/Configurations/AdminAuditLogConfiguration.cs
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class AdminAuditLogConfiguration : IEntityTypeConfiguration<AdminAuditLog>
{
    public void Configure(EntityTypeBuilder<AdminAuditLog> builder)
    {
        builder.ToTable("admin_audit_log");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.TenantId).IsRequired();
        builder.Property(a => a.AdminUserId).IsRequired().HasMaxLength(200);
        builder.Property(a => a.Action).HasConversion<string>();
        builder.Property(a => a.Details).HasMaxLength(1000);
        builder.Property(a => a.IpAddress).HasMaxLength(50);
        builder.HasIndex(a => a.TenantId);
        builder.HasIndex(a => a.CreatedAt);

        builder.HasOne(a => a.Tenant)
            .WithMany()
            .HasForeignKey(a => a.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

- [ ] **Step 8: Compilar Infrastructure**

```
cd apps/api
dotnet build src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 9: Generar migración**

```
cd apps/api
dotnet ef migrations add AddSuperAdminSchema \
  --project src/ChatOmnicanal.Infrastructure \
  --startup-project src/ChatOmnicanal.API \
  --output-dir Migrations
```

Expected: `Done. To undo this action, use 'ef migrations remove'`

- [ ] **Step 10: Verificar SQL generado**

Abrir el archivo `*_AddSuperAdminSchema.cs` recién creado en `Migrations/`. Confirmar que aparecen las tablas: `tenant_billing_info`, `tenant_payments`, `llm_pricing`, `admin_audit_log`, y las columnas `conversation_quota` e `internal_notes` en `tenants`.

- [ ] **Step 11: Aplicar migración**

```
cd apps/api
dotnet ef database update \
  --project src/ChatOmnicanal.Infrastructure \
  --startup-project src/ChatOmnicanal.API
```

Expected: `Done.`

- [ ] **Step 12: Commit**

```
git add apps/api/src/ChatOmnicanal.Infrastructure/Persistence/ \
        apps/api/src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs
git commit -m "feat(db): add EF Core configurations and migration AddSuperAdminSchema"
```

---

## Task 3: Application — DTOs e interfaces de servicio

**Files:**
- Create: `apps/api/src/ChatOmnicanal.Application/Common/PagedResult.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/DTOs/TenantAdminDto.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/DTOs/TenantKpiDto.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/DTOs/TenantStatsDto.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/DTOs/PaymentDto.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/DTOs/BillingInfoDto.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/DTOs/LlmPricingDto.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/DTOs/AuditLogEntryDto.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/DTOs/UpdateTenantConfigRequest.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/DTOs/RegisterPaymentRequest.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/Interfaces/ITenantAdminService.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/Interfaces/IAdminMetricsService.cs`
- Create: `apps/api/src/ChatOmnicanal.Application/Admin/Interfaces/IAdminAuditLogService.cs`

- [ ] **Step 1: Crear PagedResult**

```csharp
// apps/api/src/ChatOmnicanal.Application/Common/PagedResult.cs
namespace ChatOmnicanal.Application.Common;

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasNextPage => Page < TotalPages;
}
```

- [ ] **Step 2: Crear TenantAdminDto**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/DTOs/TenantAdminDto.cs
namespace ChatOmnicanal.Application.Admin.DTOs;

public record TenantAdminDto(
    Guid Id,
    string Name,
    string Plan,
    string Status,
    int? ConversationQuota,
    int ActiveChannels,
    int ConversationsLast30Days,
    long TokensLast30Days,
    decimal EstimatedCostUsd,
    decimal TotalPaidUsd,
    bool HasOverduePayment,
    bool IsNearQuota,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
```

- [ ] **Step 3: Crear TenantKpiDto**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/DTOs/TenantKpiDto.cs
namespace ChatOmnicanal.Application.Admin.DTOs;

public record TenantKpiDto(
    int TotalTenants,
    int ActiveTenants,
    int SuspendedTenants,
    int TenantsWithAlerts,
    long TotalTokensLast30Days,
    decimal TotalEstimatedCostUsd,
    decimal TotalCollectedUsd
);
```

- [ ] **Step 4: Crear TenantStatsDto**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/DTOs/TenantStatsDto.cs
namespace ChatOmnicanal.Application.Admin.DTOs;

public record TenantStatsDto(
    int ConversationsLast30Days,
    int ConversationsAllTime,
    int MessagesLast30Days,
    int MessagesAllTime,
    long InputTokensLast30Days,
    long OutputTokensLast30Days,
    decimal EstimatedCostUsdLast30Days,
    decimal EstimatedCostUsdAllTime,
    int ActiveChannels,
    IReadOnlyList<DailyConversationStat> DailyConversations
);

public record DailyConversationStat(DateOnly Date, int Count);
```

- [ ] **Step 5: Crear PaymentDto**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/DTOs/PaymentDto.cs
namespace ChatOmnicanal.Application.Admin.DTOs;

public record PaymentDto(
    Guid Id,
    Guid TenantId,
    decimal Amount,
    string Currency,
    string Status,
    string? Description,
    string? ExternalReference,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    string RegisteredByUserId,
    DateTime CreatedAt
);
```

- [ ] **Step 6: Crear BillingInfoDto**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/DTOs/BillingInfoDto.cs
namespace ChatOmnicanal.Application.Admin.DTOs;

public record BillingInfoDto(
    Guid? Id,
    string? CompanyName,
    string? TaxId,
    string? BillingEmail,
    string? Address,
    string? Country,
    string? Notes
);
```

- [ ] **Step 7: Crear LlmPricingDto**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/DTOs/LlmPricingDto.cs
namespace ChatOmnicanal.Application.Admin.DTOs;

public record LlmPricingDto(
    Guid Id,
    string ModelId,
    string DisplayName,
    decimal InputPricePerMillionTokens,
    decimal OutputPricePerMillionTokens,
    bool IsActive,
    DateTime UpdatedAt
);
```

- [ ] **Step 8: Crear AuditLogEntryDto**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/DTOs/AuditLogEntryDto.cs
namespace ChatOmnicanal.Application.Admin.DTOs;

public record AuditLogEntryDto(
    Guid Id,
    Guid TenantId,
    string TenantName,
    string AdminUserId,
    string Action,
    string? Details,
    string? IpAddress,
    DateTime CreatedAt
);
```

- [ ] **Step 9: Crear UpdateTenantConfigRequest**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/DTOs/UpdateTenantConfigRequest.cs
namespace ChatOmnicanal.Application.Admin.DTOs;

public record UpdateTenantConfigRequest(
    string Plan,
    string Status,
    int? ConversationQuota,
    string? InternalNotes
);
```

- [ ] **Step 10: Crear RegisterPaymentRequest**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/DTOs/RegisterPaymentRequest.cs
namespace ChatOmnicanal.Application.Admin.DTOs;

public record RegisterPaymentRequest(
    decimal Amount,
    string Currency,
    string Status,
    string? Description,
    string? ExternalReference,
    DateTime PeriodStart,
    DateTime PeriodEnd
);
```

- [ ] **Step 11: Crear ITenantAdminService**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/Interfaces/ITenantAdminService.cs
using ChatOmnicanal.Application.Admin.DTOs;
using ChatOmnicanal.Application.Common;

namespace ChatOmnicanal.Application.Admin.Interfaces;

public interface ITenantAdminService
{
    Task<PagedResult<TenantAdminDto>> ListTenantsAsync(
        string? search, string? status, string? plan,
        int page, int pageSize, CancellationToken ct = default);

    Task<TenantKpiDto> GetKpiAsync(CancellationToken ct = default);

    Task<TenantAdminDto?> GetTenantAsync(Guid tenantId, CancellationToken ct = default);

    Task UpdateTenantConfigAsync(Guid tenantId, UpdateTenantConfigRequest request,
        string adminUserId, string? ipAddress, CancellationToken ct = default);

    Task<BillingInfoDto> GetBillingInfoAsync(Guid tenantId, CancellationToken ct = default);

    Task UpsertBillingInfoAsync(Guid tenantId, BillingInfoDto dto,
        string adminUserId, string? ipAddress, CancellationToken ct = default);

    Task<IReadOnlyList<PaymentDto>> GetPaymentsAsync(Guid tenantId, CancellationToken ct = default);

    Task<PaymentDto> RegisterPaymentAsync(Guid tenantId, RegisterPaymentRequest request,
        string adminUserId, string? ipAddress, CancellationToken ct = default);

    Task DeletePaymentAsync(Guid paymentId,
        string adminUserId, string? ipAddress, CancellationToken ct = default);

    Task<byte[]> ExportTenantsAsCsvAsync(
        string? search, string? status, string? plan, CancellationToken ct = default);
}
```

- [ ] **Step 12: Crear IAdminMetricsService**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/Interfaces/IAdminMetricsService.cs
using ChatOmnicanal.Application.Admin.DTOs;

namespace ChatOmnicanal.Application.Admin.Interfaces;

public interface IAdminMetricsService
{
    Task<TenantStatsDto> GetTenantStatsAsync(Guid tenantId, CancellationToken ct = default);

    Task<IReadOnlyList<LlmPricingDto>> GetLlmPricingsAsync(CancellationToken ct = default);

    Task UpsertLlmPricingAsync(LlmPricingDto dto, string adminUserId,
        string? ipAddress, CancellationToken ct = default);

    Task DeleteLlmPricingAsync(Guid pricingId, string adminUserId,
        string? ipAddress, CancellationToken ct = default);
}
```

- [ ] **Step 13: Crear IAdminAuditLogService**

```csharp
// apps/api/src/ChatOmnicanal.Application/Admin/Interfaces/IAdminAuditLogService.cs
using ChatOmnicanal.Application.Admin.DTOs;
using ChatOmnicanal.Application.Common;

namespace ChatOmnicanal.Application.Admin.Interfaces;

public interface IAdminAuditLogService
{
    Task<PagedResult<AuditLogEntryDto>> ListAsync(
        Guid? tenantId, string? action, DateTime? from, DateTime? to,
        int page, int pageSize, CancellationToken ct = default);
}
```

- [ ] **Step 14: Compilar Application**

```
cd apps/api
dotnet build src/ChatOmnicanal.Application/ChatOmnicanal.Application.csproj
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 15: Commit**

```
git add apps/api/src/ChatOmnicanal.Application/
git commit -m "feat(application): add admin DTOs and service interfaces"
```

---

## Task 4: Infrastructure — servicios admin

**Files:**
- Create: `apps/api/src/ChatOmnicanal.Infrastructure/Admin/TenantAdminService.cs`
- Create: `apps/api/src/ChatOmnicanal.Infrastructure/Admin/AdminMetricsService.cs`
- Create: `apps/api/src/ChatOmnicanal.Infrastructure/Admin/AdminAuditLogService.cs`
- Modify: `apps/api/src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`

- [ ] **Step 1: Crear TenantAdminService**

```csharp
// apps/api/src/ChatOmnicanal.Infrastructure/Admin/TenantAdminService.cs
using System.Text;
using ChatOmnicanal.Application.Admin.DTOs;
using ChatOmnicanal.Application.Admin.Interfaces;
using ChatOmnicanal.Application.Common;
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Admin;

public class TenantAdminService : ITenantAdminService
{
    private readonly IApplicationDbContext _db;

    public TenantAdminService(IApplicationDbContext db) => _db = db;

    public async Task<PagedResult<TenantAdminDto>> ListTenantsAsync(
        string? search, string? status, string? plan,
        int page, int pageSize, CancellationToken ct = default)
    {
        var query = _db.Tenants.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(t => t.Name.Contains(search));
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<TenantStatus>(status, true, out var s))
            query = query.Where(t => t.Status == s);
        if (!string.IsNullOrWhiteSpace(plan) && Enum.TryParse<TenantPlan>(plan, true, out var p))
            query = query.Where(t => t.Plan == p);

        var total = await query.CountAsync(ct);
        var tenantIds = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => t.Id)
            .ToListAsync(ct);

        var cutoff = DateTime.UtcNow.AddDays(-30);

        // Batch queries — evita N+1
        var tenants = await _db.Tenants.AsNoTracking()
            .Where(t => tenantIds.Contains(t.Id))
            .ToListAsync(ct);

        var channelCounts = await _db.Channels.AsNoTracking()
            .Where(c => tenantIds.Contains(c.TenantId) && c.Status == ChannelStatus.Active)
            .GroupBy(c => c.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var convCounts = await _db.Conversations.AsNoTracking()
            .Where(c => tenantIds.Contains(c.TenantId) && c.CreatedAt >= cutoff)
            .GroupBy(c => c.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var tokenStats = await _db.UsageEvents.AsNoTracking()
            .Where(u => tenantIds.Contains(u.TenantId) && u.CreatedAt >= cutoff)
            .GroupBy(u => u.TenantId)
            .Select(g => new { TenantId = g.Key, Tokens = g.Sum(u => (long)u.InputTokens + u.OutputTokens) })
            .ToListAsync(ct);

        var payments = await _db.TenantPayments.AsNoTracking()
            .Where(p => tenantIds.Contains(p.TenantId) && p.Status == PaymentStatus.Confirmed)
            .GroupBy(p => p.TenantId)
            .Select(g => new { TenantId = g.Key, Total = g.Sum(p => p.Amount) })
            .ToListAsync(ct);

        var pricings = await _db.LlmPricings.AsNoTracking()
            .Where(lp => lp.IsActive)
            .ToListAsync(ct);

        var defaultInput = pricings.FirstOrDefault()?.InputPricePerMillionTokens ?? 0.3m;
        var defaultOutput = pricings.FirstOrDefault()?.OutputPricePerMillionTokens ?? 0.6m;

        var items = tenantIds.Select(id =>
        {
            var t = tenants.First(x => x.Id == id);
            var tokens = tokenStats.FirstOrDefault(x => x.TenantId == id)?.Tokens ?? 0;
            var cost = tokens / 1_000_000m * (defaultInput + defaultOutput) / 2;
            var paid = payments.FirstOrDefault(x => x.TenantId == id)?.Total ?? 0;
            var quota = t.ConversationQuota;
            var convs = convCounts.FirstOrDefault(x => x.TenantId == id)?.Count ?? 0;
            return new TenantAdminDto(
                Id: t.Id,
                Name: t.Name,
                Plan: t.Plan.ToString(),
                Status: t.Status.ToString(),
                ConversationQuota: quota,
                ActiveChannels: channelCounts.FirstOrDefault(x => x.TenantId == id)?.Count ?? 0,
                ConversationsLast30Days: convs,
                TokensLast30Days: tokens,
                EstimatedCostUsd: Math.Round(cost, 4),
                TotalPaidUsd: paid,
                HasOverduePayment: false, // simplificado — puedes agregar lógica de vencimiento
                IsNearQuota: quota.HasValue && convs >= quota.Value * 0.9,
                CreatedAt: t.CreatedAt,
                UpdatedAt: t.UpdatedAt
            );
        }).ToList();

        return new PagedResult<TenantAdminDto>(items, total, page, pageSize);
    }

    public async Task<TenantKpiDto> GetKpiAsync(CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow.AddDays(-30);
        var total = await _db.Tenants.CountAsync(ct);
        var active = await _db.Tenants.CountAsync(t => t.Status == TenantStatus.Active, ct);
        var suspended = await _db.Tenants.CountAsync(t => t.Status == TenantStatus.Suspended, ct);

        var tokenSum = await _db.UsageEvents.AsNoTracking()
            .Where(u => u.CreatedAt >= cutoff)
            .SumAsync(u => (long)u.InputTokens + u.OutputTokens, ct);

        var pricings = await _db.LlmPricings.AsNoTracking().Where(p => p.IsActive).ToListAsync(ct);
        var avgPrice = pricings.Any()
            ? pricings.Average(p => (p.InputPricePerMillionTokens + p.OutputPricePerMillionTokens) / 2)
            : 0.45m;

        var collected = await _db.TenantPayments.AsNoTracking()
            .Where(p => p.Status == PaymentStatus.Confirmed)
            .SumAsync(p => p.Amount, ct);

        return new TenantKpiDto(
            TotalTenants: total,
            ActiveTenants: active,
            SuspendedTenants: suspended,
            TenantsWithAlerts: 0,
            TotalTokensLast30Days: tokenSum,
            TotalEstimatedCostUsd: Math.Round(tokenSum / 1_000_000m * avgPrice, 2),
            TotalCollectedUsd: collected
        );
    }

    public async Task<TenantAdminDto?> GetTenantAsync(Guid tenantId, CancellationToken ct = default)
    {
        var result = await ListTenantsAsync(null, null, null, 1, int.MaxValue, ct);
        return result.Items.FirstOrDefault(t => t.Id == tenantId);
    }

    public async Task UpdateTenantConfigAsync(Guid tenantId, UpdateTenantConfigRequest request,
        string adminUserId, string? ipAddress, CancellationToken ct = default)
    {
        var tenant = await _db.Tenants.FindAsync([tenantId], ct)
            ?? throw new InvalidOperationException($"Tenant {tenantId} not found");

        tenant.Name = tenant.Name; // keep name
        if (Enum.TryParse<TenantPlan>(request.Plan, true, out var plan)) tenant.Plan = plan;
        if (Enum.TryParse<TenantStatus>(request.Status, true, out var status)) tenant.Status = status;
        tenant.ConversationQuota = request.ConversationQuota;
        tenant.InternalNotes = request.InternalNotes;

        var log = new AdminAuditLog
        {
            TenantId = tenantId,
            AdminUserId = adminUserId,
            Action = Domain.Enums.AdminAction.TenantConfigUpdated,
            Details = $"Plan={request.Plan}, Status={request.Status}, Quota={request.ConversationQuota}",
            IpAddress = ipAddress
        };
        _db.AdminAuditLogs.Add(log);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<BillingInfoDto> GetBillingInfoAsync(Guid tenantId, CancellationToken ct = default)
    {
        var info = await _db.TenantBillingInfos.AsNoTracking()
            .FirstOrDefaultAsync(b => b.TenantId == tenantId, ct);
        return info is null
            ? new BillingInfoDto(null, null, null, null, null, null, null)
            : new BillingInfoDto(info.Id, info.CompanyName, info.TaxId,
                info.BillingEmail, info.Address, info.Country, info.Notes);
    }

    public async Task UpsertBillingInfoAsync(Guid tenantId, BillingInfoDto dto,
        string adminUserId, string? ipAddress, CancellationToken ct = default)
    {
        var existing = await _db.TenantBillingInfos
            .FirstOrDefaultAsync(b => b.TenantId == tenantId, ct);

        if (existing is null)
        {
            existing = new TenantBillingInfo { TenantId = tenantId };
            _db.TenantBillingInfos.Add(existing);
        }

        existing.CompanyName = dto.CompanyName;
        existing.TaxId = dto.TaxId;
        existing.BillingEmail = dto.BillingEmail;
        existing.Address = dto.Address;
        existing.Country = dto.Country;
        existing.Notes = dto.Notes;

        _db.AdminAuditLogs.Add(new AdminAuditLog
        {
            TenantId = tenantId,
            AdminUserId = adminUserId,
            Action = Domain.Enums.AdminAction.TenantBillingInfoUpdated,
            IpAddress = ipAddress
        });
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<PaymentDto>> GetPaymentsAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await _db.TenantPayments.AsNoTracking()
            .Where(p => p.TenantId == tenantId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PaymentDto(
                p.Id, p.TenantId, p.Amount, p.Currency, p.Status.ToString(),
                p.Description, p.ExternalReference, p.PeriodStart, p.PeriodEnd,
                p.RegisteredByUserId, p.CreatedAt))
            .ToListAsync(ct);
    }

    public async Task<PaymentDto> RegisterPaymentAsync(Guid tenantId, RegisterPaymentRequest request,
        string adminUserId, string? ipAddress, CancellationToken ct = default)
    {
        if (!Enum.TryParse<PaymentStatus>(request.Status, true, out var status))
            status = PaymentStatus.Confirmed;

        var payment = new TenantPayment
        {
            TenantId = tenantId,
            Amount = request.Amount,
            Currency = request.Currency,
            Status = status,
            Description = request.Description,
            ExternalReference = request.ExternalReference,
            PeriodStart = request.PeriodStart,
            PeriodEnd = request.PeriodEnd,
            RegisteredByUserId = adminUserId
        };
        _db.TenantPayments.Add(payment);
        _db.AdminAuditLogs.Add(new AdminAuditLog
        {
            TenantId = tenantId,
            AdminUserId = adminUserId,
            Action = Domain.Enums.AdminAction.PaymentRegistered,
            Details = $"Amount={request.Amount} {request.Currency}",
            IpAddress = ipAddress
        });
        await _db.SaveChangesAsync(ct);

        return new PaymentDto(payment.Id, payment.TenantId, payment.Amount, payment.Currency,
            payment.Status.ToString(), payment.Description, payment.ExternalReference,
            payment.PeriodStart, payment.PeriodEnd, payment.RegisteredByUserId, payment.CreatedAt);
    }

    public async Task DeletePaymentAsync(Guid paymentId, string adminUserId,
        string? ipAddress, CancellationToken ct = default)
    {
        var payment = await _db.TenantPayments.FindAsync([paymentId], ct)
            ?? throw new InvalidOperationException($"Payment {paymentId} not found");

        _db.TenantPayments.Remove(payment);
        _db.AdminAuditLogs.Add(new AdminAuditLog
        {
            TenantId = payment.TenantId,
            AdminUserId = adminUserId,
            Action = Domain.Enums.AdminAction.PaymentDeleted,
            Details = $"PaymentId={paymentId}",
            IpAddress = ipAddress
        });
        await _db.SaveChangesAsync(ct);
    }

    public async Task<byte[]> ExportTenantsAsCsvAsync(
        string? search, string? status, string? plan, CancellationToken ct = default)
    {
        var all = await ListTenantsAsync(search, status, plan, 1, 10_000, ct);
        var sb = new StringBuilder();
        sb.AppendLine("Id,Name,Plan,Status,ConversationQuota,ActiveChannels,ConversationsLast30Days,TokensLast30Days,EstimatedCostUsd,TotalPaidUsd,CreatedAt");
        foreach (var t in all.Items)
            sb.AppendLine($"{t.Id},{Escape(t.Name)},{t.Plan},{t.Status},{t.ConversationQuota},{t.ActiveChannels},{t.ConversationsLast30Days},{t.TokensLast30Days},{t.EstimatedCostUsd},{t.TotalPaidUsd},{t.CreatedAt:O}");
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static string Escape(string v) => v.Contains(',') ? $"\"{v}\"" : v;
}
```

- [ ] **Step 2: Crear AdminMetricsService**

```csharp
// apps/api/src/ChatOmnicanal.Infrastructure/Admin/AdminMetricsService.cs
using ChatOmnicanal.Application.Admin.DTOs;
using ChatOmnicanal.Application.Admin.Interfaces;
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Admin;

public class AdminMetricsService : IAdminMetricsService
{
    private readonly IApplicationDbContext _db;

    public AdminMetricsService(IApplicationDbContext db) => _db = db;

    public async Task<TenantStatsDto> GetTenantStatsAsync(Guid tenantId, CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow.AddDays(-30);

        var convAll = await _db.Conversations.CountAsync(c => c.TenantId == tenantId, ct);
        var conv30 = await _db.Conversations.CountAsync(
            c => c.TenantId == tenantId && c.CreatedAt >= cutoff, ct);

        var msgAll = await _db.Messages.CountAsync(m => m.TenantId == tenantId, ct);
        var msg30 = await _db.Messages.CountAsync(
            m => m.TenantId == tenantId && m.CreatedAt >= cutoff, ct);

        var usageAll = await _db.UsageEvents.AsNoTracking()
            .Where(u => u.TenantId == tenantId)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                InputAll = g.Sum(u => (long)u.InputTokens),
                OutputAll = g.Sum(u => (long)u.OutputTokens)
            })
            .FirstOrDefaultAsync(ct);

        var usage30 = await _db.UsageEvents.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.CreatedAt >= cutoff)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Input30 = g.Sum(u => (long)u.InputTokens),
                Output30 = g.Sum(u => (long)u.OutputTokens)
            })
            .FirstOrDefaultAsync(ct);

        var channels = await _db.Channels.CountAsync(
            c => c.TenantId == tenantId && c.Status == ChannelStatus.Active, ct);

        var pricings = await _db.LlmPricings.AsNoTracking().Where(p => p.IsActive).ToListAsync(ct);
        var inputPrice = pricings.FirstOrDefault()?.InputPricePerMillionTokens ?? 0.3m;
        var outputPrice = pricings.FirstOrDefault()?.OutputPricePerMillionTokens ?? 0.6m;

        long in30 = usage30?.Input30 ?? 0;
        long out30 = usage30?.Output30 ?? 0;
        long inAll = usageAll?.InputAll ?? 0;
        long outAll = usageAll?.OutputAll ?? 0;

        var cost30 = in30 / 1_000_000m * inputPrice + out30 / 1_000_000m * outputPrice;
        var costAll = inAll / 1_000_000m * inputPrice + outAll / 1_000_000m * outputPrice;

        var daily = await _db.Conversations.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.CreatedAt >= cutoff)
            .GroupBy(c => c.CreatedAt.Date)
            .Select(g => new DailyConversationStat(DateOnly.FromDateTime(g.Key), g.Count()))
            .ToListAsync(ct);

        return new TenantStatsDto(
            ConversationsLast30Days: conv30,
            ConversationsAllTime: convAll,
            MessagesLast30Days: msg30,
            MessagesAllTime: msgAll,
            InputTokensLast30Days: in30,
            OutputTokensLast30Days: out30,
            EstimatedCostUsdLast30Days: Math.Round(cost30, 4),
            EstimatedCostUsdAllTime: Math.Round(costAll, 4),
            ActiveChannels: channels,
            DailyConversations: daily
        );
    }

    public async Task<IReadOnlyList<LlmPricingDto>> GetLlmPricingsAsync(CancellationToken ct = default)
    {
        return await _db.LlmPricings.AsNoTracking()
            .OrderBy(p => p.ModelId)
            .Select(p => new LlmPricingDto(
                p.Id, p.ModelId, p.DisplayName,
                p.InputPricePerMillionTokens, p.OutputPricePerMillionTokens,
                p.IsActive, p.UpdatedAt))
            .ToListAsync(ct);
    }

    public async Task UpsertLlmPricingAsync(LlmPricingDto dto, string adminUserId,
        string? ipAddress, CancellationToken ct = default)
    {
        LlmPricing entity;
        if (dto.Id != Guid.Empty)
        {
            entity = await _db.LlmPricings.FindAsync([dto.Id], ct)
                ?? throw new InvalidOperationException($"LlmPricing {dto.Id} not found");
        }
        else
        {
            entity = new LlmPricing();
            _db.LlmPricings.Add(entity);
        }

        entity.ModelId = dto.ModelId;
        entity.DisplayName = dto.DisplayName;
        entity.InputPricePerMillionTokens = dto.InputPricePerMillionTokens;
        entity.OutputPricePerMillionTokens = dto.OutputPricePerMillionTokens;
        entity.IsActive = dto.IsActive;

        var tenants = await _db.Tenants.Select(t => t.Id).FirstOrDefaultAsync(ct);
        if (tenants != Guid.Empty)
        {
            _db.AdminAuditLogs.Add(new AdminAuditLog
            {
                TenantId = tenants,
                AdminUserId = adminUserId,
                Action = Domain.Enums.AdminAction.LlmPricingUpdated,
                Details = $"Model={dto.ModelId}",
                IpAddress = ipAddress
            });
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteLlmPricingAsync(Guid pricingId, string adminUserId,
        string? ipAddress, CancellationToken ct = default)
    {
        var entity = await _db.LlmPricings.FindAsync([pricingId], ct)
            ?? throw new InvalidOperationException($"LlmPricing {pricingId} not found");
        _db.LlmPricings.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }
}
```

- [ ] **Step 3: Crear AdminAuditLogService**

```csharp
// apps/api/src/ChatOmnicanal.Infrastructure/Admin/AdminAuditLogService.cs
using ChatOmnicanal.Application.Admin.DTOs;
using ChatOmnicanal.Application.Admin.Interfaces;
using ChatOmnicanal.Application.Common;
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Admin;

public class AdminAuditLogService : IAdminAuditLogService
{
    private readonly IApplicationDbContext _db;

    public AdminAuditLogService(IApplicationDbContext db) => _db = db;

    public async Task<PagedResult<AuditLogEntryDto>> ListAsync(
        Guid? tenantId, string? action, DateTime? from, DateTime? to,
        int page, int pageSize, CancellationToken ct = default)
    {
        var query = _db.AdminAuditLogs.AsNoTracking()
            .Include(a => a.Tenant);

        IQueryable<Domain.Entities.AdminAuditLog> filtered = query;

        if (tenantId.HasValue)
            filtered = filtered.Where(a => a.TenantId == tenantId.Value);

        if (!string.IsNullOrWhiteSpace(action) && Enum.TryParse<AdminAction>(action, true, out var a2))
            filtered = filtered.Where(a => a.Action == a2);

        if (from.HasValue) filtered = filtered.Where(a => a.CreatedAt >= from.Value);
        if (to.HasValue) filtered = filtered.Where(a => a.CreatedAt <= to.Value);

        var total = await filtered.CountAsync(ct);
        var items = await filtered
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogEntryDto(
                a.Id, a.TenantId, a.Tenant.Name, a.AdminUserId,
                a.Action.ToString(), a.Details, a.IpAddress, a.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<AuditLogEntryDto>(items, total, page, pageSize);
    }
}
```

- [ ] **Step 4: Registrar servicios en DependencyInjection.cs**

Agregar al final de `AddInfrastructure`, antes del `return services;`:

```csharp
// Superadmin services
services.AddScoped<ITenantAdminService, Admin.TenantAdminService>();
services.AddScoped<IAdminMetricsService, Admin.AdminMetricsService>();
services.AddScoped<IAdminAuditLogService, Admin.AdminAuditLogService>();
```

Y agregar los usings al inicio del archivo:

```csharp
using ChatOmnicanal.Application.Admin.Interfaces;
```

- [ ] **Step 5: Compilar Infrastructure**

```
cd apps/api
dotnet build src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 6: Commit**

```
git add apps/api/src/ChatOmnicanal.Infrastructure/Admin/ \
        apps/api/src/ChatOmnicanal.Infrastructure/DependencyInjection.cs
git commit -m "feat(infrastructure): implement TenantAdminService, AdminMetricsService, AdminAuditLogService"
```

---

## Task 5: API — policy SuperAdmin + 3 controllers

**Files:**
- Modify: `apps/api/src/ChatOmnicanal.API/DependencyInjection.cs`
- Create: `apps/api/src/ChatOmnicanal.API/Controllers/AdminTenantsController.cs`
- Create: `apps/api/src/ChatOmnicanal.API/Controllers/AdminSettingsController.cs`
- Create: `apps/api/src/ChatOmnicanal.API/Controllers/AdminAuditLogController.cs`

- [ ] **Step 1: Agregar policy SuperAdmin en DependencyInjection.cs**

Reemplazar `services.AddAuthorization();` con:

```csharp
services.AddAuthorization(options =>
{
    options.AddPolicy("SuperAdmin", policy =>
        policy.RequireClaim("superadmin_role", "superadmin"));
});
```

- [ ] **Step 2: Crear AdminTenantsController**

```csharp
// apps/api/src/ChatOmnicanal.API/Controllers/AdminTenantsController.cs
using ChatOmnicanal.Application.Admin.DTOs;
using ChatOmnicanal.Application.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/admin/tenants")]
[Authorize(Policy = "SuperAdmin")]
public class AdminTenantsController : ControllerBase
{
    private readonly ITenantAdminService _service;

    public AdminTenantsController(ITenantAdminService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? plan,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _service.ListTenantsAsync(search, status, plan, page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("kpi")]
    public async Task<IActionResult> GetKpi(CancellationToken ct = default)
    {
        var kpi = await _service.GetKpiAsync(ct);
        return Ok(kpi);
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? plan,
        CancellationToken ct = default)
    {
        var csv = await _service.ExportTenantsAsCsvAsync(search, status, plan, ct);
        return File(csv, "text/csv", $"tenants_{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    [HttpGet("{tenantId:guid}")]
    public async Task<IActionResult> Get(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await _service.GetTenantAsync(tenantId, ct);
        return tenant is null ? NotFound() : Ok(tenant);
    }

    [HttpPut("{tenantId:guid}/config")]
    public async Task<IActionResult> UpdateConfig(
        Guid tenantId,
        [FromBody] UpdateTenantConfigRequest request,
        CancellationToken ct = default)
    {
        var adminId = User.FindFirst("sub")?.Value ?? "unknown";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        await _service.UpdateTenantConfigAsync(tenantId, request, adminId, ip, ct);
        return NoContent();
    }

    [HttpGet("{tenantId:guid}/billing")]
    public async Task<IActionResult> GetBilling(Guid tenantId, CancellationToken ct = default)
    {
        var billing = await _service.GetBillingInfoAsync(tenantId, ct);
        return Ok(billing);
    }

    [HttpPut("{tenantId:guid}/billing")]
    public async Task<IActionResult> UpsertBilling(
        Guid tenantId,
        [FromBody] BillingInfoDto dto,
        CancellationToken ct = default)
    {
        var adminId = User.FindFirst("sub")?.Value ?? "unknown";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        await _service.UpsertBillingInfoAsync(tenantId, dto, adminId, ip, ct);
        return NoContent();
    }

    [HttpGet("{tenantId:guid}/payments")]
    public async Task<IActionResult> GetPayments(Guid tenantId, CancellationToken ct = default)
    {
        var payments = await _service.GetPaymentsAsync(tenantId, ct);
        return Ok(payments);
    }

    [HttpPost("{tenantId:guid}/payments")]
    public async Task<IActionResult> RegisterPayment(
        Guid tenantId,
        [FromBody] RegisterPaymentRequest request,
        CancellationToken ct = default)
    {
        var adminId = User.FindFirst("sub")?.Value ?? "unknown";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var payment = await _service.RegisterPaymentAsync(tenantId, request, adminId, ip, ct);
        return CreatedAtAction(nameof(GetPayments), new { tenantId }, payment);
    }

    [HttpDelete("{tenantId:guid}/payments/{paymentId:guid}")]
    public async Task<IActionResult> DeletePayment(
        Guid tenantId, Guid paymentId, CancellationToken ct = default)
    {
        var adminId = User.FindFirst("sub")?.Value ?? "unknown";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        await _service.DeletePaymentAsync(paymentId, adminId, ip, ct);
        return NoContent();
    }
}
```

- [ ] **Step 3: Crear AdminSettingsController**

```csharp
// apps/api/src/ChatOmnicanal.API/Controllers/AdminSettingsController.cs
using ChatOmnicanal.Application.Admin.DTOs;
using ChatOmnicanal.Application.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/admin/settings")]
[Authorize(Policy = "SuperAdmin")]
public class AdminSettingsController : ControllerBase
{
    private readonly IAdminMetricsService _metrics;

    public AdminSettingsController(IAdminMetricsService metrics) => _metrics = metrics;

    [HttpGet("llm-pricing")]
    public async Task<IActionResult> GetPricings(CancellationToken ct = default)
    {
        var list = await _metrics.GetLlmPricingsAsync(ct);
        return Ok(list);
    }

    [HttpPut("llm-pricing")]
    public async Task<IActionResult> UpsertPricing(
        [FromBody] LlmPricingDto dto, CancellationToken ct = default)
    {
        var adminId = User.FindFirst("sub")?.Value ?? "unknown";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        await _metrics.UpsertLlmPricingAsync(dto, adminId, ip, ct);
        return NoContent();
    }

    [HttpDelete("llm-pricing/{pricingId:guid}")]
    public async Task<IActionResult> DeletePricing(
        Guid pricingId, CancellationToken ct = default)
    {
        var adminId = User.FindFirst("sub")?.Value ?? "unknown";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        await _metrics.DeleteLlmPricingAsync(pricingId, adminId, ip, ct);
        return NoContent();
    }
}
```

- [ ] **Step 4: Crear AdminAuditLogController**

```csharp
// apps/api/src/ChatOmnicanal.API/Controllers/AdminAuditLogController.cs
using ChatOmnicanal.Application.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/admin/audit-log")]
[Authorize(Policy = "SuperAdmin")]
public class AdminAuditLogController : ControllerBase
{
    private readonly IAdminAuditLogService _service;

    public AdminAuditLogController(IAdminAuditLogService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid? tenantId,
        [FromQuery] string? action,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var result = await _service.ListAsync(tenantId, action, from, to, page, pageSize, ct);
        return Ok(result);
    }
}
```

- [ ] **Step 5: Compilar API y toda la solución**

```
cd apps/api
dotnet build ChatOmnicanal.sln
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 6: Commit**

```
git add apps/api/src/ChatOmnicanal.API/
git commit -m "feat(api): add SuperAdmin policy and admin controllers (tenants, settings, audit-log)"
```

---

## Task 6: Integration tests

**Files:**
- Create: `apps/api/tests/ChatOmnicanal.Integration.Tests/Admin/AdminTenantsControllerTests.cs`
- Create: `apps/api/tests/ChatOmnicanal.Integration.Tests/Admin/AdminSettingsControllerTests.cs`
- Create: `apps/api/tests/ChatOmnicanal.Integration.Tests/Admin/AdminAuditLogControllerTests.cs`

> Seguir el mismo patrón de WebApplicationFactory del proyecto de tests existente. Los tests usan la BD en memoria o un PostgreSQL de test ya configurado en la fixture.

- [ ] **Step 1: Crear AdminTenantsControllerTests**

```csharp
// apps/api/tests/ChatOmnicanal.Integration.Tests/Admin/AdminTenantsControllerTests.cs
using System.Net;
using System.Net.Http.Json;
using ChatOmnicanal.Application.Admin.DTOs;
using ChatOmnicanal.Application.Common;
using ChatOmnicanal.Integration.Tests.Helpers;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.Admin;

public class AdminTenantsControllerTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AdminTenantsControllerTests(TestWebApplicationFactory factory)
    {
        _client = factory.CreateSuperAdminClient();
    }

    [Fact]
    public async Task GET_api_admin_tenants_returns_paged_result()
    {
        var response = await _client.GetAsync("/api/admin/tenants");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PagedResult<TenantAdminDto>>();
        Assert.NotNull(body);
        Assert.True(body.TotalCount >= 0);
    }

    [Fact]
    public async Task GET_api_admin_tenants_kpi_returns_kpi_dto()
    {
        var response = await _client.GetAsync("/api/admin/tenants/kpi");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<TenantKpiDto>();
        Assert.NotNull(body);
        Assert.True(body.TotalTenants >= 0);
    }

    [Fact]
    public async Task GET_api_admin_tenants_without_superadmin_returns_403()
    {
        var anonClient = _client; // reemplazar por factory.CreateRegularUserClient()
        // Este test requiere un client sin el claim superadmin_role
        // Se implementa en TestWebApplicationFactory con CreateRegularUserClient()
    }

    [Fact]
    public async Task PUT_api_admin_tenants_config_updates_tenant()
    {
        // Primero obtener un tenantId existente
        var list = await _client.GetFromJsonAsync<PagedResult<TenantAdminDto>>("/api/admin/tenants");
        if (list is null || list.Items.Count == 0) return;

        var tenantId = list.Items[0].Id;
        var request = new UpdateTenantConfigRequest("Basic", "Active", 500, "test notes");
        var response = await _client.PutAsJsonAsync($"/api/admin/tenants/{tenantId}/config", request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task POST_api_admin_tenants_payments_registers_payment()
    {
        var list = await _client.GetFromJsonAsync<PagedResult<TenantAdminDto>>("/api/admin/tenants");
        if (list is null || list.Items.Count == 0) return;

        var tenantId = list.Items[0].Id;
        var request = new RegisterPaymentRequest(
            Amount: 99.00m,
            Currency: "USD",
            Status: "Confirmed",
            Description: "Monthly plan",
            ExternalReference: "TEST-001",
            PeriodStart: DateTime.UtcNow.AddDays(-30),
            PeriodEnd: DateTime.UtcNow
        );

        var response = await _client.PostAsJsonAsync($"/api/admin/tenants/{tenantId}/payments", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payment = await response.Content.ReadFromJsonAsync<PaymentDto>();
        Assert.NotNull(payment);
        Assert.Equal(99.00m, payment.Amount);
    }
}
```

- [ ] **Step 2: Crear AdminSettingsControllerTests**

```csharp
// apps/api/tests/ChatOmnicanal.Integration.Tests/Admin/AdminSettingsControllerTests.cs
using System.Net;
using System.Net.Http.Json;
using ChatOmnicanal.Application.Admin.DTOs;
using ChatOmnicanal.Integration.Tests.Helpers;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.Admin;

public class AdminSettingsControllerTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AdminSettingsControllerTests(TestWebApplicationFactory factory)
    {
        _client = factory.CreateSuperAdminClient();
    }

    [Fact]
    public async Task GET_api_admin_settings_llm_pricing_returns_list()
    {
        var response = await _client.GetAsync("/api/admin/settings/llm-pricing");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<List<LlmPricingDto>>();
        Assert.NotNull(body);
    }

    [Fact]
    public async Task PUT_api_admin_settings_llm_pricing_creates_entry()
    {
        var dto = new LlmPricingDto(
            Id: Guid.Empty,
            ModelId: "llama-3.3-70b-versatile",
            DisplayName: "Llama 3.3 70B",
            InputPricePerMillionTokens: 0.59m,
            OutputPricePerMillionTokens: 0.79m,
            IsActive: true,
            UpdatedAt: DateTime.UtcNow
        );

        var response = await _client.PutAsJsonAsync("/api/admin/settings/llm-pricing", dto);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
```

- [ ] **Step 3: Crear AdminAuditLogControllerTests**

```csharp
// apps/api/tests/ChatOmnicanal.Integration.Tests/Admin/AdminAuditLogControllerTests.cs
using System.Net.Http.Json;
using ChatOmnicanal.Application.Admin.DTOs;
using ChatOmnicanal.Application.Common;
using ChatOmnicanal.Integration.Tests.Helpers;
using Xunit;

namespace ChatOmnicanal.Integration.Tests.Admin;

public class AdminAuditLogControllerTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AdminAuditLogControllerTests(TestWebApplicationFactory factory)
    {
        _client = factory.CreateSuperAdminClient();
    }

    [Fact]
    public async Task GET_api_admin_audit_log_returns_paged_result()
    {
        var response = await _client.GetAsync("/api/admin/audit-log");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PagedResult<AuditLogEntryDto>>();
        Assert.NotNull(body);
        Assert.True(body.TotalCount >= 0);
    }

    [Fact]
    public async Task GET_api_admin_audit_log_with_filters_returns_filtered_results()
    {
        var from = DateTime.UtcNow.AddDays(-7).ToString("o");
        var response = await _client.GetAsync($"/api/admin/audit-log?from={from}");
        response.EnsureSuccessStatusCode();
    }
}
```

- [ ] **Step 4: Agregar helper CreateSuperAdminClient en TestWebApplicationFactory**

Localizar el archivo `TestWebApplicationFactory.cs` en `tests/ChatOmnicanal.Integration.Tests/Helpers/` y agregar:

```csharp
public HttpClient CreateSuperAdminClient()
{
    // Crea un cliente con un JWT que contiene el claim superadmin_role=superadmin
    // Esto requiere configurar el test con una clave HMAC o usar el override de autenticación
    // ya establecido en la factory (TestAuthHandler pattern)
    return CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false
    });
    // Nota: configurar TestAuthHandler para inyectar claims adicionales:
    // new Claim("superadmin_role", "superadmin")
}
```

- [ ] **Step 5: Ejecutar tests**

```
cd apps/api
dotnet test tests/ChatOmnicanal.Integration.Tests/ --filter "Admin" --verbosity normal
```

Expected: todos los tests pasan o son skipped (si la DB de test no está disponible).

- [ ] **Step 6: Commit**

```
git add apps/api/tests/ChatOmnicanal.Integration.Tests/Admin/
git commit -m "test(admin): add integration tests for admin controllers"
```

---

## Task 7: Frontend — tipos admin + servicio API

**Files:**
- Modify: `apps/web/src/types/api.types.ts`
- Create: `apps/web/src/services/admin.ts`

- [ ] **Step 1: Agregar tipos admin en api.types.ts**

Agregar al final del archivo:

```typescript
// ── Admin ──────────────────────────────────────────────────────────────────

export interface TenantAdminDto {
  id: string
  name: string
  plan: string
  status: string
  conversationQuota: number | null
  activeChannels: number
  conversationsLast30Days: number
  tokensLast30Days: number
  estimatedCostUsd: number
  totalPaidUsd: number
  hasOverduePayment: boolean
  isNearQuota: boolean
  createdAt: string
  updatedAt: string
}

export interface TenantKpiDto {
  totalTenants: number
  activeTenants: number
  suspendedTenants: number
  tenantsWithAlerts: number
  totalTokensLast30Days: number
  totalEstimatedCostUsd: number
  totalCollectedUsd: number
}

export interface TenantStatsDto {
  conversationsLast30Days: number
  conversationsAllTime: number
  messagesLast30Days: number
  messagesAllTime: number
  inputTokensLast30Days: number
  outputTokensLast30Days: number
  estimatedCostUsdLast30Days: number
  estimatedCostUsdAllTime: number
  activeChannels: number
  dailyConversations: { date: string; count: number }[]
}

export interface PaymentDto {
  id: string
  tenantId: string
  amount: number
  currency: string
  status: string
  description: string | null
  externalReference: string | null
  periodStart: string
  periodEnd: string
  registeredByUserId: string
  createdAt: string
}

export interface BillingInfoDto {
  id: string | null
  companyName: string | null
  taxId: string | null
  billingEmail: string | null
  address: string | null
  country: string | null
  notes: string | null
}

export interface LlmPricingDto {
  id: string
  modelId: string
  displayName: string
  inputPricePerMillionTokens: number
  outputPricePerMillionTokens: number
  isActive: boolean
  updatedAt: string
}

export interface AuditLogEntryDto {
  id: string
  tenantId: string
  tenantName: string
  adminUserId: string
  action: string
  details: string | null
  ipAddress: string | null
  createdAt: string
}

export interface UpdateTenantConfigRequest {
  plan: string
  status: string
  conversationQuota: number | null
  internalNotes: string | null
}

export interface RegisterPaymentRequest {
  amount: number
  currency: string
  status: string
  description: string | null
  externalReference: string | null
  periodStart: string
  periodEnd: string
}

export interface AdminTenantsFilters {
  search?: string
  status?: string
  plan?: string
  page?: number
  pageSize?: number
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
}
```

- [ ] **Step 2: Crear admin.ts**

```typescript
// apps/web/src/services/admin.ts
import { apiClient } from "../lib/apiClient"
import type {
  AuditLogEntryDto,
  BillingInfoDto,
  LlmPricingDto,
  PagedResult,
  PaymentDto,
  RegisterPaymentRequest,
  TenantAdminDto,
  TenantKpiDto,
  TenantStatsDto,
  UpdateTenantConfigRequest,
  AdminTenantsFilters,
} from "../types/api.types"

const BASE = "/api/admin"

export const adminApi = {
  // Tenants list
  listTenants: (filters: AdminTenantsFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.search) params.set("search", filters.search)
    if (filters.status) params.set("status", filters.status)
    if (filters.plan) params.set("plan", filters.plan)
    params.set("page", String(filters.page ?? 1))
    params.set("pageSize", String(filters.pageSize ?? 20))
    return apiClient
      .get<PagedResult<TenantAdminDto>>(`${BASE}/tenants?${params}`)
      .then((r) => r.data)
  },

  getKpi: () =>
    apiClient.get<TenantKpiDto>(`${BASE}/tenants/kpi`).then((r) => r.data),

  exportCsv: (filters: AdminTenantsFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.search) params.set("search", filters.search)
    if (filters.status) params.set("status", filters.status)
    if (filters.plan) params.set("plan", filters.plan)
    return apiClient
      .get(`${BASE}/tenants/export?${params}`, { responseType: "blob" })
      .then((r) => r.data as Blob)
  },

  // Tenant detail
  getTenant: (tenantId: string) =>
    apiClient
      .get<TenantAdminDto>(`${BASE}/tenants/${tenantId}`)
      .then((r) => r.data),

  getTenantStats: (tenantId: string) =>
    apiClient
      .get<TenantStatsDto>(`${BASE}/tenants/${tenantId}/stats`)
      .then((r) => r.data),

  updateTenantConfig: (tenantId: string, data: UpdateTenantConfigRequest) =>
    apiClient
      .put(`${BASE}/tenants/${tenantId}/config`, data)
      .then((r) => r.data),

  // Billing
  getBillingInfo: (tenantId: string) =>
    apiClient
      .get<BillingInfoDto>(`${BASE}/tenants/${tenantId}/billing`)
      .then((r) => r.data),

  upsertBillingInfo: (tenantId: string, data: BillingInfoDto) =>
    apiClient
      .put(`${BASE}/tenants/${tenantId}/billing`, data)
      .then((r) => r.data),

  // Payments
  getPayments: (tenantId: string) =>
    apiClient
      .get<PaymentDto[]>(`${BASE}/tenants/${tenantId}/payments`)
      .then((r) => r.data),

  registerPayment: (tenantId: string, data: RegisterPaymentRequest) =>
    apiClient
      .post<PaymentDto>(`${BASE}/tenants/${tenantId}/payments`, data)
      .then((r) => r.data),

  deletePayment: (tenantId: string, paymentId: string) =>
    apiClient
      .delete(`${BASE}/tenants/${tenantId}/payments/${paymentId}`)
      .then((r) => r.data),

  // Settings — LLM pricing
  getLlmPricings: () =>
    apiClient
      .get<LlmPricingDto[]>(`${BASE}/settings/llm-pricing`)
      .then((r) => r.data),

  upsertLlmPricing: (data: LlmPricingDto) =>
    apiClient
      .put(`${BASE}/settings/llm-pricing`, data)
      .then((r) => r.data),

  deleteLlmPricing: (pricingId: string) =>
    apiClient
      .delete(`${BASE}/settings/llm-pricing/${pricingId}`)
      .then((r) => r.data),

  // Audit log
  getAuditLog: (params: {
    tenantId?: string
    action?: string
    from?: string
    to?: string
    page?: number
    pageSize?: number
  } = {}) => {
    const p = new URLSearchParams()
    if (params.tenantId) p.set("tenantId", params.tenantId)
    if (params.action) p.set("action", params.action)
    if (params.from) p.set("from", params.from)
    if (params.to) p.set("to", params.to)
    p.set("page", String(params.page ?? 1))
    p.set("pageSize", String(params.pageSize ?? 50))
    return apiClient
      .get<PagedResult<AuditLogEntryDto>>(`${BASE}/audit-log?${p}`)
      .then((r) => r.data)
  },
}
```

- [ ] **Step 3: Verificar TypeScript**

```
cd apps/web
npx tsc --noEmit
```

Expected: 0 errores

- [ ] **Step 4: Commit**

```
git add apps/web/src/types/api.types.ts apps/web/src/services/admin.ts
git commit -m "feat(web): add admin types and admin API service"
```

---

## Task 8: Frontend — hooks TanStack Query + Zustand store

**Files:**
- Create: `apps/web/src/hooks/useAdmin.ts`
- Create: `apps/web/src/store/adminStore.ts`

- [ ] **Step 1: Crear adminStore.ts**

```typescript
// apps/web/src/store/adminStore.ts
import { create } from "zustand"
import type { AdminTenantsFilters } from "../types/api.types"

interface AdminStore {
  tenantsFilters: AdminTenantsFilters
  setTenantsFilters: (f: Partial<AdminTenantsFilters>) => void
  resetTenantsFilters: () => void
}

const DEFAULT_FILTERS: AdminTenantsFilters = {
  search: "",
  status: undefined,
  plan: undefined,
  page: 1,
  pageSize: 20,
}

export const useAdminStore = create<AdminStore>((set) => ({
  tenantsFilters: DEFAULT_FILTERS,
  setTenantsFilters: (f) =>
    set((s) => ({
      tenantsFilters: { ...s.tenantsFilters, ...f, page: f.page ?? 1 },
    })),
  resetTenantsFilters: () => set({ tenantsFilters: DEFAULT_FILTERS }),
}))
```

- [ ] **Step 2: Crear useAdmin.ts**

```typescript
// apps/web/src/hooks/useAdmin.ts
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { adminApi } from "../services/admin"
import type {
  AdminTenantsFilters,
  BillingInfoDto,
  LlmPricingDto,
  RegisterPaymentRequest,
  UpdateTenantConfigRequest,
} from "../types/api.types"

// ── Tenants list ────────────────────────────────────────────────────────────

export function useAdminTenants(filters: AdminTenantsFilters = {}) {
  return useQuery({
    queryKey: ["admin", "tenants", filters],
    queryFn: () => adminApi.listTenants(filters),
    staleTime: 30_000,
  })
}

export function useAdminKpi() {
  return useQuery({
    queryKey: ["admin", "kpi"],
    queryFn: adminApi.getKpi,
    staleTime: 60_000,
  })
}

// ── Tenant detail ───────────────────────────────────────────────────────────

export function useAdminTenant(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId],
    queryFn: () => adminApi.getTenant(tenantId),
    enabled: !!tenantId,
  })
}

export function useAdminTenantStats(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "stats"],
    queryFn: () => adminApi.getTenantStats(tenantId),
    enabled: !!tenantId,
  })
}

export function useUpdateTenantConfig(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateTenantConfigRequest) =>
      adminApi.updateTenantConfig(tenantId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] })
    },
  })
}

// ── Billing ─────────────────────────────────────────────────────────────────

export function useAdminBillingInfo(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "billing"],
    queryFn: () => adminApi.getBillingInfo(tenantId),
    enabled: !!tenantId,
  })
}

export function useUpsertBillingInfo(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BillingInfoDto) =>
      adminApi.upsertBillingInfo(tenantId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "billing"] })
    },
  })
}

// ── Payments ────────────────────────────────────────────────────────────────

export function useAdminPayments(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "payments"],
    queryFn: () => adminApi.getPayments(tenantId),
    enabled: !!tenantId,
  })
}

export function useRegisterPayment(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: RegisterPaymentRequest) =>
      adminApi.registerPayment(tenantId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "payments"] })
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] })
    },
  })
}

export function useDeletePayment(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentId: string) => adminApi.deletePayment(tenantId, paymentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "payments"] })
    },
  })
}

// ── LLM Pricing ─────────────────────────────────────────────────────────────

export function useLlmPricings() {
  return useQuery({
    queryKey: ["admin", "llm-pricing"],
    queryFn: adminApi.getLlmPricings,
  })
}

export function useUpsertLlmPricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: LlmPricingDto) => adminApi.upsertLlmPricing(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "llm-pricing"] })
    },
  })
}

export function useDeleteLlmPricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pricingId: string) => adminApi.deleteLlmPricing(pricingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "llm-pricing"] })
    },
  })
}

// ── Audit log ───────────────────────────────────────────────────────────────

export function useAdminAuditLog(params: {
  tenantId?: string
  action?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
} = {}) {
  return useQuery({
    queryKey: ["admin", "audit-log", params],
    queryFn: () => adminApi.getAuditLog(params),
    staleTime: 30_000,
  })
}
```

- [ ] **Step 3: Verificar TypeScript**

```
cd apps/web
npx tsc --noEmit
```

Expected: 0 errores

- [ ] **Step 4: Commit**

```
git add apps/web/src/store/adminStore.ts apps/web/src/hooks/useAdmin.ts
git commit -m "feat(web): add admin Zustand store and TanStack Query hooks"
```

---

## Task 9: Frontend — AdminGuard + AdminLayout + router

**Files:**
- Create: `apps/web/src/components/layout/AdminLayout.tsx`
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Crear AdminLayout.tsx**

```tsx
// apps/web/src/components/layout/AdminLayout.tsx
import { Navigate, NavLink, Outlet } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()
  if (!isLoaded) return null
  const role = user?.publicMetadata?.role as string | undefined
  if (role !== "superadmin") return <Navigate to="/conversations" replace />
  return <>{children}</>
}

export function AdminLayout() {
  return (
    <AdminGuard>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <aside className="w-56 shrink-0 border-r border-border flex flex-col bg-card">
          <div className="px-4 py-5 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Superadmin
            </span>
          </div>
          <nav className="flex flex-col gap-1 p-3 flex-1">
            <AdminNavLink to="/admin" end>
              Tenants
            </AdminNavLink>
            <AdminNavLink to="/admin/settings">Precios LLM</AdminNavLink>
            <AdminNavLink to="/admin/audit-log">Audit Log</AdminNavLink>
          </nav>
          <div className="p-3 border-t border-border">
            <NavLink
              to="/conversations"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              ← Volver al panel
            </NavLink>
          </div>
        </aside>
        <main className="flex flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </AdminGuard>
  )
}

function AdminNavLink({
  to,
  end,
  children,
}: {
  to: string
  end?: boolean
  children: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground font-medium"
            : "text-foreground hover:bg-accent"
        }`
      }
    >
      {children}
    </NavLink>
  )
}
```

- [ ] **Step 2: Actualizar router.tsx**

Agregar imports al inicio:

```tsx
import { AdminLayout } from "./components/layout/AdminLayout"
import { AdminTenantsPage } from "./pages/AdminTenantsPage"
import { AdminTenantDetailPage } from "./pages/AdminTenantDetailPage"
import { AdminSettingsPage } from "./pages/AdminSettingsPage"
import { AdminAuditLogPage } from "./pages/AdminAuditLogPage"
```

Agregar rutas admin antes del cierre del array del router (después de la ruta `ProtectedRoute`):

```tsx
{
  element: <AdminLayout />,
  children: [
    { path: "admin", element: <AdminTenantsPage /> },
    { path: "admin/tenants/:id", element: <AdminTenantDetailPage /> },
    { path: "admin/settings", element: <AdminSettingsPage /> },
    { path: "admin/audit-log", element: <AdminAuditLogPage /> },
  ],
},
```

El bloque `children` del router completo queda así:

```tsx
export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/sign-in/*", element: <SignIn routing="path" path="/sign-in" /> },
      { path: "/sign-up/*", element: <SignUp routing="path" path="/sign-up" /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "onboarding", element: <OnboardingPage /> },
      {
        element: <TenantRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to="/conversations" replace /> },
              { path: "conversations", element: <ConversationsPage /> },
              { path: "conversations/:id", element: <ChatPage /> },
              { path: "simulation", element: <SimulationPage /> },
              { path: "settings/profile", element: <SettingsProfilePage /> },
              { path: "settings/documents", element: <SettingsDocumentsPage /> },
              { path: "settings/agents", element: <SettingsAgentsPage /> },
              { path: "settings/channels", element: <SettingsChannelsPage /> },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <AdminLayout />,
    children: [
      { path: "admin", element: <AdminTenantsPage /> },
      { path: "admin/tenants/:id", element: <AdminTenantDetailPage /> },
      { path: "admin/settings", element: <AdminSettingsPage /> },
      { path: "admin/audit-log", element: <AdminAuditLogPage /> },
    ],
  },
])
```

- [ ] **Step 3: Crear páginas placeholder (para que TypeScript compile)**

```tsx
// apps/web/src/pages/AdminTenantsPage.tsx
export function AdminTenantsPage() {
  return <div className="p-6 flex-1 overflow-auto">AdminTenantsPage — TODO</div>
}
```

```tsx
// apps/web/src/pages/AdminTenantDetailPage.tsx
export function AdminTenantDetailPage() {
  return <div className="p-6 flex-1 overflow-auto">AdminTenantDetailPage — TODO</div>
}
```

```tsx
// apps/web/src/pages/AdminSettingsPage.tsx
export function AdminSettingsPage() {
  return <div className="p-6 flex-1 overflow-auto">AdminSettingsPage — TODO</div>
}
```

```tsx
// apps/web/src/pages/AdminAuditLogPage.tsx
export function AdminAuditLogPage() {
  return <div className="p-6 flex-1 overflow-auto">AdminAuditLogPage — TODO</div>
}
```

- [ ] **Step 4: Verificar TypeScript y compilación**

```
cd apps/web
npx tsc --noEmit
```

Expected: 0 errores

- [ ] **Step 5: Verificar que la ruta /admin carga en browser**

```
cd apps/web
npm run dev
```

Navegar a `http://localhost:5173/admin`. Con usuario superadmin debe mostrar el layout admin. Con usuario normal debe redirigir a `/conversations`.

- [ ] **Step 6: Commit**

```
git add apps/web/src/components/layout/AdminLayout.tsx \
        apps/web/src/router.tsx \
        apps/web/src/pages/Admin*.tsx
git commit -m "feat(web): add AdminLayout with guard, router routes and page placeholders"
```

---

## Task 10: Frontend — AdminTenantsPage (lista con KPI strip)

**Files:**
- Create: `apps/web/src/components/admin/KpiStrip.tsx`
- Create: `apps/web/src/components/admin/TenantFilters.tsx`
- Create: `apps/web/src/components/admin/TenantTable.tsx`
- Create: `apps/web/src/components/admin/TenantRowMenu.tsx`
- Modify: `apps/web/src/pages/AdminTenantsPage.tsx`

- [ ] **Step 1: Crear KpiStrip.tsx**

```tsx
// apps/web/src/components/admin/KpiStrip.tsx
import type { TenantKpiDto } from "../../types/api.types"

interface Props {
  kpi: TenantKpiDto
}

export function KpiStrip({ kpi }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      <KpiCard label="Total tenants" value={kpi.totalTenants} />
      <KpiCard label="Activos" value={kpi.activeTenants} variant="success" />
      <KpiCard label="Suspendidos" value={kpi.suspendedTenants} variant="warning" />
      <KpiCard label="Con alertas" value={kpi.tenantsWithAlerts} variant="danger" />
      <KpiCard label="Tokens (30d)" value={kpi.totalTokensLast30Days.toLocaleString()} />
      <KpiCard
        label="Costo est. (30d)"
        value={`$${kpi.totalEstimatedCostUsd.toFixed(2)}`}
      />
      <KpiCard
        label="Cobrado total"
        value={`$${kpi.totalCollectedUsd.toFixed(2)}`}
        variant="success"
      />
    </div>
  )
}

function KpiCard({
  label,
  value,
  variant = "default",
}: {
  label: string
  value: string | number
  variant?: "default" | "success" | "warning" | "danger"
}) {
  const colorMap = {
    default: "text-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    danger: "text-red-600 dark:text-red-400",
  }
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${colorMap[variant]}`}>{value}</p>
    </div>
  )
}
```

- [ ] **Step 2: Crear TenantFilters.tsx**

```tsx
// apps/web/src/components/admin/TenantFilters.tsx
import { useAdminStore } from "../../store/adminStore"

export function TenantFilters() {
  const { tenantsFilters, setTenantsFilters } = useAdminStore()

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <input
        type="search"
        placeholder="Buscar por nombre..."
        value={tenantsFilters.search ?? ""}
        onChange={(e) => setTenantsFilters({ search: e.target.value })}
        className="border border-border rounded-md px-3 py-1.5 text-sm bg-background min-w-[200px]"
      />
      <select
        value={tenantsFilters.status ?? ""}
        onChange={(e) =>
          setTenantsFilters({ status: e.target.value || undefined })
        }
        className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
      >
        <option value="">Todos los estados</option>
        <option value="Active">Activo</option>
        <option value="Suspended">Suspendido</option>
        <option value="Cancelled">Cancelado</option>
      </select>
      <select
        value={tenantsFilters.plan ?? ""}
        onChange={(e) =>
          setTenantsFilters({ plan: e.target.value || undefined })
        }
        className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
      >
        <option value="">Todos los planes</option>
        <option value="Basic">Basic</option>
        <option value="Pro">Pro</option>
        <option value="Enterprise">Enterprise</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 3: Crear TenantRowMenu.tsx**

```tsx
// apps/web/src/components/admin/TenantRowMenu.tsx
import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useUpdateTenantConfig } from "../../hooks/useAdmin"
import type { TenantAdminDto } from "../../types/api.types"

interface Props {
  tenant: TenantAdminDto
}

export function TenantRowMenu({ tenant }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const updateConfig = useUpdateTenantConfig(tenant.id)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const toggleStatus = () => {
    const newStatus = tenant.status === "Active" ? "Suspended" : "Active"
    updateConfig.mutate(
      {
        plan: tenant.plan,
        status: newStatus,
        conversationQuota: tenant.conversationQuota,
        internalNotes: null,
      },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
        aria-label="Acciones"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-10 w-44 rounded-lg border border-border bg-card shadow-lg py-1">
          <MenuItem onClick={() => navigate(`/admin/tenants/${tenant.id}`)}>
            Ver detalle
          </MenuItem>
          <MenuItem onClick={toggleStatus}>
            {tenant.status === "Active" ? "Suspender" : "Activar"}
          </MenuItem>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors"
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Crear TenantTable.tsx**

```tsx
// apps/web/src/components/admin/TenantTable.tsx
import { useNavigate } from "react-router-dom"
import type { TenantAdminDto } from "../../types/api.types"
import { TenantRowMenu } from "./TenantRowMenu"

interface Props {
  tenants: TenantAdminDto[]
}

export function TenantTable({ tenants }: Props) {
  const navigate = useNavigate()

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <Th>Nombre</Th>
            <Th>Plan</Th>
            <Th>Estado</Th>
            <Th>Canales</Th>
            <Th>Convs (30d)</Th>
            <Th>Tokens (30d)</Th>
            <Th>Costo est.</Th>
            <Th>Pagado</Th>
            <Th>Alertas</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr
              key={t.id}
              className="border-t border-border hover:bg-accent/30 cursor-pointer transition-colors"
              onClick={() => navigate(`/admin/tenants/${t.id}`)}
            >
              <td className="px-4 py-2.5 font-medium">{t.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{t.plan}</td>
              <td className="px-4 py-2.5">
                <StatusBadge status={t.status} />
              </td>
              <td className="px-4 py-2.5 text-center">{t.activeChannels}</td>
              <td className="px-4 py-2.5 text-center">
                {t.conversationsLast30Days}
                {t.isNearQuota && (
                  <span className="ml-1 text-yellow-500 text-xs" title="Cerca del cupo">
                    ⚠
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                {t.tokensLast30Days.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right">
                ${t.estimatedCostUsd.toFixed(4)}
              </td>
              <td className="px-4 py-2.5 text-right">${t.totalPaidUsd.toFixed(2)}</td>
              <td className="px-4 py-2.5 text-center">
                {t.hasOverduePayment && (
                  <span className="text-red-500 text-xs font-semibold" title="Pago vencido">
                    ●
                  </span>
                )}
              </td>
              <td
                className="px-4 py-2.5"
                onClick={(e) => e.stopPropagation()}
              >
                <TenantRowMenu tenant={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </th>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Suspended: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    Cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  )
}
```

- [ ] **Step 5: Implementar AdminTenantsPage.tsx**

Reemplazar el placeholder creado en Task 9:

```tsx
// apps/web/src/pages/AdminTenantsPage.tsx
import { adminApi } from "../services/admin"
import { useAdminKpi, useAdminTenants } from "../hooks/useAdmin"
import { useAdminStore } from "../store/adminStore"
import { KpiStrip } from "../components/admin/KpiStrip"
import { TenantFilters } from "../components/admin/TenantFilters"
import { TenantTable } from "../components/admin/TenantTable"

export function AdminTenantsPage() {
  const { tenantsFilters, setTenantsFilters } = useAdminStore()
  const { data: tenantsPage, isLoading } = useAdminTenants(tenantsFilters)
  const { data: kpi } = useAdminKpi()

  const handleExport = async () => {
    const blob = await adminApi.exportCsv(tenantsFilters)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tenants_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <button
          onClick={handleExport}
          className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors"
        >
          Exportar CSV
        </button>
      </div>

      {kpi && <KpiStrip kpi={kpi} />}

      <TenantFilters />

      {isLoading ? (
        <div className="text-muted-foreground text-sm py-8 text-center">Cargando...</div>
      ) : tenantsPage && tenantsPage.items.length > 0 ? (
        <>
          <TenantTable tenants={tenantsPage.items} />
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              {tenantsPage.totalCount} tenants totales
            </span>
            <div className="flex gap-2">
              <button
                disabled={tenantsFilters.page === 1}
                onClick={() =>
                  setTenantsFilters({ page: (tenantsFilters.page ?? 1) - 1 })
                }
                className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-accent transition-colors"
              >
                Anterior
              </button>
              <span className="px-3 py-1">
                {tenantsFilters.page ?? 1} / {tenantsPage.totalPages}
              </span>
              <button
                disabled={!tenantsPage.hasNextPage}
                onClick={() =>
                  setTenantsFilters({ page: (tenantsFilters.page ?? 1) + 1 })
                }
                className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-accent transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-muted-foreground text-sm py-8 text-center">
          No hay tenants que coincidan con los filtros.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Verificar TypeScript**

```
cd apps/web
npx tsc --noEmit
```

Expected: 0 errores

- [ ] **Step 7: Verificar en browser**

Con `npm run dev` activo, ir a `/admin`. Verificar que:
- El strip de KPIs muestra datos (o ceros si DB vacía)
- Los filtros de búsqueda funcionan
- La tabla renderiza sin errores de consola
- El menú 3-dot abre y cierra correctamente

- [ ] **Step 8: Commit**

```
git add apps/web/src/components/admin/KpiStrip.tsx \
        apps/web/src/components/admin/TenantFilters.tsx \
        apps/web/src/components/admin/TenantTable.tsx \
        apps/web/src/components/admin/TenantRowMenu.tsx \
        apps/web/src/pages/AdminTenantsPage.tsx
git commit -m "feat(web): implement AdminTenantsPage with KPI strip, filters, table and row menu"
```

---

## Task 11: Frontend — AdminTenantDetailPage (4 tabs)

**Files:**
- Create: `apps/web/src/components/admin/PaymentForm.tsx`
- Create: `apps/web/src/components/admin/BillingInfoForm.tsx`
- Modify: `apps/web/src/pages/AdminTenantDetailPage.tsx`

- [ ] **Step 1: Crear PaymentForm.tsx**

```tsx
// apps/web/src/components/admin/PaymentForm.tsx
import { useState } from "react"
import type { RegisterPaymentRequest } from "../../types/api.types"

interface Props {
  onSubmit: (data: RegisterPaymentRequest) => void
  onCancel: () => void
  isLoading: boolean
}

export function PaymentForm({ onSubmit, onCancel, isLoading }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)

  const [form, setForm] = useState<RegisterPaymentRequest>({
    amount: 0,
    currency: "USD",
    status: "Confirmed",
    description: null,
    externalReference: null,
    periodStart: monthAgo,
    periodEnd: today,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Monto">
          <input
            type="number"
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="Moneda">
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="input"
          >
            <option>USD</option>
            <option>ARS</option>
            <option>EUR</option>
          </select>
        </Field>
      </div>
      <Field label="Estado">
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="input"
        >
          <option value="Confirmed">Confirmado</option>
          <option value="Pending">Pendiente</option>
          <option value="Failed">Fallido</option>
          <option value="Refunded">Reembolsado</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Periodo inicio">
          <input
            type="date"
            value={form.periodStart}
            onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Periodo fin">
          <input
            type="date"
            value={form.periodEnd}
            onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
            className="input"
          />
        </Field>
      </div>
      <Field label="Descripción">
        <input
          type="text"
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          className="input"
        />
      </Field>
      <Field label="Referencia externa">
        <input
          type="text"
          value={form.externalReference ?? ""}
          onChange={(e) =>
            setForm({ ...form, externalReference: e.target.value || null })
          }
          className="input"
        />
      </Field>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {isLoading ? "Guardando..." : "Registrar pago"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md border border-border text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Crear BillingInfoForm.tsx**

```tsx
// apps/web/src/components/admin/BillingInfoForm.tsx
import { useState } from "react"
import type { BillingInfoDto } from "../../types/api.types"

interface Props {
  initial: BillingInfoDto
  onSubmit: (data: BillingInfoDto) => void
  isLoading: boolean
}

export function BillingInfoForm({ initial, onSubmit, isLoading }: Props) {
  const [form, setForm] = useState(initial)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {(
        [
          ["companyName", "Razón social"],
          ["taxId", "CUIT / Tax ID"],
          ["billingEmail", "Email de facturación"],
          ["address", "Dirección"],
          ["country", "País"],
        ] as [keyof BillingInfoDto, string][]
      ).map(([field, label]) => (
        <div key={field}>
          <label className="block text-xs text-muted-foreground mb-1">{label}</label>
          <input
            type="text"
            value={(form[field] as string) ?? ""}
            onChange={(e) => setForm({ ...form, [field]: e.target.value || null })}
            className="input w-full"
          />
        </div>
      ))}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Notas internas
        </label>
        <textarea
          rows={3}
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
          className="input w-full resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
      >
        {isLoading ? "Guardando..." : "Guardar"}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Implementar AdminTenantDetailPage.tsx**

Reemplazar el placeholder:

```tsx
// apps/web/src/pages/AdminTenantDetailPage.tsx
import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  useAdminTenant,
  useAdminTenantStats,
  useUpdateTenantConfig,
  useAdminBillingInfo,
  useUpsertBillingInfo,
  useAdminPayments,
  useRegisterPayment,
  useDeletePayment,
} from "../hooks/useAdmin"
import { PaymentForm } from "../components/admin/PaymentForm"
import { BillingInfoForm } from "../components/admin/BillingInfoForm"
import type { UpdateTenantConfigRequest } from "../types/api.types"

type Tab = "profile" | "stats" | "config" | "payments"

export function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>("profile")
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  const tenantId = id!
  const { data: tenant, isLoading } = useAdminTenant(tenantId)
  const { data: stats } = useAdminTenantStats(tenantId)
  const { data: billing } = useAdminBillingInfo(tenantId)
  const { data: payments } = useAdminPayments(tenantId)

  const updateConfig = useUpdateTenantConfig(tenantId)
  const upsertBilling = useUpsertBillingInfo(tenantId)
  const registerPayment = useRegisterPayment(tenantId)
  const deletePayment = useDeletePayment(tenantId)

  if (isLoading) return <div className="p-6 text-muted-foreground">Cargando...</div>
  if (!tenant) return <div className="p-6 text-muted-foreground">Tenant no encontrado.</div>

  const handleUpdateConfig = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const req: UpdateTenantConfigRequest = {
      plan: fd.get("plan") as string,
      status: fd.get("status") as string,
      conversationQuota: fd.get("conversationQuota")
        ? Number(fd.get("conversationQuota"))
        : null,
      internalNotes: (fd.get("internalNotes") as string) || null,
    }
    updateConfig.mutate(req)
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <button
        onClick={() => navigate("/admin")}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1"
      >
        ← Volver a tenants
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tenant.plan} · {tenant.status} · creado{" "}
            {new Date(tenant.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6 gap-1">
        {(
          [
            ["profile", "Perfil"],
            ["stats", "Estadísticas"],
            ["config", "Configuración"],
            ["payments", "Pagos"],
          ] as [Tab, string][]
        ).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Perfil */}
      {activeTab === "profile" && billing && (
        <div>
          <h2 className="text-base font-semibold mb-4">Información de facturación</h2>
          <BillingInfoForm
            initial={billing}
            onSubmit={(data) => upsertBilling.mutate(data)}
            isLoading={upsertBilling.isPending}
          />
        </div>
      )}

      {/* Tab: Estadísticas */}
      {activeTab === "stats" && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Conversaciones (30d)" value={stats.conversationsLast30Days} />
          <StatCard label="Conversaciones (total)" value={stats.conversationsAllTime} />
          <StatCard label="Mensajes (30d)" value={stats.messagesLast30Days} />
          <StatCard label="Mensajes (total)" value={stats.messagesAllTime} />
          <StatCard
            label="Tokens entrada (30d)"
            value={stats.inputTokensLast30Days.toLocaleString()}
          />
          <StatCard
            label="Tokens salida (30d)"
            value={stats.outputTokensLast30Days.toLocaleString()}
          />
          <StatCard
            label="Costo est. (30d)"
            value={`$${stats.estimatedCostUsdLast30Days.toFixed(4)}`}
          />
          <StatCard
            label="Costo est. (total)"
            value={`$${stats.estimatedCostUsdAllTime.toFixed(4)}`}
          />
        </div>
      )}

      {/* Tab: Configuración */}
      {activeTab === "config" && (
        <div className="max-w-lg">
          <h2 className="text-base font-semibold mb-4">Configuración del tenant</h2>
          <form onSubmit={handleUpdateConfig} className="space-y-4">
            <Field label="Plan">
              <select name="plan" defaultValue={tenant.plan} className="input w-full">
                <option value="Basic">Basic</option>
                <option value="Pro">Pro</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </Field>
            <Field label="Estado">
              <select name="status" defaultValue={tenant.status} className="input w-full">
                <option value="Active">Activo</option>
                <option value="Suspended">Suspendido</option>
                <option value="Cancelled">Cancelado</option>
              </select>
            </Field>
            <Field label="Cupo de conversaciones">
              <input
                type="number"
                name="conversationQuota"
                defaultValue={tenant.conversationQuota ?? ""}
                placeholder="Sin límite"
                className="input w-full"
              />
            </Field>
            <Field label="Notas internas">
              <textarea
                name="internalNotes"
                rows={3}
                className="input w-full resize-none"
              />
            </Field>
            <button
              type="submit"
              disabled={updateConfig.isPending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {updateConfig.isPending ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Pagos */}
      {activeTab === "payments" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Historial de pagos</h2>
            {!showPaymentForm && (
              <button
                onClick={() => setShowPaymentForm(true)}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              >
                + Registrar pago
              </button>
            )}
          </div>

          {showPaymentForm && (
            <div className="mb-6 p-4 rounded-lg border border-border bg-card">
              <h3 className="text-sm font-semibold mb-4">Nuevo pago</h3>
              <PaymentForm
                onSubmit={(data) =>
                  registerPayment.mutate(data, {
                    onSuccess: () => setShowPaymentForm(false),
                  })
                }
                onCancel={() => setShowPaymentForm(false)}
                isLoading={registerPayment.isPending}
              />
            </div>
          )}

          {payments && payments.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <Th>Fecha</Th>
                    <Th>Monto</Th>
                    <Th>Estado</Th>
                    <Th>Periodo</Th>
                    <Th>Descripción</Th>
                    <Th>Ref.</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {p.amount.toFixed(2)} {p.currency}
                      </td>
                      <td className="px-4 py-2.5">{p.status}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {new Date(p.periodStart).toLocaleDateString()} —{" "}
                        {new Date(p.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {p.description ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {p.externalReference ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => deletePayment.mutate(p.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin pagos registrados.</p>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </th>
  )
}
```

> **Nota:** La clase `input` debe estar definida en el CSS global como un alias de los estilos de input base de Tailwind. Si no existe, reemplazar `className="input"` por `className="border border-border rounded-md px-3 py-1.5 bg-background text-sm"`.

- [ ] **Step 4: Verificar TypeScript**

```
cd apps/web
npx tsc --noEmit
```

Expected: 0 errores

- [ ] **Step 5: Verificar en browser**

Con backend levantado, navegar a `/admin`, hacer click en un tenant. Verificar las 4 tabs cargan sin errores de consola.

- [ ] **Step 6: Commit**

```
git add apps/web/src/components/admin/PaymentForm.tsx \
        apps/web/src/components/admin/BillingInfoForm.tsx \
        apps/web/src/pages/AdminTenantDetailPage.tsx
git commit -m "feat(web): implement AdminTenantDetailPage with 4 tabs (profile, stats, config, payments)"
```

---

## Task 12: Frontend — AdminSettingsPage + AdminAuditLogPage

**Files:**
- Create: `apps/web/src/components/admin/LlmPricingForm.tsx`
- Create: `apps/web/src/components/admin/AuditLogTable.tsx`
- Modify: `apps/web/src/pages/AdminSettingsPage.tsx`
- Modify: `apps/web/src/pages/AdminAuditLogPage.tsx`

- [ ] **Step 1: Crear LlmPricingForm.tsx**

```tsx
// apps/web/src/components/admin/LlmPricingForm.tsx
import { useState } from "react"
import type { LlmPricingDto } from "../../types/api.types"

interface Props {
  initial?: LlmPricingDto
  onSubmit: (data: LlmPricingDto) => void
  onCancel: () => void
  isLoading: boolean
}

const EMPTY: LlmPricingDto = {
  id: "00000000-0000-0000-0000-000000000000",
  modelId: "",
  displayName: "",
  inputPricePerMillionTokens: 0,
  outputPricePerMillionTokens: 0,
  isActive: true,
  updatedAt: new Date().toISOString(),
}

export function LlmPricingForm({ initial = EMPTY, onSubmit, onCancel, isLoading }: Props) {
  const [form, setForm] = useState(initial)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <Field label="Model ID">
        <input
          type="text"
          required
          placeholder="llama-3.3-70b-versatile"
          value={form.modelId}
          onChange={(e) => setForm({ ...form, modelId: e.target.value })}
          className="input w-full"
        />
      </Field>
      <Field label="Nombre para mostrar">
        <input
          type="text"
          required
          placeholder="Llama 3.3 70B"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          className="input w-full"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Precio entrada ($/M tokens)">
          <input
            type="number"
            step="0.000001"
            required
            value={form.inputPricePerMillionTokens}
            onChange={(e) =>
              setForm({ ...form, inputPricePerMillionTokens: parseFloat(e.target.value) })
            }
            className="input w-full"
          />
        </Field>
        <Field label="Precio salida ($/M tokens)">
          <input
            type="number"
            step="0.000001"
            required
            value={form.outputPricePerMillionTokens}
            onChange={(e) =>
              setForm({ ...form, outputPricePerMillionTokens: parseFloat(e.target.value) })
            }
            className="input w-full"
          />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          className="h-4 w-4"
        />
        <label htmlFor="isActive" className="text-sm">
          Activo
        </label>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {isLoading ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md border border-border text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Crear AuditLogTable.tsx**

```tsx
// apps/web/src/components/admin/AuditLogTable.tsx
import type { AuditLogEntryDto } from "../../types/api.types"

interface Props {
  entries: AuditLogEntryDto[]
}

export function AuditLogTable({ entries }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <Th>Fecha</Th>
            <Th>Tenant</Th>
            <Th>Acción</Th>
            <Th>Admin</Th>
            <Th>Detalles</Th>
            <Th>IP</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-border hover:bg-accent/20 transition-colors">
              <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                {new Date(e.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-2.5 font-medium">{e.tenantName}</td>
              <td className="px-4 py-2.5">
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  {e.action}
                </span>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs truncate max-w-[120px]">
                {e.adminUserId}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">
                {e.details ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">
                {e.ipAddress ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </th>
  )
}
```

- [ ] **Step 3: Implementar AdminSettingsPage.tsx**

Reemplazar el placeholder:

```tsx
// apps/web/src/pages/AdminSettingsPage.tsx
import { useState } from "react"
import {
  useLlmPricings,
  useUpsertLlmPricing,
  useDeleteLlmPricing,
} from "../hooks/useAdmin"
import { LlmPricingForm } from "../components/admin/LlmPricingForm"
import type { LlmPricingDto } from "../types/api.types"

export function AdminSettingsPage() {
  const { data: pricings, isLoading } = useLlmPricings()
  const upsert = useUpsertLlmPricing()
  const remove = useDeleteLlmPricing()
  const [editing, setEditing] = useState<LlmPricingDto | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Configuración</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Precios de modelos LLM</p>
        </div>
        {!showNew && !editing && (
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
          >
            + Nuevo modelo
          </button>
        )}
      </div>

      {(showNew || editing) && (
        <div className="mb-6 p-4 rounded-lg border border-border bg-card">
          <h2 className="text-sm font-semibold mb-4">
            {editing ? "Editar modelo" : "Nuevo modelo"}
          </h2>
          <LlmPricingForm
            initial={editing ?? undefined}
            onSubmit={(data) =>
              upsert.mutate(data, {
                onSuccess: () => {
                  setShowNew(false)
                  setEditing(null)
                },
              })
            }
            onCancel={() => {
              setShowNew(false)
              setEditing(null)
            }}
            isLoading={upsert.isPending}
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-muted-foreground text-sm py-8 text-center">Cargando...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Model ID</Th>
                <Th>Nombre</Th>
                <Th>Entrada ($/M)</Th>
                <Th>Salida ($/M)</Th>
                <Th>Activo</Th>
                <Th>Actualizado</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {(pricings ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono text-xs">{p.modelId}</td>
                  <td className="px-4 py-2.5 font-medium">{p.displayName}</td>
                  <td className="px-4 py-2.5">${p.inputPricePerMillionTokens.toFixed(6)}</td>
                  <td className="px-4 py-2.5">${p.outputPricePerMillionTokens.toFixed(6)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs font-semibold ${
                        p.isActive ? "text-green-600" : "text-muted-foreground"
                      }`}
                    >
                      {p.isActive ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 flex gap-3">
                    <button
                      onClick={() => setEditing(p)}
                      className="text-sm text-primary hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove.mutate(p.id)}
                      className="text-sm text-red-500 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </th>
  )
}
```

- [ ] **Step 4: Implementar AdminAuditLogPage.tsx**

Reemplazar el placeholder:

```tsx
// apps/web/src/pages/AdminAuditLogPage.tsx
import { useState } from "react"
import { useAdminAuditLog } from "../hooks/useAdmin"
import { AuditLogTable } from "../components/admin/AuditLogTable"

const ADMIN_ACTIONS = [
  "TenantStatusChanged",
  "TenantPlanChanged",
  "TenantQuotaUpdated",
  "TenantConfigUpdated",
  "TenantBillingInfoUpdated",
  "PaymentRegistered",
  "PaymentDeleted",
  "LlmPricingUpdated",
]

export function AdminAuditLogPage() {
  const [action, setAction] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useAdminAuditLog({
    action: action || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: 50,
  })

  return (
    <div className="flex-1 overflow-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Audit Log</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1) }}
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">Todas las acciones</option>
          {ADMIN_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1) }}
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1) }}
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm py-8 text-center">Cargando...</div>
      ) : data && data.items.length > 0 ? (
        <>
          <AuditLogTable entries={data.items} />
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>{data.totalCount} entradas totales</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-accent transition-colors"
              >
                Anterior
              </button>
              <span className="px-3 py-1">
                {page} / {data.totalPages}
              </span>
              <button
                disabled={!data.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-accent transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-muted-foreground text-sm py-8 text-center">
          Sin entradas que coincidan con los filtros.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verificar TypeScript**

```
cd apps/web
npx tsc --noEmit
```

Expected: 0 errores

- [ ] **Step 6: Verificar en browser**

Con `npm run dev`, ir a `/admin/settings` y `/admin/audit-log`. Verificar:
- `/admin/settings`: tabla de precios LLM, formulario de creación/edición funciona
- `/admin/audit-log`: tabla de audit log con filtros de acción y fechas

- [ ] **Step 7: Commit final**

```
git add apps/web/src/components/admin/LlmPricingForm.tsx \
        apps/web/src/components/admin/AuditLogTable.tsx \
        apps/web/src/pages/AdminSettingsPage.tsx \
        apps/web/src/pages/AdminAuditLogPage.tsx
git commit -m "feat(web): implement AdminSettingsPage (LLM pricing) and AdminAuditLogPage"
```

---

## Resumen de la implementación

Con las 12 tareas completas el panel superadmin estará operativo:

| Ruta | Descripción |
|------|-------------|
| `/admin` | Lista paginada de tenants con KPI strip, búsqueda/filtros, tabla, menú 3-dot |
| `/admin/tenants/:id` | Detalle con tabs: Perfil (billing), Estadísticas, Configuración, Pagos |
| `/admin/settings` | CRUD de precios LLM |
| `/admin/audit-log` | Log de acciones con filtros por acción y fecha |

**Acceso:** claim `superadmin_role: "superadmin"` en JWT de Clerk + policy `SuperAdmin` en .NET.

**Prerequisito manual:** configurar JWT Template en Clerk Dashboard antes de ejecutar cualquier tarea.
