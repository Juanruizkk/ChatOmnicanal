# RAG Eval — Parte A: Embedder provider-agnóstico (768 dims, Groq default) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Pasos con checkbox `- [ ]`.

**Goal:** Hacer el embedder intercambiable por configuración (Groq / OpenAI, ambos API OpenAI-compatible) a 768 dims, con Groq `nomic-embed-text-v1.5` por defecto (gratis), de modo que cambiar de proveedor sea cambiar config + re-embeber (sin migración de esquema de ahí en más).

**Architecture:** Un `ConfigurableEmbeddingService` (HttpClient contra `{BaseUrl}/embeddings`, JSON OpenAI-compatible) reemplaza a `OpenAiEmbeddingService` detrás de `IEmbeddingService`. Config `Embeddings:{Provider,BaseUrl,Model,ApiKey,Dimensions}`. La columna `KnowledgeChunk.Embedding` pasa de `vector(1536)` a `vector(768)` (migración que limpia embeddings viejos y altera el tipo). Tests y fake pasan a 768.

**Tech Stack:** .NET 8, EF Core 8 + pgvector, Npgsql, HttpClient. Repo `apps/api`, rama `feat/onboarding-wizard` (seguimos ahí). Correr desde `apps/api`. No commitear `appsettings.Development.json` (tiene WIP). Si la API bloquea DLLs: `Get-Process -Name ChatOmnicanal.API -ErrorAction SilentlyContinue | Stop-Process -Force`.

**Contexto confirmado:** hoy `OpenAiEmbeddingService` (ns `ChatOmnicanal.Infrastructure.BotEngine.Providers`) usa el SDK de OpenAI con `OpenAI:ApiKey`/`OpenAI:EmbeddingModel`; `IEmbeddingService` tiene `GenerateEmbeddingAsync` y `GenerateEmbeddingsBatchAsync`. Registrado singleton en DI. Groq embeddings = endpoint OpenAI-compatible `https://api.groq.com/openai/v1`, modelo `nomic-embed-text-v1.5` (768 nativo). OpenAI `text-embedding-3-small` soporta `dimensions:768`.

---

## Task 1: `ConfigurableEmbeddingService` (HttpClient, multi-proveedor)

**Files:**
- Modify: `src/ChatOmnicanal.Infrastructure/BotEngine/Providers/OpenAiEmbeddingService.cs` (mantener `IEmbeddingService`; agregar la nueva impl en archivo nuevo)
- Create: `src/ChatOmnicanal.Infrastructure/BotEngine/Providers/ConfigurableEmbeddingService.cs`
- Modify: `src/ChatOmnicanal.Infrastructure/DependencyInjection.cs`
- Modify: `src/ChatOmnicanal.API/appsettings.json`

- [ ] **Step 1: Crear el servicio configurable**

`ConfigurableEmbeddingService.cs`:
```csharp
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;

namespace ChatOmnicanal.Infrastructure.BotEngine.Providers;

/// <summary>
/// Embeddings vía API OpenAI-compatible (OpenAI o Groq) elegida por configuración.
/// Sección "Embeddings": Provider, BaseUrl, Model, ApiKey, Dimensions.
/// </summary>
public class ConfigurableEmbeddingService : IEmbeddingService
{
    private readonly HttpClient _http;
    private readonly string _model;
    private readonly int? _dimensions;

    public ConfigurableEmbeddingService(HttpClient http, IConfiguration config)
    {
        var baseUrl = config["Embeddings:BaseUrl"] ?? "https://api.groq.com/openai/v1";
        var apiKey = config["Embeddings:ApiKey"] ?? "";
        _model = config["Embeddings:Model"] ?? "nomic-embed-text-v1.5";
        _dimensions = int.TryParse(config["Embeddings:Dimensions"], out var d) ? d : 768;

        _http = http;
        _http.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
        if (!string.IsNullOrWhiteSpace(apiKey))
            _http.DefaultRequestHeaders.Authorization = new("Bearer", apiKey);
    }

    public async Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct = default)
        => (await EmbedAsync(new[] { text }, ct))[0];

    public async Task<List<float[]>> GenerateEmbeddingsBatchAsync(IEnumerable<string> texts, CancellationToken ct = default)
        => await EmbedAsync(texts.ToArray(), ct);

    private async Task<List<float[]>> EmbedAsync(string[] input, CancellationToken ct)
    {
        if (input.Length == 0) return new List<float[]>();
        var body = new Dictionary<string, object> { ["model"] = _model, ["input"] = input };
        // nomic es nativo 768; OpenAI small acepta "dimensions". Lo mandamos si está seteado.
        if (_dimensions is int dim) body["dimensions"] = dim;

        var resp = await _http.PostAsJsonAsync("embeddings", body, ct);
        resp.EnsureSuccessStatusCode();
        var parsed = await resp.Content.ReadFromJsonAsync<EmbeddingResponse>(cancellationToken: ct)
                     ?? throw new InvalidOperationException("Respuesta de embeddings vacía.");
        return parsed.Data.OrderBy(d => d.Index).Select(d => d.Embedding).ToList();
    }

    private sealed class EmbeddingResponse
    {
        [JsonPropertyName("data")] public List<EmbeddingItem> Data { get; set; } = new();
    }
    private sealed class EmbeddingItem
    {
        [JsonPropertyName("index")] public int Index { get; set; }
        [JsonPropertyName("embedding")] public float[] Embedding { get; set; } = Array.Empty<float>();
    }
}
```

- [ ] **Step 2: Registrar en DI (reemplaza la línea del embedding service)**

En `DependencyInjection.cs`, cambiar:
```csharp
        services.AddSingleton<BotEngine.Providers.IEmbeddingService, BotEngine.Providers.OpenAiEmbeddingService>();
```
por:
```csharp
        services.AddHttpClient<BotEngine.Providers.IEmbeddingService, BotEngine.Providers.ConfigurableEmbeddingService>();
```
(`AddHttpClient` registra el `HttpClient` tipado + la impl.)

- [ ] **Step 3: Defaults no-secretos en `appsettings.json`**

Agregar la sección (la API key NO va acá; se setea por env/user-secrets/appsettings.Development que NO tocamos):
```json
  "Embeddings": {
    "Provider": "groq",
    "BaseUrl": "https://api.groq.com/openai/v1",
    "Model": "nomic-embed-text-v1.5",
    "Dimensions": 768
  }
```

- [ ] **Step 4: Verificar compila**

Run: `dotnet build`  → OK. (No borrar `OpenAiEmbeddingService.cs` todavía; queda sin usar — lo retira la Task 4 si nada lo referencia.)

- [ ] **Step 5: Commit**

```bash
git add src/ChatOmnicanal.Infrastructure/BotEngine/Providers/ConfigurableEmbeddingService.cs src/ChatOmnicanal.Infrastructure/DependencyInjection.cs src/ChatOmnicanal.API/appsettings.json
git commit -m "feat(api): embedder configurable OpenAI-compatible (Groq/OpenAI) por config (rag eval A)"
```

---

## Task 2: Migración de la columna a `vector(768)`

**Files:**
- Modify: `src/ChatOmnicanal.Infrastructure/Persistence/Configurations/KnowledgeChunkConfiguration.cs`
- Create: migración EF `ChangeEmbeddingDimensionTo768` + snapshot (lo genera EF)

- [ ] **Step 1: Cambiar el tipo en la config EF**

En `KnowledgeChunkConfiguration.cs`, cambiar:
```csharp
        builder.Property(c => c.Embedding).HasColumnType("vector(1536)");
```
por:
```csharp
        builder.Property(c => c.Embedding).HasColumnType("vector(768)");
```

- [ ] **Step 2: Generar la migración**

Desde `apps/api`:
```bash
dotnet ef migrations add ChangeEmbeddingDimensionTo768 --project src/ChatOmnicanal.Infrastructure --startup-project src/ChatOmnicanal.Infrastructure --output-dir Persistence/Migrations
```

- [ ] **Step 3: Ajustar el `Up()` para que no falle con datos existentes**

pgvector no castea 1536→768. Editar el `Up()` de la migración generada para **limpiar embeddings primero** y luego alterar el tipo (reemplazar el `AlterColumn` autogenerado por SQL explícito):
```csharp
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Los vectores 1536 no son convertibles a 768: se limpian y se re-embeben luego.
        migrationBuilder.Sql(@"UPDATE knowledge_chunks SET ""Embedding"" = NULL;");
        migrationBuilder.Sql(@"ALTER TABLE knowledge_chunks ALTER COLUMN ""Embedding"" TYPE vector(768);");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"UPDATE knowledge_chunks SET ""Embedding"" = NULL;");
        migrationBuilder.Sql(@"ALTER TABLE knowledge_chunks ALTER COLUMN ""Embedding"" TYPE vector(1536);");
    }
```
(Si EF generó un `AlterColumn<Vector>(...)`, borrarlo y dejar solo el SQL de arriba.)

- [ ] **Step 4: Commit**

```bash
git add src/ChatOmnicanal.Infrastructure/Persistence/Configurations/KnowledgeChunkConfiguration.cs src/ChatOmnicanal.Infrastructure/Persistence/Migrations/
git commit -m "feat(api): embedding column a vector(768) (rag eval A)"
```

---

## Task 3: Actualizar fake y tests a 768

**Files:**
- Modify: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/DatabaseFixture.cs` (TestEmbeddingService)
- Modify: `tests/ChatOmnicanal.Integration.Tests/Infrastructure/KnowledgeVectorSearchTests.cs`

- [ ] **Step 1: Fake a 768**

En `DatabaseFixture.cs`, en `TestEmbeddingService.CreateFakeVector`, cambiar `new float[1536]` por `new float[768]`.

- [ ] **Step 2: Test de aislamiento a 768**

En `KnowledgeVectorSearchTests.cs`, cambiar las dos ocurrencias `new float[1536]` por `new float[768]`.

- [ ] **Step 3: Verificar**

Run: `dotnet test` → toda la suite verde (la migración se aplica en los fixtures vía `MigrateAsync`; los vectores fake ahora entran en `vector(768)`).

- [ ] **Step 4: Commit**

```bash
git add tests/ChatOmnicanal.Integration.Tests/Infrastructure/DatabaseFixture.cs tests/ChatOmnicanal.Integration.Tests/Infrastructure/KnowledgeVectorSearchTests.cs
git commit -m "test(api): fake y tests de embeddings a 768 dims (rag eval A)"
```

---

## Task 4: Retirar `OpenAiEmbeddingService` (si quedó sin uso)

- [ ] **Step 1:** `grep -r OpenAiEmbeddingService src tests`. Si no lo referencia nadie (ya lo reemplazó el configurable), eliminarlo:
```bash
git rm src/ChatOmnicanal.Infrastructure/BotEngine/Providers/OpenAiEmbeddingService.cs
```
Si todavía lo referencia algo, dejarlo y anotarlo. (OJO: `IEmbeddingService` NO se borra — vive en ese archivo. Si `IEmbeddingService` está declarado dentro de `OpenAiEmbeddingService.cs`, MOVER la interfaz a su propio archivo `IEmbeddingService.cs` antes de borrar la clase.)

- [ ] **Step 2:** `dotnet build && dotnet test` → verde.

- [ ] **Step 3: Commit** (si se borró/movió algo)
```bash
git add -A src/ChatOmnicanal.Infrastructure/BotEngine/Providers/
git commit -m "chore(api): retirar OpenAiEmbeddingService (reemplazado por configurable) (rag eval A)"
```

---

## Verificación final
- `dotnet test` verde.
- Nota operativa para el reporte: tras aplicar la migración en una DB con datos reales, los chunks quedan con `Embedding = NULL` y hay que **re-embeber** (re-ingestar docs / re-correr la proyección de config). En dev no hay datos relevantes.

## Self-review (cobertura)
- Embedder por config OpenAI-compatible (Groq default) → Task 1. ✅
- 768 dims en columna + migración segura (limpia + altera) → Task 2. ✅
- Fake + tests a 768 → Task 3. ✅
- Swap sin migración de esquema a futuro: cambiar `Embeddings:*` en config + re-embeber (sin tocar base/código) → habilitado por Task 1+2. ✅
- API key fuera de `appsettings.json` (secreto por env/Development) → Task 1 Step 3. ✅
