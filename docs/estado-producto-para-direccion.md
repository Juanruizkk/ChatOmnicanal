# ChatOmnicanal — Estado del producto

> Resumen ejecutivo para dirección. Actualizado: 2026-10-23.

## Qué es
SaaS multi-tenant: un chatbot con IA que responde automáticamente las consultas de un negocio
(horarios, envíos, pagos, etc.) por **WhatsApp, Instagram y Messenger**, con un panel unificado
donde el equipo del cliente puede tomar el control de cualquier conversación. Cada cliente
configura su negocio y paga una mensualidad que incluye el costo de la IA.

---

## ✅ Lo que YA funciona (probado)

| Área | Estado |
|---|---|
| **Motor del bot con IA** | Responde con los datos del negocio, en tono configurable, y deriva a un humano cuando corresponde |
| **Recepción de los 3 canales** | WhatsApp, Instagram y Messenger: los mensajes entran, se validan y se procesan |
| **Bandeja unificada** | Las conversaciones de los 3 canales llegan a un mismo panel, con el canal de origen visible |
| **Panel de agentes** | Tomar control, resolver, reabrir, tiempo real (mensajes aparecen al instante) |
| **Multi-tenant** | Cada cliente tiene su negocio aislado; los datos de uno nunca se mezclan con otro |
| **Panel de administración** | Vista de todos los tenants, métricas, precios, auditoría |
| **Configuración autogestiva** | El cliente carga sus datos de negocio y documentos, y prueba el bot en un simulador |

> **Para la demo:** en el simulador el bot ya responde con datos reales de un negocio de ejemplo,
> y se pueden simular mensajes entrantes de Instagram y Messenger que aparecen en la bandeja
> con la respuesta del bot.

---

## 🔧 Lo que falta para PRODUCCIÓN

### 1. Conexión autogestiva de canales (lo más importante)
Hoy conectar un canal es **manual** (hay que pegar IDs y tokens a mano). Para que un cliente
conecte su WhatsApp/Instagram/Facebook **solo**, con unos clics, falta:
- **Embedded Signup de WhatsApp** (el flujo oficial de Meta embebido en el panel)
- **OAuth de Instagram y Messenger** (conectar con "Iniciar sesión con Facebook")

### 2. Aprobaciones de Meta (trámite, no código)
- Ser **Tech Provider** con verificación de la empresa — *según nos comentaron, ya está presentado*
- **App Review** de cada canal por separado: WhatsApp, Instagram y Messenger. Son 3 revisiones
  distintas, cada una con permisos y videos demo. **El producto tiene que estar funcional para
  poder enviarlas** → depende del punto 1.

### 3. Seguridad / robustez (ya avanzamos)
- ✅ **Cifrado de los tokens de los clientes** — resuelto (antes se guardaban sin cifrar; crítico
  porque custodiamos las credenciales de Meta de cada cliente)
- ⚠️ **Optimización de búsqueda del bot** — funciona, pero falta un ajuste para que escale a
  muchos documentos sin ponerse lento
- ⚠️ **Red de seguridad extra para el aislamiento entre clientes** — hoy es correcto, pero conviene
  blindarlo contra errores futuros

### 4. Comercial (Fase 7)
- Planes con cupo de conversaciones, medición de consumo por cliente, cobro de excedente.
  Definido en el alcance, falta implementar.

---

## Decisiones pendientes (de negocio, no técnicas)
- **Qué entidad legal** se verifica como Tech Provider ante Meta
- **Montos de los planes** y precio del excedente
- **Proveedor de IA definitivo** (hoy usamos Groq; la clave actual no tiene acceso a todos los modelos)
- **Hosting de producción**

---

## Resumen en una frase
> El producto está **funcionalmente completo en su núcleo** (bot, 3 canales, panel unificado,
> multi-tenant) y listo para demostrar. Para salir a producción falta principalmente la
> **conexión autogestiva de canales** (que a su vez habilita los **App Reviews de Meta**) y
> cerrar la parte **comercial de planes y cobro**.
