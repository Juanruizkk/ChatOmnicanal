# Frontend Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el panel web de ChatOmnicanal — bandeja de conversaciones unificada, vista de chat con handoff, configuración del negocio y simulación del bot — en React + Vite + TypeScript usando MSW para mockear el backend mientras este no está listo.

**Architecture:** SPA con React Router v6. TanStack Query maneja el estado del servidor (fetch, cache, invalidación). Zustand maneja el estado de conexión SignalR. MSW intercepta todas las llamadas a la API en desarrollo para que el frontend avance sin depender del backend. shadcn/ui + Tailwind como sistema de diseño.

**Tech Stack:** React 18, Vite 5, TypeScript 5, Clerk, React Router v6, TanStack Query v5, Zustand, @microsoft/signalr, shadcn/ui, Tailwind CSS v3, MSW v2, Axios

---

## File Map

```
chatomnicanal-web/
src/
  types/
    api.types.ts          # DTOs que matchean el backend
  lib/
    utils.ts
    queryClient.ts
    apiClient.ts          # instancia de axios configurada
  services/
    conversations.ts      # llamadas a /conversations
    messages.ts           # llamadas a /messages
    tenantProfile.ts      # llamadas a /tenant-profile
    documents.ts          # llamadas a /documents
    agents.ts             # llamadas a /agents
  mocks/
    handlers.ts           # MSW handlers con datos realistas
    browser.ts            # MSW worker setup
  store/
    signalRStore.ts       # Zustand: conexión SignalR y eventos
  hooks/
    useConversations.ts
    useMessages.ts
    useSignalR.ts
    useWindowCountdown.ts
    useTenantProfile.ts
  components/
    ui/                   # componentes shadcn (Button, Input, Badge, etc.)
    layout/
      AppLayout.tsx       # sidebar + main content
      Sidebar.tsx
      ProtectedRoute.tsx
    conversations/
      ConversationList.tsx
      ConversationItem.tsx
      ConversationFilters.tsx
      ChannelBadge.tsx
      StatusBadge.tsx
    chat/
      ChatView.tsx
      MessageBubble.tsx
      MessageInput.tsx
      WindowCountdown.tsx
      TakeControlButton.tsx
      ResolveButton.tsx
    settings/
      BusinessProfileForm.tsx
      DocumentUpload.tsx
      DocumentsList.tsx
      AgentsList.tsx
      InviteAgentModal.tsx
    simulation/
      BotSimulationChat.tsx
  pages/
    ConversationsPage.tsx
    ChatPage.tsx
    SettingsProfilePage.tsx
    SettingsDocumentsPage.tsx
    SettingsAgentsPage.tsx
    SimulationPage.tsx
  router.tsx
  App.tsx
  main.tsx
.env.example
```

---

## Task 1: Setup base — dependencias, Tailwind, shadcn, Clerk

**Files:**
- Modify: `package.json`, `vite.config.ts`, `tsconfig.json`
- Create: `src/main.tsx`, `src/App.tsx`, `.env.example`
- Create: `tailwind.config.js`, `postcss.config.js`
- Create: `src/lib/utils.ts`, `src/lib/queryClient.ts`

- [ ] **Step 1.1: Instalar dependencias**

```bash
npm install @clerk/clerk-react react-router-dom @tanstack/react-query axios zustand @microsoft/signalr clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer msw@2 @types/node
npx tailwindcss init -p
```

- [ ] **Step 1.2: Configurar Tailwind**

`tailwind.config.js`
```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 1.3: Crear index.css con variables CSS**

`src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --border: 214.3 31.8% 91.4%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --radius: 0.5rem;
  }
  body {
    @apply bg-background text-foreground;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
}
```

- [ ] **Step 1.4: Instalar shadcn/ui**

```bash
npx shadcn@latest init
```

Cuando pregunte:
- Style: Default
- Base color: Slate
- CSS variables: Yes

Luego instalar los componentes que se usarán:
```bash
npx shadcn@latest add button input badge avatar scroll-area separator sheet dialog dropdown-menu form label textarea toast
```

- [ ] **Step 1.5: Crear utils y queryClient**

`src/lib/utils.ts`
```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`src/lib/queryClient.ts`
```ts
import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
})
```

- [ ] **Step 1.6: Crear apiClient**

`src/lib/apiClient.ts`
```ts
import axios from "axios"

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080",
})

apiClient.interceptors.request.use(async (config) => {
  // El token de Clerk se inyecta en Task 2 cuando tengamos el hook de auth
  return config
})
```

- [ ] **Step 1.7: Crear .env.example**

`.env.example`
```env
VITE_API_URL=http://localhost:8080
VITE_CLERK_PUBLISHABLE_KEY=pk_test_
VITE_ENABLE_MOCKS=true
```

- [ ] **Step 1.8: Crear main.tsx**

`src/main.tsx`
```tsx
import React from "react"
import ReactDOM from "react-dom/client"
import { ClerkProvider } from "@clerk/clerk-react"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "./lib/queryClient"
import App from "./App"
import "./index.css"

async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== "true") return
  const { worker } = await import("./mocks/browser")
  return worker.start({ onUnhandledRequest: "bypass" })
}

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ClerkProvider publishableKey={clerkKey}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ClerkProvider>
    </React.StrictMode>
  )
})
```

- [ ] **Step 1.9: Crear App.tsx placeholder**

`src/App.tsx`
```tsx
import { RouterProvider } from "react-router-dom"
import { router } from "./router"

export default function App() {
  return <RouterProvider router={router} />
}
```

- [ ] **Step 1.10: Verificar que levanta**

Crear `.env.local` copiando `.env.example` con `VITE_ENABLE_MOCKS=true` y una key de Clerk de prueba.

```bash
npm run dev
```

Expected: Vite en `http://localhost:5173` sin errores en consola.

- [ ] **Step 1.11: Commit**

```bash
git add .
git commit -m "chore: setup Vite + Clerk + TanStack Query + Tailwind + shadcn"
```

---

## Task 2: Tipos, servicios y MSW mocks

**Files:**
- Create: `src/types/api.types.ts`
- Create: `src/services/*.ts`
- Create: `src/mocks/handlers.ts`, `src/mocks/browser.ts`

- [ ] **Step 2.1: Crear tipos que matchean el backend**

`src/types/api.types.ts`
```ts
export type ChannelType = "WhatsApp" | "Instagram" | "Messenger"
export type ConversationStatus = "Bot" | "Human" | "InQueue" | "Closed"
export type MessageDirection = "Inbound" | "Outbound"
export type MessageAuthor = "User" | "Bot" | "Agent"
export type UserRole = "Owner" | "Agent"

export interface Conversation {
  id: string
  tenantId: string
  channelId: string
  contactId: string
  status: ConversationStatus
  assignedAgentId: string | null
  lastUserMessageAt: string | null
  referralJson: string | null
  createdAt: string
  updatedAt: string
  contact: Contact
  channel: { type: ChannelType }
  lastMessage?: Message
}

export interface Contact {
  id: string
  externalId: string
  name: string | null
  channelType: ChannelType
}

export interface Message {
  id: string
  conversationId: string
  direction: MessageDirection
  author: MessageAuthor
  content: string
  externalId: string
  deliveryStatus: string | null
  createdAt: string
}

export interface TenantProfile {
  id: string
  tenantId: string
  address: string | null
  timezone: string | null
  contactPhone: string | null
  contactEmail: string | null
  tone: string | null
  businessHoursJson: string
  shippingInfo: string | null
  paymentMethods: string | null
}

export interface KnowledgeDoc {
  id: string
  tenantId: string
  name: string
  type: string
  status: "pending" | "processing" | "ready" | "error"
  createdAt: string
}

export interface AgentMembership {
  id: string
  userId: string
  role: UserRole
  user: { id: string; email: string; name: string }
}

export interface ConversationsFilters {
  channel?: ChannelType
  status?: ConversationStatus
  agentId?: string
  source?: "organic" | "ad"
}

export interface SendMessageRequest {
  content: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
```

- [ ] **Step 2.2: Crear services**

`src/services/conversations.ts`
```ts
import { apiClient } from "../lib/apiClient"
import type { Conversation, ConversationsFilters, PaginatedResponse } from "../types/api.types"

export const conversationsService = {
  list: async (filters?: ConversationsFilters): Promise<PaginatedResponse<Conversation>> => {
    const { data } = await apiClient.get("/api/conversations", { params: filters })
    return data
  },

  getById: async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.get(`/api/conversations/${id}`)
    return data
  },

  takeControl: async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.post(`/api/conversations/${id}/take-control`)
    return data
  },

  resolve: async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.post(`/api/conversations/${id}/resolve`)
    return data
  },
}
```

`src/services/messages.ts`
```ts
import { apiClient } from "../lib/apiClient"
import type { Message, PaginatedResponse, SendMessageRequest } from "../types/api.types"

export const messagesService = {
  list: async (conversationId: string): Promise<PaginatedResponse<Message>> => {
    const { data } = await apiClient.get(`/api/conversations/${conversationId}/messages`)
    return data
  },

  send: async (conversationId: string, body: SendMessageRequest): Promise<Message> => {
    const { data } = await apiClient.post(`/api/conversations/${conversationId}/messages`, body)
    return data
  },
}
```

`src/services/tenantProfile.ts`
```ts
import { apiClient } from "../lib/apiClient"
import type { TenantProfile } from "../types/api.types"

export const tenantProfileService = {
  get: async (): Promise<TenantProfile> => {
    const { data } = await apiClient.get("/api/tenant-profile")
    return data
  },

  update: async (body: Partial<TenantProfile>): Promise<TenantProfile> => {
    const { data } = await apiClient.put("/api/tenant-profile", body)
    return data
  },
}
```

`src/services/documents.ts`
```ts
import { apiClient } from "../lib/apiClient"
import type { KnowledgeDoc } from "../types/api.types"

export const documentsService = {
  list: async (): Promise<KnowledgeDoc[]> => {
    const { data } = await apiClient.get("/api/documents")
    return data
  },

  upload: async (file: File): Promise<KnowledgeDoc> => {
    const form = new FormData()
    form.append("file", file)
    const { data } = await apiClient.post("/api/documents", form)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/documents/${id}`)
  },
}
```

`src/services/agents.ts`
```ts
import { apiClient } from "../lib/apiClient"
import type { AgentMembership } from "../types/api.types"

export const agentsService = {
  list: async (): Promise<AgentMembership[]> => {
    const { data } = await apiClient.get("/api/agents")
    return data
  },

  invite: async (email: string): Promise<void> => {
    await apiClient.post("/api/agents/invite", { email })
  },

  remove: async (membershipId: string): Promise<void> => {
    await apiClient.delete(`/api/agents/${membershipId}`)
  },
}
```

- [ ] **Step 2.3: Crear MSW handlers con datos realistas**

`src/mocks/handlers.ts`
```ts
import { http, HttpResponse } from "msw"
import type {
  Conversation, Message, TenantProfile, KnowledgeDoc, AgentMembership
} from "../types/api.types"

const conversations: Conversation[] = [
  {
    id: "conv-1",
    tenantId: "tenant-1",
    channelId: "ch-1",
    contactId: "ct-1",
    status: "Bot",
    assignedAgentId: null,
    lastUserMessageAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    referralJson: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    contact: { id: "ct-1", externalId: "5491112345678", name: "María López", channelType: "WhatsApp" },
    channel: { type: "WhatsApp" },
    lastMessage: {
      id: "msg-3",
      conversationId: "conv-1",
      direction: "Inbound",
      author: "User",
      content: "¿Hacen envíos a Rosario?",
      externalId: "wamid-3",
      deliveryStatus: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
  },
  {
    id: "conv-2",
    tenantId: "tenant-1",
    channelId: "ch-2",
    contactId: "ct-2",
    status: "Human",
    assignedAgentId: "user-1",
    lastUserMessageAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    referralJson: JSON.stringify({ headline: "Promo verano", source_id: "ad-123" }),
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    contact: { id: "ct-2", externalId: "igsid-789", name: "Carlos Ruiz", channelType: "Instagram" },
    channel: { type: "Instagram" },
    lastMessage: {
      id: "msg-7",
      conversationId: "conv-2",
      direction: "Inbound",
      author: "User",
      content: "Quiero hablar con alguien por favor",
      externalId: "ig-msg-7",
      deliveryStatus: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    },
  },
  {
    id: "conv-3",
    tenantId: "tenant-1",
    channelId: "ch-1",
    contactId: "ct-3",
    status: "InQueue",
    assignedAgentId: null,
    lastUserMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    referralJson: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    contact: { id: "ct-3", externalId: "5491187654321", name: "Ana Gómez", channelType: "WhatsApp" },
    channel: { type: "WhatsApp" },
    lastMessage: {
      id: "msg-10",
      conversationId: "conv-3",
      direction: "Outbound",
      author: "Bot",
      content: "Entendido, te responden mañana desde las 9hs.",
      externalId: "wamid-10",
      deliveryStatus: "delivered",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  },
]

const messages: Record<string, Message[]> = {
  "conv-1": [
    {
      id: "msg-1",
      conversationId: "conv-1",
      direction: "Inbound",
      author: "User",
      content: "Hola, buenos días",
      externalId: "wamid-1",
      deliveryStatus: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
      id: "msg-2",
      conversationId: "conv-1",
      direction: "Outbound",
      author: "Bot",
      content: "¡Hola! Bienvenido/a. ¿En qué te puedo ayudar?",
      externalId: "wamid-2",
      deliveryStatus: "read",
      createdAt: new Date(Date.now() - 1000 * 60 * 59).toISOString(),
    },
    {
      id: "msg-3",
      conversationId: "conv-1",
      direction: "Inbound",
      author: "User",
      content: "¿Hacen envíos a Rosario?",
      externalId: "wamid-3",
      deliveryStatus: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
  ],
  "conv-2": [
    {
      id: "msg-5",
      conversationId: "conv-2",
      direction: "Inbound",
      author: "User",
      content: "Buenas tardes, tengo una consulta sobre un pedido",
      externalId: "ig-msg-5",
      deliveryStatus: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "msg-6",
      conversationId: "conv-2",
      direction: "Outbound",
      author: "Bot",
      content: "¡Hola! Claro, contame qué necesitás.",
      externalId: "ig-msg-6",
      deliveryStatus: "read",
      createdAt: new Date(Date.now() - 1000 * 60 * 29).toISOString(),
    },
    {
      id: "msg-7",
      conversationId: "conv-2",
      direction: "Inbound",
      author: "User",
      content: "Quiero hablar con alguien por favor",
      externalId: "ig-msg-7",
      deliveryStatus: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    },
  ],
  "conv-3": [
    {
      id: "msg-10",
      conversationId: "conv-3",
      direction: "Outbound",
      author: "Bot",
      content: "Entendido, te responden mañana desde las 9hs.",
      externalId: "wamid-10",
      deliveryStatus: "delivered",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  ],
}

const tenantProfile: TenantProfile = {
  id: "prof-1",
  tenantId: "tenant-1",
  address: "Av. Corrientes 1234, CABA",
  timezone: "America/Argentina/Buenos_Aires",
  contactPhone: "+5491112345678",
  contactEmail: "hola@tienda.com",
  tone: "amigable",
  businessHoursJson: JSON.stringify({
    monday: { open: "09:00", close: "18:00", closed: false },
    tuesday: { open: "09:00", close: "18:00", closed: false },
    wednesday: { open: "09:00", close: "18:00", closed: false },
    thursday: { open: "09:00", close: "18:00", closed: false },
    friday: { open: "09:00", close: "17:00", closed: false },
    saturday: { open: "10:00", close: "14:00", closed: false },
    sunday: { open: "00:00", close: "00:00", closed: true },
  }),
  shippingInfo: "Envíos a todo el país por Andreani y OCA. Costo: $2500 CABA, $3500 interior.",
  paymentMethods: "Efectivo, transferencia bancaria, MercadoPago, tarjetas de crédito y débito.",
}

const knowledgeDocs: KnowledgeDoc[] = [
  {
    id: "doc-1",
    tenantId: "tenant-1",
    name: "Catálogo temporada 2026.pdf",
    type: "pdf",
    status: "ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
  {
    id: "doc-2",
    tenantId: "tenant-1",
    name: "Política de cambios y devoluciones.txt",
    type: "text",
    status: "ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
]

const agents: AgentMembership[] = [
  {
    id: "mem-1",
    userId: "user-1",
    role: "Owner",
    user: { id: "user-1", email: "juan@tienda.com", name: "Juan Ruiz" },
  },
  {
    id: "mem-2",
    userId: "user-2",
    role: "Agent",
    user: { id: "user-2", email: "sofia@tienda.com", name: "Sofía Martínez" },
  },
]

export const handlers = [
  http.get("/api/conversations", ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get("status")
    const channel = url.searchParams.get("channel")
    let result = [...conversations]
    if (status) result = result.filter(c => c.status === status)
    if (channel) result = result.filter(c => c.channel.type === channel)
    return HttpResponse.json({ items: result, total: result.length, page: 1, pageSize: 20 })
  }),

  http.get("/api/conversations/:id", ({ params }) => {
    const conv = conversations.find(c => c.id === params.id)
    if (!conv) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(conv)
  }),

  http.post("/api/conversations/:id/take-control", ({ params }) => {
    const conv = conversations.find(c => c.id === params.id)
    if (!conv) return new HttpResponse(null, { status: 404 })
    conv.status = "Human"
    conv.assignedAgentId = "user-1"
    return HttpResponse.json(conv)
  }),

  http.post("/api/conversations/:id/resolve", ({ params }) => {
    const conv = conversations.find(c => c.id === params.id)
    if (!conv) return new HttpResponse(null, { status: 404 })
    conv.status = "Closed"
    conv.assignedAgentId = null
    return HttpResponse.json(conv)
  }),

  http.get("/api/conversations/:id/messages", ({ params }) => {
    const msgs = messages[params.id as string] ?? []
    return HttpResponse.json({ items: msgs, total: msgs.length, page: 1, pageSize: 50 })
  }),

  http.post("/api/conversations/:id/messages", async ({ params, request }) => {
    const body = await request.json() as { content: string }
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      conversationId: params.id as string,
      direction: "Outbound",
      author: "Agent",
      content: body.content,
      externalId: `local-${Date.now()}`,
      deliveryStatus: "sent",
      createdAt: new Date().toISOString(),
    }
    if (!messages[params.id as string]) messages[params.id as string] = []
    messages[params.id as string].push(newMsg)
    return HttpResponse.json(newMsg, { status: 201 })
  }),

  http.get("/api/tenant-profile", () => HttpResponse.json(tenantProfile)),

  http.put("/api/tenant-profile", async ({ request }) => {
    const body = await request.json() as Partial<TenantProfile>
    Object.assign(tenantProfile, body)
    return HttpResponse.json(tenantProfile)
  }),

  http.get("/api/documents", () => HttpResponse.json(knowledgeDocs)),

  http.post("/api/documents", () => {
    const newDoc: KnowledgeDoc = {
      id: `doc-${Date.now()}`,
      tenantId: "tenant-1",
      name: "Nuevo documento.pdf",
      type: "pdf",
      status: "processing",
      createdAt: new Date().toISOString(),
    }
    knowledgeDocs.push(newDoc)
    return HttpResponse.json(newDoc, { status: 201 })
  }),

  http.delete("/api/documents/:id", ({ params }) => {
    const idx = knowledgeDocs.findIndex(d => d.id === params.id)
    if (idx !== -1) knowledgeDocs.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get("/api/agents", () => HttpResponse.json(agents)),

  http.post("/api/agents/invite", () => new HttpResponse(null, { status: 204 })),

  http.delete("/api/agents/:id", ({ params }) => {
    const idx = agents.findIndex(a => a.id === params.id)
    if (idx !== -1) agents.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // Simulación del bot
  http.post("/api/simulation/message", async ({ request }) => {
    const { content } = await request.json() as { content: string }
    await new Promise(r => setTimeout(r, 800))
    return HttpResponse.json({
      id: `sim-${Date.now()}`,
      content: `[Bot simulado] Recibí: "${content}". Respondería con información del negocio.`,
      createdAt: new Date().toISOString(),
    })
  }),
]
```

`src/mocks/browser.ts`
```ts
import { setupWorker } from "msw/browser"
import { handlers } from "./handlers"

export const worker = setupWorker(...handlers)
```

- [ ] **Step 2.4: Inicializar MSW**

```bash
npx msw init public/ --save
```

- [ ] **Step 2.5: Verificar que MSW intercepta**

Con `VITE_ENABLE_MOCKS=true` en `.env.local`, abrir la app y en la consola del browser ver:
```
[MSW] Mocking enabled.
```

- [ ] **Step 2.6: Commit**

```bash
git add .
git commit -m "feat: add API types, services and MSW mocks with realistic data"
```

---

## Task 3: Router y layouts

**Files:**
- Create: `src/router.tsx`
- Create: `src/components/layout/ProtectedRoute.tsx`
- Create: `src/components/layout/AppLayout.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/pages/ConversationsPage.tsx` (placeholder)
- Create: `src/pages/SettingsProfilePage.tsx` (placeholder)

- [ ] **Step 3.1: Crear ProtectedRoute**

`src/components/layout/ProtectedRoute.tsx`
```tsx
import { useAuth } from "@clerk/clerk-react"
import { Navigate, Outlet } from "react-router-dom"

export function ProtectedRoute() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )

  if (!isSignedIn) return <Navigate to="/sign-in" replace />

  return <Outlet />
}
```

- [ ] **Step 3.2: Crear Sidebar**

`src/components/layout/Sidebar.tsx`
```tsx
import { NavLink } from "react-router-dom"
import { MessageSquare, Settings, Bot, Users } from "lucide-react"
import { cn } from "../../lib/utils"
import { UserButton } from "@clerk/clerk-react"

const navItems = [
  { to: "/conversations", icon: MessageSquare, label: "Conversaciones" },
  { to: "/simulation", icon: Bot, label: "Simulación" },
  { to: "/settings/profile", icon: Settings, label: "Configuración" },
]

export function Sidebar() {
  return (
    <aside className="flex h-screen w-14 flex-col items-center border-r bg-background py-4 gap-2">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <MessageSquare className="h-4 w-4 text-primary-foreground" />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              cn(
                "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive && "bg-muted text-foreground"
              )
            }
          >
            <Icon className="h-5 w-5" />
          </NavLink>
        ))}
      </nav>

      <UserButton afterSignOutUrl="/sign-in" />
    </aside>
  )
}
```

- [ ] **Step 3.3: Crear AppLayout**

`src/components/layout/AppLayout.tsx`
```tsx
import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3.4: Crear páginas placeholder**

`src/pages/ConversationsPage.tsx`
```tsx
export function ConversationsPage() {
  return <div className="p-6">Conversaciones</div>
}
```

`src/pages/ChatPage.tsx`
```tsx
export function ChatPage() {
  return <div className="p-6">Chat</div>
}
```

`src/pages/SettingsProfilePage.tsx`
```tsx
export function SettingsProfilePage() {
  return <div className="p-6">Configuración del perfil</div>
}
```

`src/pages/SettingsDocumentsPage.tsx`
```tsx
export function SettingsDocumentsPage() {
  return <div className="p-6">Documentos</div>
}
```

`src/pages/SettingsAgentsPage.tsx`
```tsx
export function SettingsAgentsPage() {
  return <div className="p-6">Agentes</div>
}
```

`src/pages/SimulationPage.tsx`
```tsx
export function SimulationPage() {
  return <div className="p-6">Simulación del bot</div>
}
```

- [ ] **Step 3.5: Crear router**

```bash
npm install lucide-react
```

`src/router.tsx`
```tsx
import { createBrowserRouter, Navigate } from "react-router-dom"
import { SignIn, SignUp } from "@clerk/clerk-react"
import { ProtectedRoute } from "./components/layout/ProtectedRoute"
import { AppLayout } from "./components/layout/AppLayout"
import { ConversationsPage } from "./pages/ConversationsPage"
import { ChatPage } from "./pages/ChatPage"
import { SettingsProfilePage } from "./pages/SettingsProfilePage"
import { SettingsDocumentsPage } from "./pages/SettingsDocumentsPage"
import { SettingsAgentsPage } from "./pages/SettingsAgentsPage"
import { SimulationPage } from "./pages/SimulationPage"

export const router = createBrowserRouter([
  {
    path: "/sign-in/*",
    element: <SignIn routing="path" path="/sign-in" />,
  },
  {
    path: "/sign-up/*",
    element: <SignUp routing="path" path="/sign-up" />,
  },
  {
    element: <ProtectedRoute />,
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
        ],
      },
    ],
  },
])
```

- [ ] **Step 3.6: Verificar navegación**

```bash
npm run dev
```

Expected: sidebar visible, links navegan entre páginas, ruta `/` redirige a `/conversations`.

- [ ] **Step 3.7: Commit**

```bash
git add .
git commit -m "feat: add router, AppLayout, Sidebar and protected routes"
```

---

## Task 4: Hooks de datos

**Files:**
- Create: `src/hooks/useConversations.ts`
- Create: `src/hooks/useMessages.ts`
- Create: `src/hooks/useTenantProfile.ts`
- Create: `src/hooks/useWindowCountdown.ts`

- [ ] **Step 4.1: Crear hooks**

`src/hooks/useConversations.ts`
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { conversationsService } from "../services/conversations"
import type { ConversationsFilters } from "../types/api.types"

export function useConversations(filters?: ConversationsFilters) {
  return useQuery({
    queryKey: ["conversations", filters],
    queryFn: () => conversationsService.list(filters),
  })
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ["conversations", id],
    queryFn: () => conversationsService.getById(id),
    enabled: !!id,
  })
}

export function useTakeControl(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => conversationsService.takeControl(conversationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["conversations", conversationId], updated)
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })
}

export function useResolve(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => conversationsService.resolve(conversationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["conversations", conversationId], updated)
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })
}
```

`src/hooks/useMessages.ts`
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { messagesService } from "../services/messages"

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => messagesService.list(conversationId),
    enabled: !!conversationId,
    refetchInterval: 5000,
  })
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => messagesService.send(conversationId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] })
    },
  })
}
```

`src/hooks/useTenantProfile.ts`
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { tenantProfileService } from "../services/tenantProfile"
import type { TenantProfile } from "../types/api.types"

export function useTenantProfile() {
  return useQuery({
    queryKey: ["tenant-profile"],
    queryFn: () => tenantProfileService.get(),
  })
}

export function useUpdateTenantProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<TenantProfile>) => tenantProfileService.update(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["tenant-profile"], updated)
    },
  })
}
```

`src/hooks/useWindowCountdown.ts`
```ts
import { useState, useEffect } from "react"

export function useWindowCountdown(lastUserMessageAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!lastUserMessageAt) {
      setRemaining(null)
      return
    }

    const update = () => {
      const deadline = new Date(lastUserMessageAt).getTime() + 24 * 60 * 60 * 1000
      const now = Date.now()
      const diff = deadline - now
      setRemaining(diff > 0 ? diff : 0)
    }

    update()
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [lastUserMessageAt])

  if (remaining === null) return null

  const hours = Math.floor(remaining / (1000 * 60 * 60))
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))

  return { hours, minutes, expired: remaining === 0 }
}
```

- [ ] **Step 4.2: Commit**

```bash
git add .
git commit -m "feat: add data hooks (useConversations, useMessages, useTenantProfile, useWindowCountdown)"
```

---

## Task 5: Componentes de conversaciones — lista e ítem

**Files:**
- Create: `src/components/conversations/ChannelBadge.tsx`
- Create: `src/components/conversations/StatusBadge.tsx`
- Create: `src/components/conversations/ConversationItem.tsx`
- Create: `src/components/conversations/ConversationFilters.tsx`
- Create: `src/components/conversations/ConversationList.tsx`
- Modify: `src/pages/ConversationsPage.tsx`

- [ ] **Step 5.1: Crear badges**

`src/components/conversations/ChannelBadge.tsx`
```tsx
import { Badge } from "../ui/badge"
import type { ChannelType } from "../../types/api.types"

const labels: Record<ChannelType, string> = {
  WhatsApp: "WhatsApp",
  Instagram: "Instagram",
  Messenger: "Messenger",
}

const colors: Record<ChannelType, string> = {
  WhatsApp: "bg-green-100 text-green-800",
  Instagram: "bg-pink-100 text-pink-800",
  Messenger: "bg-blue-100 text-blue-800",
}

export function ChannelBadge({ channel }: { channel: ChannelType }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[channel]}`}>
      {labels[channel]}
    </span>
  )
}
```

`src/components/conversations/StatusBadge.tsx`
```tsx
import type { ConversationStatus } from "../../types/api.types"

const labels: Record<ConversationStatus, string> = {
  Bot: "Bot",
  Human: "Humano",
  InQueue: "En cola",
  Closed: "Cerrada",
}

const colors: Record<ConversationStatus, string> = {
  Bot: "bg-slate-100 text-slate-700",
  Human: "bg-orange-100 text-orange-700",
  InQueue: "bg-yellow-100 text-yellow-700",
  Closed: "bg-gray-100 text-gray-500",
}

export function StatusBadge({ status }: { status: ConversationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  )
}
```

- [ ] **Step 5.2: Crear ConversationItem**

`src/components/conversations/ConversationItem.tsx`
```tsx
import { NavLink } from "react-router-dom"
import { cn } from "../../lib/utils"
import { ChannelBadge } from "./ChannelBadge"
import { StatusBadge } from "./StatusBadge"
import type { Conversation } from "../../types/api.types"

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function ConversationItem({ conversation }: { conversation: Conversation }) {
  const isAd = !!conversation.referralJson

  return (
    <NavLink
      to={`/conversations/${conversation.id}`}
      className={({ isActive }) =>
        cn(
          "flex flex-col gap-1 p-3 hover:bg-muted cursor-pointer border-b transition-colors",
          isActive && "bg-muted"
        )
      }
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm truncate">
          {conversation.contact.name ?? conversation.contact.externalId}
        </span>
        <span className="text-xs text-muted-foreground shrink-0 ml-2">
          {conversation.lastUserMessageAt
            ? timeAgo(conversation.lastUserMessageAt)
            : ""}
        </span>
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {conversation.lastMessage?.content ?? "Sin mensajes"}
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        <ChannelBadge channel={conversation.channel.type} />
        <StatusBadge status={conversation.status} />
        {isAd && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
            Anuncio
          </span>
        )}
      </div>
    </NavLink>
  )
}
```

- [ ] **Step 5.3: Crear ConversationFilters**

`src/components/conversations/ConversationFilters.tsx`
```tsx
import type { ConversationsFilters, ChannelType, ConversationStatus } from "../../types/api.types"

interface Props {
  filters: ConversationsFilters
  onChange: (f: ConversationsFilters) => void
}

const channels: { value: ChannelType | ""; label: string }[] = [
  { value: "", label: "Todos los canales" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Instagram", label: "Instagram" },
  { value: "Messenger", label: "Messenger" },
]

const statuses: { value: ConversationStatus | ""; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "Bot", label: "Bot" },
  { value: "Human", label: "Humano" },
  { value: "InQueue", label: "En cola" },
  { value: "Closed", label: "Cerradas" },
]

export function ConversationFilters({ filters, onChange }: Props) {
  return (
    <div className="flex gap-2 p-3 border-b">
      <select
        className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
        value={filters.channel ?? ""}
        onChange={e => onChange({ ...filters, channel: (e.target.value as ChannelType) || undefined })}
      >
        {channels.map(c => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>

      <select
        className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
        value={filters.status ?? ""}
        onChange={e => onChange({ ...filters, status: (e.target.value as ConversationStatus) || undefined })}
      >
        {statuses.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 5.4: Crear ConversationList**

`src/components/conversations/ConversationList.tsx`
```tsx
import { useState } from "react"
import { useConversations } from "../../hooks/useConversations"
import { ConversationItem } from "./ConversationItem"
import { ConversationFilters } from "./ConversationFilters"
import type { ConversationsFilters } from "../../types/api.types"

export function ConversationList() {
  const [filters, setFilters] = useState<ConversationsFilters>({})
  const { data, isLoading } = useConversations(filters)

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r">
      <div className="p-3 border-b">
        <h1 className="font-semibold text-sm">Conversaciones</h1>
      </div>
      <ConversationFilters filters={filters} onChange={setFilters} />
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center p-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {!isLoading && data?.items.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No hay conversaciones
          </p>
        )}
        {data?.items.map(conv => (
          <ConversationItem key={conv.id} conversation={conv} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5.5: Actualizar ConversationsPage**

`src/pages/ConversationsPage.tsx`
```tsx
import { Outlet } from "react-router-dom"
import { ConversationList } from "../components/conversations/ConversationList"

export function ConversationsPage() {
  return (
    <div className="flex h-full w-full">
      <ConversationList />
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        Seleccioná una conversación
      </div>
    </div>
  )
}
```

- [ ] **Step 5.6: Verificar en browser**

```bash
npm run dev
```

Expected: sidebar con lista de 3 conversaciones mock, filtros funcionando, badges de canal y estado visibles.

- [ ] **Step 5.7: Commit**

```bash
git add .
git commit -m "feat: add ConversationList with filters, ChannelBadge and StatusBadge"
```

---

## Task 6: Vista de chat — mensajes, contador de ventana, tomar control y resolver

**Files:**
- Create: `src/components/chat/MessageBubble.tsx`
- Create: `src/components/chat/WindowCountdown.tsx`
- Create: `src/components/chat/TakeControlButton.tsx`
- Create: `src/components/chat/ResolveButton.tsx`
- Create: `src/components/chat/MessageInput.tsx`
- Create: `src/components/chat/ChatView.tsx`
- Modify: `src/pages/ChatPage.tsx`
- Modify: `src/pages/ConversationsPage.tsx`

- [ ] **Step 6.1: Crear MessageBubble**

`src/components/chat/MessageBubble.tsx`
```tsx
import { cn } from "../../lib/utils"
import type { Message } from "../../types/api.types"

const authorLabel: Record<string, string> = {
  Bot: "Bot",
  Agent: "Agente",
  User: "",
}

export function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === "Outbound"

  return (
    <div className={cn("flex flex-col gap-0.5 max-w-[70%]", isOutbound ? "items-end self-end" : "items-start self-start")}>
      {message.author !== "User" && (
        <span className="text-xs text-muted-foreground px-1">
          {authorLabel[message.author]}
        </span>
      )}
      <div
        className={cn(
          "rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isOutbound
            ? message.author === "Bot"
              ? "bg-slate-100 text-slate-800"
              : "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {message.content}
      </div>
      <span className="text-[10px] text-muted-foreground px-1">
        {new Date(message.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
        {isOutbound && message.deliveryStatus === "read" && " · leído"}
      </span>
    </div>
  )
}
```

- [ ] **Step 6.2: Crear WindowCountdown**

`src/components/chat/WindowCountdown.tsx`
```tsx
import { useWindowCountdown } from "../../hooks/useWindowCountdown"
import { Clock } from "lucide-react"

export function WindowCountdown({ lastUserMessageAt }: { lastUserMessageAt: string | null }) {
  const countdown = useWindowCountdown(lastUserMessageAt)

  if (!countdown) return null

  if (countdown.expired) {
    return (
      <div className="flex items-center gap-1 text-xs text-destructive">
        <Clock className="h-3 w-3" />
        Ventana de 24h vencida — solo templates
      </div>
    )
  }

  const isWarning = countdown.hours < 4

  return (
    <div className={`flex items-center gap-1 text-xs ${isWarning ? "text-orange-600" : "text-muted-foreground"}`}>
      <Clock className="h-3 w-3" />
      Ventana: {countdown.hours}h {countdown.minutes}m restantes
    </div>
  )
}
```

- [ ] **Step 6.3: Crear TakeControlButton y ResolveButton**

`src/components/chat/TakeControlButton.tsx`
```tsx
import { Button } from "../ui/button"
import { useTakeControl } from "../../hooks/useConversations"
import { UserCheck } from "lucide-react"

export function TakeControlButton({ conversationId }: { conversationId: string }) {
  const { mutate, isPending } = useTakeControl(conversationId)

  return (
    <Button
      size="sm"
      onClick={() => mutate()}
      disabled={isPending}
    >
      <UserCheck className="h-4 w-4 mr-1" />
      {isPending ? "Tomando control..." : "Tomar control"}
    </Button>
  )
}
```

`src/components/chat/ResolveButton.tsx`
```tsx
import { Button } from "../ui/button"
import { useResolve } from "../../hooks/useConversations"
import { CheckCircle } from "lucide-react"

export function ResolveButton({ conversationId }: { conversationId: string }) {
  const { mutate, isPending } = useResolve(conversationId)

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => mutate()}
      disabled={isPending}
    >
      <CheckCircle className="h-4 w-4 mr-1" />
      {isPending ? "Resolviendo..." : "Resolver"}
    </Button>
  )
}
```

- [ ] **Step 6.4: Crear MessageInput**

`src/components/chat/MessageInput.tsx`
```tsx
import { useState } from "react"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { useSendMessage } from "../../hooks/useMessages"
import { Send } from "lucide-react"

export function MessageInput({ conversationId, disabled }: { conversationId: string; disabled?: boolean }) {
  const [content, setContent] = useState("")
  const { mutate, isPending } = useSendMessage(conversationId)

  const send = () => {
    if (!content.trim()) return
    mutate(content.trim(), { onSuccess: () => setContent("") })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t">
      <Textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "El bot está respondiendo…" : "Escribí un mensaje (Enter para enviar)"}
        disabled={disabled || isPending}
        rows={2}
        className="resize-none"
      />
      <Button size="icon" onClick={send} disabled={disabled || isPending || !content.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 6.5: Crear ChatView**

`src/components/chat/ChatView.tsx`
```tsx
import { useEffect, useRef } from "react"
import { useConversation } from "../../hooks/useConversations"
import { useMessages } from "../../hooks/useMessages"
import { MessageBubble } from "./MessageBubble"
import { MessageInput } from "./MessageInput"
import { TakeControlButton } from "./TakeControlButton"
import { ResolveButton } from "./ResolveButton"
import { WindowCountdown } from "./WindowCountdown"
import { ChannelBadge } from "../conversations/ChannelBadge"
import { StatusBadge } from "../conversations/StatusBadge"

export function ChatView({ conversationId }: { conversationId: string }) {
  const { data: conversation, isLoading: convLoading } = useConversation(conversationId)
  const { data: messagesData, isLoading: msgsLoading } = useMessages(conversationId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messagesData])

  if (convLoading || msgsLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!conversation) return <div className="flex flex-1 items-center justify-center text-muted-foreground">Conversación no encontrada</div>

  const isBotActive = conversation.status === "Bot"
  const isHuman = conversation.status === "Human"
  const isInQueue = conversation.status === "InQueue"
  const isClosed = conversation.status === "Closed"

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium text-sm">
              {conversation.contact.name ?? conversation.contact.externalId}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <ChannelBadge channel={conversation.channel.type} />
              <StatusBadge status={conversation.status} />
              {conversation.referralJson && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                  Anuncio
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WindowCountdown lastUserMessageAt={conversation.lastUserMessageAt} />
          {(isBotActive || isInQueue) && (
            <TakeControlButton conversationId={conversationId} />
          )}
          {isHuman && (
            <ResolveButton conversationId={conversationId} />
          )}
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messagesData?.items.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input — solo si el agente tiene el control */}
      <MessageInput conversationId={conversationId} disabled={!isHuman} />

      {isClosed && (
        <div className="border-t p-3 text-center text-xs text-muted-foreground">
          Conversación cerrada. El próximo mensaje del usuario la reabre.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6.6: Actualizar ChatPage y ConversationsPage**

`src/pages/ChatPage.tsx`
```tsx
import { useParams } from "react-router-dom"
import { ChatView } from "../components/chat/ChatView"

export function ChatPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return <ChatView conversationId={id} />
}
```

`src/pages/ConversationsPage.tsx`
```tsx
import { Outlet, useMatch } from "react-router-dom"
import { ConversationList } from "../components/conversations/ConversationList"

export function ConversationsPage() {
  const hasChat = useMatch("/conversations/:id")

  return (
    <div className="flex h-full w-full">
      <ConversationList />
      {!hasChat && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
          Seleccioná una conversación
        </div>
      )}
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 6.7: Verificar flujo completo en browser**

1. Abrir `/conversations`
2. Click en una conversación → ver mensajes
3. Click "Tomar control" → status cambia a "Humano"
4. Escribir un mensaje y enviar → aparece en el chat como agente
5. Click "Resolver" → status cambia a "Cerrada"

- [ ] **Step 6.8: Commit**

```bash
git add .
git commit -m "feat: add ChatView with messages, take control, resolve and window countdown"
```

---

## Task 7: Configuración — Perfil del negocio

**Files:**
- Create: `src/components/settings/BusinessProfileForm.tsx`
- Modify: `src/pages/SettingsProfilePage.tsx`

- [ ] **Step 7.1: Crear BusinessProfileForm**

`src/components/settings/BusinessProfileForm.tsx`
```tsx
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTenantProfile, useUpdateTenantProfile } from "../../hooks/useTenantProfile"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import type { TenantProfile } from "../../types/api.types"

type FormValues = Pick<TenantProfile,
  "address" | "timezone" | "contactPhone" | "contactEmail" | "tone" | "shippingInfo" | "paymentMethods"
>

export function BusinessProfileForm() {
  const { data: profile, isLoading } = useTenantProfile()
  const { mutate, isPending } = useUpdateTenantProfile()
  const { register, handleSubmit, reset } = useForm<FormValues>()

  useEffect(() => {
    if (profile) reset(profile)
  }, [profile, reset])

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>

  const onSubmit = (data: FormValues) => mutate(data)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <Label>Dirección</Label>
        <Input {...register("address")} placeholder="Av. Corrientes 1234, CABA" />
      </div>
      <div className="space-y-1">
        <Label>Zona horaria</Label>
        <Input {...register("timezone")} placeholder="America/Argentina/Buenos_Aires" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Teléfono de contacto</Label>
          <Input {...register("contactPhone")} placeholder="+5491112345678" />
        </div>
        <div className="space-y-1">
          <Label>Email de contacto</Label>
          <Input {...register("contactEmail")} type="email" placeholder="hola@tienda.com" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Tono del bot</Label>
        <Input {...register("tone")} placeholder="amigable, formal, casual…" />
      </div>
      <div className="space-y-1">
        <Label>Información de envíos</Label>
        <Textarea {...register("shippingInfo")} rows={3} placeholder="Envíos a todo el país por Andreani..." />
      </div>
      <div className="space-y-1">
        <Label>Medios de pago</Label>
        <Textarea {...register("paymentMethods")} rows={2} placeholder="Efectivo, transferencia, MercadoPago..." />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  )
}
```

Instalar react-hook-form:
```bash
npm install react-hook-form
```

- [ ] **Step 7.2: Actualizar SettingsProfilePage**

`src/pages/SettingsProfilePage.tsx`
```tsx
import { BusinessProfileForm } from "../components/settings/BusinessProfileForm"

export function SettingsProfilePage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold mb-6">Perfil del negocio</h1>
      <BusinessProfileForm />
    </div>
  )
}
```

- [ ] **Step 7.3: Verificar en browser**

Ir a `/settings/profile` → formulario cargado con datos del mock → modificar un campo → "Guardar cambios" → sin errores.

- [ ] **Step 7.4: Commit**

```bash
git add .
git commit -m "feat: add BusinessProfileForm with react-hook-form and TanStack Query"
```

---

## Task 8: Configuración — Documentos

**Files:**
- Create: `src/components/settings/DocumentsList.tsx`
- Create: `src/components/settings/DocumentUpload.tsx`
- Modify: `src/pages/SettingsDocumentsPage.tsx`

- [ ] **Step 8.1: Crear DocumentsList**

`src/components/settings/DocumentsList.tsx`
```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { documentsService } from "../../services/documents"
import { Button } from "../ui/button"
import { FileText, Trash2 } from "lucide-react"

const statusLabel: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando…",
  ready: "Listo",
  error: "Error",
}

const statusColor: Record<string, string> = {
  pending: "text-yellow-600",
  processing: "text-blue-600",
  ready: "text-green-600",
  error: "text-destructive",
}

export function DocumentsList() {
  const queryClient = useQueryClient()
  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsService.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  })

  if (isLoading) return <div className="text-sm text-muted-foreground">Cargando…</div>

  if (!docs?.length) return <p className="text-sm text-muted-foreground">No hay documentos subidos.</p>

  return (
    <ul className="space-y-2">
      {docs.map(doc => (
        <li key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{doc.name}</p>
            <p className={`text-xs ${statusColor[doc.status]}`}>{statusLabel[doc.status]}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => deleteMutation.mutate(doc.id)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 8.2: Crear DocumentUpload**

`src/components/settings/DocumentUpload.tsx`
```tsx
import { useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { documentsService } from "../../services/documents"
import { Button } from "../ui/button"
import { Upload } from "lucide-react"

export function DocumentUpload() {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: (file: File) => documentsService.upload(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) mutate(file)
    e.target.value = ""
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
      >
        <Upload className="h-4 w-4 mr-2" />
        {isPending ? "Subiendo…" : "Subir documento (PDF o TXT)"}
      </Button>
    </div>
  )
}
```

- [ ] **Step 8.3: Actualizar SettingsDocumentsPage**

`src/pages/SettingsDocumentsPage.tsx`
```tsx
import { DocumentUpload } from "../components/settings/DocumentUpload"
import { DocumentsList } from "../components/settings/DocumentsList"

export function SettingsDocumentsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold mb-2">Documentos del negocio</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Subí catálogos, políticas de cambio o FAQ. El bot los usa para responder.
      </p>
      <div className="space-y-4 max-w-lg">
        <DocumentUpload />
        <DocumentsList />
      </div>
    </div>
  )
}
```

- [ ] **Step 8.4: Commit**

```bash
git add .
git commit -m "feat: add DocumentUpload and DocumentsList for settings"
```

---

## Task 9: Configuración — Agentes

**Files:**
- Create: `src/components/settings/AgentsList.tsx`
- Create: `src/components/settings/InviteAgentModal.tsx`
- Modify: `src/pages/SettingsAgentsPage.tsx`

- [ ] **Step 9.1: Crear AgentsList**

`src/components/settings/AgentsList.tsx`
```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { agentsService } from "../../services/agents"
import { Button } from "../ui/button"
import { Trash2 } from "lucide-react"
import { useUser } from "@clerk/clerk-react"

export function AgentsList() {
  const queryClient = useQueryClient()
  const { user } = useUser()

  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => agentsService.list(),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => agentsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] }),
  })

  if (isLoading) return <div className="text-sm text-muted-foreground">Cargando…</div>

  return (
    <ul className="space-y-2">
      {agents?.map(agent => (
        <li key={agent.id} className="flex items-center gap-3 rounded-lg border p-3">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
            {agent.user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{agent.user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{agent.user.email}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {agent.role === "Owner" ? "Dueño" : "Agente"}
          </span>
          {agent.role !== "Owner" && (
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => removeMutation.mutate(agent.id)}
              disabled={removeMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 9.2: Crear InviteAgentModal**

`src/components/settings/InviteAgentModal.tsx`
```tsx
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { agentsService } from "../../services/agents"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "../ui/dialog"
import { UserPlus } from "lucide-react"

export function InviteAgentModal() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: (e: string) => agentsService.invite(e),
    onSuccess: () => {
      setOpen(false)
      setEmail("")
      queryClient.invalidateQueries({ queryKey: ["agents"] })
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar agente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar agente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="agente@tienda.com"
              onKeyDown={e => e.key === "Enter" && mutate(email)}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => mutate(email)}
            disabled={!email || isPending}
          >
            {isPending ? "Enviando invitación…" : "Enviar invitación"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 9.3: Actualizar SettingsAgentsPage**

`src/pages/SettingsAgentsPage.tsx`
```tsx
import { AgentsList } from "../components/settings/AgentsList"
import { InviteAgentModal } from "../components/settings/InviteAgentModal"

export function SettingsAgentsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6 max-w-lg">
        <h1 className="text-lg font-semibold">Agentes</h1>
        <InviteAgentModal />
      </div>
      <div className="max-w-lg">
        <AgentsList />
      </div>
    </div>
  )
}
```

- [ ] **Step 9.4: Commit**

```bash
git add .
git commit -m "feat: add AgentsList and InviteAgentModal for settings"
```

---

## Task 10: Simulación del bot

**Files:**
- Create: `src/components/simulation/BotSimulationChat.tsx`
- Modify: `src/pages/SimulationPage.tsx`

- [ ] **Step 10.1: Crear BotSimulationChat**

`src/components/simulation/BotSimulationChat.tsx`
```tsx
import { useState, useRef, useEffect } from "react"
import { apiClient } from "../../lib/apiClient"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Send, Bot } from "lucide-react"
import { cn } from "../../lib/utils"

interface SimMessage {
  id: string
  role: "user" | "bot"
  content: string
}

export function BotSimulationChat() {
  const [messages, setMessages] = useState<SimMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: SimMessage = { id: `u-${Date.now()}`, role: "user", content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const { data } = await apiClient.post<{ content: string }>("/api/simulation/message", { content: userMsg.content })
      setMessages(prev => [...prev, { id: `b-${Date.now()}`, role: "bot", content: data.content }])
    } catch {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: "bot", content: "Error al conectar con el bot." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3 bg-muted/40">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Simulación del bot</span>
        <span className="text-xs text-muted-foreground">— los mensajes no llegan a WhatsApp</span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-8">
            Escribí un mensaje para probar cómo responde el bot.
          </p>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={cn(
              "max-w-[70%] rounded-2xl px-3 py-2 text-sm",
              msg.role === "user"
                ? "self-end bg-primary text-primary-foreground"
                : "self-start bg-muted text-foreground"
            )}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="self-start bg-muted rounded-2xl px-3 py-2 text-sm text-muted-foreground">
            Escribiendo…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 p-3 border-t">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Escribí como si fueras un cliente..."
          rows={2}
          className="resize-none"
          disabled={loading}
        />
        <Button size="icon" onClick={send} disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 10.2: Actualizar SimulationPage**

`src/pages/SimulationPage.tsx`
```tsx
import { BotSimulationChat } from "../components/simulation/BotSimulationChat"

export function SimulationPage() {
  return (
    <div className="flex flex-1 flex-col h-full p-6">
      <h1 className="text-lg font-semibold mb-4">Simulación del bot</h1>
      <div className="flex-1 overflow-hidden">
        <BotSimulationChat />
      </div>
    </div>
  )
}
```

- [ ] **Step 10.3: Verificar en browser**

Ir a `/simulation` → escribir un mensaje → ver respuesta del bot simulado mock en ~800ms.

- [ ] **Step 10.4: Commit**

```bash
git add .
git commit -m "feat: add BotSimulationChat for testing bot responses"
```

---

## Task 11: Agregar Sidebar con navegación de Settings

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 11.1: Agregar sub-navegación de settings**

`src/components/layout/Sidebar.tsx`
```tsx
import { NavLink, useMatch } from "react-router-dom"
import { MessageSquare, Settings, Bot, FileText, Users } from "lucide-react"
import { cn } from "../../lib/utils"
import { UserButton } from "@clerk/clerk-react"

const mainNav = [
  { to: "/conversations", icon: MessageSquare, label: "Conversaciones" },
  { to: "/simulation", icon: Bot, label: "Simulación" },
]

const settingsNav = [
  { to: "/settings/profile", icon: Settings, label: "Perfil" },
  { to: "/settings/documents", icon: FileText, label: "Documentos" },
  { to: "/settings/agents", icon: Users, label: "Agentes" },
]

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        cn(
          "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          isActive && "bg-muted text-foreground"
        )
      }
    >
      <Icon className="h-5 w-5" />
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-14 flex-col items-center border-r bg-background py-4 gap-1">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <MessageSquare className="h-4 w-4 text-primary-foreground" />
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {mainNav.map(item => <NavItem key={item.to} {...item} />)}
        <div className="my-2 h-px w-8 bg-border" />
        {settingsNav.map(item => <NavItem key={item.to} {...item} />)}
      </nav>
      <UserButton afterSignOutUrl="/sign-in" />
    </aside>
  )
}
```

- [ ] **Step 11.2: Commit**

```bash
git add .
git commit -m "feat: update Sidebar with settings sub-navigation"
```

---

## Criterio de terminado del Frontend MVP

- Login via Clerk funciona (redirige a `/conversations` al autenticarse).
- `/conversations` muestra la lista con filtros y abre el chat al hacer click.
- En el chat: contador de ventana de 24h, "Tomar control", enviar mensaje como agente, "Resolver".
- `/settings/profile` carga y guarda el perfil del negocio.
- `/settings/documents` lista, sube y elimina documentos.
- `/settings/agents` lista agentes e invita por email.
- `/simulation` permite chatear con el bot mock.
- Todo funciona con MSW sin necesidad del backend.
