"use client";

import { useEffect } from "react";

// Registra public/sw.js (pantalla sin conexión y notificaciones push). Va en
// el layout raíz para que esté en cualquier página por la que se entre.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
