# Sesión 2026-10-23 — Dev bypass de auth + Cifrado de tokens + Auditorías

Registro de todo lo realizado en la sesión del 23/10/2026 sobre el proyecto ChatOmnicanal.

---

## 1. Puesta en marcha del proyecto (recordatorio de cómo levantarlo)

Tres procesos, en este orden:

```powershell
# 1) Base de datos (PostgreSQL + pgvector)
cd "C:\JUAN RUIZ\Trabajos\ChatOmnicanal\apps\api"
docker compose up postgres -d

# 2) API .NET (queda en http://localhost:8080)
dotnet run --project src/ChatOmnicanal.API

# 3) Frontend React (queda en http://localhost:5173)
cd "C:\JUAN RUIZ\Trabajos\ChatOmnicanal\apps\web"
npm run dev
```

### Problemas resueltos durante el arranque
- **`role "postgres" does not exist`**: el volumen de Docker tenía datos de una instalación previa. Se recreó con `docker compose down -v` + `docker compose up postgres -d`.
- **Puerto 5435 ocupado**: otro proyecto (`demoml-postgres-1`) ya usaba el 5435. Se cambió **este** proyecto al puerto **5436** en `docker-compose.yml` y `appsettings.json`.
- **API escuchaba en 5155 en vez de 8080**: se fijó el puerto en `Properties/launchSettings.json` a `http://localhost:8080` (el frontend apunta ahí).
- **Migraciones**: la base nueva no tenía tablas. Se aplicaron con
  `dotnet ef database update --project src/ChatOmnicanal.Infrastructure --startup-project src/ChatOmnicanal.API`.

---

## 2. Dev bypass de autenticación (trabajar sin Clerk)

**Motivo:** no había acceso a Clerk (requería usuario/contraseña + 2FA por celular). Se implementó un bypass para desarrollo que permite entrar al panel de tenant y al de superadmin sin login real.

### Frontend (`apps/web`)
- **`.env.local`**: se agregó
  ```
  VITE_DEV_BYPASS_AUTH=true
  VITE_DEV_ROLE=tenant        # "tenant" o "superadmin" según qué panel querés ver
  ```
- **`src/lib/auth.ts`** (nuevo): hooks wrapper `useAppAuth`, `useAppUser`, `useAppClerk`. Cuando el bypass está activo devuelven un usuario dev hardcodeado y un token `dev-bypass-token`, sin invocar a Clerk (por eso no hace falta `ClerkProvider`). El token getter se registra al cargar el módulo.
- **`src/lib/AppUserButton.tsx`** (nuevo): `AppUserButton` que en modo bypass muestra un avatar genérico en vez del `UserButton` de Clerk. (Se separó de `auth.ts` porque los `.ts` no admiten JSX — oxc lo rechazaba.)
- Archivos migrados a los wrappers: `main.tsx` (ClerkProvider condicional), `components/layout/ProtectedRoute.tsx`, `components/layout/AdminLayout.tsx`, `hooks/useSignalR.ts`, `components/layout/Sidebar.tsx`, `pages/OnboardingPage.tsx`.

### Backend (`apps/api`)
- **`appsettings.Development.json`**: `"DevBypass": { "Enabled": true }`.
- **`Middleware/DevBypassAuthHandler.cs`** (nuevo): esquema de autenticación que acepta el header `Authorization: Bearer dev-bypass-token` y genera un `ClaimsPrincipal` con `sub = dev_superadmin` y claim `superadmin_role = superadmin`.
- **`DependencyInjection.cs` (API)**: en Development con DevBypass activo, se usa un `PolicyScheme` ("SmartScheme") que enruta al handler de bypass si el token coincide, o a JWT Bearer (Clerk) en caso normal.
- **`Program.cs`**: `AddApiServices` ahora recibe `builder.Environment.IsDevelopment()`.
- **`Middleware/TenantMiddleware.cs`**: para el usuario dev resuelve el tenant leyendo la membresía directo de la DB (el middleware normal depende de Clerk).
- **`Controllers/MeController.cs`**: cuando la auth es DevBypass, **siembra automáticamente** el usuario dev + un "Dev Tenant" si no existen, y devuelve ese estado. Así entrás directo sin pasar por onboarding ni Clerk.

> **Para volver a Clerk:** poner `VITE_DEV_BYPASS_AUTH=false` en `.env.local` y quitar/`false` en `DevBypass:Enabled`.

---

## 3. Cifrado de tokens de canal (AES-256-GCM) — fix de seguridad

**Problema detectado:** el campo `Channel.EncryptedAccessToken` decía "cifrado (AES-256)" pero guardaba el token de Meta **en texto plano**. Crítico en el modelo Tech Provider, donde se custodian los tokens de todos los clientes.

### Implementación
- **`Application/Common/Interfaces/ITokenEncryptor.cs`** (nuevo): interfaz `Encrypt`/`Decrypt`.
- **`Infrastructure/Security/AesGcmTokenEncryptor.cs`** (nuevo):
  - AES-256-GCM, formato de salida `enc:v1:` + Base64(nonce[12] ‖ tag[16] ‖ ciphertext).
  - Nonce aleatorio por operación (misma entrada → distinto ciphertext).
  - Tolera valores **legacy** en texto plano (sin prefijo los devuelve tal cual).
  - Clave desde `Encryption:Key` (32 bytes en Base64). Si falta, usa un **fallback de desarrollo con warning**.
- **`Infrastructure/Persistence/ApplicationDbContext.cs`**:
  - Constructor con `ITokenEncryptor?` **opcional** (null en design-time → no rompe `dotnet ef`).
  - En `OnModelCreating`, `ValueConverter` transparente sobre `Channel.EncryptedAccessToken`: cifra al guardar, descifra al leer. **No se tocó ningún sitio de lectura** (senders, routers) — el token les llega en claro como antes.
- **`Infrastructure/DependencyInjection.cs`**: `AddSingleton<ITokenEncryptor, AesGcmTokenEncryptor>()`.
- **`appsettings.Development.json`**: `"Encryption": { "Key": "<clave base64 de 32 bytes>" }`.

### Tests (todos verdes)
- **`tests/ChatOmnicanal.Domain.Tests/Security/AesGcmTokenEncryptorTests.cs`** (7 tests): round-trip, prefijo, nonce aleatorio, legacy plaintext, null/empty, fallback de clave.
- **`tests/ChatOmnicanal.Integration.Tests/Infrastructure/ChannelTokenEncryptionTests.cs`** (1 test e2e): confirma que la columna en la DB guarda ciphertext (`enc:v1:...`) y que EF lo devuelve descifrado.
- **Suite completa: 101/101** (54 domain + 47 integration), sin regresiones.

### ⚠️ Pendiente para producción
Setear `Encryption:Key` (32 bytes Base64) como secret/variable de entorno. Sin eso, usa la clave de dev (débil y conocida).

---

## 4. Auditoría del flujo de conexión de canales (Fase 6 / 7)

Estado del flujo autogestivo de conexión (Embedded Signup / OAuth):

| Componente | Estado |
|---|---|
| Webhooks WhatsApp / Instagram / Messenger (recepción + firma HMAC) | ✅ Completo |
| Envío por los 3 canales (Graph API v19.0) | ✅ Completo |
| Parseo de `referral` (anuncios CTWA/CTM) | ✅ Se captura `ReferralJson` |
| Cifrado de tokens | ✅ Resuelto en esta sesión |
| **OAuth de IG profesional / Página FB** | ❌ No existe — conexión 100% manual |
| **Embedded Signup de WhatsApp** | ❌ No existe |
| **Etiqueta `HUMAN_AGENT`** (ventana 7 días IG/Messenger) | ❌ Los senders mandan texto plano sin `messaging_type`/`tag` |
| **Ice breakers de Instagram** | ❌ No existe |

### Sobre App Review de Meta
Ser **Tech Provider / Business Verification** (estatus de la empresa) es el requisito previo, pero **cada canal necesita su propio App Review** de permisos sobre la app de Meta:
- **WhatsApp**: `whatsapp_business_messaging`, `whatsapp_business_management` (Advanced access).
- **Instagram**: `instagram_basic`, `instagram_manage_messages`, `pages_messaging`.
- **Messenger**: `pages_messaging`, `pages_manage_metadata`.

Meta exige ver el **producto funcional** (Embedded Signup + OAuth funcionando, con videos demo) antes de aprobar. Eso es lo que hoy bloquea el envío a revisión.

---

## 5. Auditoría del subsistema RAG (Fase 3)

Revisión read-only hecha por un agente en worktree aislado. El aislamiento multi-tenant **se cumple hoy**, pero hay deuda:

| # | Hallazgo | Severidad |
|---|----------|-----------|
| 1 | **Sin índice vectorial** (ivfflat/hnsw) sobre `KnowledgeChunk.Embedding`; solo B-tree sobre `TenantId` → scan secuencial, no escala | **Crítico (operacional)** |
| 2 | **Sin Global Query Filter** de EF; aislamiento depende de `Where(TenantId)` manual en cada query | Medio (seguridad / regresión) |
| 3 | Embeddings sin retry/backoff; un 429/500 de OpenAI rompe ingesta y respuesta del bot | Medio |
| 4 | Sin batching/rate limiting; docs grandes pueden exceder límites de la API | Medio |
| 5 | Dimensionalidad 1536 acoplada; modelo configurable sin validar longitud del vector | Medio/Bajo |
| 6 | Score de similitud expuesto dentro del system prompt (ruido para el LLM) | Medio/Bajo |
| 7 | Contenido RAG sin delimitación anti prompt-injection | Bajo |
| 8 | Separador `""` puede cortar palabras en texto patológico | Bajo |
| 9 | Overlap frágil con splits grandes; tamaño medido en chars, no tokens | Bajo |
| 10 | API key default `"dummy-key-for-tests"` enmascara config faltante en prod | Bajo |
| — | `KnowledgeController.Upload` sin límite de tamaño de archivo | Bajo |

**Prioridad sugerida:** (1) índice vectorial → (2) Global Query Filter → (3) resiliencia OpenAI.

---

## 6. Estado de pendientes al cierre de la sesión

**Seguridad / producción:**
- [x] Cifrado de tokens de canal (AES-256-GCM) — **hecho**
- [ ] Índice vectorial del RAG (crítico operacional)
- [ ] Global Query Filter multi-tenant
- [ ] Setear `Encryption:Key` real en producción

**Fase 6 / 7:**
- [ ] Etiqueta `HUMAN_AGENT` en senders de IG/Messenger
- [ ] OAuth de Instagram y Messenger
- [ ] Embedded Signup de WhatsApp
- [ ] Ice breakers de Instagram
