"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import Navbar from "@/components/Navbar";
import { clearNavUser, refreshNavUser } from "@/lib/navUser";
import { disablePush } from "@/lib/pushClient";
import Avatar from "@/components/Avatar";
import PageLoader from "@/components/PageLoader";
import ProfileShowcase from "@/components/ProfileShowcase";
import BlockedUsers from "@/components/BlockedUsers";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Spinner, { InlineLoading } from "@/components/ui/Spinner";
import { Field, FieldError, Input, LABEL_CLASS } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { resizeImage } from "@/lib/image";
import { safeRedirect } from "@/lib/safeRedirect";
import { bggUserUrl } from "@/lib/bggLinks";
import { APP_URL } from "@/lib/site";
import { plural } from "@/lib/text";
import { profileHref } from "@/lib/users";

interface Handover {
  id: string;
  name: string;
  heir: { userId: string; name: string } | null;
}

interface DeletionPlan {
  groups: Handover[];
  events: Handover[];
  kept: { posts: number; reviews: number; comments: number; photos: number };
}

// «bgplanner.app» (o el dominio en el que estemos), para enseñar direcciones.
const APP_HOST = APP_URL.replace(/^https?:\/\//, "");

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
  const redirect = safeRedirect(searchParams.get("redirect"));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Profile>({
    name: "",
    surname: "",
    displayName: "",
    location: "",
    bggUsername: "",
  });
  const [profileSlug, setProfileSlug] = useState("");
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
  const toast = useToast();
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Borrar la cuenta: el modal enseña antes qué pasa con grupos, eventos y
  // lo publicado, y pide escribir BORRAR.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePlan, setDeletePlan] = useState<DeletionPlan | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePhotos, setDeletePhotos] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
          setProfileSlug(data.slug || data.id || "");
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
      if (resend) toast("Te hemos enviado un código nuevo");
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
      toast.success("Email actualizado");
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
      const res = await fetch("/api/profile/email", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setPendingEmail(null);
      setEmailModal(false);
      toast("Cambio de email cancelado");
    } catch {
      // Puede pulsarse desde el aviso de la página, con el modal cerrado.
      toast.error("No se ha podido cancelar la solicitud");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const previous = avatarUrl;
    try {
      const resized = await resizeImage(file, 200, 0.8);
      setAvatarUrl(resized); // Optimistic
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatarUrl: resized }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setAvatarUrl(previous);
      toast.error("Error al subir la imagen");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const openDeleteModal = async () => {
    setDeleteOpen(true);
    setDeleteConfirm("");
    setDeletePhotos(false);
    setDeleteError("");
    setDeletePlan(null);
    try {
      const res = await fetch("/api/profile/account", { credentials: "include" });
      if (!res.ok) throw new Error();
      setDeletePlan(await res.json());
    } catch {
      setDeleteError("No hemos podido preparar el borrado. Recarga la página e inténtalo de nuevo.");
    }
  };

  const closeDeleteModal = () => {
    if (!deleteBusy) setDeleteOpen(false);
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");
    setDeleteBusy(true);
    try {
      const res = await fetch("/api/profile/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: deleteConfirm, removePhotos: deletePhotos }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No hemos podido borrar la cuenta");
      }
      // La sesión ya está cerrada (y las suscripciones borradas en el
      // servidor): solo falta soltar el push de este navegador.
      await disablePush().catch(() => {});
      clearNavUser();
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Error inesperado");
      setDeleteBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    const previous = avatarUrl;
    setAvatarUrl(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setAvatarUrl(previous);
      toast.error("No se ha podido eliminar la foto");
    }
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

      // Que la cabecera de la siguiente página ya salga con el BGG nuevo
      await refreshNavUser();
      router.push(redirect || "/");
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

  const linkButton = "text-xs text-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-50 transition-colors";
  const mutedDangerButton =
    "text-xs text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-50 transition-colors";

  return (
    <PageShell nav={<Navbar />} width="form">
      <PageHeader
        title="Mi perfil"
        action={
          profileSlug && (
            <Link
              href={profileHref({ id: profileSlug })}
              className="text-xs text-[var(--primary)] hover:underline shrink-0"
            >
              Ver mi perfil público &rarr;
            </Link>
          )
        }
      />

      <Card padding="lg">
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
                <Spinner size="sm" label="Subiendo foto" />
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className={linkButton}
            >
              {avatarUrl ? "Cambiar foto" : "Subir foto"}
            </button>
            {avatarUrl && (
              <button type="button" onClick={handleRemoveAvatar} disabled={uploadingAvatar} className={mutedDangerButton}>
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
          <p className={LABEL_CLASS}>Email de acceso</p>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-[var(--text-secondary)] break-all">
              {email || "—"}
            </span>
            <button type="button" onClick={() => openEmailModal("email")} className={linkButton}>
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
                <button type="button" onClick={() => openEmailModal("code")} className={`${linkButton} font-semibold`}>
                  Introducir código
                </button>
                <button
                  type="button"
                  onClick={handleCancelEmailChange}
                  disabled={emailBusy}
                  className={mutedDangerButton}
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
          <Field label="Nombre">
            {(id) => (
              <Input
                id={id}
                type="text"
                required
                size="lg"
                autoComplete="given-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>

          <Field label="Apellido">
            {(id) => (
              <Input
                id={id}
                type="text"
                required
                size="lg"
                autoComplete="family-name"
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
              />
            )}
          </Field>

          <Field
            label="Nombre para mostrar"
            hint="Aparecerá en el feed de actividad, votos y listas de miembros. Si lo dejas vacío se usará tu nombre."
          >
            {(id) => (
              <Input
                id={id}
                type="text"
                size="lg"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder={form.name || "Tu nombre visible para el resto"}
                maxLength={50}
              />
            )}
          </Field>

          <Field label="Ubicación">
            {(id) => (
              <Input
                id={id}
                type="text"
                size="lg"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Ciudad, País"
              />
            )}
          </Field>

          <div>
            <Field
              label="Usuario de BGG"
              hint="Se usará para importar tu colección de juegos. Asegúrate de que tu colección es pública en BGG."
            >
              {(id) => (
                <>
                  <Input
                    id={id}
                    type="text"
                    size="lg"
                    autoCapitalize="none"
                    value={form.bggUsername}
                    onChange={(e) => setForm({ ...form, bggUsername: e.target.value })}
                    placeholder="Tu nombre de usuario en BoardGameGeek"
                  />
                  {form.bggUsername && (
                    <a
                      href={bggUserUrl(form.bggUsername)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-xs text-[var(--primary)] hover:text-[var(--primary-hover)]"
                    >
                      Ver perfil de @{form.bggUsername} en BGG &rarr;
                    </a>
                  )}
                </>
              )}
            </Field>
            {profileSlug && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                La dirección de tu perfil público es{" "}
                <span className="font-mono text-[var(--text-secondary)] break-all">
                  {APP_HOST}/users/{profileSlug}
                </span>
              </p>
            )}
          </div>

          <FieldError>{error}</FieldError>

          <Button type="submit" size="lg" block loading={saving} className="py-3">
            {saving ? "Guardando…" : "Guardar perfil"}
          </Button>
        </form>
      </Card>

      <ProfileShowcase />

      <BlockedUsers />

      {/* Zona de peligro */}
      <section className="mt-10 rounded-2xl border border-[var(--danger)]/30 p-6">
        <h2 className="text-base font-semibold text-[var(--danger)] mb-1">Borrar mi cuenta</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
          Se borran tus datos, tu colección, tus votos y tus amigos. Lo que publicaste en
          grupos, eventos y la Comunidad se queda, pero firmado como «Usuario eliminado».
          No se puede deshacer.{" "}
          <Link href="/privacy" className="text-[var(--primary)] hover:underline">
            Más detalles en la política de privacidad
          </Link>
          .
        </p>
        <Button variant="dangerOutline" onClick={openDeleteModal} className="py-2.5">
          Borrar mi cuenta…
        </Button>
      </section>

      {/* Modal de borrar la cuenta */}
      <Modal open={deleteOpen} onClose={closeDeleteModal} title="Borrar tu cuenta" tone="danger" busy={deleteBusy}>
        {!deletePlan && !deleteError && <InlineLoading text="Mirando qué hay que hacer…" className="py-6" />}

        {deletePlan && (
          <form onSubmit={handleDeleteAccount} className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-[var(--text)] mb-1">Se borra para siempre</p>
              <ul className="list-disc list-inside space-y-0.5 pl-1 text-[var(--text-secondary)]">
                <li>Tu email, tu nombre, tu foto y tu usuario de BGG</li>
                <li>Tu colección, tus notas y tu vitrina</li>
                <li>Tus votos en los rankings de los grupos</li>
                <li>Tus amigos, tus avisos y los dispositivos con avisos activados</li>
              </ul>
            </div>

            {(deletePlan.kept.posts > 0 ||
              deletePlan.kept.reviews > 0 ||
              deletePlan.kept.comments > 0 ||
              (deletePlan.kept.photos > 0 && !deletePhotos)) && (
              <div>
                <p className="font-medium text-[var(--text)] mb-1">
                  Se queda, firmado como «Usuario eliminado»
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1 text-[var(--text-secondary)]">
                  {deletePlan.kept.posts > 0 && (
                    <li>{plural(deletePlan.kept.posts, "mensaje", "mensajes")} en la Comunidad</li>
                  )}
                  {deletePlan.kept.reviews > 0 && (
                    <li>{plural(deletePlan.kept.reviews, "opinión o valoración", "opiniones y valoraciones")}</li>
                  )}
                  {deletePlan.kept.comments > 0 && (
                    <li>{plural(deletePlan.kept.comments, "comentario", "comentarios")} en juegos de tus grupos</li>
                  )}
                  {deletePlan.kept.photos > 0 && !deletePhotos && (
                    <li>{plural(deletePlan.kept.photos, "foto", "fotos")} en galerías y opiniones</li>
                  )}
                </ul>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Así las conversaciones y las galerías de los demás no se quedan cojas.
                </p>
              </div>
            )}

            {(deletePlan.groups.length > 0 || deletePlan.events.length > 0) && (
              <div>
                <p className="font-medium text-[var(--text)] mb-1">Lo que gestionas</p>
                <ul className="space-y-1 text-[var(--text-secondary)]">
                  {deletePlan.groups.map((g) => (
                    <li key={g.id}>
                      👥 <strong className="text-[var(--text)]">{g.name}</strong>{" "}
                      {g.heir ? (
                        <>pasa a {g.heir.name}</>
                      ) : (
                        <span className="text-[var(--danger)]">se borra: no queda nadie más</span>
                      )}
                    </li>
                  ))}
                  {deletePlan.events.map((e) => (
                    <li key={e.id}>
                      📅 <strong className="text-[var(--text)]">{e.name}</strong>{" "}
                      {e.heir ? (
                        <>pasa a {e.heir.name}</>
                      ) : (
                        <span className="text-[var(--danger)]">se borra: no hay más asistentes</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Pasan al admin que más tiempo lleva dentro o, si no hay admins, a quien
                  más tiempo lleva. Si prefieres a otra persona, hazla admin antes.
                </p>
              </div>
            )}

            {deletePlan.kept.photos > 0 && (
              <label className="flex items-start gap-2 text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={deletePhotos}
                  onChange={(e) => setDeletePhotos(e.target.checked)}
                  disabled={deleteBusy}
                  className="mt-0.5 accent-[var(--danger)]"
                />
                <span>
                  Borrar también mis {plural(deletePlan.kept.photos, "foto", "fotos")} de las
                  galerías y opiniones
                </span>
              </label>
            )}

            <div>
              <label htmlFor="delete-confirm" className="block text-xs text-[var(--text-secondary)] mb-1.5">
                Para confirmar, escribe <span className="font-mono font-semibold text-[var(--text)]">BORRAR</span>
              </label>
              <Input
                id="delete-confirm"
                type="text"
                size="lg"
                tone="danger"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="BORRAR"
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                disabled={deleteBusy}
              />
            </div>

            <FieldError>{deleteError}</FieldError>

            <div className="flex gap-3">
              <Button variant="secondary" size="lg" onClick={closeDeleteModal} disabled={deleteBusy} className="flex-1 py-3">
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="lg"
                loading={deleteBusy}
                disabled={deleteConfirm.trim().toUpperCase() !== "BORRAR"}
                className="flex-1 py-3"
              >
                {deleteBusy ? "Borrando…" : "Borrar mi cuenta"}
              </Button>
            </div>
          </form>
        )}

        {!deletePlan && <FieldError>{deleteError}</FieldError>}
      </Modal>

      {/* Modal de cambio de email: primero la dirección, luego el código */}
      <Modal
        open={emailModal}
        onClose={closeEmailModal}
        busy={emailBusy}
        title={emailStep === "email" ? "Cambiar email" : "Confirma tu nuevo email"}
        description={
          emailStep === "email" ? (
            "Te enviaremos un código a la nueva dirección para comprobar que es tuya. El cambio no se aplica hasta que lo confirmes."
          ) : (
            <>
              Hemos enviado un código de 6 dígitos a{" "}
              <strong className="text-[var(--text)] break-all">{pendingEmail || newEmail}</strong>. Caduca en 10
              minutos.
            </>
          )
        }
      >
        {emailStep === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <Field label="Nuevo email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  required
                  size="lg"
                  autoComplete="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
              )}
            </Field>

            <FieldError>{emailError}</FieldError>

            <div className="flex gap-3">
              <Button variant="secondary" size="lg" onClick={closeEmailModal} disabled={emailBusy} className="flex-1 py-3">
                Cancelar
              </Button>
              <Button
                type="submit"
                size="lg"
                loading={emailBusy}
                disabled={!newEmail.trim()}
                className="flex-1 py-3"
              >
                {emailBusy ? "Enviando…" : "Enviarme el código"}
              </Button>
            </div>
          </form>
        ) : (
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
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  aria-label={`Dígito ${i + 1} de 6`}
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  className="w-12 h-14 text-center text-2xl font-semibold bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                />
              ))}
            </div>

            <FieldError className="text-center">{emailError}</FieldError>

            <Button
              type="submit"
              size="lg"
              block
              loading={emailBusy}
              disabled={emailCode.join("").length !== 6}
              className="py-3"
            >
              {emailBusy ? "Confirmando…" : "Confirmar cambio"}
            </Button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => requestEmailChange(pendingEmail || newEmail, true)}
                disabled={emailBusy}
                className={linkButton}
              >
                Reenviar código
              </button>
              <button
                type="button"
                onClick={handleCancelEmailChange}
                disabled={emailBusy}
                className={mutedDangerButton}
              >
                Cancelar cambio
              </button>
            </div>
          </form>
        )}
      </Modal>
    </PageShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <PageLoader withNavbar />
        </>
      }
    >
      <ProfileForm />
    </Suspense>
  );
}
