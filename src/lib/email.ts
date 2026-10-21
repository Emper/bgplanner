import { EMAIL_FROM } from "@/lib/contact";
import { escapeHtml } from "@/lib/html";
import { resend } from "@/lib/resend";
import { inBackground } from "@/lib/background";

// Los emails de la app: una sola plantilla (tema oscuro, acento ámbar) y un
// solo sitio por el que salen. Lo que venga del usuario se escapa solo si se
// mete con la etiqueta `html`, así que no hay que acordarse en cada envío.

const C = {
  bg: "#0f172a",
  card: "#1e293b",
  text: "#f1f5f9",
  muted: "#94a3b8",
  accent: "#f59e0b",
  border: "#334155",
};

/** Un trozo de HTML ya seguro: `html` no lo vuelve a escapar. */
export class SafeHtml {
  constructor(readonly value: string) {}
  toString() {
    return this.value;
  }
}

type Interpolation = string | number | null | undefined | false | SafeHtml | SafeHtml[];

function render(value: Interpolation): string {
  if (value === null || value === undefined || value === false) return "";
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return escapeHtml(String(value));
}

/**
 * Plantilla de HTML que escapa todo lo que se interpola, salvo otros trozos
 * hechos con `html` (o envueltos en `SafeHtml` a propósito).
 *
 *   html`<p>${user.name} te invita a <strong>${group.name}</strong></p>`
 */
export function html(strings: TemplateStringsArray, ...values: Interpolation[]): SafeHtml {
  let out = strings[0];
  values.forEach((value, i) => {
    out += render(value) + strings[i + 1];
  });
  return new SafeHtml(out);
}

/** El botón ámbar con texto oscuro de todos los emails. */
export function emailButton(href: string, label: string): SafeHtml {
  return html`<a href="${href}" style="display: inline-block; background: ${C.accent}; color: ${C.bg}; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">${label}</a>`;
}

/** Texto gris pequeño, para pies y aclaraciones. */
export function emailNote(text: string | SafeHtml): SafeHtml {
  return html`<p style="color: ${C.muted}; font-size: 14px;">${text}</p>`;
}

/** Un bloque destacado (un código, una cita, un ranking). */
export function emailBox(inner: SafeHtml): SafeHtml {
  return html`<div style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 10px; padding: 16px; margin: 16px 0;">${inner}</div>`;
}

/** El código de 6 cifras del login y del cambio de email. */
export function emailCode(code: string): SafeHtml {
  return html`<div style="background: ${C.card}; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;"><span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: ${C.accent};">${code}</span></div>`;
}

/** La carcasa común: fondo oscuro, cabecera con la marca y el contenido. */
export function emailLayout(inner: SafeHtml, { maxWidth = 480 }: { maxWidth?: number } = {}): string {
  return html`<div style="font-family: sans-serif; max-width: ${maxWidth}px; margin: 0 auto; padding: 20px; background: ${C.bg}; color: ${C.text}; border-radius: 12px;">
  <h2 style="color: ${C.accent}; margin-bottom: 16px;">BG Planner</h2>
  ${inner}
</div>`.value;
}

export const EMAIL_COLORS = C;

interface AppEmail {
  to: string | string[];
  subject: string;
  /** El contenido, sin la carcasa: la pone `emailLayout`. */
  body: SafeHtml;
  replyTo?: string;
  maxWidth?: number;
  /** Ficheros adjuntos (p. ej. las capturas de una sugerencia). */
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}

/**
 * Envía un email y espera a saber si salió. Devuelve false si Resend lo
 * rechaza o falla, con traza en los logs. Para cuando el email ES la
 * respuesta (el código de entrada): si no sale, hay que decirlo.
 */
export async function sendAppEmail({ to, subject, body, replyTo, maxWidth, attachments }: AppEmail): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html: emailLayout(body, { maxWidth }),
      ...(replyTo ? { replyTo } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });
    if (error) {
      console.error(`[email] Resend rechazó "${subject}"`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] fallo al enviar "${subject}"`, err);
    return false;
  }
}

/** Envía un email después de responder: ni bloquea ni se pierde. */
export function sendAppEmailLater(email: AppEmail) {
  inBackground(() => sendAppEmail(email));
}
