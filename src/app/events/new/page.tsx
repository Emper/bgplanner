"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import EmojiField from "@/components/EmojiField";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Button, { buttonClass } from "@/components/ui/Button";
import { Field, FieldError, Input, LABEL_CLASS, fieldClass } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/Tabs";
import { EVENT_ABOUT_MAX } from "@/lib/text";
import { resizeImage } from "@/lib/image";

export default function NewEventPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [about, setAbout] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploadingImage(true);
    try {
      const resized = await resizeImage(file, 600);
      setImageUrl(resized);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          about: about.trim() ? about : undefined,
          date,
          endDate: endDate || undefined,
          location: location || undefined,
          maxAttendees: maxAttendees ? parseInt(maxAttendees) : undefined,
          visibility,
          imageUrl: imageUrl || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al crear el evento");
        return;
      }

      const event = await res.json();
      router.push(`/events/${event.id}`);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell nav={<Navbar />} width="form">
      <PageHeader title="Crear evento" back={{ href: "/events", label: "Eventos" }} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre del evento *">
          {(id) => (
            <EmojiField
              id={id}
              multiline={false}
              value={name}
              onChange={setName}
              required
              maxLength={200}
              placeholder="Ej: Jornada de juegos de mesa en Madrid"
              className={fieldClass()}
            />
          )}
        </Field>

        <Field label="Descripción corta">
          {(id) => (
            <EmojiField
              id={id}
              value={description}
              onChange={setDescription}
              maxLength={2000}
              rows={2}
              placeholder="Una frase que resuma el evento"
              className={fieldClass({ className: "resize-none" })}
            />
          )}
        </Field>

        <Field
          label="Info general"
          hint={
            <>
              Opcional. Se ve en el evento y en su página pública. Usa <code>## </code> para títulos, <code>- </code> para listas y <code>**texto**</code> para negrita.
            </>
          }
        >
          {(id) => (
            <EmojiField
              id={id}
              value={about}
              onChange={setAbout}
              maxLength={EVENT_ABOUT_MAX}
              rows={6}
              placeholder={"Horarios, normas, qué traer, cómo llegar…\n\n## Horarios\n- Sábado de 10:00 a 22:00"}
              className={fieldClass({ className: "resize-y" })}
            />
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Fecha de inicio *">
            {(id) => (
              <Input
                id={id}
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            )}
          </Field>
          <Field label="Fecha de fin">
            {(id) => (
              <Input
                id={id}
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Ubicación">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={300}
                placeholder="Ej: Cafetería Ludo, Madrid"
              />
            )}
          </Field>
          <Field label="Máximo de asistentes">
            {(id) => (
              <Input
                id={id}
                type="number"
                value={maxAttendees}
                onChange={(e) => setMaxAttendees(e.target.value)}
                min={1}
                placeholder="Sin límite"
              />
            )}
          </Field>
        </div>

        <div>
          <p className={LABEL_CLASS}>Imagen del evento</p>
          <div className="flex items-center gap-3">
            {imageUrl ? (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-[var(--border)] shrink-0">
                <Image src={imageUrl} alt="Vista previa" width={96} height={96} unoptimized className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-[var(--border)] flex items-center justify-center shrink-0">
                <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className={buttonClass({ variant: "secondary", className: "cursor-pointer" })}>
                {uploadingImage ? "Procesando…" : imageUrl ? "Cambiar imagen" : "Subir imagen"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <p className={LABEL_CLASS}>Visibilidad</p>
          <SegmentedControl
            label="Visibilidad"
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: "public", label: "Público" },
              { value: "private", label: "Privado" },
            ]}
          />
        </div>

        <FieldError>{error}</FieldError>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={!name || !date} loading={saving}>
            {saving ? "Creando…" : "Crear evento"}
          </Button>
          <Button variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
