# CLAUDE.md

Instrucciones y contexto para Claude Code y colaboradores que trabajen en este repositorio. Complemento del código — el código manda, esto resume decisiones y patrones no obvios.

## Qué es BG Planner

App para que grupos de amigos organicen sus partidas de juegos de mesa: importas tu colección de BGG, los miembros votan sus favoritos, sale un ranking y se planifican sesiones o eventos a partir de ahí.

## Stack

- **Next.js 16.1.7** (App Router, TypeScript, Turbopack)
- **React 19.2**
- **PostgreSQL via Supabase** + **Prisma 5.22** (Node 20.11 no soporta Prisma 7)
- **Tailwind CSS v4** (`@import "tailwindcss"`, sin plugins, variables CSS)
- **Resend** para emails transaccionales
- **jose** para JWT, **zod v4** para validación, **xml2js** para parsear XML de BGG
- Idioma UI y errores: **español (es-ES)**
- Deploy: Vercel (dominio `bgplanner.app`). Push a `main` → deploy automático.

## Prisma / BD

- **No hay carpeta `prisma/migrations/`**. Flujo: editar `schema.prisma` → `npx prisma db push` → `npx prisma generate`. Adecuado para MVP con un único entorno real; asume riesgo de no tener historial de migraciones.
- `DATABASE_URL` = pooler Supabase; `DIRECT_URL` = conexión directa (necesaria para `prisma generate`).
- Modelos principales: `User`, `OtpCode`, `Group`, `GroupMember`, `GroupInvitation`, `Game` (caché global BGG), `GroupGame`, `Vote`, `GameSession`, `GameSessionGame`, `Event`, `EventAttendee`, `EventGame`, `EventGameInterest`, `CollectionGame` (caché por usuario BGG), `ActivityLog`.

## Auth

- OTP-only (sin contraseñas). Envío 6 dígitos por email, rate-limit **3 códigos / 5 min**, expira en **10 min**.
- JWT HS256 en cookie httpOnly `session`, 60 días (sin refresh).
- Helper central: `getSession(request?)` en [src/lib/auth.ts](src/lib/auth.ts). Siempre se usa al principio del handler → `401` si null.
- Superadmin: `role = "superadmin"` en DB o fallback `SUPERADMIN_EMAIL` env.

## Patrones que seguir

### Handlers API
```
getSession → 401
check membership → 403
parse body con Zod schema → 400 si falla
lógica + prisma
logActivity(...) fire-and-forget
NextResponse.json(...)
```

### Envío de emails (Resend)
- `import { resend } from "@/lib/resend"`.
- **Fire-and-forget**: `resend.emails.send(...).catch(() => {})`. Nunca bloquear la respuesta por un email.
- From: `"BG Planner <cesar@tiradacritica.es>"`.
- Plantilla HTML inline, tema dark: `background: #0f172a`, texto `#f1f5f9`, acento `#f59e0b`, bordes `#334155`, grises `#94a3b8`. CTA = botón ámbar con texto oscuro.
- **Siempre escapar HTML** en cualquier string que venga del usuario antes de meterlo en el template (ver `escapeHtml` en [src/app/api/groups/[id]/ping/route.ts](src/app/api/groups/[id]/ping/route.ts)).

### Activity log
- `logActivity(type, userId, { groupId?, eventId?, ...metadata })` en [src/lib/activity.ts](src/lib/activity.ts).
- `type` tiene que estar en la union `ActivityType`; añadir nuevos tipos ahí.
- Cada tipo debe tener template en `TEMPLATES` para `formatActivity()` (si no, se muestra el id literal).
- Algunos tipos son `scope: "public"` (aparecen en feed global) — ver `PUBLIC_TYPES`.

### Validaciones
- Todo lo que viene del cliente pasa por un schema Zod de [src/lib/validations.ts](src/lib/validations.ts). Mensajes de error en español.
- En handler: `const parsed = schema.safeParse(body); if (!parsed.success) return 400 con parsed.error.issues[0].message`.

### Ranking
- Fórmula: `score = 3 × super + 1 × up - 1 × down`. Desempate por `bggRating` descendente.
- Helper central: `computeRanking(groupId, viewerUserId?)` en [src/lib/ranking.ts](src/lib/ranking.ts). Úsalo para cualquier cosa que necesite ranking — no dupliques la lógica.
- Restricción: **1 super voto por usuario por grupo** (no por juego). Si ya tiene, 409 con `conflictingGameId`.

### UI (client components)
- La página de grupo [src/app/groups/[id]/page.tsx](src/app/groups/[id]/page.tsx) es el ejemplo canónico: `useState` para todo (modales, forms, loading, errores, toasts), no hay Redux ni Zustand.
- **Modales**: inline en el mismo fichero, patrón `fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4` con `onClick` de backdrop que cierra + `stopPropagation` en el contenido.
- **Toasts**: `useState("")` + `setTimeout(() => setState(""), 4000)`. No hay librería tipo Sonner.
- **Estilos**: variables CSS (`var(--primary)`, `var(--surface)`, `var(--text)`, `var(--text-secondary)`, `var(--text-muted)`, `var(--border)`, `var(--input-bg)`, `var(--input-border)`, `var(--card-shadow)`). Definidas en [src/app/globals.css](src/app/globals.css). Light y dark definidos con `.dark` toggle.
- Bordes redondeados = `rounded-xl` (botones/inputs) o `rounded-2xl` (tarjetas/modales).
- Fuentes: Bricolage Grotesque (display), DM Sans (body), Geist Mono (mono).

### Feed
- Cursor pagination con `createdAt < cursor`, no offset. Límite máximo 50.
- Caché in-memory 5 min en `src/components/ActivityFeed.tsx` con keys `group:{id}` o `event:{id}`.

### BGG API
- Centralizado en [src/lib/bgg.ts](src/lib/bgg.ts). Cualquier acceso a BGG pasa por aquí.
- BGG devuelve **202** cuando está preparando datos (colecciones grandes). Hay retry con backoff exponencial (max 6 intentos, ~15 s). No reintentar fuera del helper.
- Búsqueda: cascada Geekdo JSON → XML API → DB local (`Game` y `CollectionGame`). Evita dejar al usuario esperando a BGG.
- Colecciones: caché DB 24 h (`CollectionGame.fetchedAt`). `forceRefresh` solo bajo acción explícita del usuario.

### Rate limiting
- OTP: `prisma.otpCode.count({ email, createdAt >= ahora - 5min })` → 429 si ≥ 3.
- Ping (convocatoria): campo `GroupMember.lastPingedAt`, cooldown 7 días. 429 con `nextAvailableAt` para que la UI muestre la fecha.

## Changelog — OBLIGATORIO

**Cada vez que se añade una feature visible al usuario, añadir entrada en [src/app/changelog/page.tsx](src/app/changelog/page.tsx)** al principio del array `CHANGELOG`. Formato:

```ts
{
  date: "23 abril 2026",         // en español, día mes año
  version: "1.2",                // minor por defecto en cada release; patch solo si es exclusivamente fixes
  title: "Título corto y evocador",
  changes: [
    { type: "new", text: "..." },      // feature nueva
    { type: "improved", text: "..." }, // mejora
    { type: "fixed", text: "..." },    // bug fix
  ],
},
```

Descriptivo pero **sin explicar cómo funciona por dentro**: se trata de enseñar "cosas chulas nuevas", no detalles de implementación. Texto en español, orientado al valor que aporta al usuario. Evita tecnicismos tipo "caché", "rate limit", "campo X", "optimización de queries".

## Comandos

```bash
npm run dev                      # Next dev (puerto 3000)
npm run build                    # limpia caché Prisma, genera cliente, build Next
npm run lint                     # ESLint

npx prisma db push               # sincroniza schema con Supabase
npx prisma generate              # regenera cliente Prisma
npx prisma studio                # GUI de la BD
```

No hay tests ni formateador configurado.

## Limpieza proactiva

Cuando detectemos al pasar por un fichero **cualquier error** — funcional, de lint o posible vulnerabilidad de seguridad — limpiarlo en el momento (o, si infla demasiado la tarea actual, sacarlo a una tarea aparte con `spawn_task`). No dejar errores "que ya estaban" sin tocar si los hemos visto.

## Convenciones de commit

- Mensajes de commit en **español**, imperativos cortos (ver `git log`). Ejemplos: "Añadir ...", "Agrupar ...", "Mover ...", "Arreglar ...".
- Pie con `Co-Authored-By: Claude ...` si el commit lo hace Claude.
- **Siempre push a `origin main` tras el commit** (deploy automático en Vercel).

## Gotchas conocidos

- **Next.js 16**: warning de middleware deprecation (pide usar "proxy"). El middleware actual funciona.
- **Node 20.11.1**: no soporta Prisma 7 (requiere 20.19+). No actualizar Prisma más allá de 5.x mientras siga este Node.
- **Imágenes remotas**: [next.config.ts](next.config.ts) solo permite `cf.geekdo-images.com`. Si se añade otra fuente hay que listarla.
- **`currentDate` del entorno** puede adelantarse al calendario real — no basar lógica en él.
