# Chatbot omnicanal SaaS — Alcance del producto

Oct 1, 2026 · @Juan

## Resumen

SaaS autogestivo que responde automáticamente las consultas básicas de un negocio (horarios, envíos, dirección, medios de pago) por WhatsApp, Instagram y Messenger, con un panel unificado donde el equipo del cliente puede tomar el control de cualquier conversación.

Cada cliente (tenant) conecta sus propias cuentas, configura su información con un formulario y documentos, y paga una mensualidad que incluye el costo del LLM.

## Canales y entrada

El bot responde siempre por el mismo canal donde entró el mensaje.

| Canal | Integración | Cómo lo conecta el cliente |
| --- | --- | --- |
| WhatsApp | Cloud API | Embedded Signup desde el panel (requiere Tech Provider) |
| Instagram | API de mensajería de Instagram | OAuth con su cuenta profesional |
| Messenger | API de Messenger (Página de Facebook) | OAuth con su Página |

**Pauta publicitaria:** las conversaciones que entran por anuncios Click-to-WhatsApp o Click-to-Messenger llegan por el mismo webhook con un objeto `referral` (ID del anuncio). Se etiquetan automáticamente en el panel para medirlas por campaña.

En Instagram el bot es 100% conversacional; opcionalmente el cliente puede configurar ice breakers (hasta 4 preguntas sugeridas).

## Configuración autogestiva

El cliente se da de alta y deja el bot funcionando sin intervención nuestra.

1. Registro y elección de plan.
2. Conexión de canales (WhatsApp, Instagram, Messenger).
3. Formulario de datos del negocio: horarios de atención, dirección, zonas y costos de envío, medios de pago, contacto, tono de respuesta.
4. Carga de documentos opcionales: catálogo, políticas de cambio, FAQ extensas (PDF, texto, links).
5. Prueba del bot en un chat de simulación dentro del panel.
6. Activación.

**Decisión de diseño:** los datos del formulario se inyectan directo en el system prompt como datos estructurados (son pocos y siempre relevantes). El RAG queda solo para los documentos subidos. Más precisión y menos tokens.

## Comportamiento del bot

El bot responde solo sobre el negocio del tenant y deriva a un humano cuando no sabe o cuando se lo piden.

- **Alcance cerrado:** responde únicamente con la info del formulario y los documentos. Ante preguntas ajenas al negocio ("escribime un poema") declina amablemente. Esto evita caer en la categoría "AI Provider" de Meta y facilita el App Review.
- **Derivación a humano:** cuando el usuario lo pide, cuando la confianza de la respuesta es baja o cuando detecta un tema sensible (reclamo, enojo).
- **Fuera de horario:** si el usuario pide humano fuera del horario configurado, el bot avisa cuándo lo van a atender ("te responden mañana desde las 9") y deja la conversación en cola.
- **Moderación previa:** filtros por reglas antes del LLM (datos sensibles, spam, links).

## Panel de conversaciones

Una bandeja única estilo Chatwoot centraliza las conversaciones de los tres canales, con el canal de origen visible en cada una.

**Funcionalidades del MVP:**

- Bandeja unificada con filtros por canal, estado, agente y origen (orgánico o anuncio).
- Vista de conversación con historial completo y respuestas del bot marcadas como tales.
- Botón "Tomar control" y botón "Resolver".
- Contador de ventana de 24 h por conversación ("quedan X horas para responder").
- Multiusuario: el cliente invita agentes sin compartir contraseñas.
- Notificación al agente cuando una conversación pasa a humano.

**Estados y handoff:**

- `bot`: responde la IA.
- `humano`: un agente tomó el control o el usuario pidió hablar con alguien; el bot no responde.
- `en_cola`: se pidió humano fuera de horario; el bot ya avisó y no vuelve a responder hasta que un agente la tome.
- `cerrada`: el agente resolvió. El próximo mensaje del usuario la reabre en `bot`.

Regla: el bot vuelve a quedar activo solo cuando el agente cierra/resuelve la conversación.

## Reglas de Meta que impactan el producto

El bot no genera costos de Meta porque siempre responde dentro de la ventana de 24 h; el riesgo de costo está en las respuestas humanas tardías.

| Regla | Qué dice | Impacto |
| --- | --- | --- |
| Ventana de servicio (WA) | 24 h desde el último mensaje del usuario; dentro, mensajes libres y gratis | El bot siempre entra en ventana |
| Fuera de ventana (WA) | Solo templates aprobados, pagos por categoría y país | Agente que responde tarde necesita template |
| Free Entry Point (WA) | Anuncio CTWA + respuesta en 24 h abre 72 h de mensajes gratis (solo usuarios desde app móvil) | Leads de pauta más baratos |
| Ventana IG / Messenger | 24 h, sin templates; etiqueta `HUMAN_AGENT` permite respuesta humana hasta 7 días | Contador visible en el panel |
| AI Providers | Asistentes de IA de propósito general restringidos; hoy se cobran mensajes no-template a usuarios de Brasil (+55) | Mantener el bot acotado al negocio; revisar antes de vender en Brasil |

Alarma recomendada: si un mensaje del bot llega en el webhook de status con `billable: true` o `category: general_purpose_ai`, algo cambió en la clasificación.

Fuente: [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) y [AI Providers pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers).

## Modelo comercial

Mensualidad por plan, con cupo de conversaciones atendidas por el bot y canales incluidos según plan; el costo del LLM sale de la mensualidad.

- **Unidad de cobro:** conversación atendida por el bot, no mensaje (más predecible para el cliente).
- **Planes:** escalonados por cupo mensual y canales (por ejemplo, Básico solo WhatsApp, Pro WhatsApp + Instagram + Messenger). Montos a definir.
- **Al llegar al tope:** excedente cobrado aparte o bot pausado, a elección del cliente.
- **Templates de WhatsApp:** fuera de la mensualidad; los paga el cliente en su cuenta de Meta (facturable en ARS) o se trasladan con recargo.
- **Medición desde el día uno:** tokens y conversaciones por tenant y por canal, para controlar margen.

Pendiente: definir montos de cada plan y precio del excedente.

## Requisitos de Meta

Para que cada cliente conecte su propio WhatsApp desde el panel hay que ser Tech Provider; Instagram y Messenger van por App Review aparte.

- [ ] Business portfolio de una entidad legal verificable (definir cuál), con 2FA y Business Verification.
- [ ] App de Meta tipo Business con caso de uso WhatsApp.
- [ ] App Review de `whatsapp_business_messaging` y `whatsapp_business_management` con Advanced access (videos demo del flujo).
- [ ] Embedded Signup integrado en el panel.
- [ ] App Review de los permisos de mensajería de Instagram y de Páginas (Messenger).
- [ ] Producto funcional y testeable antes de enviar a revisión.

## Arquitectura

&#91;embedded content: arquitectura · 3 canales, gateway, router, bot, panel y datos\]

El gateway recibe y envía por los tres canales; el router decide según el estado de la conversación si responde el motor del bot o si va al panel. Stack candidato reutilizando lo de MELI: Node.js + Fastify, PostgreSQL con pgvector, React.

## Fuera de alcance del MVP

El MVP cubre FAQ, handoff y panel; todo lo transaccional queda para después.

- Toma de pedidos, pagos o turnos dentro del chat.
- Envío de campañas o mensajes masivos (templates de marketing).
- Integraciones con ERP, CRM o e-commerce.
- Transcripción de audios e interpretación de imágenes.
- Usuarios finales en Brasil (por la política de AI Providers).

**Preguntas abiertas:**

- [ ] ¿Qué entidad legal se verifica como Tech Provider?
- [ ] ¿Montos de cada plan y del excedente?
- [ ] ¿Proveedor de LLM y modelo por defecto?
- [ ] ¿Se construye el panel propio desde cero o se parte de un fork de Chatwoot?
