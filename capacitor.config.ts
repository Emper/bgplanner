import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

/**
 * Configuración de la cáscara nativa (iOS + Android).
 *
 * Estrategia: **web remota**. El WebView carga directamente https://bgplanner.app
 * en lugar de servir los assets desde el binario. Motivo: la sesión es una cookie
 * httpOnly con sameSite "lax" emitida por ese dominio (ver `sessionCookieOptions`
 * en src/lib/auth.ts). Si el WebView carga el mismo origen, la cookie viaja igual
 * que en el navegador y el login funciona sin tocar la autenticación.
 *
 * Contrapartida: sin red la app no arranca; por eso `server.errorPath` apunta a una
 * pantalla local de fallback (capacitor-shell/offline.html) que sí va empaquetada.
 *
 * Tras CUALQUIER cambio en este fichero hay que ejecutar `npx cap sync` en el Mac
 * para que se copie a los proyectos nativos. Ver docs/capacitor.md.
 */
const config: CapacitorConfig = {
  // Identificador de paquete. NO se puede cambiar una vez publicado en las tiendas.
  appId: "app.bgplanner",
  // Nombre que se ve bajo el icono y en las fichas de tienda.
  appName: "BG Planner",

  /**
   * Carpeta con los assets locales que se empaquetan en el binario. Con web remota
   * solo contiene la cáscara mínima (index.html + offline.html), pero Capacitor
   * exige que exista y tenga un index.html.
   */
  webDir: "capacitor-shell",

  // Color de fondo del WebView: evita el flash blanco entre splash y primera pintura.
  backgroundColor: "#151118",

  // Sin zoom por pellizco: es una app, no una página. (Es el valor por defecto,
  // se deja explícito para que no dependa de la versión de Capacitor.)
  zoomEnabled: false,

  server: {
    // Origen remoto. Todo lo que se navegue dentro de este host se queda en el WebView.
    url: "https://bgplanner.app",

    // Solo HTTPS: nada de http:// dentro del WebView (Apple ATS y Android lo exigen).
    cleartext: false,

    /**
     * Fallback sin conexión. Cuando la carga de `server.url` falla (avión, túnel,
     * caída del servidor), el WebView redirige a este fichero LOCAL, relativo a
     * `webDir`. Sin esto el usuario vería la pantalla de error genérica del sistema.
     */
    errorPath: "offline.html",

    // Esquema del bridge en Android para los assets locales (el fallback offline).
    androidScheme: "https",

    /**
     * Hosts que se permiten navegar DENTRO del WebView. Solo el propio dominio:
     * cualquier otro enlace (BoardGameGeek, redes sociales, mailto…) se abre en el
     * navegador del sistema, que es el comportamiento correcto y además evita el
     * rechazo por directriz 4.2 de Apple.
     */
    allowNavigation: ["bgplanner.app", "www.bgplanner.app"],
  },

  ios: {
    /**
     * `never` deja que el WebView ocupe la pantalla completa y que sea el CSS de la
     * web quien gestione las zonas seguras con env(safe-area-inset-*) y
     * viewportFit: "cover". Si se pusiera "always" iOS metería un padding propio que
     * se sumaría al del CSS y dejaría una franja muerta bajo la barra de estado.
     */
    contentInset: "never",

    // La vista es scrollable (lo contrario rompería el scroll de toda la app).
    // El rebote elástico NO tiene interruptor en la config de Capacitor: se controla
    // desde el CSS de la web con `overscroll-behavior-y: none` en body (globals.css).
    scrollEnabled: true,

    // Sin la previsualización 3D-touch al mantener pulsado un enlace.
    allowsLinkPreview: false,
  },

  android: {
    // Mismo fondo que el WebView para el arranque en frío.
    backgroundColor: "#151118",
    // Sin contenido mixto: todo por HTTPS también en Android.
    allowMixedContent: false,
    zoomEnabled: false,
  },

  plugins: {
    /**
     * Splash: fondo plano del tema oscuro de la app, sin spinner y sin fundido largo.
     * Con web remota el arranque depende de la red, así que se oculta pronto y es la
     * propia web quien enseña su loader.
     */
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      launchFadeOutDuration: 150, // Android 12+; nada de fundidos de segundos
      backgroundColor: "#151118ff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
      useDialog: false,
    },

    /**
     * Barra de estado con estilo por defecto: el texto se adapta solo a la apariencia
     * del dispositivo (claro/oscuro). Si más adelante el tema de la app deja de seguir
     * al del sistema, se cambia en caliente con `setStatusBarStyle()` de src/lib/native.ts.
     * `overlaysWebView: false` reserva el hueco de la barra en Android en lugar de
     * pintar la web por debajo.
     */
    StatusBar: {
      style: "DEFAULT",
      backgroundColor: "#151118",
      overlaysWebView: false,
    },

    /**
     * Teclado en modo `native`: el WebView entero se redimensiona al abrirse el teclado,
     * así las unidades vh y los elementos `fixed` (barra inferior, toasts) se recolocan
     * solos y no quedan tapados.
     */
    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true, // Android: workaround para pantalla completa
    },

    /**
     * IMPORTANTE: dejar CapacitorHttp desactivado. Si se activa, fetch/XMLHttpRequest
     * pasan por la capa nativa y se pierden las cookies del WebView — es decir, se
     * rompe la sesión, que es justo lo que esta arquitectura busca conservar.
     */
    CapacitorHttp: {
      enabled: false,
    },

    // Cómo se muestran las push con la app en primer plano (iOS).
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
