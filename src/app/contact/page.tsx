"use client";

import { useState } from "react";
import Link from "next/link";
import SmartNav from "@/components/SmartNav";
import EmojiField from "@/components/EmojiField";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, FieldError, Input, fieldClass } from "@/components/ui/Field";
import { CONTACT_EMAIL } from "@/lib/contact";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  // Campo trampa: invisible para personas, los bots lo rellenan.
  const [website, setWebsite] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message, honeypot: website }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar el mensaje");
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el mensaje");
    } finally {
      setSending(false);
    }
  };

  return (
    <PageShell nav={<SmartNav />} width="text">
      <PageHeader
        title="Contacto"
        lead="¿Tienes alguna pregunta, quieres saber más sobre BG Planner o simplemente quieres saludar? Escríbenos y te responderemos lo antes posible."
      />

      {sent ? (
        <div className="bg-[var(--success-soft)] border border-[var(--success)]/30 rounded-xl p-6 text-center" role="status">
          <div className="text-2xl mb-2" aria-hidden>✅</div>
          <h2 className="text-lg font-semibold text-[var(--success)] mb-1">Mensaje enviado</h2>
          <p className="text-sm text-[var(--text-secondary)]">Gracias por escribirnos. Te responderemos lo antes posible.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Honeypot - hidden from users */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="absolute opacity-0 h-0 w-0 pointer-events-none"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />

          <Field label="Nombre">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Tu nombre"
              />
            )}
          </Field>

          <Field label="Email">
            {(id) => (
              <Input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@email.com"
              />
            )}
          </Field>

          <Field label="Asunto">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={200}
                placeholder="¿Sobre qué quieres escribirnos?"
              />
            )}
          </Field>

          <Field label="Mensaje">
            {(id) => (
              <EmojiField
                id={id}
                value={message}
                onChange={setMessage}
                required
                maxLength={5000}
                rows={6}
                className={fieldClass({ className: "resize-none" })}
                placeholder="Cuéntanos…"
              />
            )}
          </Field>

          <FieldError>{error}</FieldError>

          <div className="flex justify-end">
            <Button type="submit" loading={sending} className="px-6 py-2.5">
              {sending ? "Enviando…" : "Enviar mensaje"}
            </Button>
          </div>
        </form>
      )}

      {/* Lo piden App Store y Google Play: un contacto visible para moderación */}
      <Card as="section" id="moderacion" padding="lg" className="mt-12 scroll-mt-24">
        <h2 className="text-lg font-semibold text-[var(--text)] mb-2">🛡️ Moderación y denuncias</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">
          ¿Has visto algo que no debería estar en BG Planner, como spam, acoso o fotos inapropiadas? Usa
          «Denunciar» en el menú <span aria-label="tres puntos">⋯</span> de cualquier hilo, respuesta, foto,
          opinión o perfil. Si alguien te molesta, también puedes bloquearle: dejarás de ver lo que escribe en la
          Comunidad y de recibir sus avisos.
        </p>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Para cualquier otra cosa de moderación, escríbenos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[var(--primary)] hover:underline">
            {CONTACT_EMAIL}
          </a>{" "}
          o usa el formulario de arriba. Revisamos cada denuncia en menos de 24 horas, retiramos lo que incumpla{" "}
          <Link href="/terms#normas" className="font-medium text-[var(--primary)] hover:underline">
            los términos de uso
          </Link>{" "}
          y expulsamos a quien lo publicó.
        </p>
      </Card>
    </PageShell>
  );
}
