# RAG Eval — Parte B: Suite de evaluación (runner de consola) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Pasos con checkbox `- [ ]`.

**Goal:** Un runner de consola `ChatOmnicanal.Evals` que siembra el negocio de prueba "Dulce Tentación", corre un golden set en español contra una o más **variantes** del pipeline RAG, y escribe un reporte comparativo (markdown + CSV) con métricas de recuperación y de respuesta end-to-end.

**Architecture:** Proyecto consola que referencia `Infrastructure`+`Application`+`Domain` y arma un `ServiceProvider` con `AddInfrastructure(config)` (reusa DbContext, `IEmbeddingService` configurable, `IKnowledgeService`, `IKnowledgeProjectionService`, `IBotEngineService`, `ILlmProvider`). Por cada variante: setea la config de embeddings, **re-siembra** el tenant "eval" (perfil/catálogo/FAQ/política/persona) y re-proyecta los chunks, corre el golden set midiendo retrieval (recall@k, MRR, precision@k) y end-to-end (faithfulness vía LLM-juez Groq, y "no-sé/handoff" en las fuera-de-alcance), agrega y reporta.

**Tech Stack:** .NET 8 consola, EF Core + pgvector (Postgres dev :5436), Groq (LLM-juez, gratis). Repo `apps/api`, rama `feat/onboarding-wizard`. Correr desde `apps/api`. **Prerrequisito: Parte A ya aplicada** (embedder 768 configurable). Necesita DB dev levantada (`docker compose -f docker-compose.yml up -d postgres`) y claves en config del eval (`Embeddings:ApiKey` de Groq, `Groq:ApiKey`).

> Nota de alcance: esto corre **local/manual** (usa embeddings + LLM reales). No es test de CI.

---

## Task 1: Proyecto `ChatOmnicanal.Evals` + wiring de servicios

**Files:**
- Create: `src/ChatOmnicanal.Evals/ChatOmnicanal.Evals.csproj` (console, net8.0; ProjectReference a Infrastructure)
- Create: `src/ChatOmnicanal.Evals/appsettings.json` (ConnectionStrings:DefaultConnection → Postgres dev :5436; Embeddings + Groq placeholders; `EvalVariants`)
- Create: `src/ChatOmnicanal.Evals/Program.cs` (bootstrap DI + orquestación, se completa en Task 5)
- Modify: `ChatOmnicanal.sln` (agregar el proyecto)

- [ ] **Step 1:** Crear el csproj (console) con `<ProjectReference Include="..\ChatOmnicanal.Infrastructure\ChatOmnicanal.Infrastructure.csproj" />` y paquetes ya presentes en la solución (Microsoft.Extensions.Hosting/DependencyInjection/Configuration). `dotnet sln add src/ChatOmnicanal.Evals/ChatOmnicanal.Evals.csproj`.
- [ ] **Step 2:** `appsettings.json` del eval: connection string a `Host=localhost;Port=5436;Database=chatomnicanal;Username=postgres;Password=postgres`; `Embeddings` (Groq default, igual que la API) con `ApiKey` vacío (se completa por user-secrets/env); `Groq:ApiKey` vacío; y una lista `EvalVariants` (ver Task 5) con al menos la variante Groq-nomic.
- [ ] **Step 3:** `Program.cs` mínimo que construye configuración + `ServiceCollection().AddInfrastructure(config)` y resuelve `IServiceScopeFactory`. Imprime "Evals OK" y sale. 
- [ ] **Step 4:** `dotnet build` → OK.
- [ ] **Step 5: Commit** `git add src/ChatOmnicanal.Evals/ ChatOmnicanal.sln` → `feat(evals): scaffold proyecto de evaluación RAG (rag eval B)`.

> Nota: `AddInfrastructure` también registra Hangfire/Clerk/canales; está OK para la consola (no se usan). Si algo exige conexión al arrancar, envolver en try o no resolver esos servicios.

---

## Task 2: Fixture "Dulce Tentación" (seeder)

**Files:**
- Create: `src/ChatOmnicanal.Evals/Fixture/DulceTentacionSeeder.cs`

- [ ] **Step 1:** Seeder que, dado el `ApplicationDbContext` y un `IKnowledgeProjectionService`, **borra** el tenant "eval" (por `Name == "eval-dulce-tentacion"`: borrar sus `KnowledgeChunks`, `KnowledgeDocs`, `CatalogItems`, `Faqs`, `CommercialPolicy`, `BotPersona`, `TenantProfile`, `Tenant`) y lo **recrea** con estos datos exactos, y al final llama `RebuildConfigChunksAsync(tenantId)`:

```csharp
// Tenant.Name = "eval-dulce-tentacion"
// TenantProfile:
//   Rubro="Pastelería"
//   Description="Hacemos tortas, cheesecakes y mesas dulces por encargo. También vendemos porciones y café en el local."
//   Zone="Yerba Buena, Tucumán"; SocialHandle="@dulcetentacion.ok"
//   Address="Av. Aconquija 1450, Yerba Buena"
//   DirectionsNote="Frente a la plaza. Hay lugar para estacionar sobre la calle."
//   HolidaysNote="Los feriados cerramos. Si hay un horario especial lo avisamos en Instagram."
//   BusinessHoursJson = {"monday":{"open":"09:00","close":"20:00"}, ... sáb igual, "sunday":{"open":"10:00","close":"14:00"}}  (mar-vie 09-20)
// CommercialPolicy:
//   PaymentMethods = ["Efectivo","Transferencia","Mercado Pago","Tarjeta de crédito"]  (JSON string)
//   Installments="Hasta 3 cuotas sin interés con tarjeta."
//   Promo="10% de descuento pagando en efectivo o transferencia."
//   DeliveryMode="ambos"; DeliveryZones="Yerba Buena y San Miguel de Tucumán"
//   DeliveryCost="Desde $2.500, según la zona"; DeliveryTime="Pedidos con 48 horas de anticipación"
//   PickupInfo="Retiro gratis en el local, en el horario de atención."
// CatalogItem[]:
//   ("Torta de chocolate (12 porciones)", "Bizcochuelo húmedo, ganache y dulce de leche. Se pide con 48 horas.", "28000", 0)
//   ("Cheesecake de frutos rojos", "Entera, 10 porciones.", "24000", 1)
//   ("Porción de torta", "Sabores del día, consultar.", "4500", 2)
// Faq[]:
//   ("¿Hacen tortas personalizadas?", "Sí. Contanos la idea y la fecha, y una persona del equipo te confirma el presupuesto.", 0)
//   ("¿Con cuánta anticipación tengo que pedir?", "Con 48 horas como mínimo. Para fiestas grandes, mejor con una semana.", 1)
// BotPersona:
//   Name="Dulce"; Tone="cercano"
//   Greeting="¡Hola! Soy Dulce, la asistente de Dulce Tentación. ¿En qué te puedo ayudar?"
//   NeverRules="No inventar precios. No prometer fechas de entrega que no estén en la información."
//   HandoffOnComplaint=true; HandoffOnRequest=true; HandoffOnSpecial=true; HandoffOnPayment=true
//   HandoffNotifyTo="+54 9 381 555 0000"; HandoffHours="Lunes a sábado de 9 a 20."
//   HandoffMessage="Te paso con una persona del equipo. Te responde en el horario de atención."
```
Devuelve el `tenantId`.

- [ ] **Step 2:** `dotnet build` → OK. **Commit** `feat(evals): fixture Dulce Tentación (rag eval B)`.

---

## Task 3: Golden set (JSON versionado) + modelos

**Files:**
- Create: `src/ChatOmnicanal.Evals/golden-set.es.json` (copiar a output: `<CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>`)
- Create: `src/ChatOmnicanal.Evals/Model/EvalQuestion.cs`

- [ ] **Step 1:** Modelo:
```csharp
public record ExpectedChunk(string Category, string Contains);
public record EvalQuestion(
    string Id, string Pregunta, string Tipo,              // factica|parafraseada|typo|multi|fuera_alcance|handoff
    ExpectedChunk[] ChunksEsperados, string? RespuestaReferencia,
    bool EsperaHandoff = false);                           // true en fuera_alcance/handoff
```
- [ ] **Step 2:** `golden-set.es.json` (set inicial ~18; crecer tras review). Entradas:
```json
[
 {"id":"precio-torta-choco","pregunta":"¿cuánto sale la torta de chocolate?","tipo":"factica","chunksEsperados":[{"category":"Productos","contains":"Torta de chocolate"}],"respuestaReferencia":"La torta de chocolate (12 porciones) sale $28.000."},
 {"id":"precio-cheesecake","pregunta":"¿a cuánto está el cheesecake?","tipo":"parafraseada","chunksEsperados":[{"category":"Productos","contains":"Cheesecake"}],"respuestaReferencia":"El cheesecake de frutos rojos sale $24.000."},
 {"id":"precio-porcion","pregunta":"¿cuánto sale una porción de torta?","tipo":"factica","chunksEsperados":[{"category":"Productos","contains":"Porción"}],"respuestaReferencia":"La porción de torta sale $4.500."},
 {"id":"horarios","pregunta":"¿q horarios tienen?","tipo":"typo","chunksEsperados":[{"category":"Horarios","contains":"20:00"}],"respuestaReferencia":"Lunes a sábado de 9 a 20, domingos de 10 a 14."},
 {"id":"abren-domingo","pregunta":"¿abren los domingos?","tipo":"factica","chunksEsperados":[{"category":"Horarios","contains":"10:00"}],"respuestaReferencia":"Sí, domingos de 10 a 14."},
 {"id":"hacen-envios","pregunta":"¿hacen envíos?","tipo":"factica","chunksEsperados":[{"category":"Entregas","contains":"env"}],"respuestaReferencia":"Sí, hacemos envíos y también retiro en el local."},
 {"id":"zonas-envio","pregunta":"¿a qué zonas llegan con el envío?","tipo":"factica","chunksEsperados":[{"category":"Entregas","contains":"Tucumán"}],"respuestaReferencia":"Yerba Buena y San Miguel de Tucumán."},
 {"id":"acepta-tarjeta","pregunta":"¿aceptan tarjeta?","tipo":"factica","chunksEsperados":[{"category":"Pagos","contains":"Tarjeta"}],"respuestaReferencia":"Sí, tarjeta de crédito (hasta 3 cuotas sin interés), efectivo, transferencia y Mercado Pago."},
 {"id":"descuento-transferencia","pregunta":"¿tienen descuento si pago por transferencia?","tipo":"parafraseada","chunksEsperados":[{"category":"Pagos","contains":"10%"}],"respuestaReferencia":"Sí, 10% de descuento pagando en efectivo o transferencia."},
 {"id":"donde-quedan","pregunta":"¿dónde quedan?","tipo":"parafraseada","chunksEsperados":[{"category":"Ubicacion","contains":"Aconquija"}],"respuestaReferencia":"En Av. Aconquija 1450, Yerba Buena, frente a la plaza."},
 {"id":"estacionamiento","pregunta":"¿hay dónde estacionar?","tipo":"parafraseada","chunksEsperados":[{"category":"Ubicacion","contains":"estacionar"}],"respuestaReferencia":"Sí, hay lugar para estacionar sobre la calle."},
 {"id":"personalizadas","pregunta":"¿hacen tortas personalizadas?","tipo":"factica","chunksEsperados":[{"category":"FAQ","contains":"personalizadas"}],"respuestaReferencia":"Sí, contanos la idea y la fecha y el equipo te confirma el presupuesto."},
 {"id":"anticipacion","pregunta":"¿con cuánto tiempo tengo que encargar?","tipo":"parafraseada","chunksEsperados":[{"category":"FAQ","contains":"anticipación"},{"category":"Entregas","contains":"48 horas"}],"respuestaReferencia":"Con 48 horas como mínimo; para fiestas grandes, una semana."},
 {"id":"multi-torta-envio","pregunta":"¿cuánto sale la torta de chocolate y hacen envíos?","tipo":"multi","chunksEsperados":[{"category":"Productos","contains":"Torta de chocolate"},{"category":"Entregas","contains":"env"}],"respuestaReferencia":"La torta de chocolate sale $28.000 y sí, hacemos envíos."},
 {"id":"quiero-humano","pregunta":"quiero hablar con una persona","tipo":"handoff","chunksEsperados":[],"respuestaReferencia":null,"esperaHandoff":true},
 {"id":"sin-tacc","pregunta":"¿tienen opciones sin TACC?","tipo":"fuera_alcance","chunksEsperados":[],"respuestaReferencia":null,"esperaHandoff":true},
 {"id":"crypto","pregunta":"¿puedo pagar con criptomonedas?","tipo":"fuera_alcance","chunksEsperados":[],"respuestaReferencia":null,"esperaHandoff":true},
 {"id":"cursos","pregunta":"¿dan cursos de pastelería?","tipo":"fuera_alcance","chunksEsperados":[],"respuestaReferencia":null,"esperaHandoff":true}
]
```
- [ ] **Step 3:** `dotnet build` → OK. **Commit** `feat(evals): golden set es (~18) + modelos (rag eval B)`.

---

## Task 4: Métricas + LLM-juez

**Files:**
- Create: `src/ChatOmnicanal.Evals/Scoring/RetrievalMetrics.cs`
- Create: `src/ChatOmnicanal.Evals/Scoring/LlmJudge.cs`

- [ ] **Step 1: Retrieval.** Dado `ExpectedChunk[]` y la lista ordenada de chunks recuperados (cada uno con `Category` y `Content`), con regla de match: *un chunk recuperado matchea un esperado si `Category` coincide (case-insensitive) y `Content` contiene `Contains` (case-insensitive)*:
  - `Recall@k` = (# de esperados que aparecen en los primeros k) / (# esperados). Si no hay esperados (handoff/fuera_alcance), se omite del promedio de recall.
  - `MRR` = 1 / (posición 1-based del primer recuperado que matchea algún esperado); 0 si ninguno.
  - `Precision@k` = (# recuperados en top-k que matchean algún esperado) / k.
  Implementar como funciones puras testeables.
- [ ] **Step 2: LLM-juez (Groq).** `LlmJudge` usa el `ILlmProvider` ya registrado para puntuar **faithfulness** (0/1): prompt en español = "Sos un evaluador. Dada la PREGUNTA, las FUENTES y la RESPUESTA del bot, respondé SOLO `1` si la respuesta se apoya únicamente en las fuentes (no inventa datos) y `0` si afirma algo que no está en las fuentes." Devuelve 1/0 parseando el output. Solo se corre en preguntas answerable (no fuera_alcance).
- [ ] **Step 3:** Para preguntas `esperaHandoff=true`: éxito ("no-sé OK") = `BotResponse.ShouldHandoff == true` **o** el texto contiene marcador de no-saber (ej. "no sé", "no cuento con esa información", "no tengo esa información").
- [ ] **Step 4:** `dotnet build` → OK. **Commit** `feat(evals): métricas de retrieval + LLM-juez de faithfulness (rag eval B)`.

---

## Task 5: Orquestación, variantes y reporte

**Files:**
- Modify: `src/ChatOmnicanal.Evals/Program.cs`
- Create: `src/ChatOmnicanal.Evals/Report/ReportWriter.cs`
- Modify: `src/ChatOmnicanal.Evals/appsettings.json` (sección `EvalVariants`)

- [ ] **Step 1: Variantes por config.** `EvalVariants` = lista de objetos `{ Name, Embeddings:{Provider,BaseUrl,Model,ApiKey,Dimensions}, TopK, MinSimilarity }`. Default incluye:
  - `{ "Name":"groq-nomic-768", ...Embeddings Groq nomic..., "TopK":3, "MinSimilarity":0.6 }`
  - (comentario) opcional `openai-small-768` (requiere OpenAI key) para comparar.
- [ ] **Step 2: Loop principal** (`Program.cs`): para cada variante →
  1. construir un `ServiceProvider` con la config de embeddings de esa variante (override de la sección `Embeddings`),
  2. crear scope, resolver `ApplicationDbContext` + `IKnowledgeProjectionService` + `DulceTentacionSeeder` → `MigrateAsync` + sembrar (re-embebe con el embedder de la variante),
  3. resolver `IKnowledgeService` + `IBotEngineService`,
  4. para cada `EvalQuestion`: 
     - retrieval: `SearchSimilarChunksAsync(tenantId, pregunta, topK=variant.TopK, minSimilarity=variant.MinSimilarity)` → mapear a (Category, Content) y calcular recall@k/MRR/precision,
     - end-to-end: `ProcessMessageAsync(new BotRequest{ TenantId, UserMessage=pregunta, ... })` → faithfulness (juez) para answerable, y "no-sé OK" para esperaHandoff,
  5. agregar promedios de la variante.
  > Para mapear el chunk recuperado a su `Category`: `KnowledgeSearchResult` trae `Content` y `DocId`/`Id` pero puede no traer `Category`. Si no lo trae, hacer un lookup por `Id` a `KnowledgeChunks` (AsNoTracking) para obtener `Category`, o extender `KnowledgeSearchResult`/la query para incluir `Category`. Elegir lo más simple y anotarlo.
- [ ] **Step 3: Reporte** (`ReportWriter`): imprime tabla markdown en consola y escribe `eval-report.csv` + `eval-report.md` en el working dir, con columnas: `Variante | recall@k | MRR | precision@k | faithfulness | no-sé OK (x/total)`. Una fila por variante. Incluir timestamp.
- [ ] **Step 4: Verificar end-to-end (manual, requiere DB + claves).**
  - `docker compose -f docker-compose.yml up -d postgres` (desde `apps/api`).
  - Setear `Embeddings:ApiKey` (Groq) y `Groq:ApiKey` por user-secrets o env del proyecto Evals.
  - `dotnet run --project src/ChatOmnicanal.Evals` → debe sembrar, correr las ~18 preguntas, e imprimir la tabla + generar los archivos.
  - (Si no hay claves a mano, al menos `dotnet build` verde y el runner arranca y falla con un mensaje claro de "falta ApiKey".)
- [ ] **Step 5: Commit** `feat(evals): runner con variantes + reporte markdown/CSV (rag eval B)`.

---

## Verificación final
- `dotnet build` de la solución verde; `dotnet test` de la API sigue verde (el proyecto Evals no afecta los tests).
- Entregable de uso: `dotnet run --project src/ChatOmnicanal.Evals` produce la tabla comparativa. Variante por defecto = Groq nomic (gratis). Para comparar contra OpenAI, agregar la variante `openai-small-768` en `EvalVariants` con su key.

## Self-review (cobertura vs lo acordado)
- 2 capas (retrieval + end-to-end con faithfulness y no-sé) → Tasks 4–5. ✅
- Fixture sintético "Dulce Tentación" reseedeado → Task 2. ✅
- Golden set es (~18, tipos variados + fuera_alcance), versionado, autoreado → Task 3 (crecer a ~40 tras review del user). ✅
- Runner consola, 1 o N variantes, reporte md+CSV, tenant "eval" en Postgres dev → Tasks 1,5. ✅
- Primer experimento = comparar embedders: default Groq nomic; agregar `openai-small-768` como variante → Task 5. ✅
- Local/manual (no CI), embeddings+LLM reales → notas de alcance. ✅
