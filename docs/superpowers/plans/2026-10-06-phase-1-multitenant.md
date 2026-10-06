# Phase 1 — Multi-tenant + Clerk Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar autenticación con Clerk JWT, sincronización de usuarios vía webhook de Clerk, CRUD de tenants y memberships, y el middleware que inyecta TenantId en cada request autenticado.

**Architecture:** Controllers → Services → IApplicationDbContext. JWT Bearer valida tokens de Clerk usando JWKS discovery automático. TenantMiddleware extrae el ClerkId del token, busca el User en la DB, obtiene su Membership activa y expone el TenantId vía ICurrentTenantService. Los endpoints de webhooks de Clerk son públicos (sin auth).

**Tech Stack:** .NET 8, ASP.NET Core JWT Bearer, Svix (webhook signature validation), EF Core 8, PostgreSQL, xUnit, Testcontainers

---

## Pre-requisitos — Configurar Clerk (manual, antes de ejecutar este plan)

1. Crear cuenta en https://clerk.com con el gmail del proyecto
2. Crear una Application → elegir "Email + Password" como método de login
3. Ir a **API Keys** → copiar:
   - `CLERK_PUBLISHABLE_KEY` (empieza con `pk_test_`)
   - `CLERK_SECRET_KEY` (empieza con `sk_test_`)
4. Ir a **JWT Templates** → tomar nota del `Issuer` (formato: `https://your-app.clerk.accounts.dev`)
5. Ir a **Webhooks** → crear endpoint `https://tu-dominio/api/webhooks/clerk` → seleccionar eventos `user.created`, `user.updated` → copiar el **Signing Secret** (`whsec_...`)
6. Agregar al archivo `apps/api/src/ChatOmnicanal.API/appsettings.Development.json`:

```json
{
  "Clerk": {
    "Authority": "https://your-app.clerk.accounts.dev",
    "SecretKey": "sk_test_...",
    "WebhookSecret": "whsec_..."
  },
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5435;Database=chatomnicanal;Username=postgres;Password=postgres"
  }
}
```

---

## File Map

```
src/ChatOmnicanal.Application/
  Tenants/
    ITenantService.cs
    TenantDto.cs
  Memberships/
    IMembershipService.cs
    MembershipDto.cs
  Users/
    IUserService.cs
    UserDto.cs
  Common/Interfaces/
    IClerkService.cs          # invitar usuario vía Clerk API

src/ChatOmnicanal.Infrastructure/
  Services/
    TenantService.cs
    MembershipService.cs
    UserService.cs
    ClerkService.cs           # HTTP client a api.clerk.com
  Authentication/
    CurrentTenantService.cs   # implementa ICurrentTenantService
  Modify: DependencyInjection.cs

src/ChatOmnicanal.API/
  Controllers/
    TenantsController.cs
    MembershipsController.cs
    ClerkWebhookController.cs
  Middleware/
    TenantMiddleware.cs
  DependencyInjection.cs      # nuevo: auth + middleware registration
  Modify: Program.cs

tests/ChatOmnicanal.Integration.Tests/
  API/
    TenantsControllerTests.cs
    MembershipsControllerTests.cs
    ClerkWebhookTests.cs
  Infrastructure/
    Modify: DatabaseFixture.cs  # agregar helpers para seed de datos
```

---

## Task 1: Instalar paquetes NuGet

**Files:**
- Modify: `src/ChatOmnicanal.API/ChatOmnicanal.API.csproj`
- Modify: `src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj`
- Modify: `tests/ChatOmnicanal.Integration.Tests/ChatOmnicanal.Integration.Tests.csproj`

- [ ] **Step 1.1: Instalar paquetes**

Ejecutar desde `apps/api/`:

```bash
# Auth JWT Bearer
dotnet add src/ChatOmnicanal.API/ChatOmnicanal.API.csproj package Microsoft.AspNetCore.Authentication.JwtBearer --version 8.0.10

# Svix para validar webhooks de Clerk
dotnet add src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj package Svix --version 1.1.0

# HttpClient para llamar a Clerk API
dotnet add src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj package Microsoft.Extensions.Http --version 8.0.1

# Para tests: crear tokens JWT de prueba
dotnet add tests/ChatOmnicanal.Integration.Tests/ChatOmnicanal.Integration.Tests.csproj package System.IdentityModel.Tokens.Jwt --version 7.1.2
```

- [ ] **Step 1.2: Verificar compilación**

```bash
dotnet build ChatOmnicanal.sln
```

Expected: `Build succeeded`.

- [ ] **Step 1.3: Commit**

```bash
git add .
git commit -m "chore(phase-1): add JWT Bearer, Svix and HttpClient packages"
```

---

## Task 2: Application — Interfaces y DTOs

**Files:**
- Create: `src/ChatOmnicanal.Application/Tenants/TenantDto.cs`
- Create: `src/ChatOmnicanal.Application/Tenants/ITenantService.cs`
- Create: `src/ChatOmnicanal.Application/Memberships/MembershipDto.cs`
- Create: `src/ChatOmnicanal.Application/Memberships/IMembershipService.cs`
- Create: `src/ChatOmnicanal.Application/Users/UserDto.cs`
- Create: `src/ChatOmnicanal.Application/Users/IUserService.cs`
- Create: `src/ChatOmnicanal.Application/Common/Interfaces/IClerkService.cs`

- [ ] **Step 2.1: Crear DTOs**

`src/ChatOmnicanal.Application/Tenants/TenantDto.cs`
```csharp
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Application.Tenants;

public record TenantDto(Guid Id, string Name, TenantPlan Plan, TenantStatus Status);

public record CreateTenantRequest(string Name);
```

`src/ChatOmnicanal.Application/Memberships/MembershipDto.cs`
```csharp
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Application.Memberships;

public record MembershipDto(
    Guid Id,
    Guid UserId,
    string UserEmail,
    string UserName,
    UserRole Role);

public record InviteMemberRequest(string Email);
```

`src/ChatOmnicanal.Application/Users/UserDto.cs`
```csharp
namespace ChatOmnicanal.Application.Users;

public record UserDto(Guid Id, string ClerkId, string Email, string Name);

public record SyncUserRequest(string ClerkId, string Email, string Name);
```

- [ ] **Step 2.2: Crear interfaces de servicios**

`src/ChatOmnicanal.Application/Tenants/ITenantService.cs`
```csharp
namespace ChatOmnicanal.Application.Tenants;

public interface ITenantService
{
    Task<TenantDto> CreateAsync(string name, Guid ownerUserId, CancellationToken ct = default);
    Task<TenantDto?> GetByIdAsync(Guid tenantId, CancellationToken ct = default);
}
```

`src/ChatOmnicanal.Application/Memberships/IMembershipService.cs`
```csharp
namespace ChatOmnicanal.Application.Memberships;

public interface IMembershipService
{
    Task<List<MembershipDto>> ListAsync(Guid tenantId, CancellationToken ct = default);
    Task InviteAsync(Guid tenantId, string email, CancellationToken ct = default);
    Task RemoveAsync(Guid tenantId, Guid membershipId, CancellationToken ct = default);
}
```

`src/ChatOmnicanal.Application/Users/IUserService.cs`
```csharp
namespace ChatOmnicanal.Application.Users;

public interface IUserService
{
    Task<UserDto> SyncAsync(SyncUserRequest request, CancellationToken ct = default);
    Task<UserDto?> GetByClerkIdAsync(string clerkId, CancellationToken ct = default);
}
```

`src/ChatOmnicanal.Application/Common/Interfaces/IClerkService.cs`
```csharp
namespace ChatOmnicanal.Application.Common.Interfaces;

public interface IClerkService
{
    Task InviteUserAsync(string email, CancellationToken ct = default);
}
```

- [ ] **Step 2.3: Compilar Application**

```bash
dotnet build src/ChatOmnicanal.Application/ChatOmnicanal.Application.csproj
```

Expected: `Build succeeded`.

- [ ] **Step 2.4: Commit**

```bash
git add .
git commit -m "feat(phase-1): add tenant, membership and user DTOs and service interfaces"
```

---

## Task 3: Infrastructure — Servicios de dominio

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Services/UserService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Services/TenantService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Services/MembershipService.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Services/ClerkService.cs`

- [ ] **Step 3.1: Crear UserService**

`src/ChatOmnicanal.Infrastructure/Services/UserService.cs`
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Users;
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly IApplicationDbContext _db;

    public UserService(IApplicationDbContext db) => _db = db;

    public async Task<UserDto> SyncAsync(SyncUserRequest request, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.ClerkId == request.ClerkId, ct);

        if (user is null)
        {
            user = new User
            {
                ClerkId = request.ClerkId,
                Email = request.Email,
                Name = request.Name
            };
            _db.Users.Add(user);
        }
        else
        {
            user.Email = request.Email;
            user.Name = request.Name;
        }

        await _db.SaveChangesAsync(ct);
        return new UserDto(user.Id, user.ClerkId, user.Email, user.Name);
    }

    public async Task<UserDto?> GetByClerkIdAsync(string clerkId, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.ClerkId == clerkId, ct);
        return user is null ? null : new UserDto(user.Id, user.ClerkId, user.Email, user.Name);
    }
}
```

- [ ] **Step 3.2: Crear TenantService**

`src/ChatOmnicanal.Infrastructure/Services/TenantService.cs`
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Tenants;
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Services;

public class TenantService : ITenantService
{
    private readonly IApplicationDbContext _db;

    public TenantService(IApplicationDbContext db) => _db = db;

    public async Task<TenantDto> CreateAsync(string name, Guid ownerUserId, CancellationToken ct = default)
    {
        var tenant = new Tenant { Name = name };
        _db.Tenants.Add(tenant);

        var membership = new Membership
        {
            TenantId = tenant.Id,
            UserId = ownerUserId,
            Role = UserRole.Owner
        };
        _db.Memberships.Add(membership);

        await _db.SaveChangesAsync(ct);
        return new TenantDto(tenant.Id, tenant.Name, tenant.Plan, tenant.Status);
    }

    public async Task<TenantDto?> GetByIdAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await _db.Tenants.FindAsync([tenantId], ct);
        return tenant is null ? null : new TenantDto(tenant.Id, tenant.Name, tenant.Plan, tenant.Status);
    }
}
```

- [ ] **Step 3.3: Crear MembershipService**

`src/ChatOmnicanal.Infrastructure/Services/MembershipService.cs`
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Memberships;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Infrastructure.Services;

public class MembershipService : IMembershipService
{
    private readonly IApplicationDbContext _db;
    private readonly IClerkService _clerk;

    public MembershipService(IApplicationDbContext db, IClerkService clerk)
    {
        _db = db;
        _clerk = clerk;
    }

    public async Task<List<MembershipDto>> ListAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await _db.Memberships
            .Where(m => m.TenantId == tenantId)
            .Include(m => m.User)
            .Select(m => new MembershipDto(m.Id, m.UserId, m.User.Email, m.User.Name, m.Role))
            .ToListAsync(ct);
    }

    public async Task InviteAsync(Guid tenantId, string email, CancellationToken ct = default)
    {
        // Envía la invitación vía Clerk — el usuario completa el registro por su cuenta
        // Cuando acepta, el webhook user.created sincroniza el User a nuestra DB
        // La membresía se crea cuando el nuevo usuario llama a POST /api/tenants con el tenantId
        // (flujo de aceptación de invitación — fuera del alcance de este plan)
        await _clerk.InviteUserAsync(email, ct);
    }

    public async Task RemoveAsync(Guid tenantId, Guid membershipId, CancellationToken ct = default)
    {
        var membership = await _db.Memberships
            .FirstOrDefaultAsync(m => m.Id == membershipId && m.TenantId == tenantId, ct)
            ?? throw new KeyNotFoundException($"Membership {membershipId} not found in tenant {tenantId}");

        if (membership.Role == Domain.Enums.UserRole.Owner)
            throw new InvalidOperationException("Cannot remove the tenant owner.");

        _db.Memberships.Remove(membership);
        await _db.SaveChangesAsync(ct);
    }
}
```

- [ ] **Step 3.4: Crear ClerkService**

`src/ChatOmnicanal.Infrastructure/Services/ClerkService.cs`
```csharp
using System.Net.Http.Json;
using ChatOmnicanal.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace ChatOmnicanal.Infrastructure.Services;

public class ClerkService : IClerkService
{
    private readonly HttpClient _http;

    public ClerkService(HttpClient http) => _http = http;

    public async Task InviteUserAsync(string email, CancellationToken ct = default)
    {
        var response = await _http.PostAsJsonAsync(
            "https://api.clerk.com/v1/invitations",
            new { email_address = email },
            ct);

        response.EnsureSuccessStatusCode();
    }
}
```

- [ ] **Step 3.5: Compilar Infrastructure**

```bash
dotnet build src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```

Expected: `Build succeeded`.

- [ ] **Step 3.6: Commit**

```bash
git add .
git commit -m "feat(phase-1): add UserService, TenantService, MembershipService and ClerkService"
```

---

## Task 4: Infrastructure — CurrentTenantService + ICurrentTenantService

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Authentication/CurrentTenantService.cs`

- [ ] **Step 4.1: Implementar ICurrentTenantService**

`src/ChatOmnicanal.Infrastructure/Authentication/CurrentTenantService.cs`
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace ChatOmnicanal.Infrastructure.Authentication;

public class CurrentTenantService : ICurrentTenantService
{
    private const string TenantIdKey = "X-Tenant-Id-Internal";
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentTenantService(IHttpContextAccessor httpContextAccessor)
        => _httpContextAccessor = httpContextAccessor;

    public Guid TenantId
    {
        get
        {
            var ctx = _httpContextAccessor.HttpContext
                ?? throw new InvalidOperationException("No HTTP context.");
            if (ctx.Items.TryGetValue(TenantIdKey, out var value) && value is Guid tenantId)
                return tenantId;
            throw new UnauthorizedAccessException("TenantId not set. Request is not tenant-scoped.");
        }
    }

    public bool IsAuthenticated
    {
        get
        {
            var ctx = _httpContextAccessor.HttpContext;
            return ctx?.Items.ContainsKey(TenantIdKey) == true;
        }
    }

    public static void SetTenantId(HttpContext ctx, Guid tenantId)
        => ctx.Items[TenantIdKey] = tenantId;
}
```

- [ ] **Step 4.2: Commit**

```bash
git add .
git commit -m "feat(phase-1): implement ICurrentTenantService via HttpContext.Items"
```

---

## Task 5: API — TenantMiddleware

**Files:**
- Create: `src/ChatOmnicanal.API/Middleware/TenantMiddleware.cs`

- [ ] **Step 5.1: Crear TenantMiddleware**

`src/ChatOmnicanal.API/Middleware/TenantMiddleware.cs`
```csharp
using ChatOmnicanal.Application.Users;
using ChatOmnicanal.Infrastructure.Authentication;
using Microsoft.EntityFrameworkCore;
using ChatOmnicanal.Application.Common.Interfaces;
using System.Security.Claims;

namespace ChatOmnicanal.API.Middleware;

public class TenantMiddleware
{
    private readonly RequestDelegate _next;

    public TenantMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext ctx, IUserService userService, IApplicationDbContext db)
    {
        // Solo procesar requests autenticados
        if (ctx.User.Identity?.IsAuthenticated == true)
        {
            var clerkId = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? ctx.User.FindFirstValue("sub");

            if (!string.IsNullOrEmpty(clerkId))
            {
                var user = await userService.GetByClerkIdAsync(clerkId);

                if (user is not null)
                {
                    // Buscar la membership activa del usuario
                    var membership = await db.Memberships
                        .Where(m => m.UserId == user.Id)
                        .OrderBy(m => m.CreatedAt)
                        .FirstOrDefaultAsync();

                    if (membership is not null)
                        CurrentTenantService.SetTenantId(ctx, membership.TenantId);
                }
            }
        }

        await _next(ctx);
    }
}
```

- [ ] **Step 5.2: Commit**

```bash
git add .
git commit -m "feat(phase-1): add TenantMiddleware to resolve TenantId from Clerk JWT"
```

---

## Task 6: API — Controllers

**Files:**
- Create: `src/ChatOmnicanal.API/Controllers/TenantsController.cs`
- Create: `src/ChatOmnicanal.API/Controllers/MembershipsController.cs`
- Create: `src/ChatOmnicanal.API/Controllers/ClerkWebhookController.cs`

- [ ] **Step 6.1: Crear TenantsController**

`src/ChatOmnicanal.API/Controllers/TenantsController.cs`
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Tenants;
using ChatOmnicanal.Application.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TenantsController : ControllerBase
{
    private readonly ITenantService _tenantService;
    private readonly IUserService _userService;
    private readonly ICurrentTenantService _currentTenant;

    public TenantsController(
        ITenantService tenantService,
        IUserService userService,
        ICurrentTenantService currentTenant)
    {
        _tenantService = tenantService;
        _userService = userService;
        _currentTenant = currentTenant;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTenantRequest request, CancellationToken ct)
    {
        var clerkId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrEmpty(clerkId)) return Unauthorized();

        var user = await _userService.GetByClerkIdAsync(clerkId, ct);
        if (user is null) return Unauthorized("User not synced. Clerk webhook may not have fired yet.");

        var tenant = await _tenantService.CreateAsync(request.Name, user.Id, ct);
        return CreatedAtAction(nameof(GetCurrent), new { }, tenant);
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrent(CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        var tenant = await _tenantService.GetByIdAsync(_currentTenant.TenantId, ct);
        return tenant is null ? NotFound() : Ok(tenant);
    }
}
```

- [ ] **Step 6.2: Crear MembershipsController**

`src/ChatOmnicanal.API/Controllers/MembershipsController.cs`
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Memberships;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MembershipsController : ControllerBase
{
    private readonly IMembershipService _membershipService;
    private readonly ICurrentTenantService _currentTenant;

    public MembershipsController(IMembershipService membershipService, ICurrentTenantService currentTenant)
    {
        _membershipService = membershipService;
        _currentTenant = currentTenant;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        var members = await _membershipService.ListAsync(_currentTenant.TenantId, ct);
        return Ok(members);
    }

    [HttpPost("invite")]
    public async Task<IActionResult> Invite([FromBody] InviteMemberRequest request, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        await _membershipService.InviteAsync(_currentTenant.TenantId, request.Email, ct);
        return NoContent();
    }

    [HttpDelete("{membershipId:guid}")]
    public async Task<IActionResult> Remove(Guid membershipId, CancellationToken ct)
    {
        if (!_currentTenant.IsAuthenticated) return Unauthorized();
        try
        {
            await _membershipService.RemoveAsync(_currentTenant.TenantId, membershipId, ct);
            return NoContent();
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
    }
}
```

- [ ] **Step 6.3: Crear ClerkWebhookController**

`src/ChatOmnicanal.API/Controllers/ClerkWebhookController.cs`
```csharp
using ChatOmnicanal.Application.Users;
using Microsoft.AspNetCore.Mvc;
using Svix;
using Svix.Model;
using System.Text.Json;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("api/webhooks/clerk")]
public class ClerkWebhookController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IConfiguration _config;
    private readonly ILogger<ClerkWebhookController> _logger;

    public ClerkWebhookController(IUserService userService, IConfiguration config, ILogger<ClerkWebhookController> logger)
    {
        _userService = userService;
        _config = config;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Handle(CancellationToken ct)
    {
        // Leer el body crudo para validar la firma
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(ct);

        // Validar firma Svix
        var webhookSecret = _config["Clerk:WebhookSecret"]
            ?? throw new InvalidOperationException("Clerk:WebhookSecret not configured.");

        var wh = new Webhook(webhookSecret);
        try
        {
            wh.Verify(body, new WebhookHeaders(
                id: Request.Headers["svix-id"].ToString(),
                timestamp: Request.Headers["svix-timestamp"].ToString(),
                signature: Request.Headers["svix-signature"].ToString()));
        }
        catch (WebhookVerificationException ex)
        {
            _logger.LogWarning("Clerk webhook signature verification failed: {Message}", ex.Message);
            return Unauthorized();
        }

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var eventType = root.GetProperty("type").GetString();

        if (eventType is "user.created" or "user.updated")
        {
            var data = root.GetProperty("data");
            var clerkId = data.GetProperty("id").GetString()!;
            var email = data.GetProperty("email_addresses")[0].GetProperty("email_address").GetString()!;
            var firstName = data.TryGetProperty("first_name", out var fn) ? fn.GetString() ?? "" : "";
            var lastName = data.TryGetProperty("last_name", out var ln) ? ln.GetString() ?? "" : "";
            var name = $"{firstName} {lastName}".Trim();

            await _userService.SyncAsync(new SyncUserRequest(clerkId, email, name), ct);
            _logger.LogInformation("Synced Clerk user {ClerkId}", clerkId);
        }

        return Ok();
    }
}
```

- [ ] **Step 6.4: Commit**

```bash
git add .
git commit -m "feat(phase-1): add TenantsController, MembershipsController and ClerkWebhookController"
```

---

## Task 7: API — DependencyInjection y Program.cs

**Files:**
- Create: `src/ChatOmnicanal.API/DependencyInjection.cs`
- Modify: `src/ChatOmnicanal.API/Program.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`

- [ ] **Step 7.1: Crear API DependencyInjection**

`src/ChatOmnicanal.API/DependencyInjection.cs`
```csharp
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace ChatOmnicanal.API;

public static class DependencyInjection
{
    public static IServiceCollection AddApiServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var clerkAuthority = configuration["Clerk:Authority"]
            ?? throw new InvalidOperationException("Clerk:Authority not configured.");

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = clerkAuthority;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = clerkAuthority,
                    ValidateAudience = false,
                    NameClaimType = "sub",
                };
            });

        services.AddAuthorization();
        services.AddHttpContextAccessor();

        return services;
    }
}
```

- [ ] **Step 7.2: Actualizar Infrastructure DependencyInjection**

Reemplazar el contenido de `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`:

```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Application.Memberships;
using ChatOmnicanal.Application.Tenants;
using ChatOmnicanal.Application.Users;
using ChatOmnicanal.Infrastructure.Authentication;
using ChatOmnicanal.Infrastructure.Persistence;
using ChatOmnicanal.Infrastructure.Services;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ChatOmnicanal.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(connectionString, o => o.UseVector()));

        services.AddScoped<IApplicationDbContext>(provider =>
            provider.GetRequiredService<ApplicationDbContext>());

        services.AddScoped<ICurrentTenantService, CurrentTenantService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<ITenantService, TenantService>();
        services.AddScoped<IMembershipService, MembershipService>();

        services.AddHttpClient<IClerkService, ClerkService>(client =>
        {
            client.DefaultRequestHeaders.Add(
                "Authorization",
                $"Bearer {configuration["Clerk:SecretKey"]}");
        });

        services.AddHangfire(config => config
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UsePostgreSqlStorage(c => c.UseNpgsqlConnection(connectionString)));

        services.AddHangfireServer();

        return services;
    }
}
```

- [ ] **Step 7.3: Actualizar Program.cs**

```csharp
using ChatOmnicanal.API;
using ChatOmnicanal.API.Middleware;
using ChatOmnicanal.Infrastructure;
using Hangfire;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApiServices(builder.Configuration);
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<TenantMiddleware>();

app.MapControllers();
app.MapHealthChecks("/health");
app.UseHangfireDashboard("/hangfire");

app.Run();

public partial class Program { }
```

- [ ] **Step 7.4: Compilar toda la solución**

```bash
dotnet build ChatOmnicanal.sln
```

Expected: `Build succeeded`.

- [ ] **Step 7.5: Commit**

```bash
git add .
git commit -m "feat(phase-1): wire up Clerk JWT auth, TenantMiddleware and all services in DI"
```

---

## Task 8: Tests de integración

**Files:**
- Modify: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/DatabaseFixture.cs`
- Create: `tests/ChatOmnicanal.Integration.Tests/API/TenantsControllerTests.cs`
- Create: `tests/ChatOmnicanal.Integration.Tests/API/ClerkWebhookTests.cs`

- [ ] **Step 8.1: Actualizar DatabaseFixture con helpers**

Reemplazar `tests/ChatOmnicanal.Integration.Tests/Infrastructure/DatabaseFixture.cs`:

```csharp
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;
using ChatOmnicanal.Infrastructure.Persistence;
using Hangfire;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace ChatOmnicanal.Integration.Tests.Infrastructure;

public class DatabaseFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("pgvector/pgvector:pg16")
        .WithDatabase("chatomnicanal_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public string ConnectionString => _postgres.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        Factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    var dbDescriptor = services.SingleOrDefault(
                        d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
                    if (dbDescriptor != null) services.Remove(dbDescriptor);

                    services.AddDbContext<ApplicationDbContext>(options =>
                        options.UseNpgsql(_postgres.GetConnectionString(), o => o.UseVector()));

                    // Reemplazar Hangfire para que no intente conectarse al postgres real
                    var hangfireDescriptors = services
                        .Where(d => d.ServiceType.FullName?.Contains("Hangfire") == true)
                        .ToList();
                    foreach (var d in hangfireDescriptors) services.Remove(d);
                    services.AddHangfire(c => c.UseInMemoryStorage());
                    services.AddHangfireServer();
                });
                // Clerk authority apunta a un issuer de prueba
                builder.UseSetting("Clerk:Authority", "https://test.clerk.dev");
                builder.UseSetting("Clerk:SecretKey", "sk_test_fake");
                builder.UseSetting("Clerk:WebhookSecret", "whsec_testbase64secretforsvixvalidation==");
            });

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.MigrateAsync();
    }

    public async Task<(User user, Tenant tenant)> SeedUserWithTenantAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var user = new User { ClerkId = $"user_{Guid.NewGuid():N}", Email = "owner@test.com", Name = "Test Owner" };
        db.Users.Add(user);

        var tenant = new Tenant { Name = "Test Tenant" };
        db.Tenants.Add(tenant);

        db.Memberships.Add(new Membership { TenantId = tenant.Id, UserId = user.Id, Role = UserRole.Owner });

        await db.SaveChangesAsync();
        return (user, tenant);
    }

    public async Task DisposeAsync()
    {
        Factory?.Dispose();
        await _postgres.StopAsync();
    }
}
```

- [ ] **Step 8.2: Escribir test de ClerkWebhook**

`tests/ChatOmnicanal.Integration.Tests/API/ClerkWebhookTests.cs`
```csharp
using ChatOmnicanal.Integration.Tests.Infrastructure;
using ChatOmnicanal.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Text;
using System.Text.Json;

namespace ChatOmnicanal.Integration.Tests.API;

public class ClerkWebhookTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    private readonly HttpClient _client;

    public ClerkWebhookTests(DatabaseFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.Factory.CreateClient();
    }

    [Fact]
    public async Task Post_WithInvalidSignature_Returns401()
    {
        var payload = JsonSerializer.Serialize(new
        {
            type = "user.created",
            data = new { id = "user_123", email_addresses = new[] { new { email_address = "test@test.com" } } }
        });

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/clerk")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };
        // Sin headers de Svix → firma inválida
        request.Headers.Add("svix-id", "msg_123");
        request.Headers.Add("svix-timestamp", "1234567890");
        request.Headers.Add("svix-signature", "v1,invalidsignature");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Post_ValidUserCreated_SyncsUserToDatabase()
    {
        // Para este test simulamos el procesamiento directamente via servicio
        // El test de firma ya cubre la validación; aquí testeamos la lógica de sync
        using var scope = _fixture.Factory.Services.CreateScope();
        var userService = scope.ServiceProvider.GetRequiredService<Application.Users.IUserService>();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var clerkId = $"user_test_{Guid.NewGuid():N}";
        await userService.SyncAsync(new Application.Users.SyncUserRequest(clerkId, "new@test.com", "New User"));

        var user = db.Users.FirstOrDefault(u => u.ClerkId == clerkId);
        Assert.NotNull(user);
        Assert.Equal("new@test.com", user.Email);
    }
}
```

- [ ] **Step 8.3: Escribir tests de TenantsController**

`tests/ChatOmnicanal.Integration.Tests/API/TenantsControllerTests.cs`
```csharp
using ChatOmnicanal.Integration.Tests.Infrastructure;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace ChatOmnicanal.Integration.Tests.API;

public class TenantsControllerTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;

    public TenantsControllerTests(DatabaseFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task GetMe_WithoutAuth_Returns401()
    {
        var client = _fixture.Factory.CreateClient();
        var response = await client.GetAsync("/api/tenants/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetMe_WithValidAuth_ReturnsTenant()
    {
        var (user, tenant) = await _fixture.SeedUserWithTenantAsync();

        // Crear un token JWT firmado con una clave de prueba
        // En tests de integración sin Clerk real, deshabilitamos la validación de firma
        // y solo chequeamos que el middleware resuelve el TenantId correctamente
        var factory = _fixture.Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Permitir cualquier token JWT en tests (sin validar firma)
                services.PostConfigure<Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerOptions>(
                    Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme,
                    options =>
                    {
                        options.TokenValidationParameters.SignatureValidator =
                            (token, _) => new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(token);
                        options.TokenValidationParameters.ValidateIssuer = false;
                        options.TokenValidationParameters.ValidateLifetime = false;
                    });
            });
        });

        var token = CreateTestJwt(user.ClerkId);
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/tenants/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(tenant.Id.ToString(), body.GetProperty("id").GetString());
    }

    private static string CreateTestJwt(string clerkId)
    {
        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var claims = new[] { new System.Security.Claims.Claim("sub", clerkId) };
        var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
            issuer: "https://test.clerk.dev",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1));
        return handler.WriteToken(token);
    }
}
```

- [ ] **Step 8.4: Correr los tests**

```bash
dotnet test tests/ChatOmnicanal.Integration.Tests/ChatOmnicanal.Integration.Tests.csproj --verbosity normal
```

Expected: todos en verde (incluyendo el HealthCheck existente).

- [ ] **Step 8.5: Commit**

```bash
git add .
git commit -m "test(phase-1): add Clerk webhook and Tenants controller integration tests"
```

---

## Criterio de terminado de Fase 1

- `POST /api/webhooks/clerk` rechaza requests sin firma Svix válida con 401.
- `POST /api/webhooks/clerk` con payload `user.created` crea o actualiza un `User` en la DB.
- `POST /api/tenants` crea un tenant y una membership Owner para el usuario autenticado.
- `GET /api/tenants/me` devuelve el tenant del usuario autenticado.
- `GET /api/memberships` lista los miembros del tenant actual.
- `POST /api/memberships/invite` llama a Clerk API para invitar un email.
- `DELETE /api/memberships/{id}` elimina una membership (no la del Owner).
- `GET /api/tenants/me` sin token devuelve 401.
- Todos los tests en verde.
