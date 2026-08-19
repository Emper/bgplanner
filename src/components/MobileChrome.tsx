"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NavProvider, TAB_ROOTS } from "@/lib/navigation";
import BottomNav, { shouldShowBottomNav } from "./BottomNav";
import SwipeBack from "./SwipeBack";
import { onAndroidBackButton } from "@/lib/native";

/**
 * Envoltorio de cliente que da a toda la app el comportamiento de aplicación
 * móvil: transiciones de navegación, gesto de retroceso, barra inferior y
 * botón físico de atrás en Android.
 *
 * Vive en el layout raíz para no tener que tocar las páginas una a una.
 */
export default function MobileChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // La clase en <body> reserva el hueco de la barra inferior y sube los
  // elementos flotantes (toasts, botones de acción) por encima de ella.
  useEffect(() => {
    document.body.classList.toggle("has-bottom-nav", shouldShowBottomNav(pathname));
  }, [pathname]);

  // Botón físico / gesto de atrás de Android. Sin esto, atrás cierra la app
  // desde cualquier pantalla y se siente roto.
  useEffect(
    () =>
      onAndroidBackButton((canGoBack) => {
        // Desde la raíz de una pestaña, atrás sale de la app en vez de saltar
        // a la pestaña anterior: devolver false deja que Capacitor la cierre.
        if (!canGoBack || TAB_ROOTS.includes(window.location.pathname)) {
          return false;
        }
        router.back();
        return true;
      }),
    [router]
  );

  return (
    <NavProvider>
      {children}
      <SwipeBack />
      <BottomNav />
    </NavProvider>
  );
}
