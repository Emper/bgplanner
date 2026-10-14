import Link from "next/link";
import SmartNav from "@/components/SmartNav";
import Footer from "@/components/Footer";

// Hilo borrado o enlace mal copiado: 404 de verdad (para los buscadores) con
// salida a la Comunidad.
export default function ThreadNotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SmartNav />
      <main className="max-w-3xl mx-auto py-16 px-4 text-center">
        <p className="text-4xl mb-3">🫥</p>
        <h1 className="text-xl font-semibold mb-2">Esta conversación ya no está</h1>
        <p className="text-[var(--text-secondary)] mb-6">
          Puede que la hayan borrado o que el enlace no sea correcto.
        </p>
        <Link
          href="/community"
          className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold px-5 py-2 rounded-xl text-sm transition-all duration-200 shadow-sm hover:shadow-md"
        >
          Volver a la Comunidad
        </Link>
      </main>
      <Footer />
    </div>
  );
}
