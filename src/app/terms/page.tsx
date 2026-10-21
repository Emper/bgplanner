import type { Metadata } from "next";
import Link from "next/link";
import SmartNav from "@/components/SmartNav";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { CONTACT_EMAIL } from "@/lib/contact";
import { absoluteUrl } from "@/lib/site";

const UPDATED = "15 de octubre de 2026";

export const metadata: Metadata = {
  title: "Términos de uso · BG Planner",
  description:
    "Las normas de BG Planner: qué se puede publicar, tolerancia cero con el contenido ofensivo y el acoso, cómo denunciar y qué pasa si alguien se las salta.",
  alternates: { canonical: absoluteUrl("/terms") },
};

// Lo piden App Store (guideline 1.2) y Google Play para las apps con contenido
// de usuarios: unas normas aceptadas al entrar (el texto está en /login) que
// digan que no se tolera contenido ofensivo, cómo denunciar y qué pasa si se
// incumplen. Si cambia la moderación (Moderation.tsx, lib/moderation.ts),
// esta página tiene que cambiar con ello.

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold text-[var(--text)] mb-3">{title}</h2>
      <div className="space-y-3 text-[var(--text-secondary)] leading-relaxed">{children}</div>
    </section>
  );
}

const NOT_ALLOWED = [
  {
    label: "Acoso e insultos",
    text: "meterse con alguien, humillarle, amenazarle, perseguirle por mensajes o avisos, o animar a otros a hacerlo.",
  },
  {
    label: "Odio y discriminación",
    text: "atacar o despreciar a nadie por su origen, etnia, religión, sexo, género, orientación sexual, discapacidad, edad o cualquier otra condición.",
  },
  {
    label: "Contenido sexual o violento",
    text: "desnudos, pornografía, violencia explícita o cualquier cosa que sexualice a menores (esto último, además, lo denunciamos a las autoridades).",
  },
  {
    label: "Datos y fotos de otros",
    text: "publicar el email, el teléfono, la dirección u otros datos privados de alguien, o fotos en las que salga gente que no quiere estar ahí.",
  },
  {
    label: "Spam y engaños",
    text: "publicidad que nadie ha pedido, mensajes repetidos, enlaces fraudulentos o hacerse pasar por otra persona.",
  },
  {
    label: "Cosas ilegales",
    text: "contenido que infrinja la ley o los derechos de otros, como subir fotos o textos que no son tuyos sin permiso.",
  },
];

export default function TermsPage() {
  return (
    <PageShell nav={<SmartNav />} width="text">
      <PageHeader title="Términos de uso" lead={`Última actualización: ${UPDATED}`} />

      <Card padding="lg" className="mb-10">
        <h2 className="font-semibold text-[var(--text)] mb-2">En corto</h2>
        <ul className="space-y-1.5 text-sm text-[var(--text-secondary)] leading-relaxed list-disc list-inside">
          <li>BG Planner es para organizar partidas con buen rollo. Trata a los demás como en tu mesa de juego favorita.</li>
          <li>
            <strong className="text-[var(--text)]">Tolerancia cero</strong> con el contenido ofensivo, el acoso y
            el odio: lo retiramos y echamos a quien lo publique.
          </li>
          <li>Si ves algo que no debería estar aquí, denúncialo desde su menú ⋯. Si alguien te molesta, bloquéale.</li>
          <li>
            Al entrar en BG Planner aceptas estos términos y la{" "}
            <Link href="/privacy" className="text-[var(--primary)] hover:underline">política de privacidad</Link>.
          </li>
        </ul>
      </Card>

      <div className="space-y-10">
        <Section id="aceptar" title="Qué aceptas al entrar">
          <p>
            Para usar BG Planner hay que crear una cuenta, y se crea la primera vez que entras con tu email. Al
            hacerlo aceptas estos términos y nuestra{" "}
            <Link href="/privacy" className="text-[var(--primary)] hover:underline">política de privacidad</Link>.
            Si no estás de acuerdo con ellos, no uses la app.
          </p>
          <p>
            Tienes que tener al menos 14 años. Cada cuenta es de una persona: no la compartas y cuida el acceso a
            tu email, porque es la llave para entrar.
          </p>
        </Section>

        <Section id="normas" title="Lo que no tiene sitio en BG Planner">
          <p>
            En BG Planner publicas cosas que leen otras personas: mensajes en la Comunidad, comentarios y
            opiniones, fotos en grupos y eventos, tu perfil. En todo eso{" "}
            <strong className="text-[var(--text)]">no toleramos ningún contenido ofensivo ni ningún tipo de
            acoso</strong>. En concreto, no está permitido:
          </p>
          <ul className="space-y-2">
            {NOT_ALLOWED.map((item) => (
              <li key={item.label}>
                <strong className="text-[var(--text)]">{item.label}:</strong> {item.text}
              </li>
            ))}
          </ul>
          <p>
            Discutir sobre si un juego es una obra maestra o un truño está bien; meterse con quien opina distinto,
            no.
          </p>
        </Section>

        <Section id="denunciar" title="Cómo denunciar y bloquear">
          <ul className="space-y-2 list-disc list-inside">
            <li>
              <strong className="text-[var(--text)]">Denunciar:</strong> abre el menú{" "}
              <span aria-label="tres puntos">⋯</span> de cualquier hilo, respuesta, foto, opinión o perfil y pulsa
              «🚩 Denunciar». Nunca le decimos a nadie quién le ha denunciado.
            </li>
            <li>
              <strong className="text-[var(--text)]">Bloquear:</strong> desde el mismo menú de su perfil o de sus
              mensajes. Dejarás de ver lo que escribe en la Comunidad y de recibir sus avisos. Puedes deshacerlo
              desde tu perfil.
            </li>
            <li>
              <strong className="text-[var(--text)]">Escribirnos:</strong> para cualquier otra cosa, usa{" "}
              <Link href="/contact#moderacion" className="text-[var(--primary)] hover:underline">
                el contacto de moderación
              </Link>{" "}
              o escribe a{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--primary)] hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </li>
          </ul>
          <p>
            Revisamos las denuncias en menos de 24 horas. Lo que acumula varias denuncias en la Comunidad se
            oculta solo mientras tanto.
          </p>
        </Section>

        <Section id="incumplir" title="Qué pasa si alguien se salta las normas">
          <ul className="space-y-2 list-disc list-inside">
            <li>
              <strong className="text-[var(--text)]">Retiramos el contenido</strong> que incumpla estos términos,
              sin necesidad de avisar antes.
            </li>
            <li>
              <strong className="text-[var(--text)]">Expulsamos a quien lo publicó:</strong> cerramos su cuenta y
              no puede volver a usar BG Planner. En casos leves podemos empezar por un aviso, pero el acoso, el
              odio y el contenido sexual o violento suponen la expulsión directa.
            </li>
            <li>
              Si algo puede ser un delito, se lo comunicamos a las autoridades.
            </li>
          </ul>
        </Section>

        <Section id="contenido" title="Lo que publicas">
          <p>
            Lo que subes sigue siendo tuyo. Solo nos das permiso para guardarlo y enseñarlo dentro de BG Planner a
            quien corresponda (tu grupo, tu evento o todo el mundo si es la Comunidad o tu perfil público), y
            para quitarlo si incumple estas normas. Tú respondes de lo que publicas, así que sube solo lo que
            tengas derecho a compartir.
          </p>
          <p>
            Los datos de los juegos (nombres, imágenes, puntuaciones) vienen de{" "}
            <a
              href="https://boardgamegeek.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline"
            >
              BoardGameGeek
            </a>{" "}
            y son de sus autores.
          </p>
        </Section>

        <Section id="servicio" title="El servicio">
          <p>
            BG Planner es un proyecto independiente y gratuito. Hacemos lo posible para que funcione bien, pero se
            ofrece tal cual: puede fallar, cambiar o dejar de existir, y no respondemos de partidas que no salgan
            como esperabas. Si algún día cerramos, avisaremos con tiempo.
          </p>
          <p>
            Puedes irte cuando quieras borrando tu cuenta desde{" "}
            <Link href="/profile" className="text-[var(--primary)] hover:underline">tu perfil</Link>. Lo que pasa
            con tus datos al hacerlo está en la{" "}
            <Link href="/privacy#borrar" className="text-[var(--primary)] hover:underline">política de privacidad</Link>.
          </p>
          <p>Estos términos se rigen por la ley española.</p>
        </Section>

        <Section id="cambios" title="Cambios en estos términos">
          <p>
            Si cambiamos algo importante, lo contaremos en el{" "}
            <Link href="/changelog" className="text-[var(--primary)] hover:underline">changelog</Link>{" "}
            y actualizaremos la fecha de arriba. Si sigues usando BG Planner después, entendemos que los aceptas.
            ¿Dudas? Escríbenos desde{" "}
            <Link href="/contact" className="text-[var(--primary)] hover:underline">contacto</Link>.
          </p>
        </Section>
      </div>
    </PageShell>
  );
}
