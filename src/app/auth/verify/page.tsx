"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, Suspense } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import PageLoader from "@/components/PageLoader";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const redirect = searchParams.get("redirect") || "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length !== 6) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code: fullCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Código inválido");
      }

      const data = await res.json();

      if (data.isNewUser) {
        const profileUrl = redirect ? `/profile?redirect=${encodeURIComponent(redirect)}` : "/profile";
        router.push(profileUrl);
      } else if (redirect) {
        router.push(redirect);
      } else {
        router.push("/groups");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendCooldown(60);
    setError("");

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al reenviar");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-[var(--glow)] rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-fade-up">
          <Link href="/" className="inline-block">
            <AnimatedLogo />
          </Link>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-7 shadow-[var(--card-shadow)] animate-fade-up delay-100">
          <h2 className="text-xl font-bold text-[var(--text)] mb-2">
            Verificar código
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Ingresa el código de 6 dígitos enviado a{" "}
            <span className="font-medium text-[var(--text)]">{email}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-12 h-14 text-center text-2xl font-semibold bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                />
              ))}
            </div>

            {error && <p className="text-sm text-red-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || code.join("").length !== 6}
              className="w-full px-4 py-3 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {loading ? "Verificando..." : "Verificar"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] disabled:text-[var(--text-muted)] transition-colors"
            >
              {resendCooldown > 0
                ? `Reenviar código (${resendCooldown}s)`
                : "Reenviar código"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-[var(--bg)]"><PageLoader /></div>}
    >
      <VerifyForm />
    </Suspense>
  );
}
