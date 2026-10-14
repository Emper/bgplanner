import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import SmartNav from "@/components/SmartNav";
import { NOTIFICATION_TTL_DAYS } from "@/lib/notifications";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";
const UPDATED = "15 de octubre de 2026";
const CONTACT_EMAIL = "cesar@tiradacritica.es";

export const metadata: Metadata = {
  title: "Privacidad · BG Planner",
  description:
    "Qué datos guarda BG Planner, para qué, con quién se comparten, cuánto tiempo y cómo borrar tu cuenta.",
  alternates: { canonical: `${APP_URL}/privacy` },
};

// Si cambia lo que guardamos (un modelo nuevo en schema.prisma, un servicio
// externo, un plazo de borrado), esta página tiene que cambiar con ello.

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold text-[var(--text)] mb-3">{title}</h2>
      <div className="space-y-3 text-[var(--text-secondary)] leading-relaxed">{children}</div>
    </section>
  );
}

function DataList({ items }: { items: { label: string; text: React.ReactNode }[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label}>
          <strong className="text-[var(--text)]">{item.label}.</strong> {item.text}
        </li>
      ))}
    </ul>
  );
}

const DATA = [
  {
    label: "Tu cuenta",
    text: "el email con el que entras, tu nombre y apellido, el nombre que enseñas al resto, tu ubicación si la pones, tu foto de perfil y tu usuario de BoardGameGeek (BGG). No hay contraseñas: entras con un código que te mandamos al email.",
  },
  {
    label: "Tu colección",
    text: "lo que tu colección pública de BGG dice que tienes, quieres, has jugado y has puntuado; las notas y la puntuación de «¿me lo quedo?» que añades aquí (solo las ves tú); tu vitrina; y los juegos que guardas o descartas en las recomendaciones.",
  },
  {
    label: "Tus grupos y eventos",
    text: "los grupos y eventos que creas o a los que te unes, los juegos que propones, tus votos, comentarios, opiniones y valoraciones, las partidas que planificáis, a qué eventos vas y qué juegos te apetecen en ellos.",
  },
  {
    label: "Tus fotos",
    text: "las que subes a las galerías de grupos y eventos, a tus opiniones de partida y, si nos mandas un error, las capturas que adjuntes.",
  },
  {
    label: "La Comunidad y el roadmap",
    text: "los hilos y respuestas que publicas en la Comunidad, las ideas y errores que nos mandas desde «Ideas y mejoras» y las propuestas que votas.",
  },
  {
    label: "Tus amigos",
    text: "a quién has añadido a tu lista de amigos.",
  },
  {
    label: "Denuncias y bloqueos",
    text: "a quién bloqueas (no se lo decimos) y lo que denuncias, con el motivo y el texto que añadas. Las denuncias solo las ve quien modera, y nunca le decimos a nadie quién le ha denunciado. Si expulsamos a alguien por incumplir los términos de uso, guardamos su email y su nombre para que no pueda volver.",
  },
  {
    label: "Avisos",
    text: "las notificaciones de la campana y, si activas los avisos en un dispositivo, la suscripción que nos da su navegador para mandárselos (una dirección técnica del servicio de avisos y unas claves de cifrado) y qué navegador es.",
  },
  {
    label: "Registro de actividad",
    text: "qué haces y cuándo (crear un grupo, votar, apuntarte a un evento…). Con eso se pinta el feed de cada grupo y evento, y nos ayuda a detectar abusos y errores.",
  },
  {
    label: "Seguridad",
    text: "los códigos de acceso que te enviamos y los cambios de email pendientes de confirmar.",
  },
];

const NOT_COLLECTED = [
  "contraseñas",
  "datos de pago",
  "tu ubicación GPS",
  "tus contactos del móvil",
  "nada para publicidad",
];

const PROVIDERS = [
  {
    label: "Supabase",
    text: "guarda la base de datos y las fotos.",
  },
  {
    label: "Vercel",
    text: "aloja la web y la app. Con Vercel Analytics contamos visitas de forma agregada, sin cookies y sin seguirte entre sitios.",
  },
  {
    label: "Resend",
    text: "envía nuestros emails (códigos de acceso, invitaciones, convocatorias), así que recibe tu email y el contenido del mensaje.",
  },
  {
    label: "Los servicios de avisos de tu navegador",
    text: "(Google, Apple, Mozilla o Microsoft, según el dispositivo) entregan los avisos al móvil si los activas. El contenido va cifrado: solo tu dispositivo puede leerlo.",
  },
  {
    label: "BoardGameGeek",
    text: "le pedimos tu colección pública con tu usuario de BGG. No le mandamos nada más sobre ti.",
  },
];

const RETENTION = [
  { label: "Tu cuenta y lo que publicas", text: "mientras tengas la cuenta." },
  { label: "Notificaciones de la campana", text: `${NOTIFICATION_TTL_DAYS} días; después se borran solas.` },
  {
    label: "Códigos de acceso y cambios de email",
    text: "caducan a los 10 minutos y se borran del todo al día siguiente.",
  },
  {
    label: "Avisos en un dispositivo",
    text: "hasta que los desactivas, cierras sesión en él o el navegador deja de aceptarlos. Como mucho guardamos 10 dispositivos por cuenta.",
  },
  {
    label: "Si te expulsamos",
    text: "tu cuenta se borra igual que si lo hicieras tú, pero tu email, tu nombre y el motivo se quedan en la lista de expulsados mientras dure la expulsión.",
  },
  {
    label: "Tu colección de BGG",
    text: "se vuelve a pedir a BGG cuando caduca (un día) o cuando le das a actualizar, y desaparece al borrar la cuenta.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SmartNav />

      <main className="page-text page-pad">
        <h1 className="page-title mb-2">Privacidad</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">Última actualización: {UPDATED}</p>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 mb-10 shadow-[var(--card-shadow)]">
          <h2 className="font-semibold text-[var(--text)] mb-2">En corto</h2>
          <ul className="space-y-1.5 text-sm text-[var(--text-secondary)] leading-relaxed list-disc list-inside">
            <li>Guardamos lo justo para que tu grupo pueda organizar partidas: tu cuenta, tu colección y lo que haces en la app.</li>
            <li>No vendemos tus datos, no hay publicidad y no usamos cookies de seguimiento.</li>
            <li>Solo los ven los servicios que necesitamos para funcionar (alojamiento, base de datos, emails y avisos).</li>
            <li>
              Puedes borrar tu cuenta cuando quieras desde{" "}
              <Link href="/profile" className="text-[var(--primary)] hover:underline">tu perfil</Link>.
            </li>
          </ul>
        </div>

        <div className="space-y-10">
          <Section id="quien" title="Quién está detrás">
            <p>
              BG Planner es un proyecto independiente para organizar partidas de juegos de mesa con
              amigos. Para cualquier cosa sobre tus datos, escríbenos desde{" "}
              <Link href="/contact" className="text-[var(--primary)] hover:underline">el formulario de contacto</Link>{" "}
              o a{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--primary)] hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section id="datos" title="Qué datos guardamos">
            <DataList items={DATA} />
            <p>
              Si nos escribes desde el formulario de contacto, tu nombre, tu email y tu mensaje nos
              llegan por email; no se guardan en la app.
            </p>
            <p>
              <strong className="text-[var(--text)]">Lo que no guardamos:</strong>{" "}
              {NOT_COLLECTED.join(", ")}.
            </p>
          </Section>

          <Section id="para-que" title="Para qué los usamos">
            <p>
              Para que la app funcione: dejarte entrar, montar el ranking de tu grupo con los votos,
              cruzar colecciones, planificar partidas y eventos, enseñar el feed, recomendarte juegos a
              partir de lo que tienes y lo que te gusta, y avisarte de lo que te importa (en la campana,
              en el móvil si lo activas y por email solo cuando hace falta, como los códigos de acceso).
            </p>
            <p>
              También para cuidar la app: detectar abusos y errores y saber qué partes se usan. Nunca
              para publicidad ni para venderlos.
            </p>
          </Section>

          <Section id="quien-ve" title="Quién ve qué">
            <DataList
              items={[
                {
                  label: "Cualquiera, sin cuenta",
                  text: "tu perfil público (nombre visible, ubicación, usuario de BGG, foto, vitrina y los eventos públicos a los que vas), lo que publicas en la Comunidad y los eventos públicos.",
                },
                {
                  label: "Los miembros de tus grupos y eventos",
                  text: "tu nombre visible, tu foto, tus votos, comentarios, opiniones y fotos dentro de ese grupo o evento, y qué juegos tienes en tu colección cuando buscáis a qué jugar.",
                },
                {
                  label: "Quien tenga un enlace que compartes",
                  text: "tu colección o tu lista de un evento, en modo lectura. Puedes cortar el enlace cuando quieras.",
                },
                {
                  label: "Solo tú",
                  text: "tu email, tu apellido, tus notas y tu puntuación de «¿me lo quedo?», tus amigos y tus avisos.",
                },
              ]}
            />
          </Section>

          <Section id="con-quien" title="Con quién se comparten">
            <p>
              Con nadie para su propio uso. Solo con los servicios que necesitamos para funcionar, que
              tratan los datos por encargo nuestro:
            </p>
            <DataList items={PROVIDERS} />
            <p>
              Algunos de estos servicios son de empresas de fuera de la Unión Europea y pueden tratar
              datos fuera de ella, con las garantías que exige el Reglamento General de Protección de
              Datos (RGPD).
            </p>
          </Section>

          <Section id="cuanto-tiempo" title="Cuánto tiempo los guardamos">
            <DataList items={RETENTION} />
          </Section>

          <Section id="cookies" title="Cookies y almacenamiento del navegador">
            <p>
              Usamos una sola cookie, <code className="font-mono text-[var(--text)]">session</code>, para
              mantener tu sesión abierta hasta 60 días. Es imprescindible para entrar y no sirve para
              seguirte. En el navegador guardamos también algunas preferencias (tema claro u oscuro,
              cómo ves tu colección, si ya te propusimos los avisos…) que no salen de tu dispositivo.
            </p>
          </Section>

          <Section id="borrar" title="Cómo borrar tu cuenta">
            <p>
              Entra en{" "}
              <Link href="/profile" className="text-[var(--primary)] hover:underline">tu perfil</Link>,
              baja hasta el final y pulsa «Borrar mi cuenta». Antes de confirmar te enseñamos qué va a
              pasar. Al borrarla:
            </p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>
                Se borran tu email, tu nombre, tu foto, tu usuario de BGG, tu colección, tus notas, tus
                votos, tus amigos, tus avisos y tus dispositivos.
              </li>
              <li>
                Lo que publicaste en sitios compartidos (mensajes de la Comunidad, opiniones,
                comentarios, fotos de galerías, juegos añadidos a un grupo) se queda firmado como
                «Usuario eliminado», para que las conversaciones de los demás sigan teniendo sentido.
                Si quieres, puedes borrar también tus fotos en ese momento.
              </li>
              <li>
                Los grupos y eventos que gestionas pasan a quien más tiempo lleva en ellos. Si no queda
                nadie, se borran.
              </li>
            </ul>
            <p>
              Si no puedes entrar en tu cuenta, escríbenos desde{" "}
              <Link href="/contact" className="text-[var(--primary)] hover:underline">contacto</Link>{" "}
              con el email de la cuenta y la borramos nosotros.
            </p>
          </Section>

          <Section id="derechos" title="Tus derechos">
            <p>
              Puedes pedirnos en cualquier momento una copia de tus datos, corregirlos, borrarlos,
              limitar u oponerte a que los usemos, y llevártelos a otro servicio. La mayoría los puedes
              cambiar tú mismo desde tu perfil; para lo demás, escríbenos. Si crees que no hemos
              tratado bien tus datos, puedes reclamar ante la{" "}
              <a
                href="https://www.aepd.es"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:underline"
              >
                Agencia Española de Protección de Datos
              </a>
              .
            </p>
          </Section>

          <Section id="menores" title="Menores">
            <p>
              BG Planner no está pensado para menores de 14 años. Si crees que un menor nos ha dado
              sus datos, avísanos y los borramos.
            </p>
          </Section>

          <Section id="cambios" title="Cambios en esta política">
            <p>
              Si cambiamos algo importante, lo contaremos en el{" "}
              <Link href="/changelog" className="text-[var(--primary)] hover:underline">changelog</Link>{" "}
              y actualizaremos la fecha de arriba.
            </p>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
