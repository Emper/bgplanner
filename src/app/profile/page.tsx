"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Avatar from "@/components/Avatar";
import PageLoader from "@/components/PageLoader";
import { resizeImage } from "@/lib/image";

interface Profile {
  name: string;
  surname: string;
  displayName: string;
  location: string;
  bggUsername: string;
}

function ProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Profile>({
    name: "",
    surname: "",
    displayName: "",
    location: "",
    bggUsername: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setForm({
            name: data.name || "",
            surname: data.surname || "",
            displayName: data.displayName || "",
            location: data.location || "",
            bggUsername: data.bggUsername || "",
          });
          setAvatarUrl(data.avatarUrl || null);
        }
      } catch {
        // New user, empty form is fine
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const resized = await resizeImage(file, 200, 0.8);
      setAvatarUrl(resized); // Optimistic
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatarUrl: resized }),
      });
    } catch {
      setError("Error al subir la imagen");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl(null);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ avatarUrl: null }),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar el perfil");
      }

      router.push(redirect || "/groups");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <PageLoader withNavbar />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--bg)] py-10 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-[var(--text)] mb-6">Mi Perfil</h1>

          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--card-shadow)]">
            {/* Avatar section */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <Avatar
                  name={form.name || form.bggUsername || "?"}
                  avatarUrl={avatarUrl}
                  size="lg"
                />
                {uploadingAvatar && (
                  <div className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] flex items-center justify-center">
                    <span className="text-xs text-[var(--primary)] animate-pulse">...</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
                >
                  {avatarUrl ? "Cambiar foto" : "Subir foto"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
                  >
                    Eliminar foto
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Apellido
                </label>
                <input
                  type="text"
                  required
                  value={form.surname}
                  onChange={(e) => setForm({ ...form, surname: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Nombre para mostrar
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder={form.name || "Tu nombre visible para el resto"}
                  maxLength={50}
                  className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Aparecerá en el feed de actividad, votos y listas de miembros. Si lo dejas vacío se usará tu nombre.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Ubicación
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Ciudad, País"
                  className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Usuario de BGG
                </label>
                <input
                  type="text"
                  value={form.bggUsername}
                  onChange={(e) =>
                    setForm({ ...form, bggUsername: e.target.value })
                  }
                  placeholder="Tu nombre de usuario en BoardGameGeek"
                  className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                />
                {form.bggUsername && (
                  <a
                    href={`https://boardgamegeek.com/user/${form.bggUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-xs text-[var(--primary)] hover:text-[var(--primary-hover)]"
                  >
                    Ver perfil de @{form.bggUsername} en BGG &rarr;
                  </a>
                )}
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Se usará para importar tu colección de juegos. Asegúrate de que tu colección es pública en BGG.
                </p>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full px-4 py-3 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {saving ? "Guardando..." : "Guardar perfil"}
              </button>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-[var(--bg)]"><PageLoader /></div>}
    >
      <ProfileForm />
    </Suspense>
  );
}
