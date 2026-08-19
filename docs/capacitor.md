# Cáscara nativa con Capacitor (iOS + Android)

Guía operativa para montar, compilar y firmar la app de BG Planner en el Mac.
El plan de producto y el calendario están en [app-movil.md](app-movil.md); esto es
solo el "cómo se hace".

**Estrategia**: el WebView carga la web remota (`https://bgplanner.app`), no una copia
empaquetada. La sesión es una cookie `httpOnly` / `sameSite: lax` de ese dominio, así que
al cargar el mismo origen el login funciona sin tocar nada de la autenticación.

---

## 1. Lo que ya está hecho en el repo

| Fichero | Qué es |
| --- | --- |
| `capacitor.config.ts` | Configuración de la cáscara: appId, web remota, splash, teclado, barra de estado |
| `capacitor-shell/index.html` | Cáscara local mínima (Capacitor exige un `index.html` en `webDir`) |
| `capacitor-shell/offline.html` | Pantalla de "sin conexión" a la que salta `server.errorPath` |
| `src/lib/native.ts` | Helpers de cliente (háptica, compartir, barra de estado, botón atrás) — no-ops en navegador |
| `src/app/.well-known/apple-app-site-association/route.ts` | Verificación de Universal Links de iOS |
| `src/app/.well-known/assetlinks.json/route.ts` | Verificación de App Links de Android |
| `package.json` | Capacitor 7.6.8 + plugins, ya instalados |

**Datos fijos, no se cambian**:

- `appId` / package name: `app.bgplanner` — **no se puede cambiar después de publicar**.
- `appName`: `BG Planner`.
- Editor en tiendas: Gyoza Studio.

---

## 2. Requisitos en el Mac

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Node | ≥ 20.0.0 (el proyecto va con 20.11.1) | CLI de Capacitor |
| Xcode | 16 o superior | Compilar iOS |
| Command Line Tools | `xcode-select --install` | — |
| CocoaPods | `sudo gem install cocoapods` o `brew install cocoapods` | Dependencias nativas de iOS |
| Android Studio | Ladybug o superior | Compilar Android |
| JDK 21 | El que trae Android Studio vale | Gradle |

Versiones mínimas de sistema que impone Capacitor 7: **iOS 14** y **Android 6.0 (API 23)**.

---

## 3. Crear los proyectos nativos (una sola vez)

Desde la raíz del repo, con las dependencias ya instaladas (`npm install`):

```bash
npx cap add ios
npx cap add android
```

Esto genera las carpetas `ios/` y `android/`. **Se versionan en git** (es lo normal en
Capacitor): contienen configuración que se edita a mano — iconos, capabilities, permisos,
ficheros de firma — y perderla obligaría a rehacerla en cada máquina. No están en
`.gitignore` a propósito. Lo que sí conviene ignorar, una vez creadas, son los artefactos
de compilación; los `.gitignore` que Capacitor deja dentro de cada carpeta ya lo cubren.

**No hay que ejecutar `npx cap add` desde Linux ni desde CI sin SDKs**: fallaría y dejaría
carpetas a medias.

---

## 4. El ciclo de trabajo del día a día

```bash
npx cap sync      # copia capacitor-shell/ + config + plugins a ios/ y android/
npx cap open ios      # abre Xcode
npx cap open android  # abre Android Studio
```

**`npx cap sync` hay que ejecutarlo siempre que**:

- se cambie `capacitor.config.ts`,
- se instale, actualice o quite un plugin de `@capacitor/*`,
- se toque algo de `capacitor-shell/` (la pantalla de offline).

Lo que **no** requiere sync: cambiar el código de la web. Como el WebView carga
`https://bgplanner.app`, un deploy a Vercel llega a la app instalada sin recompilar nada.
Ese es el gran beneficio de esta arquitectura — y también su límite: si un cambio de la web
necesita una cáscara más nueva (por ejemplo, un plugin nuevo), hay que publicar versión en
las tiendas.

### Probar contra el entorno local

Por defecto la app apunta a producción. Para trabajar contra `npm run dev`, cambia
temporalmente en `capacitor.config.ts`:

```ts
server: {
  url: "http://192.168.1.X:3000",  // IP de tu Mac en la red local, no localhost
  cleartext: true,                  // http necesita cleartext
  ...
}
```

`npx cap sync` y a correr. **Revertirlo antes de compilar cualquier build de tienda.**

---

## 5. Iconos y splash

Los assets fuente ya están en `public/icons/` (`icon-1024.png`, `icon-maskable-512.png`…).
Para generar todos los tamaños de ambas plataformas:

```bash
mkdir -p assets
cp public/icons/icon-1024.png assets/icon.png
# splash.png y splash-dark.png: 2732×2732, logo centrado sobre #151118
npx @capacitor/assets generate --iconBackgroundColor '#151118' \
                               --iconBackgroundColorDark '#151118' \
                               --splashBackgroundColor '#151118' \
                               --splashBackgroundColorDark '#151118'
```

Requisitos de las fuentes:

- `assets/icon.png` — 1024×1024, **sin canal alfa y sin esquinas redondeadas** (Apple lo
  rechaza si tiene transparencia; el redondeo lo aplica el sistema).
- `assets/splash.png` y `assets/splash-dark.png` — 2732×2732, con el logo dentro del
  círculo central seguro de ~1200 px, porque el recorte varía mucho entre dispositivos.

`@capacitor/assets` escribe directamente dentro de `ios/` y `android/`, así que hay que
tener los proyectos ya creados. Después, `npx cap sync`.

---

## 6. iOS: Xcode

`npx cap open ios` abre `ios/App/App.xcworkspace` (el *workspace*, nunca el `.xcodeproj`).

### Firma

1. Target **App** → pestaña **Signing & Capabilities**.
2. **Team**: la cuenta de organización de Gyoza Studio.
3. **Bundle Identifier**: `app.bgplanner` (debe coincidir con `appId`).
4. Deja **Automatically manage signing** activado; Xcode crea el perfil.

### Associated Domains (Universal Links)

1. **Signing & Capabilities** → **+ Capability** → **Associated Domains**.
2. Añadir estas dos entradas:
   - `applinks:bgplanner.app`
   - `webcredentials:bgplanner.app`
3. Durante el desarrollo, para saltarse la caché del CDN de Apple, puedes usar
   `applinks:bgplanner.app?mode=developer` con el modo desarrollador activado en
   Ajustes → Desarrollador del dispositivo. **Quítalo antes de subir a App Store.**
4. La capability tiene que estar también activada en el App ID dentro del portal de
   Apple Developer (Certificates, Identifiers & Profiles).

Para que esto funcione, `APPLE_TEAM_ID` debe estar puesta en Vercel (ver sección 8) y
`https://bgplanner.app/.well-known/apple-app-site-association` debe devolver 200 con
`Content-Type: application/json` y **sin redirecciones** (ni `www`, ni barra final).

### Capabilities y permisos adicionales

- **Push Notifications** → + Capability (requiere clave APNs en Apple Developer).
- **Background Modes** → *Remote notifications*, solo si se usan push silenciosas.
- `Info.plist`, textos en español porque los ve el usuario en el diálogo del sistema:
  - `NSCameraUsageDescription` — "BG Planner usa la cámara para que puedas añadir fotos a las galerías de tus grupos y eventos."
  - `NSPhotoLibraryUsageDescription` — "BG Planner accede a tus fotos para que puedas subir imágenes de tus partidas."
  - `NSPhotoLibraryAddUsageDescription` — "BG Planner guarda en tu carrete las fotos que descargues de las galerías."
- Si no se declaran, la app **crashea** al usar la cámara y App Review la rechaza.

### Compilar y subir

- Dispositivo de destino: **Any iOS Device (arm64)**.
- **Product → Archive** → **Distribute App** → **App Store Connect**.
- Subir versión de prueba a **TestFlight** antes de mandar a revisión.

---

## 7. Android: Android Studio

`npx cap open android`.

### ⚠️ Nivel de API objetivo — obligatorio antes de publicar

Capacitor 7 genera `android/variables.gradle` con `compileSdkVersion = 35` y
`targetSdkVersion = 35`. **Google Play exige API 36 para apps nuevas a partir del 31 de
agosto de 2026.** Hay que editar ese fichero:

```groovy
ext {
    minSdkVersion = 23
    compileSdkVersion = 36
    targetSdkVersion = 36
    ...
}
```

y después `npx cap sync android`. Comprueba que compila y que la app arranca: subir el
`targetSdk` activa comportamientos nuevos del sistema (sobre todo *edge to edge*, que puede
requerir ajustar las áreas seguras del CSS).

La alternativa es subir a **Capacitor 8**, que ya trae `minSdk 24` / `SDK 36` de fábrica,
pero su CLI **exige Node ≥ 22** y el proyecto está fijado a Node 20.11.1 por Prisma 5
(ver CLAUDE.md). Si algún día se sube el Node, migrar a Capacitor 8 es la opción limpia.

### Firma

1. **Build → Generate Signed Bundle / APK → Android App Bundle**.
2. Crear el keystore la primera vez (`bgplanner-upload.jks`). **Ese fichero y sus
   contraseñas no van a git jamás**: guardarlos en el gestor de contraseñas de Gyoza. Si se
   pierde el keystore de subida se puede pedir reseteo a Google, pero es un incordio.
3. Configurar la firma en `android/app/build.gradle` con un `keystore.properties` local
   ignorado por git, para no meter credenciales en el repo.
4. Activar **Play App Signing** en Play Console (es lo predeterminado en cuentas nuevas).

### App Links

Android verifica `https://bgplanner.app/.well-known/assetlinks.json` al instalar. Con
**Play App Signing** hay **dos** huellas SHA-256 que declarar:

- la del certificado de subida (upload key),
- la que genera Google (Play Console → Configuración → Integridad de la aplicación →
  Firma de apps → *Certificado de firma de la app*).

Sácalas así y mételas separadas por comas en `ANDROID_CERT_SHA256`:

```bash
keytool -list -v -keystore bgplanner-upload.jks -alias bgplanner | grep SHA256
```

Verificación en un dispositivo con la app instalada:

```bash
adb shell pm get-app-links app.bgplanner
```

Debe decir `verified` para `bgplanner.app`.

### Push

Requiere `google-services.json` de Firebase colocado en `android/app/`. Ese fichero no
lleva secretos, se puede versionar.

---

## 8. Variables de entorno pendientes

Hay que añadirlas en **Vercel → Settings → Environment Variables** (Production) y también
en `.env.local` si se quieren probar en desarrollo. Están documentadas en `.env.example`.

| Variable | De dónde sale | Sin ella |
| --- | --- | --- |
| `APPLE_TEAM_ID` | App Store Connect → Membership details → Team ID (10 caracteres) | `/.well-known/apple-app-site-association` responde **503** y los Universal Links no funcionan |
| `ANDROID_CERT_SHA256` | `keytool -list -v` sobre el keystore + Play Console (dos huellas, separadas por comas) | `/.well-known/assetlinks.json` responde **503** y los App Links no funcionan |

Se leen en cada petición (`dynamic = "force-dynamic"`), así que basta con añadirlas y
redesplegar; no hace falta tocar código.

Rutas capturadas por la app (definidas en el route handler del AASA): `/groups/*`,
`/events/*`, `/join/*`, `/join-event/*`, `/invite/*`, `/profile*`. Cualquier otra URL del
dominio se abre en el navegador, que es lo que queremos.

---

## 9. Cosas que romperían la sesión — no tocar

- **`CapacitorHttp` debe seguir desactivado.** Si se activa, `fetch` y `XMLHttpRequest`
  pasan por la capa nativa y dejan de enviar las cookies del WebView: adiós login.
- **`server.url` debe apuntar exactamente a `https://bgplanner.app`**, sin `www` y sin
  redirección intermedia. Un salto a otro origen tira la cookie.
- **No empaquetar la web** (`webDir` con el `out/` de Next) sin migrar antes la
  autenticación a `Authorization: Bearer`: el origen pasaría a ser `capacitor://localhost`
  y la cookie dejaría de viajar.
- **`allowNavigation` solo con el propio dominio.** Añadir ahí BoardGameGeek o similares
  metería webs de terceros dentro de la app, que es motivo de rechazo (Apple 4.2).

---

## 10. Checklist antes de mandar a revisión

- [ ] `npx cap sync` ejecutado tras el último cambio de config
- [ ] `server.url` apuntando a producción (no a la IP local)
- [ ] `targetSdkVersion = 36` en `android/variables.gradle`
- [ ] `APPLE_TEAM_ID` y `ANDROID_CERT_SHA256` puestas en Vercel y ambas rutas devolviendo 200
- [ ] Textos de permiso de cámara y fotos en `Info.plist`
- [ ] Modo `?mode=developer` quitado de los Associated Domains
- [ ] Iconos y splash regenerados
- [ ] Bloqueantes de tienda de [app-movil.md](app-movil.md) §5 resueltos: borrado de cuenta,
      moderación de contenido, páginas legales
