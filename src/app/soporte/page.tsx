import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import SmartNav from "@/components/SmartNav";

export const metadata: Metadata = {
  title: "Soporte · BG Planner",
  description:
    "Ayuda y contacto de BG Planner: resuelve dudas frecuentes sobre el acceso, BoardGameGeek, los grupos y tu cuenta.",
};

const FAQS: { question: string; answer: React.ReactNode }[] = [
  {
    question: "No me llega el código de acceso",
    answer: (
      <>
        <p>
          BG Planner no usa contraseñas: al escribir tu email te enviamos un código de 6 dígitos que
          caduca a los 10 minutos. Si no te llega:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>Revisa la carpeta de spam o correo no deseado.</li>
          <li>
            Comprueba que has escrito bien la dirección. El código va a la dirección exacta que
            introduces.
          </li>
          <li>
            Espera un minuto antes de volver a pedirlo: solo se pueden solicitar 3 códigos cada 5
            minutos, y al superar ese límite hay que esperar.
          </li>
          <li>
            Si tu correo es corporativo, puede que el filtro lo esté bloqueando. Añade{" "}
            <span className="font-mono text-xs">cesar@tiradacritica.es</span> a tus contactos o
            prueba con otra dirección.
          </li>
        </ul>
      </>
    ),
  },
  {
    question: "¿Cómo conecto mi cuenta de BoardGameGeek?",
    answer: (
      <>
        <p>
          Ve a <strong>Perfil</strong> y escribe tu nombre de usuario de BoardGameGeek en el campo
          correspondiente. Al guardar comprobamos que existe y ya podrás importar tus juegos a
          cualquier grupo.
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            Tu colección en BGG tiene que ser <strong>pública</strong>; si no, no podemos leerla.
          </li>
          <li>
            La primera importación puede tardar un poco: BGG prepara las colecciones grandes bajo
            demanda y hay que esperar a que responda.
          </li>
          <li>
            Guardamos una copia de tu colección que se actualiza cada 24 horas, así que si acabas de
            añadir un juego en BGG puede tardar en aparecer. Puedes forzar la actualización desde la
            propia pantalla de colección.
          </li>
        </ul>
      </>
    ),
  },
  {
    question: "¿Cómo salgo de un grupo?",
    answer: (
      <>
        <p>
          Pídele a un administrador del grupo que te dé de baja: los administradores gestionan los
          miembros desde la pantalla del grupo.
        </p>
        <p className="mt-2">
          Si quieres desaparecer de todos tus grupos a la vez, puedes eliminar tu cuenta desde{" "}
          <strong>Perfil → Eliminar cuenta</strong>. Y si no consigues contactar con ningún
          administrador,{" "}
          <Link href="/contact" className="text-[var(--primary)] hover:underline">
            escríbenos
          </Link>{" "}
          y te ayudamos.
        </p>
      </>
    ),
  },
  {
    question: "¿Cómo borro mi cuenta?",
    answer: (
      <>
        <p>
          Entra en <strong>Perfil</strong> y usa la opción <strong>Eliminar cuenta</strong>. Te
          pediremos que escribas tu dirección de correo para confirmar.
        </p>
        <p className="mt-2">
          El borrado es inmediato y no se puede deshacer: se eliminan tu perfil, tus votos,
          comentarios, opiniones y las fotos que hayas subido. Lo que pertenece al grupo —juegos
          añadidos, partidas organizadas— se traspasa a otro miembro para no romper su histórico, y
          los grupos o eventos en los que no quede nadie se eliminan del todo. Tienes el detalle en
          la{" "}
          <Link href="/privacidad" className="text-[var(--primary)] hover:underline">
            política de privacidad
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    question: "He visto contenido ofensivo o abusivo",
    answer: (
      <>
        <p>
          No lo toleramos. Escríbenos desde la{" "}
          <Link href="/contact" className="text-[var(--primary)] hover:underline">
            página de contacto
          </Link>{" "}
          indicando en qué grupo o evento está el contenido y qué ha pasado. Revisamos todas las
          denuncias y actuamos en un plazo máximo de 24 horas, retirando el contenido y expulsando a
          quien lo haya publicado si procede. Puedes consultar nuestra política de tolerancia cero
          en los{" "}
          <Link href="/terminos" className="text-[var(--primary)] hover:underline">
            términos de uso
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    question: "Creo que he encontrado un error",
    answer: (
      <p>
        Cuéntanoslo desde{" "}
        <Link href="/feedback" className="text-[var(--primary)] hover:underline">
          Feedback
        </Link>{" "}
        (necesitas haber iniciado sesión). Puedes adjuntar capturas de pantalla, que ayudan mucho a
        entender qué ha pasado. Si el error te impide entrar en la app, escríbenos desde{" "}
        <Link href="/contact" className="text-[var(--primary)] hover:underline">
          Contacto
        </Link>
        .
      </p>
    ),
  },
];

export default function SoportePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SmartNav />

      <main className="max-w-2xl mx-auto py-8 sm:py-12 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Soporte</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          ¿Algo no funciona como esperabas o tienes una duda? Aquí tienes las respuestas rápidas y
          las formas de llegar hasta nosotros.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 mb-12">
          <Link
            href="/contact"
            className="block bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] hover:border-[var(--primary)] transition-all duration-200"
          >
            <h2 className="font-semibold text-[var(--text)] mb-1">Contacto</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Para cualquier consulta, incluso si no tienes cuenta. Te respondemos por correo.
            </p>
          </Link>

          <Link
            href="/feedback"
            className="block bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] hover:border-[var(--primary)] transition-all duration-200"
          >
            <h2 className="font-semibold text-[var(--text)] mb-1">Feedback</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Errores e ideas para mejorar la app, con capturas de pantalla. Requiere sesión
              iniciada.
            </p>
          </Link>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-12">
          También puedes escribirnos directamente a{" "}
          <a
            href="mailto:cesar@tiradacritica.es"
            className="text-[var(--primary)] hover:underline"
          >
            cesar@tiradacritica.es
          </a>
          . Solemos responder en un par de días laborables.
        </p>

        <h2 className="text-2xl font-bold mb-5">Preguntas frecuentes</h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-5 py-4 shadow-[var(--card-shadow)]"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-semibold text-[var(--text)]">
                <span>{faq.question}</span>
                <span className="text-[var(--text-muted)] shrink-0 transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)] text-sm text-[var(--text-secondary)]">
          <p>
            Consulta también los{" "}
            <Link href="/terminos" className="text-[var(--primary)] hover:underline">
              términos de uso
            </Link>
            , la{" "}
            <Link href="/privacidad" className="text-[var(--primary)] hover:underline">
              política de privacidad
            </Link>{" "}
            y el{" "}
            <Link href="/changelog" className="text-[var(--primary)] hover:underline">
              changelog
            </Link>{" "}
            para ver las novedades.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
