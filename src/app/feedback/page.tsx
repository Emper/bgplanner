"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { resizeImage } from "@/lib/image";

export default function FeedbackPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile").then((res) => {
      if (!res.ok) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  const handleImageUpload = async (files: FileList) => {
    const remaining = 5 - images.length;
    const toProcess = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, remaining);
    if (toProcess.length === 0) return;

    setUploadingImage(true);
    try {
      const resized = await Promise.all(toProcess.map((f) => resizeImage(f, 600)));
      setImages((prev) => [...prev, ...resized]);
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, images: images.length > 0 ? images : undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar el feedback");
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el feedback");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Navbar />

      <main className="max-w-2xl mx-auto py-8 sm:py-12 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Feedback</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          ¿Tienes una idea para mejorar BG Planner? ¿Has encontrado un error? ¿Quieres proponer una nueva funcionalidad? Tu opinión nos ayuda a hacer la app mejor para todos. Cuéntanos lo que quieras.
        </p>

        {sent ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
            <div className="text-2xl mb-2">&#x2705;</div>
            <h2 className="text-lg font-semibold text-emerald-400 mb-1">Feedback enviado</h2>
            <p className="text-sm text-[var(--text-secondary)]">Gracias por tu aportación. Lo revisaremos lo antes posible.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Asunto</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={200}
                className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all duration-200"
                placeholder="Describe brevemente tu sugerencia o problema"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Descripción</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={5000}
                rows={6}
                className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all duration-200 resize-none"
                placeholder="Explica con detalle qué te gustaría que mejoráramos, qué funcionalidad echas en falta, o qué error has encontrado..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Capturas de pantalla <span className="text-[var(--text-muted)] font-normal">(opcional, máx. 5)</span>
              </label>

              {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-[var(--border)] shrink-0">
                      <img src={img} alt={`Captura ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length < 5 && (
                <label className="inline-block px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl text-sm font-medium hover:bg-[var(--surface-hover)] transition-all duration-200 cursor-pointer">
                  {uploadingImage ? "Procesando..." : "Adjuntar imagen"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleImageUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending}
                className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold px-6 py-2.5 rounded-xl text-sm transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md"
              >
                {sending ? "Enviando..." : "Enviar feedback"}
              </button>
            </div>
          </form>
        )}
      </main>

      <Footer variant="internal" />
    </div>
  );
}
