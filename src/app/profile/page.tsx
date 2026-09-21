"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Avatar from "@/components/Avatar";
import PageLoader from "@/components/PageLoader";
import ProfileShowcase from "@/components/ProfileShowcase";
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

  // Cambio de email: se pide el nuevo, llega un código a esa dirección y
  // hasta que no se confirma la cuenta sigue con el email de siempre.
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState<"email" | "code">("email");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState(["", "", "", "", "", ""]);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [toast, setToast] = useState("");
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

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
          setEmail(data.email || "");
        }
        const emailRes = await fetch("/api/profile/email", {
          credentials: "include",
        });
        if (emailRes.ok) {
          const emailData = await emailRes.json();
          setEmail(emailData.email || "");
          setPendingEmail(emailData.pending?.newEmail || null);
        }
      } catch {
        // New user, empty form is fine
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4000);
  };

  const openEmailModal = (step: "email" | "code") => {
    setEmailError("");
    setEmailCode(["", "", "", "", "", ""]);
    setNewEmail(step === "code" ? pendingEmail || "" : "");
    setEmailStep(step);
    setEmailModal(true);
  };

  const closeEmailModal = () => {
    setEmailModal(false);
    setEmailError("");
  };

  const requestEmailChange = async (address: string, resend = false) => {
    setEmailError("");
    setEmailBusy(true);
    try {
      const res = await fetch("/api/profile/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: address }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se ha podido enviar el código");
      }
      setPendingEmail(data.newEmail);
      setNewEmail(data.newEmail);
      setEmailCode(["", "", "", "", "", ""]);
      setEmailStep("code");
      setTimeout(() => codeRefs.current[0]?.focus(), 50);
      if (resend) showToast("Te hemos enviado un código nuevo");
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestEmailChange(newEmail.trim().toLowerCase());
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...emailCode];
    next[index] = value.slice(-1);
    setEmailCode(next);
    if (value && index < 5) codeRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !emailCode[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...emailCode];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setEmailCode(next);
    codeRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleConfirmEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = emailCode.join("");
    if (code.length !== 6) return;

    setEmailError("");
    setEmailBusy(true);
    try {
      const res = await fetch("/api/profile/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Código inválido");
      }
      setEmail(data.email);
      setPendingEmail(null);
      setEmailModal(false);
      setEmailCode(["", "", "", "", "", ""]);
      showToast("Email actualizado");
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : "Error inesperado");
      setEmailCode(["", "", "", "", "", ""]);
      codeRefs.current[0]?.focus();
    } finally {
      setEmailBusy(false);
    }
  };

  const handleCancelEmailChange = async () => {
    setEmailBusy(true);
    try {
      await fetch("/api/profile/email", {
        method: "DELETE",
        credentials: "include",
      });
      setPendingEmail(null);
      setEmailModal(false);
      showToast("Cambio de email cancelado");
    } catch {
      setEmailError("No se ha podido cancelar la solicitud");
    } finally {
      setEmailBusy(false);
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

            {/* Email de acceso */}
            <div className="mb-6 pb-6 border-b border-[var(--border)]">
              <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                Email de acceso
              </label>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm text-[var(--text-secondary)] break-all">
                  {email || "—"}
                </span>
                <button
                  type="button"
                  onClick={() => openEmailModal("email")}
                  className="text-xs text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
                >
                  Cambiar email
                </button>
              </div>

              {pendingEmail ? (
                <div className="mt-3 rounded-xl border border-[var(--primary)]/40 bg-[var(--accent-soft)] p-3">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Pendiente de confirmar:{" "}
                    <strong className="text-[var(--text)] break-all">{pendingEmail}</strong>.
                    Te hemos enviado un código a esa dirección. Hasta que lo introduzcas
                    sigues entrando con tu email actual.
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <button
                      type="button"
                      onClick={() => openEmailModal("code")}
                      className="text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
                    >
                      Introducir código
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEmailChange}
                      disabled={emailBusy}
                      className="text-xs text-[var(--text-muted)] hover:text-red-400 disabled:opacity-50 transition-colors"
                    >
                      Cancelar cambio
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Es la dirección a la que te llega el código para entrar. Para cambiarla
                  tendrás que confirmar la nueva con un código.
                </p>
              )}
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

          <ProfileShowcase />
        </div>
      </div>

      {/* Modal de cambio de email */}
      {emailModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={closeEmailModal}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 w-full max-w-md shadow-[var(--card-shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            {emailStep === "email" ? (
              <>
                <h2 className="text-lg font-bold text-[var(--text)] mb-1">
                  Cambiar email
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-5 leading-relaxed">
                  Te enviaremos un código a la nueva dirección para comprobar que es
                  tuya. El cambio no se aplica hasta que lo confirmes.
                </p>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                      Nuevo email
                    </label>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                    />
                  </div>

                  {emailError && (
                    <p className="text-sm text-red-400">{emailError}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeEmailModal}
                      className="flex-1 px-4 py-3 bg-[var(--input-bg)] text-[var(--text-secondary)] border border-[var(--input-border)] rounded-xl hover:text-[var(--text)] font-semibold transition-all duration-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={emailBusy || !newEmail.trim()}
                      className="flex-1 px-4 py-3 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      {emailBusy ? "Enviando..." : "Enviarme el código"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-[var(--text)] mb-1">
                  Confirma tu nuevo email
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-5 leading-relaxed">
                  Hemos enviado un código de 6 dígitos a{" "}
                  <strong className="text-[var(--text)] break-all">
                    {pendingEmail || newEmail}
                  </strong>
                  . Caduca en 10 minutos.
                </p>

                <form onSubmit={handleConfirmEmail} className="space-y-4">
                  <div className="flex gap-2 justify-center" onPaste={handleCodePaste}>
                    {emailCode.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          codeRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(i, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(i, e)}
                        className="w-12 h-14 text-center text-2xl font-semibold bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                      />
                    ))}
                  </div>

                  {emailError && (
                    <p className="text-sm text-red-400 text-center">{emailError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={emailBusy || emailCode.join("").length !== 6}
                    className="w-full px-4 py-3 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {emailBusy ? "Confirmando..." : "Confirmar cambio"}
                  </button>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        requestEmailChange(pendingEmail || newEmail, true)
                      }
                      disabled={emailBusy}
                      className="text-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-50 transition-colors"
                    >
                      Reenviar código
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEmailChange}
                      disabled={emailBusy}
                      className="text-[var(--text-muted)] hover:text-red-400 disabled:opacity-50 transition-colors"
                    >
                      Cancelar cambio
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--primary)] text-[var(--primary-text)] px-4 py-3 rounded-xl shadow-lg font-semibold text-sm">
          {toast}
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
