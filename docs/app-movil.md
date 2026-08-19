# BG Planner como app móvil (iOS + Android)

Plan de trabajo para publicar BG Planner en App Store y Google Play. Documento vivo:
según se cierren decisiones y fases, actualizarlo aquí.

---

## 1. Empaquetado: Capacitor cargando la web remota

| Opción | Coste | Veredicto |
| --- | --- | --- |
| PWA instalable | 1–2 días | Complemento, no sustituto (sin tiendas) |
| **Capacitor + web remota (`server.url = https://bgplanner.app`)** | 2–3 semanas | **Elegida** |
| Capacitor + web empaquetada (assets locales + API por CORS) | 6–8 semanas | Más adelante, si hace falta offline |
| React Native / Expo | 4–6 meses | Descartada |

**Razón técnica de la elección**: la sesión es una cookie `httpOnly` con `sameSite: lax`
sobre `bgplanner.app` (ver `sessionCookieOptions` en `src/lib/auth.ts`). Si el WebView
carga ese mismo origen, el login funciona sin tocar nada. Empaquetar la web dentro del
binario cambia el origen a `capacitor://localhost`, la cookie deja de viajar y habría que
migrar a `Authorization: Bearer` + almacenamiento seguro + CORS en ~60 rutas de API.

Contrapartidas asumidas: sin conexión la app no arranca (mitigado con `server.errorPath`
apuntando a una pantalla local) y el arranque en frío depende de la red.

**Riesgo**: directriz 4.2 de Apple (apps que son "solo la web en un contenedor"). Se
neutraliza con las capacidades nativas de la sección 4 y la navegación de la sección 3.

---

## 2. Que se sienta una app

### Swipe back

El gesto nativo de WKWebView (`allowsBackForwardNavigationGestures`) se puede activar,
pero solo anima bien con cargas de página completas. El App Router navega con `pushState`
dentro del mismo documento, así que el gesto nativo retrocede sin animación y de forma
inconsistente. **Se implementa en la capa web** (y así vale igual para Android):

- Proveedor `<SwipeBack>`: `touchstart` en la franja de 24 px del borde izquierdo,
  confirmar intención horizontal (`dx > dy`), arrastrar con `transform: translateX()`
  sobre fondo sólido.
- Umbral: 35 % del ancho o velocidad > 0,5 px/ms → `router.back()`. Si no, muelle de vuelta.
- Zonas excluidas con `data-no-swipe`: barras de pestañas con `overflow-x-auto`, carrusel
  de galería, modales abiertos.
- View Transitions API para el parallax de la página entrante (ya se usa `::view-transition`
  para el cambio de tema en `globals.css`). iOS 18+ y Android moderno; en versiones
  anteriores el gesto funciona sin parallax.
- `useNav()` marca `document.documentElement.dataset.nav = "push" | "pop"` para animar
  distinto ida y vuelta.

### Botón atrás de Android

`App.addListener("backButton")` → `router.back()`; en la raíz de cada pestaña, salir de la app.

### Checklist de detalles

- [ ] `export const viewport` en `layout.tsx` con `viewportFit: "cover"` y `themeColor`
      por tema (hoy no existe ninguno).
- [ ] `env(safe-area-inset-*)` en navbar, modales y toasts. Los toasts `fixed bottom-6`
      de `groups/[id]/page.tsx` caen sobre el indicador de inicio.
- [ ] `overscroll-behavior-y: contain` + bounce del WebView desactivado.
- [ ] `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`,
      `-webkit-touch-callout: none`.
- [ ] Inputs a 16 px mínimo (evita el zoom automático de iOS sin bloquear el zoom).
- [ ] Plugin Keyboard + `scrollIntoView` al enfocar.
- [ ] Zonas de toque ≥ 44 px (auditar botones de voto y menús kebab del ranking).
- [ ] Pull to refresh propio, con háptica al soltar.
- [ ] Esqueletos en lugar de `PageLoader`; voto optimista.
- [x] Estados `hover:` pegados al tocar — ya cubierto: Tailwind v4 restringe `hover:` a
      dispositivos con puntero.

---

## 3. Navegación y orden de la interfaz

**Problema actual**: en móvil la barra superior esconde Perfil, tema y logout tras una
hamburguesa; dentro de un grupo hay 5 pestañas en scroll horizontal y en eventos esas
pestañas **no son URLs** (en grupos sí, vía `?tab=`), así que retroceder te saca del grupo.

- **Barra inferior**: Inicio · Grupos · Eventos · Perfil. Se retira la hamburguesa en móvil.
  Pila de navegación propia por pestaña.
- **Pantalla de Inicio** (no existe hoy): qué se juega próximamente, a quién le falta votar,
  qué ha pasado desde la última vez. Acciones directas en la tarjeta.
- **Pestañas como rutas reales**: `/groups/[id]/juegos`, `/sesiones`, `/actividad`,
  `/galeria`, `/miembros`; ídem en eventos. Habilita swipe back entre pestañas, enlaces
  profundos y trocear las 2.810 líneas de `groups/[id]/page.tsx`.
- **Reorden del grupo**: Juegos → Sesiones → Actividad → Galería → Miembros. Pestaña por
  defecto: Juegos si hay votos pendientes, Actividad si no.
- **Modo votación por deslizamiento**: carta a pantalla completa, derecha 👍 / izquierda 👎 /
  arriba ⭐ super voto, háptica distinta por gesto, aviso de "1 super voto por grupo"
  resuelto en el sitio.
- Modales → hojas inferiores con arrastre para cerrar (el patrón `fixed inset-0 …
  items-center` queda para escritorio).
- Menús kebab → deslizar la fila; pulsación larga para menú contextual.
- Botón flotante contextual (grupo: "Añadir juegos"; eventos: "Nuevo evento").
- Buscador BGG a pantalla completa con teclado abierto.
- Deslizar horizontalmente entre pestañas.

---

## 4. Capacidades nativas

| Capacidad | Uso en BG Planner | Trabajo de servidor |
| --- | --- | --- |
| Push | Convocatoria (hoy email), nueva sesión, voto en tu juego, recordatorio 24 h, fotos nuevas | Modelo `DeviceToken`, ruta de registro, servicio de envío, Firebase + clave APNs |
| Enlaces universales | `/join/[code]`, `/invite/[token]`, `/join-event/[code]` abren la app | Servir `/.well-known/apple-app-site-association` y `assetlinks.json` |
| Cámara / carrete nativos | Galerías de grupo y evento, con compresión previa | Ninguno (ya hay Supabase Storage) |
| Añadir al calendario | Sesiones y eventos al calendario del móvil | Ninguno |
| Compartir del sistema | Sustituye al "copiar enlace" de invitaciones | Ninguno |
| Háptica | Voto, super voto, confirmar asistencia | Ninguno |
| Actualización forzada | Avisar cuando la web requiera cáscara más nueva | `/api/app/version` |

---

## 5. Bloqueantes de tienda

Verificados contra el repo. Impiden la aprobación, no la retrasan.

1. **Borrado de cuenta dentro de la app** — Apple 5.1.1(v). `/api/profile` solo tiene
   `GET`, `PUT`, `PATCH`. Falta `DELETE` + pantalla, y decidir qué pasa con votos,
   sesiones, fotos y `ActivityLog` de esa persona.
2. **Moderación de contenido de usuario** — Apple 1.2. Galerías, reseñas y comentarios son
   UGC: hacen falta denunciar contenido, bloquear usuario y términos con tolerancia cero
   aceptados al registrarse. No hay nada de esto.
3. **Páginas legales** — solo existe `/contact`. Faltan `/privacidad` y `/terminos`, y
   declarar datos recogidos: email, fotos, contenido de usuario, analítica.

### Trámites

| Concepto | App Store | Google Play |
| --- | --- | --- |
| Alta | 99 €/año | 25 $ una vez |
| Entorno | Mac con Xcode (o CI con runners macOS) | Cualquier equipo |
| Icono | 1024×1024 PNG sin alpha | 512×512 + portada 1024×500 |
| Capturas | iPhone 6.9" y 6.5" (declarar solo iPhone evita las de iPad) | Teléfono, mín. 2 |
| Formulario | Etiquetas de privacidad | Seguridad de los datos |
| Login con Apple | No aplica (OTP por email, sin proveedores externos) | — |
| Revisión | 1–3 días | 1–7 días |

**Aviso**: las cuentas **personales** nuevas de Google Play exigen prueba cerrada con
≥ 12 testers durante 14 días seguidos antes de producción. Las cuentas de organización
están exentas.

---

## 6. Fases

| Fase | Contenido | Esfuerzo |
| --- | --- | --- |
| 0 | Preparar la web para el dedo: viewport, áreas seguras, manifest e iconos, toques, esqueletos | 3–4 días |
| 1 | Navegación móvil: barra inferior, Inicio, pestañas como rutas, swipe back, hojas inferiores, pull to refresh, modo votación | 1,5–2 semanas |
| 2 | Cáscara Capacitor: proyectos iOS/Android, origen remoto + fallback offline, splash, barra de estado, teclado, botón atrás | 3–4 días |
| 3 | Capacidades nativas: push de punta a punta, enlaces universales, cámara, compartir, calendario, háptica | 1,5–2 semanas |
| 4 | Cumplimiento: borrado de cuenta, denunciar/bloquear, legales, actualización forzada | 4–5 días |
| 5 | Publicación: fichas, capturas, TestFlight, prueba cerrada de Play, revisión | 1 semana + revisión |

**Total: 6–8 semanas de trabajo efectivo**, más los 14 días de prueba cerrada de Play si la
cuenta es personal. Las fases 0 y 1 se prueban enteras en el navegador y se despliegan a la
web tal cual, sin depender de tiendas ni de un Mac.

---

## 7. Decisiones pendientes

- [ ] ¿Mac con Xcode disponible? Si no: Mac en la nube o CI con runners macOS. Determina si
      arrancamos por Android.
- [ ] ¿Publicar como persona o como Gyoza Studio? En Play decide si aplican los 14 días de
      prueba cerrada; en Apple, cuenta de empresa pide D-U-N-S.
- [ ] Nombre en tiendas e identificador de paquete (propuesta: "BG Planner" / `app.bgplanner`;
      el identificador no se puede cambiar después).
- [ ] Icono 1024 px y fondo del splash por tema (hoy solo hay `logo.svg` y `favicon.svg`).
- [ ] Quién redacta privacidad y términos.
- [ ] Vía libre para trocear `groups/[id]/page.tsx` en rutas por pestaña.
- [ ] ¿Push sustituye al email o convive? Propuesta: push si hay app instalada, email si no;
      requiere preferencia por usuario.
- [ ] ¿Las dos tiendas a la vez o Android primero?
