/**
 * Puente con la cáscara nativa (Capacitor).
 *
 * Reglas de la casa:
 * - Este módulo es SOLO de cliente. No lo importes desde un Server Component ni
 *   desde un route handler.
 * - Nada de aquí puede romper en el navegador: cuando no estamos dentro de la app
 *   nativa, todo degrada a un no-op o a la alternativa web equivalente.
 * - Los plugins se cargan con `await import(...)` **dentro** de cada función, no
 *   arriba del fichero. Así el navegador nunca descarga el código de los plugins
 *   que no va a usar y el bundle de la web no engorda.
 *
 * La app carga la web remota (https://bgplanner.app) dentro del WebView, así que el
 * MISMO código corre en navegador y en app: de ahí que todo tenga que ramificar.
 */

import { Capacitor } from "@capacitor/core";

export type Platform = "ios" | "android" | "web";

/** ¿Estamos dentro de la app nativa (iOS/Android) y no en un navegador? */
export function isNative(): boolean {
  // Durante el render en servidor no hay ningún Capacitor: siempre web.
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

/** Plataforma actual. En SSR y en navegador devuelve "web". */
export function getPlatform(): Platform {
  if (typeof window === "undefined") return "web";
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
}

export function isIOS(): boolean {
  return getPlatform() === "ios";
}

export function isAndroid(): boolean {
  return getPlatform() === "android";
}

/* ── Háptica ──────────────────────────────────────────────────────────────
 * Vibración corta de respuesta al tacto. En web no hace nada (la Vibration API
 * no existe en iOS y en Android da un zumbido tosco que no se parece en nada).
 */

/** Intensidad del golpe. "light" para toques, "medium" para acciones, "heavy" para el super voto. */
export type HapticStyle = "light" | "medium" | "heavy";

/** Golpecito. Úsalo al votar, al confirmar asistencia, al soltar un pull-to-refresh. */
export async function haptic(style: HapticStyle = "light"): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    } as const;
    await Haptics.impact({ style: map[style] });
  } catch {
    // Un fallo de háptica jamás debe cortar la interacción del usuario.
  }
}

/** Vibración de resultado: verde, aviso o error. Para toasts de éxito/fallo. */
export async function hapticNotification(
  type: "success" | "warning" | "error" = "success"
): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    const map = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    } as const;
    await Haptics.notification({ type: map[type] });
  } catch {
    /* no-op */
  }
}

/** Tic seco de selección: recorrer una lista, cambiar de pestaña. */
export async function hapticSelection(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch {
    /* no-op */
  }
}

/* ── Compartir ────────────────────────────────────────────────────────── */

export type ShareInput = {
  /** Asunto (email) o título del contenido. */
  title?: string;
  /** Texto del mensaje. */
  text?: string;
  /** Enlace a compartir. */
  url?: string;
  /** Título del propio diálogo del sistema (solo Android). */
  dialogTitle?: string;
};

/**
 * Abre la hoja de compartir del sistema.
 *
 * Cascada: plugin nativo → Web Share API (móviles y Safari) → `false`.
 * Devuelve `true` si se ha abierto algún diálogo y `false` si no había ninguna vía,
 * para que quien llama pueda caer en el "copiar enlace" de toda la vida.
 */
export async function share(input: ShareInput): Promise<boolean> {
  if (isNative()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share(input);
      return true;
    } catch {
      // Incluye el caso de que el usuario cancele la hoja: no es un error real,
      // pero tampoco hace falta ofrecerle el fallback.
      return true;
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: input.title,
        text: input.text,
        url: input.url,
      });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/* ── Barra de estado ──────────────────────────────────────────────────── */

/**
 * Ajusta el color del texto de la barra de estado al tema de la app.
 * Llámalo desde el toggle de tema: `setStatusBarTheme(isDark ? "dark" : "light")`.
 *
 * Ojo con la nomenclatura de Capacitor: `Style.Dark` significa "texto claro sobre
 * fondo oscuro", así que el tema oscuro de la app usa Style.Dark. Aquí se recibe el
 * tema de la app y se traduce, para no tener que recordarlo en cada llamada.
 */
export async function setStatusBarTheme(theme: "light" | "dark"): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({
      style: theme === "dark" ? Style.Dark : Style.Light,
    });
    if (isAndroid()) {
      // En iOS el color de fondo no se puede tocar; en Android sí.
      await StatusBar.setBackgroundColor({
        color: theme === "dark" ? "#151118" : "#faf8f5",
      });
    }
  } catch {
    /* no-op */
  }
}

/* ── Splash ───────────────────────────────────────────────────────────── */

/**
 * Oculta el splash nativo. La configuración ya lo esconde sola a los 600 ms, pero
 * conviene llamarlo cuando la primera pantalla real esté pintada para que no se vea
 * un parpadeo si la red va lenta.
 */
export async function hideSplash(): Promise<void> {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* no-op */
  }
}

/* ── Enlaces externos ─────────────────────────────────────────────────── */

/**
 * Abre una URL de fuera del dominio (BoardGameGeek, por ejemplo).
 * En nativo usa el navegador in-app (SFSafariViewController / Custom Tabs), que
 * mantiene al usuario dentro de la app y permite volver con un gesto.
 * En web, pestaña nueva de toda la vida.
 */
export async function openExternal(url: string): Promise<void> {
  if (!isNative()) {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return;
  }
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, presentationStyle: "popover" });
  } catch {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
}

/* ── Botón atrás de Android ───────────────────────────────────────────── */

/**
 * Registra un manejador para el botón físico de atrás de Android.
 * Devuelve una función para darse de baja (úsala en el cleanup del useEffect).
 * En iOS y en web no hace nada y devuelve un no-op.
 *
 * El manejador recibe `canGoBack` (si el WebView tiene historial); si devuelve
 * `true` se considera gestionado y la app NO se cierra.
 */
export function onAndroidBackButton(
  handler: (canGoBack: boolean) => boolean | Promise<boolean>
): () => void {
  if (!isNative() || !isAndroid()) return () => {};

  let remove: (() => void) | null = null;
  let cancelled = false;

  (async () => {
    try {
      const { App } = await import("@capacitor/app");
      const listener = await App.addListener("backButton", async ({ canGoBack }) => {
        const handled = await handler(canGoBack);
        if (!handled) {
          await App.exitApp();
        }
      });
      if (cancelled) {
        await listener.remove();
      } else {
        remove = () => {
          void listener.remove();
        };
      }
    } catch {
      /* no-op */
    }
  })();

  return () => {
    cancelled = true;
    remove?.();
  };
}
