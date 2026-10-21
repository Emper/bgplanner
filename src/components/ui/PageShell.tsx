import Footer from "@/components/Footer";

// El esqueleto de una página: cabecera, contenido con su ancho y pie. En
// columna flexible, así el pie queda abajo del todo si hay poco contenido y
// justo después si hay mucho (antes cada página lo resolvía a su manera).
//
// Anchos (ver globals.css): wide (Inicio, ludoteca), main (secciones y sus
// detalles), text (páginas de leer), form (formularios y avisos).

const WIDTHS = {
  wide: "page-wide",
  main: "page-main",
  text: "page-text",
  form: "page-form",
};

export default function PageShell({
  nav,
  width = "main",
  footer = true,
  className = "",
  children,
}: {
  /** <Navbar />, <SmartNav /> o lo que toque. */
  nav?: React.ReactNode;
  width?: keyof typeof WIDTHS;
  footer?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {nav}
      <main className="flex-1 w-full page-pad">
        <div className={`${WIDTHS[width]} ${className}`}>{children}</div>
      </main>
      {footer && <Footer />}
    </div>
  );
}
