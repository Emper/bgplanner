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

- **No hay carpeta `prisma/migrations/`**. Flujo: editar `schema.prisma` → aplicar el cambio en Supabase → `npx prisma generate`. Adecuado para MVP con un único entorno real; asume riesgo de no tener historial de migraciones.
- `DATABASE_URL` = pooler Supabase; `DIRECT_URL` = conexión directa (necesaria para `prisma generate`).
- Modelos principales (lista completa en `schema.prisma`): `User`, `Group`/`GroupMember`/`GroupInvitation`, `Game` (caché global BGG), `GroupGame`, `Vote`, `GameComment`, `GameReview` (crónicas), `GameSession`, `Event`/`EventAttendee`/`EventGame`/`EventGameInterest`/`EventReview`/`EventPhoto`, `CollectionGame` (caché por usuario BGG), `CollectionEntry`, `BggGameInfo`/`BggUserGame`/`UserGameFlag` (recomendaciones), `ActivityLog`, `Notification` (campana), `Friendship`, `CommunityThread`/`CommunityReply` (foro `/community`), `Feedback`, `Feature`/`FeatureVote` (roadmap público), `Report`/`UserBlock` (moderación).

### Seguridad con la base de datos — IMPORTANTE

La base de datos de Supabase del proyecto es **producción**, sin entorno de staging. Cualquier cambio de esquema o `UPDATE`/`DELETE` masivo afecta a la app en vivo y puede romper la versión desplegada hasta que se publique el código nuevo.

**Regla**: Claude nunca ejecuta cambios contra la BD. Cuando haga falta tocar el esquema o los datos, **entregar el SQL al usuario para que lo ejecute él en la consola de Supabase**, aunque parezca un cambio menor o esté implícito en una tarea más grande. Esto incluye:

- Cambios de esquema (incluso añadir un campo opcional). Nada de `npx prisma db push`
- Scripts que escriban con `$executeRaw`, `updateMany`, `deleteMany`, `create*` masivos
- Cualquier query destructiva manual

Para generar el SQL exacto de un cambio de esquema, sin inventárselo, diferenciar el `schema.prisma` anterior contra el nuevo:

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-old.prisma
npx prisma migrate diff \
  --from-schema-datamodel /tmp/schema-old.prisma \
  --to-schema-datamodel prisma/schema.prisma --script
```

Entregarlo junto con **el orden correcto respecto al deploy** (normalmente: SQL primero, deploy después) y avisando de si hay ventana en la que la web queda rota.

Cuando haya que migrar datos asociados a un cambio de esquema, **plantear al usuario el plan completo y la ventana de incompatibilidad esperada** antes de ejecutar nada. Si la migración requiere varios pasos coordinados con el deploy, avisar de que la web puede quedar parcialmente rota durante el proceso.

**Antes de cualquier operación destructiva o migración**: ejecutar `npm run db:snapshot` para generar un volcado en `backups/` (ignored por git). Restaurar luego con `pg_restore -d "$DIRECT_URL" --clean --no-owner --no-acl <archivo>`. Requiere `pg_dump` instalado (`brew install libpq && brew link --force libpq`).

## Auth

- OTP-only (sin contraseñas). Envío 6 dígitos por email, rate-limit **3 códigos / 5 min**, expira en **10 min**. Solo vale el **último** código pedido.
- Emails siempre normalizados (trim + minúsculas) con `normalizedEmail()` de [validations.ts](src/lib/validations.ts) antes de guardar o buscar. Cualquier schema nuevo que reciba un email lo usa.
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
- **Toasts**: `useState("")` + `setTimeout(() => setState(""), 4000)`. No hay librería tipo Sonner. Posición `fixed bottom-6` (o `bottom-4`): `globals.css` los sube solos por encima de la barra de inicio y de la barra de pestañas.
- **Estilos**: variables CSS (`var(--primary)`, `var(--surface)`, `var(--text)`, `var(--text-secondary)`, `var(--text-muted)`, `var(--border)`, `var(--input-bg)`, `var(--input-border)`, `var(--card-shadow)`). Definidas en [src/app/globals.css](src/app/globals.css). Light y dark definidos con `.dark` toggle.
- Bordes redondeados = `rounded-xl` (botones/inputs) o `rounded-2xl` (tarjetas/modales).
- Fuentes: Bricolage Grotesque (display), DM Sans (body), Geist Mono (mono).

### Feed
- Cursor pagination con `createdAt < cursor`, no offset. Límite máximo 50.
- Caché in-memory 5 min en `src/components/ActivityFeed.tsx` con keys `group:{id}` o `event:{id}`.

### BGG API
- Centralizado en [src/lib/bgg.ts](src/lib/bgg.ts). Cualquier acceso a BGG pasa por aquí.
- BGG devuelve **202** cuando está preparando datos (colecciones grandes). Hay retry con backoff exponencial (max 6 intentos, ~15 s). No reintentar fuera del helper.
- Búsqueda: XML API2 oficial → DB local (`Game` y `CollectionGame`) si BGG no responde. Nada de APIs privadas (`api.geekdo.com`): las condiciones de BGG no las licencian.
- Condiciones de uso: app registrada en boardgamegeek.com/applications con token `BGG_API_TOKEN` (cabecera Bearer, peticiones siempre desde el servidor). Licencia no comercial: si la app pasa a cobrar, mostrar anuncios o publicarse a nombre de una empresa, hace falta licencia comercial. Logo «Powered by BGG» enlazado en el Footer, no modificar los datos de BGG y prohibido usarlos para entrenar IA.
- Colecciones: caché DB 24 h (`CollectionGame.fetchedAt`). `forceRefresh` solo bajo acción explícita del usuario.

### Moderación (denuncias y bloqueos)
- Lo exigen App Store (guideline 1.2) y Google Play para el contenido de usuarios. Constantes compartidas en [src/lib/reports.ts](src/lib/reports.ts); servidor en [src/lib/moderation.ts](src/lib/moderation.ts).
- Contenido nuevo que suban los usuarios y vean otros → añadir su tipo a `REPORT_TARGET_TYPES`, a `describeReportTarget` y a `removeReportTarget`, y un «🚩 Denunciar» en su menú `MoreMenu` ([Moderation.tsx](src/components/Moderation.tsx)).
- Bloquear: `notifyNow` ya descarta a quien ha bloqueado al actor; la Comunidad oculta/pliega lo de bloqueados. En grupos y eventos no se esconde nada.
- Hilos y respuestas con `AUTO_HIDE_REPORTS` denuncias pendientes se ocultan solos hasta que se revisan en `/admin/reports`.

### Rate limiting
- OTP: `prisma.otpCode.count({ email, createdAt >= ahora - 5min })` → 429 si ≥ 3.
- Verificar OTP: `OtpCode.attempts` se incrementa **antes** de comparar (seguro ante peticiones en paralelo). 5 intentos por código y 10 por hora y email (429).
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

**Breve**: 1-4 puntos por entrada, una frase corta cada uno. Solo lo que el usuario nota; las mejoras internas, retoques menores y fixes sin impacto visible no entran.

## Checklist de una feature nueva — OBLIGATORIO

La app tiene muchos sitios transversales y es fácil que una feature nueva se quede encerrada en su página. Antes de cerrar una feature, **repasar esta lista punto por punto** y decidir en cada uno si aplica. Lo que no aplique se descarta conscientemente; lo que se deje para más adelante va a `BACKLOG.md` o se propone como tarea aparte.

**Navegación**
- Cabecera con sesión ([Navbar.tsx](src/components/Navbar.tsx)): enlace desde `sm` (icono hasta `lg`) y, si no es una sección principal, entrada en el menú lateral del móvil. En móvil las secciones principales van en la barra de pestañas de abajo ([MobileTabBar.tsx](src/components/MobileTabBar.tsx), montada en el layout raíz); no meter más de cuatro o cinco. Medir que cabe a 360, 375, 640, 768 y 1024 px de ancho (con campana y botón de admin).
- Cabecera sin sesión ([SmartNav.tsx](src/components/SmartNav.tsx)) y menú de la portada (`NAV_LINKS` en [Landing.tsx](src/components/landing/Landing.tsx)), si la feature se puede ver sin cuenta.
- Pie ([Footer.tsx](src/components/Footer.tsx)).

**Escaparates**
- Portada pública ([Landing.tsx](src/components/landing/Landing.tsx), datos desde [src/app/page.tsx](src/app/page.tsx)): sección propia, tarjeta en «Y además» o mención en los textos. Los textos de la portada no pueden contradecir lo que hace hoy la app (p. ej. si un aviso deja de ir por email).
- Inicio con sesión ([HomeDashboard.tsx](src/components/HomeDashboard.tsx)): bloque, atajo en la barra lateral o cifra en el saludo.

**Avisos y actividad**
- Notificaciones de la campana ([notifications.ts](src/lib/notifications.ts)): ¿hay alguien a quien avisar? Tipo nuevo, texto en `presentNotification` y, si puede llegar en ráfaga, fusión. El email, solo si de verdad merece salir de la app.
- Activity log ([activity.ts](src/lib/activity.ts)): tipo + template, y si va al feed público (`PUBLIC_TYPES`).

**Conexiones con el resto**
- Perfil público e insignias ([publicProfile.ts](src/lib/publicProfile.ts) + [profileBadges.ts](src/lib/profileBadges.ts)).
- Grupos, eventos, colección y amigos ([friends.ts](src/lib/friends.ts)): ¿hay un atajo natural desde o hacia ellos? Ejemplo: «Anúncialo en la Comunidad» desde un evento abierto.
- Panel de admin (`src/app/admin`) si hay contenido de usuarios que moderar. Cron (`src/app/api/cron`) si hay limpieza o recordatorios.

**Público y SEO** (solo si se ve sin cuenta)
- [proxy.ts](src/proxy.ts): rutas protegidas frente a públicas, tanto la página como su API.
- El contenido tiene que salir **pintado del servidor** (página de servidor que pasa `initial` a un componente de cliente), no pedido desde el navegador: si no, los buscadores ven un loader. Lo que falte devuelve 404 de verdad (`notFound()`).
- `generateMetadata` con título, descripción y canonical; JSON-LD si hay un tipo de schema.org que encaje; [sitemap.ts](src/app/sitemap.ts) y [robots.ts](src/app/robots.ts); `opengraph-image` si se va a compartir.
- Sin sesión: `SignupBanner` con su variante, y el login vuelve a donde estaba (`?redirect=`).
- No enlazar perfiles sin `nofollow` mientras siga abierto el punto 5 de `BACKLOG.md`.

**Cierre**
- Changelog (ver abajo) y, si la feature venía del roadmap, avisar para marcar la propuesta como hecha.
- Actualizar este fichero si cambia un patrón o aparece un modelo nuevo.

## Comandos

```bash
npm run dev                      # Next dev (puerto 3000)
npm run build                    # limpia caché Prisma, genera cliente, build Next
npm run lint                     # ESLint

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
- **Imágenes remotas**: [next.config.ts](next.config.ts) solo permite `cf.geekdo-images.com` y `*.supabase.co`. Si se añade otra fuente hay que listarla.
- **`currentDate` del entorno** puede adelantarse al calendario real — no basar lógica en él.
