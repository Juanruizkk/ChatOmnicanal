# Phase 0 — Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la estructura base del repo de la API (.NET 8 Clean Architecture) y del repo web (React + Vite), con PostgreSQL + pgvector corriendo en Docker y el esquema inicial migrado.

**Architecture:** Clean Architecture en 4 capas: Domain (entidades y enums, sin dependencias externas), Application (interfaces y contratos), Infrastructure (EF Core, Hangfire, repositorios), API (ASP.NET Core controllers). Repo web separado con React + Vite. Docker Compose levanta postgres, api y worker desde el repo de la API.

**Tech Stack:** .NET 8, ASP.NET Core 8, EF Core 8, Npgsql.EntityFrameworkCore.PostgreSQL, Pgvector.EntityFrameworkCore, Hangfire 1.8, xUnit, Testcontainers.PostgreSql, React 18, Vite 5, TypeScript 5

---

## File Map

### Repo: chatomnicanal-api

```
ChatOmnicanal.sln
global.json
.gitignore
.env.example
docker-compose.yml
docker-compose.override.yml

src/
  ChatOmnicanal.Domain/
    ChatOmnicanal.Domain.csproj
    Common/
      BaseEntity.cs
      ITenantScoped.cs
    Enums/
      ChannelType.cs
      ChannelStatus.cs
      ConversationStatus.cs
      MessageDirection.cs
      MessageAuthor.cs
      UserRole.cs
      TenantPlan.cs
      TenantStatus.cs
    Entities/
      Tenant.cs
      User.cs
      Membership.cs
      TenantProfile.cs
      Channel.cs
      Contact.cs
      Conversation.cs
      Message.cs
      KnowledgeDoc.cs
      KnowledgeChunk.cs
      UsageEvent.cs

  ChatOmnicanal.Application/
    ChatOmnicanal.Application.csproj
    Common/
      Interfaces/
        IApplicationDbContext.cs
        ICurrentTenantService.cs

  ChatOmnicanal.Infrastructure/
    ChatOmnicanal.Infrastructure.csproj
    Persistence/
      ApplicationDbContext.cs
      Configurations/
        TenantConfiguration.cs
        UserConfiguration.cs
        MembershipConfiguration.cs
        TenantProfileConfiguration.cs
        ChannelConfiguration.cs
        ContactConfiguration.cs
        ConversationConfiguration.cs
        MessageConfiguration.cs
        KnowledgeDocConfiguration.cs
        KnowledgeChunkConfiguration.cs
        UsageEventConfiguration.cs
      Migrations/   ← generado por EF CLI
    DependencyInjection.cs

  ChatOmnicanal.API/
    ChatOmnicanal.API.csproj
    Program.cs
    Controllers/
      HealthController.cs
    DependencyInjection.cs

  ChatOmnicanal.Worker/
    ChatOmnicanal.Worker.csproj
    Program.cs

tests/
  ChatOmnicanal.Domain.Tests/
    ChatOmnicanal.Domain.Tests.csproj
    Entities/
      ConversationTests.cs
  ChatOmnicanal.Integration.Tests/
    ChatOmnicanal.Integration.Tests.csproj
    Infrastructure/
      DatabaseFixture.cs
    API/
      HealthCheckTests.cs
```

### Repo: chatomnicanal-web

```
chatomnicanal-web/
  src/
    App.tsx
    main.tsx
    vite-env.d.ts
  index.html
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  .env.example
  .gitignore
  package.json
```

---

## Task 1: Crear repos y estructura de solución .NET

**Files:**
- Create: `ChatOmnicanal.sln`, `global.json`, `.gitignore`, `docker-compose.yml`, `.env.example`
- Create: los 5 proyectos `.csproj`

- [ ] **Step 1.1: Inicializar el repo de la API**

```bash
mkdir chatomnicanal-api && cd chatomnicanal-api
git init
```

- [ ] **Step 1.2: Crear global.json para fijar versión de SDK**

```bash
dotnet new globaljson --sdk-version 8.0.0 --roll-forward latestFeature
```

- [ ] **Step 1.3: Crear la solución y los proyectos**

```bash
dotnet new sln -n ChatOmnicanal

dotnet new classlib -n ChatOmnicanal.Domain         -o src/ChatOmnicanal.Domain         -f net8.0
dotnet new classlib -n ChatOmnicanal.Application    -o src/ChatOmnicanal.Application    -f net8.0
dotnet new classlib -n ChatOmnicanal.Infrastructure -o src/ChatOmnicanal.Infrastructure -f net8.0
dotnet new webapi   -n ChatOmnicanal.API            -o src/ChatOmnicanal.API            -f net8.0 --no-openapi
dotnet new worker   -n ChatOmnicanal.Worker         -o src/ChatOmnicanal.Worker         -f net8.0

dotnet new xunit    -n ChatOmnicanal.Domain.Tests       -o tests/ChatOmnicanal.Domain.Tests       -f net8.0
dotnet new xunit    -n ChatOmnicanal.Integration.Tests  -o tests/ChatOmnicanal.Integration.Tests  -f net8.0

dotnet sln add src/ChatOmnicanal.Domain/ChatOmnicanal.Domain.csproj
dotnet sln add src/ChatOmnicanal.Application/ChatOmnicanal.Application.csproj
dotnet sln add src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
dotnet sln add src/ChatOmnicanal.API/ChatOmnicanal.API.csproj
dotnet sln add src/ChatOmnicanal.Worker/ChatOmnicanal.Worker.csproj
dotnet sln add tests/ChatOmnicanal.Domain.Tests/ChatOmnicanal.Domain.Tests.csproj
dotnet sln add tests/ChatOmnicanal.Integration.Tests/ChatOmnicanal.Integration.Tests.csproj
```

- [ ] **Step 1.4: Agregar referencias entre proyectos**

```bash
# Application depende de Domain
dotnet add src/ChatOmnicanal.Application/ChatOmnicanal.Application.csproj reference src/ChatOmnicanal.Domain/ChatOmnicanal.Domain.csproj

# Infrastructure depende de Application
dotnet add src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj reference src/ChatOmnicanal.Application/ChatOmnicanal.Application.csproj

# API depende de Infrastructure y Application
dotnet add src/ChatOmnicanal.API/ChatOmnicanal.API.csproj reference src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
dotnet add src/ChatOmnicanal.API/ChatOmnicanal.API.csproj reference src/ChatOmnicanal.Application/ChatOmnicanal.Application.csproj

# Worker depende de Infrastructure
dotnet add src/ChatOmnicanal.Worker/ChatOmnicanal.Worker.csproj reference src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj

# Tests
dotnet add tests/ChatOmnicanal.Domain.Tests/ChatOmnicanal.Domain.Tests.csproj reference src/ChatOmnicanal.Domain/ChatOmnicanal.Domain.csproj
dotnet add tests/ChatOmnicanal.Integration.Tests/ChatOmnicanal.Integration.Tests.csproj reference src/ChatOmnicanal.API/ChatOmnicanal.API.csproj
dotnet add tests/ChatOmnicanal.Integration.Tests/ChatOmnicanal.Integration.Tests.csproj reference src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```

- [ ] **Step 1.5: Instalar paquetes NuGet**

```bash
# Infrastructure
dotnet add src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj package Npgsql.EntityFrameworkCore.PostgreSQL --version 8.0.10
dotnet add src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj package Pgvector.EntityFrameworkCore --version 0.2.0
dotnet add src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj package Microsoft.EntityFrameworkCore.Design --version 8.0.10
dotnet add src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj package Hangfire.AspNetCore --version 1.8.14
dotnet add src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj package Hangfire.PostgreSql --version 1.20.9

# API
dotnet add src/ChatOmnicanal.API/ChatOmnicanal.API.csproj package Microsoft.AspNetCore.OpenApi --version 8.0.10

# Integration tests
dotnet add tests/ChatOmnicanal.Integration.Tests/ChatOmnicanal.Integration.Tests.csproj package Testcontainers.PostgreSql --version 3.10.0
dotnet add tests/ChatOmnicanal.Integration.Tests/ChatOmnicanal.Integration.Tests.csproj package Microsoft.AspNetCore.Mvc.Testing --version 8.0.10
```

- [ ] **Step 1.6: Borrar archivos de clase por defecto**

```bash
rm src/ChatOmnicanal.Domain/Class1.cs
rm src/ChatOmnicanal.Application/Class1.cs
rm src/ChatOmnicanal.Infrastructure/Class1.cs
```

- [ ] **Step 1.7: Crear .gitignore**

```gitignore
# .gitignore
**/bin/
**/obj/
**/.vs/
**/.idea/
*.user
.env
.env.local
*.log
```

- [ ] **Step 1.8: Crear .env.example**

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=chatomnicanal
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
ConnectionStrings__DefaultConnection=Host=localhost;Port=5432;Database=chatomnicanal;Username=postgres;Password=postgres
```

- [ ] **Step 1.9: Verificar que la solución compila**

```bash
dotnet build ChatOmnicanal.sln
```

Expected: `Build succeeded` sin errores.

- [ ] **Step 1.10: Commit**

```bash
git add .
git commit -m "chore: scaffold solution with Clean Architecture project structure"
```

---

## Task 2: Domain — Enums

**Files:**
- Create: `src/ChatOmnicanal.Domain/Enums/*.cs`

- [ ] **Step 2.1: Crear los enums**

`src/ChatOmnicanal.Domain/Enums/ChannelType.cs`
```csharp
namespace ChatOmnicanal.Domain.Enums;

public enum ChannelType
{
    WhatsApp,
    Instagram,
    Messenger
}
```

`src/ChatOmnicanal.Domain/Enums/ChannelStatus.cs`
```csharp
namespace ChatOmnicanal.Domain.Enums;

public enum ChannelStatus
{
    Active,
    Inactive,
    Error
}
```

`src/ChatOmnicanal.Domain/Enums/ConversationStatus.cs`
```csharp
namespace ChatOmnicanal.Domain.Enums;

public enum ConversationStatus
{
    Bot,
    Human,
    InQueue,
    Closed
}
```

`src/ChatOmnicanal.Domain/Enums/MessageDirection.cs`
```csharp
namespace ChatOmnicanal.Domain.Enums;

public enum MessageDirection
{
    Inbound,
    Outbound
}
```

`src/ChatOmnicanal.Domain/Enums/MessageAuthor.cs`
```csharp
namespace ChatOmnicanal.Domain.Enums;

public enum MessageAuthor
{
    User,
    Bot,
    Agent
}
```

`src/ChatOmnicanal.Domain/Enums/UserRole.cs`
```csharp
namespace ChatOmnicanal.Domain.Enums;

public enum UserRole
{
    Owner,
    Agent
}
```

`src/ChatOmnicanal.Domain/Enums/TenantPlan.cs`
```csharp
namespace ChatOmnicanal.Domain.Enums;

public enum TenantPlan
{
    Basic,
    Pro
}
```

`src/ChatOmnicanal.Domain/Enums/TenantStatus.cs`
```csharp
namespace ChatOmnicanal.Domain.Enums;

public enum TenantStatus
{
    Active,
    Suspended,
    Cancelled
}
```

- [ ] **Step 2.2: Compilar para verificar**

```bash
dotnet build src/ChatOmnicanal.Domain/ChatOmnicanal.Domain.csproj
```

Expected: `Build succeeded`.

- [ ] **Step 2.3: Commit**

```bash
git add .
git commit -m "feat(domain): add enums"
```

---

## Task 3: Domain — Base y entidades principales

**Files:**
- Create: `src/ChatOmnicanal.Domain/Common/BaseEntity.cs`
- Create: `src/ChatOmnicanal.Domain/Common/ITenantScoped.cs`
- Create: `src/ChatOmnicanal.Domain/Entities/Tenant.cs`, `User.cs`, `Membership.cs`, `TenantProfile.cs`

- [ ] **Step 3.1: Crear BaseEntity e ITenantScoped**

`src/ChatOmnicanal.Domain/Common/BaseEntity.cs`
```csharp
namespace ChatOmnicanal.Domain.Common;

public abstract class BaseEntity
{
    public Guid Id { get; protected set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; protected set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

`src/ChatOmnicanal.Domain/Common/ITenantScoped.cs`
```csharp
namespace ChatOmnicanal.Domain.Common;

public interface ITenantScoped
{
    Guid TenantId { get; }
}
```

- [ ] **Step 3.2: Crear entidades principales**

`src/ChatOmnicanal.Domain/Entities/Tenant.cs`
```csharp
using ChatOmnicanal.Domain.Common;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Domain.Entities;

public class Tenant : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public TenantPlan Plan { get; set; } = TenantPlan.Basic;
    public TenantStatus Status { get; set; } = TenantStatus.Active;

    public TenantProfile? Profile { get; private set; }
    public ICollection<Membership> Memberships { get; private set; } = new List<Membership>();
    public ICollection<Channel> Channels { get; private set; } = new List<Channel>();
}
```

`src/ChatOmnicanal.Domain/Entities/User.cs`
```csharp
using ChatOmnicanal.Domain.Common;

namespace ChatOmnicanal.Domain.Entities;

public class User : BaseEntity
{
    public string ClerkId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    public ICollection<Membership> Memberships { get; private set; } = new List<Membership>();
}
```

`src/ChatOmnicanal.Domain/Entities/Membership.cs`
```csharp
using ChatOmnicanal.Domain.Common;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Domain.Entities;

public class Membership : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public UserRole Role { get; set; } = UserRole.Agent;

    public Tenant Tenant { get; private set; } = null!;
    public User User { get; private set; } = null!;
}
```

`src/ChatOmnicanal.Domain/Entities/TenantProfile.cs`
```csharp
using ChatOmnicanal.Domain.Common;

namespace ChatOmnicanal.Domain.Entities;

public class TenantProfile : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }

    public string? Address { get; set; }
    public string? Timezone { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public string? Tone { get; set; }

    // Horarios: JSON serializado { "monday": { "open": "09:00", "close": "18:00", "closed": false }, ... }
    public string BusinessHoursJson { get; set; } = "{}";

    // Info de envíos y medios de pago: texto libre para inyectar en el system prompt
    public string? ShippingInfo { get; set; }
    public string? PaymentMethods { get; set; }

    public Tenant Tenant { get; private set; } = null!;
}
```

- [ ] **Step 3.3: Compilar**

```bash
dotnet build src/ChatOmnicanal.Domain/ChatOmnicanal.Domain.csproj
```

Expected: `Build succeeded`.

- [ ] **Step 3.4: Commit**

```bash
git add .
git commit -m "feat(domain): add base entities (Tenant, User, Membership, TenantProfile)"
```

---

## Task 4: Domain — Entidades de canales y conversaciones

**Files:**
- Create: `src/ChatOmnicanal.Domain/Entities/Channel.cs`, `Contact.cs`, `Conversation.cs`, `Message.cs`

- [ ] **Step 4.1: Crear Channel y Contact**

`src/ChatOmnicanal.Domain/Entities/Channel.cs`
```csharp
using ChatOmnicanal.Domain.Common;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Domain.Entities;

public class Channel : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public ChannelType Type { get; set; }
    public ChannelStatus Status { get; set; } = ChannelStatus.Active;

    // WhatsApp
    public string? WabaId { get; set; }
    public string? PhoneNumberId { get; set; }

    // Instagram
    public string? IgUserId { get; set; }

    // Messenger
    public string? PageId { get; set; }

    // Token cifrado (AES-256 en infraestructura)
    public string? EncryptedAccessToken { get; set; }

    public Tenant Tenant { get; private set; } = null!;
    public ICollection<Conversation> Conversations { get; private set; } = new List<Conversation>();
}
```

`src/ChatOmnicanal.Domain/Entities/Contact.cs`
```csharp
using ChatOmnicanal.Domain.Common;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Domain.Entities;

public class Contact : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public ChannelType ChannelType { get; set; }

    // Identificador externo según canal: waId, IGSID o PSID
    public string ExternalId { get; set; } = string.Empty;
    public string? Name { get; set; }

    public ICollection<Conversation> Conversations { get; private set; } = new List<Conversation>();
}
```

- [ ] **Step 4.2: Crear Conversation**

`src/ChatOmnicanal.Domain/Entities/Conversation.cs`
```csharp
using ChatOmnicanal.Domain.Common;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Domain.Entities;

public class Conversation : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public Guid ChannelId { get; set; }
    public Guid ContactId { get; set; }
    public ConversationStatus Status { get; set; } = ConversationStatus.Bot;
    public Guid? AssignedAgentId { get; set; }
    public DateTime? LastUserMessageAt { get; set; }

    // JSON del objeto referral de Meta (si vino por pauta publicitaria)
    public string? ReferralJson { get; set; }

    public Channel Channel { get; private set; } = null!;
    public Contact Contact { get; private set; } = null!;
    public User? AssignedAgent { get; private set; }
    public ICollection<Message> Messages { get; private set; } = new List<Message>();

    public void AssignAgent(Guid agentId)
    {
        AssignedAgentId = agentId;
        Status = ConversationStatus.Human;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Resolve()
    {
        Status = ConversationStatus.Closed;
        AssignedAgentId = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void TransitionToHuman()
    {
        Status = ConversationStatus.Human;
        UpdatedAt = DateTime.UtcNow;
    }

    public void TransitionToQueue()
    {
        Status = ConversationStatus.InQueue;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReopenAsBot()
    {
        Status = ConversationStatus.Bot;
        AssignedAgentId = null;
        UpdatedAt = DateTime.UtcNow;
    }
}
```

- [ ] **Step 4.3: Crear Message**

`src/ChatOmnicanal.Domain/Entities/Message.cs`
```csharp
using ChatOmnicanal.Domain.Common;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Domain.Entities;

public class Message : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public Guid ConversationId { get; set; }
    public MessageDirection Direction { get; set; }
    public MessageAuthor Author { get; set; }
    public string Content { get; set; } = string.Empty;

    // ID externo de Meta (para idempotencia — Meta reintenta webhooks)
    public string ExternalId { get; set; } = string.Empty;

    // Estado de entrega: sent, delivered, read, failed
    public string? DeliveryStatus { get; set; }

    // Si el webhook de status reporta billable o category general_purpose_ai
    public bool? Billable { get; set; }
    public string? MetaCategory { get; set; }

    public Conversation Conversation { get; private set; } = null!;
}
```

- [ ] **Step 4.4: Compilar**

```bash
dotnet build src/ChatOmnicanal.Domain/ChatOmnicanal.Domain.csproj
```

Expected: `Build succeeded`.

- [ ] **Step 4.5: Commit**

```bash
git add .
git commit -m "feat(domain): add Channel, Contact, Conversation, Message entities"
```

---

## Task 5: Domain — Entidades de conocimiento y uso

**Files:**
- Create: `src/ChatOmnicanal.Domain/Entities/KnowledgeDoc.cs`, `KnowledgeChunk.cs`, `UsageEvent.cs`

- [ ] **Step 5.1: Crear KnowledgeDoc y KnowledgeChunk**

`src/ChatOmnicanal.Domain/Entities/KnowledgeDoc.cs`
```csharp
using ChatOmnicanal.Domain.Common;

namespace ChatOmnicanal.Domain.Entities;

public class KnowledgeDoc : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;

    // pdf, text, url
    public string Type { get; set; } = string.Empty;

    // pending, processing, ready, error
    public string Status { get; set; } = "pending";

    public Tenant Tenant { get; private set; } = null!;
    public ICollection<KnowledgeChunk> Chunks { get; private set; } = new List<KnowledgeChunk>();
}
```

`src/ChatOmnicanal.Domain/Entities/KnowledgeChunk.cs`
```csharp
using ChatOmnicanal.Domain.Common;
using Pgvector;

namespace ChatOmnicanal.Domain.Entities;

public class KnowledgeChunk : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public Guid DocId { get; set; }
    public string Content { get; set; } = string.Empty;
    public int ChunkIndex { get; set; }
    public Vector? Embedding { get; set; }

    public KnowledgeDoc Doc { get; private set; } = null!;
}
```

- [ ] **Step 5.2: Crear UsageEvent**

`src/ChatOmnicanal.Domain/Entities/UsageEvent.cs`
```csharp
using ChatOmnicanal.Domain.Common;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Domain.Entities;

public class UsageEvent : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public Guid? ChannelId { get; set; }
    public Guid? ConversationId { get; set; }
    public ChannelType? ChannelType { get; set; }
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }

    // bot_response, embedding, handoff
    public string EventType { get; set; } = string.Empty;
}
```

- [ ] **Step 5.3: Compilar toda la solución**

```bash
dotnet build ChatOmnicanal.sln
```

Expected: `Build succeeded`.

- [ ] **Step 5.4: Commit**

```bash
git add .
git commit -m "feat(domain): add KnowledgeDoc, KnowledgeChunk, UsageEvent entities"
```

---

## Task 6: Application — Interfaces

**Files:**
- Create: `src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs`
- Create: `src/ChatOmnicanal.Application/Common/Interfaces/ICurrentTenantService.cs`

- [ ] **Step 6.1: Crear IApplicationDbContext**

`src/ChatOmnicanal.Application/Common/Interfaces/IApplicationDbContext.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatOmnicanal.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<User> Users { get; }
    DbSet<Membership> Memberships { get; }
    DbSet<TenantProfile> TenantProfiles { get; }
    DbSet<Channel> Channels { get; }
    DbSet<Contact> Contacts { get; }
    DbSet<Conversation> Conversations { get; }
    DbSet<Message> Messages { get; }
    DbSet<KnowledgeDoc> KnowledgeDocs { get; }
    DbSet<KnowledgeChunk> KnowledgeChunks { get; }
    DbSet<UsageEvent> UsageEvents { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
```

- [ ] **Step 6.2: Crear ICurrentTenantService**

`src/ChatOmnicanal.Application/Common/Interfaces/ICurrentTenantService.cs`
```csharp
namespace ChatOmnicanal.Application.Common.Interfaces;

public interface ICurrentTenantService
{
    Guid TenantId { get; }
    bool IsAuthenticated { get; }
}
```

- [ ] **Step 6.3: Compilar**

```bash
dotnet build src/ChatOmnicanal.Application/ChatOmnicanal.Application.csproj
```

Expected: `Build succeeded`.

- [ ] **Step 6.4: Commit**

```bash
git add .
git commit -m "feat(application): add IApplicationDbContext and ICurrentTenantService interfaces"
```

---

## Task 7: Infrastructure — DbContext y configuraciones EF Core

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs`
- Create: `src/ChatOmnicanal.Infrastructure/Persistence/Configurations/*.cs`

- [ ] **Step 7.1: Crear ApplicationDbContext**

`src/ChatOmnicanal.Infrastructure/Persistence/ApplicationDbContext.cs`
```csharp
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
    public DbSet<TenantProfile> TenantProfiles => Set<TenantProfile>();
    public DbSet<Channel> Channels => Set<Channel>();
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<KnowledgeDoc> KnowledgeDocs => Set<KnowledgeDoc>();
    public DbSet<KnowledgeChunk> KnowledgeChunks => Set<KnowledgeChunk>();
    public DbSet<UsageEvent> UsageEvents => Set<UsageEvent>();

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

- [ ] **Step 7.2: Crear configuraciones de EF**

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/TenantConfiguration.cs`
```csharp
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
    }
}
```

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/UserConfiguration.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");
        builder.HasKey(u => u.Id);
        builder.Property(u => u.ClerkId).IsRequired().HasMaxLength(100);
        builder.HasIndex(u => u.ClerkId).IsUnique();
        builder.Property(u => u.Email).IsRequired().HasMaxLength(255);
        builder.Property(u => u.Name).HasMaxLength(200);
    }
}
```

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/MembershipConfiguration.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class MembershipConfiguration : IEntityTypeConfiguration<Membership>
{
    public void Configure(EntityTypeBuilder<Membership> builder)
    {
        builder.ToTable("memberships");
        builder.HasKey(m => m.Id);
        builder.HasIndex(m => new { m.TenantId, m.UserId }).IsUnique();
        builder.Property(m => m.Role).HasConversion<string>();

        builder.HasOne(m => m.Tenant)
               .WithMany(t => t.Memberships)
               .HasForeignKey(m => m.TenantId);

        builder.HasOne(m => m.User)
               .WithMany(u => u.Memberships)
               .HasForeignKey(m => m.UserId);
    }
}
```

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/TenantProfileConfiguration.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class TenantProfileConfiguration : IEntityTypeConfiguration<TenantProfile>
{
    public void Configure(EntityTypeBuilder<TenantProfile> builder)
    {
        builder.ToTable("tenant_profiles");
        builder.HasKey(p => p.Id);
        builder.HasIndex(p => p.TenantId).IsUnique();
        builder.Property(p => p.Timezone).HasMaxLength(100);
        builder.Property(p => p.Tone).HasMaxLength(50);
        builder.Property(p => p.BusinessHoursJson).HasColumnType("jsonb").HasDefaultValue("{}");

        builder.HasOne(p => p.Tenant)
               .WithOne(t => t.Profile)
               .HasForeignKey<TenantProfile>(p => p.TenantId);
    }
}
```

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/ChannelConfiguration.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class ChannelConfiguration : IEntityTypeConfiguration<Channel>
{
    public void Configure(EntityTypeBuilder<Channel> builder)
    {
        builder.ToTable("channels");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Type).HasConversion<string>();
        builder.Property(c => c.Status).HasConversion<string>();
        builder.HasIndex(c => new { c.TenantId, c.Type });

        builder.HasOne(c => c.Tenant)
               .WithMany(t => t.Channels)
               .HasForeignKey(c => c.TenantId);
    }
}
```

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/ContactConfiguration.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class ContactConfiguration : IEntityTypeConfiguration<Contact>
{
    public void Configure(EntityTypeBuilder<Contact> builder)
    {
        builder.ToTable("contacts");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.ChannelType).HasConversion<string>();
        builder.Property(c => c.ExternalId).IsRequired().HasMaxLength(100);
        builder.HasIndex(c => new { c.TenantId, c.ChannelType, c.ExternalId }).IsUnique();
        builder.Property(c => c.Name).HasMaxLength(200);
    }
}
```

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/ConversationConfiguration.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class ConversationConfiguration : IEntityTypeConfiguration<Conversation>
{
    public void Configure(EntityTypeBuilder<Conversation> builder)
    {
        builder.ToTable("conversations");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Status).HasConversion<string>();
        builder.Property(c => c.ReferralJson).HasColumnType("jsonb");
        builder.HasIndex(c => c.TenantId);
        builder.HasIndex(c => c.Status);

        builder.HasOne(c => c.Channel)
               .WithMany(ch => ch.Conversations)
               .HasForeignKey(c => c.ChannelId);

        builder.HasOne(c => c.Contact)
               .WithMany(ct => ct.Conversations)
               .HasForeignKey(c => c.ContactId);

        builder.HasOne(c => c.AssignedAgent)
               .WithMany()
               .HasForeignKey(c => c.AssignedAgentId)
               .IsRequired(false);
    }
}
```

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/MessageConfiguration.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class MessageConfiguration : IEntityTypeConfiguration<Message>
{
    public void Configure(EntityTypeBuilder<Message> builder)
    {
        builder.ToTable("messages");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Direction).HasConversion<string>();
        builder.Property(m => m.Author).HasConversion<string>();
        builder.Property(m => m.ExternalId).IsRequired().HasMaxLength(200);
        builder.HasIndex(m => m.ExternalId).IsUnique();
        builder.HasIndex(m => m.ConversationId);

        builder.HasOne(m => m.Conversation)
               .WithMany(c => c.Messages)
               .HasForeignKey(m => m.ConversationId);
    }
}
```

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/KnowledgeDocConfiguration.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class KnowledgeDocConfiguration : IEntityTypeConfiguration<KnowledgeDoc>
{
    public void Configure(EntityTypeBuilder<KnowledgeDoc> builder)
    {
        builder.ToTable("knowledge_docs");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Name).IsRequired().HasMaxLength(500);
        builder.Property(d => d.Type).HasMaxLength(20);
        builder.Property(d => d.Status).HasMaxLength(20);
        builder.HasIndex(d => d.TenantId);
    }
}
```

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/KnowledgeChunkConfiguration.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pgvector;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class KnowledgeChunkConfiguration : IEntityTypeConfiguration<KnowledgeChunk>
{
    public void Configure(EntityTypeBuilder<KnowledgeChunk> builder)
    {
        builder.ToTable("knowledge_chunks");
        builder.HasKey(c => c.Id);
        builder.HasIndex(c => c.TenantId);
        builder.Property(c => c.Embedding).HasColumnType("vector(1536)");

        builder.HasOne(c => c.Doc)
               .WithMany(d => d.Chunks)
               .HasForeignKey(c => c.DocId);
    }
}
```

`src/ChatOmnicanal.Infrastructure/Persistence/Configurations/UsageEventConfiguration.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatOmnicanal.Infrastructure.Persistence.Configurations;

public class UsageEventConfiguration : IEntityTypeConfiguration<UsageEvent>
{
    public void Configure(EntityTypeBuilder<UsageEvent> builder)
    {
        builder.ToTable("usage_events");
        builder.HasKey(u => u.Id);
        builder.HasIndex(u => u.TenantId);
        builder.HasIndex(u => u.CreatedAt);
        builder.Property(u => u.ChannelType).HasConversion<string>();
        builder.Property(u => u.EventType).HasMaxLength(50);
    }
}
```

- [ ] **Step 7.3: Compilar Infrastructure**

```bash
dotnet build src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj
```

Expected: `Build succeeded`.

- [ ] **Step 7.4: Commit**

```bash
git add .
git commit -m "feat(infrastructure): add ApplicationDbContext with all entity configurations"
```

---

## Task 8: Infrastructure — DependencyInjection y API Program.cs

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`
- Modify: `src/ChatOmnicanal.API/Program.cs`
- Create: `src/ChatOmnicanal.API/Controllers/HealthController.cs`

- [ ] **Step 8.1: Crear DependencyInjection de Infrastructure**

`src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`
```csharp
using ChatOmnicanal.Application.Common.Interfaces;
using ChatOmnicanal.Infrastructure.Persistence;
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

- [ ] **Step 8.2: Crear Program.cs de la API**

`src/ChatOmnicanal.API/Program.cs`
```csharp
using ChatOmnicanal.Infrastructure;
using Hangfire;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHealthChecks();

var app = builder.Build();

app.MapControllers();
app.MapHealthChecks("/health");
app.UseHangfireDashboard("/hangfire");

app.Run();

// Hace el tipo accesible para integration tests
public partial class Program { }
```

- [ ] **Step 8.3: Crear appsettings.json con la connection string**

`src/ChatOmnicanal.API/appsettings.json`
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=chatomnicanal;Username=postgres;Password=postgres"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

- [ ] **Step 8.4: Crear HealthController**

`src/ChatOmnicanal.API/Controllers/HealthController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;

namespace ChatOmnicanal.API.Controllers;

[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
}
```

- [ ] **Step 8.5: Compilar toda la solución**

```bash
dotnet build ChatOmnicanal.sln
```

Expected: `Build succeeded`.

- [ ] **Step 8.6: Commit**

```bash
git add .
git commit -m "feat(api): wire up DI, health check and Hangfire dashboard"
```

---

## Task 9: Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.override.yml`

- [ ] **Step 9.1: Crear docker-compose.yml**

`docker-compose.yml`
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: chatomnicanal
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: src/ChatOmnicanal.API/Dockerfile
    environment:
      - ConnectionStrings__DefaultConnection=Host=postgres;Port=5432;Database=chatomnicanal;Username=postgres;Password=postgres
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://+:8080
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy

  worker:
    build:
      context: .
      dockerfile: src/ChatOmnicanal.Worker/Dockerfile
    environment:
      - ConnectionStrings__DefaultConnection=Host=postgres;Port=5432;Database=chatomnicanal;Username=postgres;Password=postgres
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

- [ ] **Step 9.2: Crear Dockerfiles**

`src/ChatOmnicanal.API/Dockerfile`
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/ChatOmnicanal.API/ChatOmnicanal.API.csproj", "src/ChatOmnicanal.API/"]
COPY ["src/ChatOmnicanal.Application/ChatOmnicanal.Application.csproj", "src/ChatOmnicanal.Application/"]
COPY ["src/ChatOmnicanal.Domain/ChatOmnicanal.Domain.csproj", "src/ChatOmnicanal.Domain/"]
COPY ["src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj", "src/ChatOmnicanal.Infrastructure/"]
RUN dotnet restore "src/ChatOmnicanal.API/ChatOmnicanal.API.csproj"
COPY . .
RUN dotnet publish "src/ChatOmnicanal.API/ChatOmnicanal.API.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ChatOmnicanal.API.dll"]
```

`src/ChatOmnicanal.Worker/Dockerfile`
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/ChatOmnicanal.Worker/ChatOmnicanal.Worker.csproj", "src/ChatOmnicanal.Worker/"]
COPY ["src/ChatOmnicanal.Application/ChatOmnicanal.Application.csproj", "src/ChatOmnicanal.Application/"]
COPY ["src/ChatOmnicanal.Domain/ChatOmnicanal.Domain.csproj", "src/ChatOmnicanal.Domain/"]
COPY ["src/ChatOmnicanal.Infrastructure/ChatOmnicanal.Infrastructure.csproj", "src/ChatOmnicanal.Infrastructure/"]
RUN dotnet restore "src/ChatOmnicanal.Worker/ChatOmnicanal.Worker.csproj"
COPY . .
RUN dotnet publish "src/ChatOmnicanal.Worker/ChatOmnicanal.Worker.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ChatOmnicanal.Worker.dll"]
```

- [ ] **Step 9.3: Commit**

```bash
git add .
git commit -m "chore: add Docker Compose with pgvector/pg16, api and worker"
```

---

## Task 10: EF Core — Primera migración

**Files:**
- Create: `src/ChatOmnicanal.Infrastructure/Migrations/` (generado por EF)

- [ ] **Step 10.1: Instalar la herramienta dotnet-ef globalmente**

```bash
dotnet tool install --global dotnet-ef --version 8.0.10
```

Si ya está instalada:
```bash
dotnet tool update --global dotnet-ef --version 8.0.10
```

- [ ] **Step 10.2: Levantar postgres con Docker**

```bash
docker compose up postgres -d
```

Expected: contenedor corriendo, `pg_isready` en verde.

- [ ] **Step 10.3: Crear la migración inicial**

```bash
dotnet ef migrations add InitialSchema \
  --project src/ChatOmnicanal.Infrastructure \
  --startup-project src/ChatOmnicanal.API \
  --output-dir Persistence/Migrations
```

Expected: archivos `*_InitialSchema.cs` y `ApplicationDbContextModelSnapshot.cs` creados en `Persistence/Migrations/`.

- [ ] **Step 10.4: Aplicar la migración**

```bash
dotnet ef database update \
  --project src/ChatOmnicanal.Infrastructure \
  --startup-project src/ChatOmnicanal.API
```

Expected: `Done. Applied migration '..._InitialSchema'`.

- [ ] **Step 10.5: Verificar que las tablas existen**

```bash
docker exec -it chatomnicanal-api-postgres-1 psql -U postgres -d chatomnicanal -c "\dt"
```

Expected: lista de tablas `tenants`, `users`, `memberships`, `channels`, `contacts`, `conversations`, `messages`, `knowledge_docs`, `knowledge_chunks`, `usage_events`, `tenant_profiles`.

- [ ] **Step 10.6: Commit**

```bash
git add .
git commit -m "feat(infrastructure): add initial EF Core migration with full schema"
```

---

## Task 11: Tests — Domain unit tests

**Files:**
- Create: `tests/ChatOmnicanal.Domain.Tests/Entities/ConversationTests.cs`

- [ ] **Step 11.1: Escribir tests de la máquina de estados de Conversation**

`tests/ChatOmnicanal.Domain.Tests/Entities/ConversationTests.cs`
```csharp
using ChatOmnicanal.Domain.Entities;
using ChatOmnicanal.Domain.Enums;

namespace ChatOmnicanal.Domain.Tests.Entities;

public class ConversationTests
{
    private static Conversation CreateConversation(ConversationStatus status = ConversationStatus.Bot)
    {
        var conv = new Conversation
        {
            TenantId = Guid.NewGuid(),
            ChannelId = Guid.NewGuid(),
            ContactId = Guid.NewGuid(),
            Status = status
        };
        return conv;
    }

    [Fact]
    public void TransitionToHuman_WhenBot_SetsStatusHuman()
    {
        var conv = CreateConversation(ConversationStatus.Bot);

        conv.TransitionToHuman();

        Assert.Equal(ConversationStatus.Human, conv.Status);
    }

    [Fact]
    public void TransitionToQueue_WhenBot_SetsStatusInQueue()
    {
        var conv = CreateConversation(ConversationStatus.Bot);

        conv.TransitionToQueue();

        Assert.Equal(ConversationStatus.InQueue, conv.Status);
    }

    [Fact]
    public void AssignAgent_SetsAgentAndStatusHuman()
    {
        var conv = CreateConversation(ConversationStatus.Bot);
        var agentId = Guid.NewGuid();

        conv.AssignAgent(agentId);

        Assert.Equal(ConversationStatus.Human, conv.Status);
        Assert.Equal(agentId, conv.AssignedAgentId);
    }

    [Fact]
    public void Resolve_SetsStatusClosedAndClearsAgent()
    {
        var conv = CreateConversation(ConversationStatus.Human);
        conv.AssignAgent(Guid.NewGuid());

        conv.Resolve();

        Assert.Equal(ConversationStatus.Closed, conv.Status);
        Assert.Null(conv.AssignedAgentId);
    }

    [Fact]
    public void ReopenAsBot_WhenClosed_SetsStatusBotAndClearsAgent()
    {
        var conv = CreateConversation(ConversationStatus.Closed);
        conv.AssignAgent(Guid.NewGuid());
        conv.Resolve();

        conv.ReopenAsBot();

        Assert.Equal(ConversationStatus.Bot, conv.Status);
        Assert.Null(conv.AssignedAgentId);
    }
}
```

- [ ] **Step 11.2: Correr los tests**

```bash
dotnet test tests/ChatOmnicanal.Domain.Tests/ChatOmnicanal.Domain.Tests.csproj --verbosity normal
```

Expected: `5 passed, 0 failed`.

- [ ] **Step 11.3: Commit**

```bash
git add .
git commit -m "test(domain): add Conversation state machine unit tests"
```

---

## Task 12: Tests — Integration test del health check

**Files:**
- Create: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/DatabaseFixture.cs`
- Create: `tests/ChatOmnicanal.Integration.Tests/API/HealthCheckTests.cs`

- [ ] **Step 12.1: Crear DatabaseFixture con Testcontainers**

`tests/ChatOmnicanal.Integration.Tests/Infrastructure/DatabaseFixture.cs`
```csharp
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;
using ChatOmnicanal.Infrastructure.Persistence;

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

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        Factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Reemplazar el DbContext por uno que apunta al contenedor de test
                    var descriptor = services.SingleOrDefault(
                        d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
                    if (descriptor != null)
                        services.Remove(descriptor);

                    services.AddDbContext<ApplicationDbContext>(options =>
                        options.UseNpgsql(_postgres.GetConnectionString(), o => o.UseVector()));
                });
            });

        // Aplicar migraciones al contenedor de test
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        Factory?.Dispose();
        await _postgres.StopAsync();
    }
}
```

- [ ] **Step 12.2: Crear HealthCheckTests**

`tests/ChatOmnicanal.Integration.Tests/API/HealthCheckTests.cs`
```csharp
using ChatOmnicanal.Integration.Tests.Infrastructure;

namespace ChatOmnicanal.Integration.Tests.API;

public class HealthCheckTests : IClassFixture<DatabaseFixture>
{
    private readonly HttpClient _client;

    public HealthCheckTests(DatabaseFixture fixture)
    {
        _client = fixture.Factory.CreateClient();
    }

    [Fact]
    public async Task GetHealth_ReturnsOk()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
    }
}
```

- [ ] **Step 12.3: Correr integration tests (requiere Docker corriendo)**

```bash
dotnet test tests/ChatOmnicanal.Integration.Tests/ChatOmnicanal.Integration.Tests.csproj --verbosity normal
```

Expected: `1 passed, 0 failed`.

- [ ] **Step 12.4: Commit**

```bash
git add .
git commit -m "test(integration): add health check integration test with Testcontainers"
```

---

## Task 13: Worker — Program.cs básico

**Files:**
- Modify: `src/ChatOmnicanal.Worker/Program.cs`

- [ ] **Step 13.1: Configurar el Worker con Infrastructure**

`src/ChatOmnicanal.Worker/Program.cs`
```csharp
using ChatOmnicanal.Infrastructure;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);

var host = builder.Build();
host.Run();
```

`src/ChatOmnicanal.Worker/appsettings.json`
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=chatomnicanal;Username=postgres;Password=postgres"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

- [ ] **Step 13.2: Compilar toda la solución**

```bash
dotnet build ChatOmnicanal.sln
```

Expected: `Build succeeded`.

- [ ] **Step 13.3: Correr todos los tests**

```bash
dotnet test ChatOmnicanal.sln --verbosity normal
```

Expected: todos los tests en verde.

- [ ] **Step 13.4: Commit**

```bash
git add .
git commit -m "feat(worker): configure worker host with Infrastructure DI"
```

---

## Task 14: Verificación final — docker compose up

- [ ] **Step 14.1: Levantar todo el stack**

```bash
docker compose up --build -d
```

- [ ] **Step 14.2: Verificar health check**

```bash
curl http://localhost:8080/health
```

Expected:
```json
{"status":"healthy","timestamp":"2026-10-06T..."}
```

- [ ] **Step 14.3: Verificar Hangfire dashboard accesible**

Abrir en browser: `http://localhost:8080/hangfire`

Expected: dashboard de Hangfire cargando sin errores.

- [ ] **Step 14.4: Commit final de fase**

```bash
git add .
git commit -m "chore: phase 0 complete — solution builds, migrations applied, health check passing"
```

---

## Task 15: Repo web — React + Vite

> Este task se ejecuta en el repo `chatomnicanal-web` separado.

- [ ] **Step 15.1: Crear el repo web**

```bash
mkdir chatomnicanal-web && cd chatomnicanal-web
git init
npm create vite@latest . -- --template react-ts
npm install
```

- [ ] **Step 15.2: Crear .env.example**

`.env.example`
```env
VITE_API_URL=http://localhost:8080
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

- [ ] **Step 15.3: Crear .gitignore**

```gitignore
node_modules/
dist/
.env
.env.local
```

- [ ] **Step 15.4: Verificar que levanta**

```bash
npm run dev
```

Expected: Vite en `http://localhost:5173` sin errores.

- [ ] **Step 15.5: Commit**

```bash
git add .
git commit -m "chore: scaffold React + Vite + TypeScript web app"
```

---

## Criterio de terminado de Fase 0

- `docker compose up` levanta postgres, api y worker sin errores.
- `GET /health` responde 200.
- Hangfire dashboard accesible en `/hangfire`.
- Todas las tablas del esquema inicial existen en PostgreSQL.
- `dotnet test` corre 6 tests en verde (5 unit + 1 integration).
- Repo web levanta en `localhost:5173`.
