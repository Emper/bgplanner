"use client";

import { ConfirmProvider } from "./ConfirmDialog";
import { ToastProvider } from "./Toast";

/** Lo que cuelga del layout raíz para toda la app: avisos y confirmaciones. */
export default function UiProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
