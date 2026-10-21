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

**Alternativa intermedia: hecha (octubre 2026).** El cliente de Prisma devuelve avatares y carteles como URL de `/api/img/...` (caché inmutable) en toda la app: el feed bajó de 168 a 6 KB, la lista de grupos de 229 a 6 KB y la de eventos de 480 a 3 KB. Queda la migración de verdad a Storage si algún día hace falta (las filas siguen guardando el base64 y se leen enteras en el servidor).

**Ojo.** Durante la migración convivirán filas con data URL y con URL de Storage, así que el código tiene que aceptar las dos. Hay que plantear el plan completo y la ventana de incompatibilidad antes de ejecutar nada.

---

## 2. Miniaturas para las galerías de fotos

**Tipo:** rendimiento · **Impacto:** alto en galerías · **Esfuerzo:** medio · **Toca BD:** probablemente (campo de miniatura)

**Problema.** Las cuadrículas de `EventGallery.tsx` y `GroupGallery.tsx` muestran celdas de unos 160 px, pero descargan la foto original de 1600 px (300-500 KB cada una), porque las imágenes llevan `unoptimized`.

**Propuesta.** Generar una miniatura de unos 400 px al subir la foto. Se guarda junto a la original (p. ej. `thumbUrl` en el modelo de foto, o una ruta con convención `…/thumb/…`). La cuadrícula usa la miniatura y el visor a pantalla completa, la original.

**Por qué no quitar `unoptimized` sin más.** Funcionaría, pero cada imagen pasaría por la optimización de Vercel, que tiene cupo según el plan. Si además se quita en las carátulas de BGG (feed, ranking, portada, roadmap), el volumen de imágenes distintas puede agotar ese cupo. Antes de tocarlo, revisar el plan de Vercel o usar las transformaciones de Supabase Storage (requieren plan Pro).

---

## 3. Cargar los datos iniciales en el servidor (hecho en inicio, grupo y evento)

**Hecho (octubre 2026).** El inicio, la ficha de grupo y la de evento (con sesión) piden sus datos en el servidor con Suspense: cabecera y loader al instante, y los datos en la misma respuesta. La lógica vive en `src/lib` (`homeData`, `groupDashboard`, `groupFeed`, `eventDetail`, `eventFeed`…) y las rutas de la API son envoltorios para los refrescos. Las pestañas cambian la URL con `history` para no volver a pintar en el servidor.

**Queda.** Otras páginas de cliente siguen pidiendo al arrancar: lista de grupos, Mi colección, notificaciones, perfil (edición) y admin. Mismo patrón si se nota.

## 4. Decidir si los perfiles públicos van al sitemap

**Tipo:** SEO / producto · **Impacto:** medio · **Esfuerzo:** bajo · **Toca BD:** no (o un campo si se hace opcional)

**Situación.** Los perfiles `/users/<slug>` ya son públicos e indexables (canonical, tarjeta para compartir), pero no están en `src/app/sitemap.ts`. La única página pública que enlaza a ellos es la Comunidad (autor de cada hilo y respuesta), y lo hace con `rel="nofollow"` y sin la URL del perfil en los datos estructurados del hilo, para no adelantar esta decisión. En la práctica Google solo los encuentra si alguien comparte el enlace.

**Decisión pendiente.** Incluirlos en el sitemap supone empujar activamente a todos los usuarios a los buscadores. Opciones:
- No incluirlos (estado actual).
- Incluirlos todos.
- Añadir una opción en el perfil («Que mi perfil aparezca en buscadores»), incluir solo a quien la active y poner `noindex` al resto. Necesita un campo nuevo en `User`.

Si se decide indexarlos, quitar el `nofollow` de `AuthorLink` (`src/components/CommunityBits.tsx`) y añadir `author.url` en el JSON-LD del hilo (`src/app/community/[id]/page.tsx`).

---

## Otros puntos menores detectados

- **Portada como componente de servidor.** `Landing.tsx` y `mockups.tsx` (unos 80 KB) son enteros de cliente. Bastaría con dejar en cliente solo las partes animadas (`Reveal`, el carrusel, el ranking en directo).
- **Feed del grupo en dos pasos.** `/api/groups/[id]/feed` comprueba la membresía antes de lanzar la consulta del feed; se pueden hacer en paralelo.
- **Dashboard de grupo.** `/api/groups/[id]/dashboard` carga todas las sesiones (`GameNight`) de la historia del grupo y los juegos con todas sus columnas. Le vendría bien un `take` y un `select`.

---

## 5. Partir los ficheros gigantes (fase 3 de la auditoría de octubre 2026)

**Tipo:** mantenibilidad · **Impacto:** alto · **Esfuerzo:** alto · **Toca BD:** no

Las fases 0, 1, 2 y 4 de la auditoría (seguridad, kit de UI en `src/components/ui`, helpers en `src/lib` y limpieza) están hechas. Queda la 3, que ya se puede hacer apoyándose en el kit:
- `GroupClient.tsx` (~2.500 líneas): pestañas, fila del ranking, modales de convocatoria y de borrar, y hooks (`useGroupVoting`, `useFrozenRanking`).
- `EventClient.tsx` (~1.900): pestañas a ficheros propios y un `EventForm` compartido con `events/new` (85 % de código repetido).
- «Añadir juegos» sobre `CollectionBrowser` con una acción «Añadir» por juego; sobraría `api/bgg/collection/[username]`.
- `profile/page.tsx` y `ThreadClient.tsx` (formulario de hilo compartido con `CommunityClient`).
- Galerías de grupo y evento: `usePhotoGallery`, `PhotoGrid` y `Lightbox` comunes, y lo mismo en sus rutas de API.
- `useActivityFeed` compartido por grupo, evento e inicio.
- Invitaciones (`join`, `join-event`, `invite`) pintadas en servidor: su layout ya carga los datos.
