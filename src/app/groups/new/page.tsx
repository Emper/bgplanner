"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Navbar from "@/components/Navbar";

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear el grupo");
      }

      const data = await res.json();
      router.push(`/groups/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--bg)] py-10 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-[var(--text)] mb-6">
            Crear nuevo grupo
          </h1>

          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">
                  Nombre del grupo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Noches de juegos"
                  className="w-full px-4 py-2 bg-[var(--input-bg)] border border-[var(--border-strong)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-amber-500 text-[var(--primary-text)] rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium"
              >
                {loading ? "Creando..." : "Crear grupo"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
