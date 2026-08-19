"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Avatar from "@/components/Avatar";
import PageLoader from "@/components/PageLoader";
import { resizeImage } from "@/lib/image";
import { isNative } from "@/lib/native";

// Un tipo de aviso del catálogo (src/lib/notifications.ts) con los valores
// efectivos de este usuario, tal como los devuelve la API.
interface NotificationType {
  type: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
}

interface Profile {
  name: string;
  surname: string;
  displayName: string;
  location: string;
  bggUsername: string;
}

/** Conmutador de un canal (Email / Móvil) para un tipo de aviso. */
function ChannelToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-2 text-xs font-medium ${
        disabled
          ? "text-[var(--text-muted)] cursor-not-allowed"
          : "text-[var(--text-secondary)] cursor-pointer"
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${
          checked ? "bg-[var(--primary)]" : "bg-[var(--input-bg)] border border-[var(--input-border)]"
        }`}
      >
        <span
          className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
      {label}
    </label>
  );
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [notifTypes, setNotifTypes] = useState<NotificationType[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifToast, setNotifToast] = useState("");
  const [notifError, setNotifError] = useState("");
  // Solo dentro de la app nativa se pueden recibir push. En el navegador los
  // conmutadores de móvil se quedan bloqueados con una explicación.
  const [nativeApp, setNativeApp] = useState(false);

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
          setAccountEmail(data.email || "");
        }
      } catch {
        // New user, empty form is fine
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // isNative() depende de window: se resuelve tras montar para no romper la
  // hidratación con un render distinto en servidor y cliente.
  useEffect(() => {
    setNativeApp(isNative());
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/notifications/preferences", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setNotifTypes(data.types || []);
        }
      } catch {
        // Sin preferencias no pasa nada: se muestra la tarjeta vacía.
      } finally {
        setNotifLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleChannelChange = async (
    type: string,
    channel: "email" | "push",
    value: boolean
  ) => {
    const current = notifTypes.find((t) => t.type === type);
    if (!current) return;
    const next = { ...current, [channel]: value };

    // Optimista: el conmutador responde al instante y se revierte si falla.
    setNotifTypes((types) => types.map((t) => (t.type === type ? next : t)));
    setNotifError("");

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type,
          email: next.email,
          push: next.push,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      setNotifToast("Preferencias guardadas");
      setTimeout(() => setNotifToast(""), 4000);
    } catch (err: unknown) {
      setNotifTypes((types) => types.map((t) => (t.type === type ? current : t)));
      setNotifError(
        err instanceof Error ? err.message : "No se pudo guardar"
      );
      setTimeout(() => setNotifError(""), 4000);
    }
  };

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

  const closeDeleteModal = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setDeleteConfirm("");
    setDeleteError("");
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    setDeleting(true);

    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmEmail: deleteConfirm }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar la cuenta");
      }

      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : "Error inesperado"
      );
      setDeleting(false);
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

          {/* Notificaciones — canal por tipo de aviso */}
          <div className="mt-8 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--card-shadow)]">
            <h2 className="text-lg font-bold text-[var(--text)] mb-2">
              Notificaciones
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Elige cómo quieres enterarte de cada cosa. Si tienes la app
              instalada y el aviso al móvil activado, te llega solo al móvil y
              no por email.
            </p>

            {!nativeApp && (
              <p className="text-xs text-[var(--text-muted)] bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2.5 mb-4">
                Los avisos al móvil necesitan la app de BG Planner instalada.
                Desde el navegador solo puedes ajustar el email.
              </p>
            )}

            {notifLoading ? (
              <p className="text-sm text-[var(--text-muted)]">Cargando…</p>
            ) : notifTypes.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No se han podido cargar tus preferencias. Prueba a recargar.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {notifTypes.map((item) => (
                  <li
                    key={item.type}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {item.label}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <ChannelToggle
                        label="Email"
                        checked={item.email}
                        onChange={(next) =>
                          handleChannelChange(item.type, "email", next)
                        }
                      />
                      <ChannelToggle
                        label="Móvil"
                        checked={item.push}
                        disabled={!nativeApp}
                        onChange={(next) =>
                          handleChannelChange(item.type, "push", next)
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Zona de peligro — borrado de cuenta */}
          <div className="mt-8 bg-[var(--surface)] rounded-2xl border border-red-500/30 p-6 shadow-[var(--card-shadow)]">
            <h2 className="text-lg font-bold text-red-500 dark:text-red-400 mb-2">
              Zona de peligro
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Si eliminas tu cuenta desaparece todo lo tuyo y no hay vuelta
              atrás.
            </p>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1.5 mb-3 list-disc pl-5">
              <li>
                <strong className="text-[var(--text)]">Se borra:</strong> tu
                perfil, tus votos, tus comentarios y opiniones, tus fotos, tus
                asistencias a eventos y tu actividad.
              </li>
              <li>
                <strong className="text-[var(--text)]">Se conserva:</strong> lo
                que es del grupo — los juegos que añadiste, las sesiones y los
                eventos siguen ahí, pero pasan a estar a nombre de otro
                miembro (el admin más antiguo).
              </li>
              <li>
                <strong className="text-[var(--text)]">Se elimina entero:</strong>{" "}
                cualquier grupo o evento en el que fueras la única persona.
              </li>
            </ul>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="w-full sm:w-auto px-4 py-3 rounded-xl border border-red-500/40 text-red-500 dark:text-red-400 hover:bg-red-500/10 font-semibold transition-all duration-200"
            >
              Eliminar mi cuenta
            </button>
          </div>
        </div>
      </div>

      {notifToast && (
        <div className="fixed bottom-safe left-1/2 -translate-x-1/2 z-50 bg-[var(--primary)] text-[var(--primary-text)] px-4 py-3 rounded-xl shadow-lg font-semibold text-sm">
          {notifToast}
        </div>
      )}
      {notifError && (
        <div className="fixed bottom-safe left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg font-semibold text-sm">
          {notifError}
        </div>
      )}

      {showDeleteModal && (
        <div
          data-no-swipe className="modal-sheet fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={closeDeleteModal}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 w-full max-w-md shadow-[var(--card-shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[var(--text)] mb-2">
              Eliminar cuenta
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Esta acción es irreversible. Para confirmar, escribe tu email{" "}
              <span className="text-[var(--text)] font-medium break-all">
                {accountEmail}
              </span>
              .
            </p>

            <input
              type="email"
              autoComplete="off"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-red-500/40 focus:border-red-500 focus:outline-none transition-all duration-200"
            />

            {deleteError && (
              <p className="text-sm text-red-400 mt-3">{deleteError}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] text-[var(--text)] hover:bg-[var(--input-bg)] disabled:opacity-50 font-semibold transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={
                  deleting ||
                  deleteConfirm.trim().toLowerCase() !==
                    accountEmail.toLowerCase() ||
                  !accountEmail
                }
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 font-semibold transition-all duration-200"
              >
                {deleting ? "Eliminando..." : "Eliminar cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}
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
