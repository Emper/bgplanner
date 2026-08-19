"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNative, getPlatform } from "@/lib/native";

/**
 * Registro del dispositivo para las notificaciones push.
 *
 * Solo hace algo dentro de la app nativa: en el navegador se sale a la primera
 * línea y no descarga ni el plugin. Corre una vez por sesión de la app (va
 * montado en el chrome del layout, que no se desmonta al navegar).
 *
 * Qué hace, por orden:
 *   1. Pide permiso de notificaciones (en iOS sale el diálogo del sistema; en
 *      Android 12 y anteriores se concede solo).
 *   2. Llama a `register()`, que dispara el evento "registration" con el token
 *      de FCM/APNs, y lo guarda en /api/notifications/devices.
 *   3. Al tocar una notificación, navega a la ruta que venga en `data.url`
 *      (la ponen los emisores: /groups/xxx, /events/xxx…).
 *
 * Nada de esto puede romper la app: si el permiso se deniega o el plugin falla,
 * se queda sin push y ya está.
 */
export default function PushRegistrar() {
  const router = useRouter();

  useEffect(() => {
    if (!isNative()) return;

    let cancelled = false;
    const cleanups: (() => void)[] = [];

    (async () => {
      try {
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );

        // Solo pedimos permiso si aún no hay respuesta: volver a preguntar en
        // cada arranque cuando ya dijeron que no es de mala educación.
        let status = await PushNotifications.checkPermissions();
        if (status.receive === "prompt" || status.receive === "prompt-with-rationale") {
          status = await PushNotifications.requestPermissions();
        }
        if (status.receive !== "granted" || cancelled) return;

        // El token llega de forma asíncrona por este evento, no como retorno
        // de register(): hay que suscribirse ANTES de llamar.
        const onRegistration = await PushNotifications.addListener(
          "registration",
          (token) => {
            void fetch("/api/notifications/devices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                token: token.value,
                platform: getPlatform(),
              }),
            }).catch(() => {});
          }
        );
        cleanups.push(() => void onRegistration.remove());

        const onError = await PushNotifications.addListener(
          "registrationError",
          (err) => {
            console.warn("[push] Registro fallido:", err);
          }
        );
        cleanups.push(() => void onError.remove());

        // Toque sobre la notificación: la llevamos a la pantalla que toque.
        const onAction = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            const data = action.notification?.data as
              | Record<string, unknown>
              | undefined;
            const url = typeof data?.url === "string" ? data.url : null;
            // Solo rutas internas: un "url" externo en el payload no debe poder
            // sacar al usuario de la app.
            if (url && url.startsWith("/")) {
              router.push(url);
            }
          }
        );
        cleanups.push(() => void onAction.remove());

        if (cancelled) return;
        await PushNotifications.register();
      } catch (err) {
        console.warn("[push] No se pudo inicializar:", err);
      }
    })();

    return () => {
      cancelled = true;
      for (const remove of cleanups) remove();
    };
  }, [router]);

  return null;
}
