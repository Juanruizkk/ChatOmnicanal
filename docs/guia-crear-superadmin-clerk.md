# Guía: crear usuario superadmin en Clerk

Cómo crear un usuario de plataforma (superadmin) que solo accede al panel de administración (`/admin`) y no pertenece a ningún tenant.

---

## Paso 1 — Crear el usuario en Clerk Dashboard

1. Ir a [dashboard.clerk.com](https://dashboard.clerk.com) → seleccionar la aplicación **PentaBot**
2. Menú lateral → **Users** → botón **+ Create user**
3. Completar email y contraseña (o usar "Send magic link")
4. Guardar — el usuario queda creado sin rol asignado

---

## Paso 2 — Asignar el metadata `superadmin`

1. En la lista de usuarios, hacer clic en el usuario recién creado
2. Ir a la sección **Metadata** → **Public metadata**
3. Reemplazar el contenido con:

```json
{
  "role": "superadmin"
}
```

4. Clic en **Save**

---

## Paso 3 — Configurar el JWT Template *(solo se hace una vez)*

1. Menú lateral → **JWT Templates**
2. Abrir el template existente (o crear uno nuevo)
3. En el campo **Claims**, agregar:

```json
{
  "superadmin_role": "{{user.public_metadata.role}}"
}
```

4. Guardar el template

> Este claim es lo que valida la policy `"SuperAdmin"` en el backend .NET:
> `policy.RequireClaim("superadmin_role", "superadmin")`

---

## Paso 4 — Verificar que funciona

1. El superadmin inicia sesión en la app
2. Al intentar entrar a cualquier ruta de tenant (`/conversations`, `/settings`, etc.) es redirigido automáticamente a `/admin`
3. Dentro de `/admin` tiene acceso completo: Tenants, Precios LLM, Audit Log
4. El botón **Cerrar sesión** del sidebar ejecuta `signOut()` y lo lleva a `/sign-in`

---

## Notas

- **Sesión activa:** si el usuario ya tenía sesión antes de asignar el metadata, debe cerrar sesión y volver a entrar para que el JWT incluya el claim `superadmin_role`.
- **Un superadmin no es tenant:** no puede pertenecer a ninguna organización ni acceder a funciones de agente. Es exclusivamente un usuario de plataforma.
- **Para revocar acceso:** cambiar el Public metadata a `{}` o eliminar la clave `role`. El cambio toma efecto en la próxima sesión.
