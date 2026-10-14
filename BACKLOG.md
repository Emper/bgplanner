# Backlog técnico

Mejoras y arreglos detectados en la revisión de SEO y rendimiento (octubre 2026) que quedan pendientes. Ninguno está empezado. Cada uno lleva el problema, la propuesta y lo que hay que tener en cuenta antes de abordarlo.

---

## 1. Sacar avatares y carteles de evento de la base de datos

**Tipo:** rendimiento · **Impacto:** alto · **Esfuerzo:** medio-alto · **Toca BD:** sí (migración de datos)

**Problema.** Los avatares (`User.avatarUrl`, hasta 200 KB) y los carteles de evento (`Event.imageUrl`, `@db.Text`) se guardan como data URLs en base64 dentro de la propia fila. Así:
- Viajan dentro de cada respuesta que los incluye: listado de eventos, feed (el avatar se repite en cada actividad, hasta 30 veces), miembros del grupo, asistentes, perfil público y portada (los 3 carteles van en el HTML y otra vez en el payload de React).
- No se pueden cachear ni optimizar, y por eso llevan `unoptimized` en `Avatar.tsx`, `EventsClient.tsx` y `EventClient.tsx`.

**Propuesta.**
1. Subirlos a Supabase Storage igual que las fotos de galería (`src/lib/supabaseStorage.ts`, `resizeImageToBlob`) y guardar solo la URL.
   - Puntos de subida: `src/app/profile/page.tsx` (`handleAvatarChange`), `src/app/events/new/page.tsx` y `EventClient.tsx` (`handleImageUpload`).
2. Hacer un script de migración que recorra las filas con `data:` y las suba a Storage. Lo ejecuta el usuario, con `npm run db:snapshot` antes.
3. Quitar `unoptimized` y dejar que `next/image` sirva tamaños adecuados.

**Alternativa intermedia** (si no se quiere migrar aún): una ruta `GET /api/img/avatar/[userId]?v=<updatedAt>` que decodifique el base64 y lo sirva con `Cache-Control: public, max-age=31536000, immutable`. Los listados devolverían esa URL en vez del data URL.

**Ojo.** Durante la migración convivirán filas con data URL y con URL de Storage, así que el código tiene que aceptar las dos. Hay que plantear el plan completo y la ventana de incompatibilidad antes de ejecutar nada.

---

## 2. Miniaturas para las galerías de fotos

**Tipo:** rendimiento · **Impacto:** alto en galerías · **Esfuerzo:** medio · **Toca BD:** probablemente (campo de miniatura)

**Problema.** Las cuadrículas de `EventGallery.tsx` y `GroupGallery.tsx` muestran celdas de unos 160 px, pero descargan la foto original de 1600 px (300-500 KB cada una), porque las imágenes llevan `unoptimized`.

**Propuesta.** Generar una miniatura de unos 400 px al subir la foto. Se guarda junto a la original (p. ej. `thumbUrl` en el modelo de foto, o una ruta con convención `…/thumb/…`). La cuadrícula usa la miniatura y el visor a pantalla completa, la original.

**Por qué no quitar `unoptimized` sin más.** Funcionaría, pero cada imagen pasaría por la optimización de Vercel, que tiene cupo según el plan. Si además se quita en las carátulas de BGG (feed, ranking, portada, roadmap), el volumen de imágenes distintas puede agotar ese cupo. Antes de tocarlo, revisar el plan de Vercel o usar las transformaciones de Supabase Storage (requieren plan Pro).

---

## 3. Cargar los datos iniciales en el servidor

**Tipo:** rendimiento · **Impacto:** alto (carga percibida) · **Esfuerzo:** alto · **Toca BD:** no

**Problema.** El inicio (`HomeDashboard.tsx`), la ficha de grupo (`GroupClient.tsx`) y la de evento (`EventClient.tsx`) son componentes de cliente. El servidor ya comprueba la sesión, pero la página no empieza a pedir sus datos hasta que se ha descargado y arrancado el JavaScript. Es un viaje de ida y vuelta extra en cada carga, con el loader a la vista mientras tanto.

**Propuesta.**
- Sacar la lógica de las rutas API (`/api/groups`, `/api/feed`, `/api/events/[id]`, `/api/groups/[id]/dashboard`…) a funciones de `src/lib`.
- Llamarlas desde el `page.tsx` de servidor y pasar el resultado como `initialData` al componente de cliente, que sigue usando la API para refrescar.
- Hacerlo página a página, empezando por el inicio.

**Ojo.** Los objetos `Date` y similares deben llegar al cliente serializados igual que por la API. Mantener los mismos filtros de privacidad (notas privadas, código de invitación solo para quien gestiona, etc.).

---

## 4. Ajustar el pool de conexiones a la base de datos

**Tipo:** rendimiento / estabilidad · **Impacto:** medio · **Esfuerzo:** bajo · **Toca BD:** no (configuración en Vercel)

**Problema.** `DATABASE_URL` va al pooler de Supabase con `?pgbouncer=true`, pero sin `connection_limit`. Con el valor por defecto de Prisma, cada función serverless puede abrir varias conexiones, y con tráfico se puede llegar al límite del pooler. Ponerlo a 1 tampoco sirve: haría secuenciales todos los `Promise.all` (el inicio lanza 6 consultas en paralelo).

**Propuesta.** En las variables de entorno de Vercel, añadir `&connection_limit=3&pool_timeout=10` a `DATABASE_URL` (entre 3 y 5). Comprobar también que la región de Supabase está cerca de `cdg1` (París), la que usan las funciones según `vercel.json`.

---

## 5. Decidir si los perfiles públicos van al sitemap

**Tipo:** SEO / producto · **Impacto:** medio · **Esfuerzo:** bajo · **Toca BD:** no (o un campo si se hace opcional)

**Situación.** Los perfiles `/users/<slug>` ya son públicos e indexables (canonical, tarjeta para compartir), pero no están en `src/app/sitemap.ts`. La única página pública que enlaza a ellos es la Comunidad (autor de cada hilo y respuesta), y lo hace con `rel="nofollow"` y sin la URL del perfil en los datos estructurados del hilo, para no adelantar esta decisión. En la práctica Google solo los encuentra si alguien comparte el enlace.

**Decisión pendiente.** Incluirlos en el sitemap supone empujar activamente a todos los usuarios a los buscadores. Opciones:
- No incluirlos (estado actual).
- Incluirlos todos.
- Añadir una opción en el perfil («Que mi perfil aparezca en buscadores»), incluir solo a quien la active y poner `noindex` al resto. Necesita un campo nuevo en `User`.

Si se decide indexarlos, quitar el `nofollow` de `AuthorLink` (`src/components/CommunityBits.tsx`) y añadir `author.url` en `src/app/community/[id]/layout.tsx`.

---

## Otros puntos menores detectados

- **Roadmap renderizado en servidor.** `src/app/roadmap/page.tsx` pide las propuestas desde el navegador, así que su contenido no está en el HTML. Se puede renderizar la lista en servidor con `revalidate` y pedir desde el cliente solo los votos propios.
- **Portada como componente de servidor.** `Landing.tsx` y `mockups.tsx` (unos 80 KB) son enteros de cliente. Bastaría con dejar en cliente solo las partes animadas (`Reveal`, el carrusel, el ranking en directo).
- **404 reales.** Un evento o perfil inexistente responde 200 con `noindex`. Con `notFound()` y una página `not-found.tsx` con el estilo de la app daría un 404 de verdad.
- **Consultas encadenadas en algunas rutas.** `/api/groups` vuelve a consultar las membresías y `/api/groups/[id]/feed` comprueba la membresía antes de lanzar la consulta del feed. Ambas se pueden juntar o hacer en paralelo.
- **Dashboard de grupo.** `/api/groups/[id]/dashboard` carga todas las sesiones de la historia del grupo y los juegos con todas sus columnas. Le vendría bien un `take` y un `select`.
