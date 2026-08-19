import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import SmartNav from "@/components/SmartNav";

export const metadata: Metadata = {
  title: "Términos de uso · BG Planner",
  description:
    "Condiciones de uso de BG Planner: qué puedes hacer en la aplicación, qué contenido está prohibido y cómo denunciar abusos.",
};

const LAST_UPDATED = "19 de agosto de 2026";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl sm:text-2xl font-bold mb-3 text-[var(--text)]">{title}</h2>
      <div className="space-y-3 text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SmartNav />

      <main className="max-w-3xl mx-auto py-8 sm:py-12 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Términos de uso</h1>
        <p className="text-[var(--text-muted)] text-sm mb-6">
          Última actualización: {LAST_UPDATED}
        </p>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-10">
          <h2 className="text-base font-semibold text-amber-500 mb-1.5">
            Borrador pendiente de revisión legal
          </h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Este documento es un <strong>borrador</strong> redactado a partir del funcionamiento
            real de la aplicación. Todavía <strong>no ha sido revisado por un profesional
            jurídico</strong> y puede contener imprecisiones o apartados incompletos. No debe
            considerarse el texto legal definitivo de BG Planner.
          </p>
        </div>

        <div className="space-y-10">
          <Section id="objeto" title="1. Qué son estos términos">
            <p>
              Estos términos regulan el uso de BG Planner (
              <span className="font-mono text-xs">bgplanner.app</span> y sus aplicaciones móviles),
              un servicio que permite a grupos de amigos organizar sus partidas de juegos de mesa:
              importar colecciones, votar juegos, obtener un ranking y planificar sesiones y
              eventos.
            </p>
            <p>
              Al crear una cuenta o usar la aplicación aceptas estos términos y nuestra{" "}
              <Link href="/privacidad" className="text-[var(--primary)] hover:underline">
                política de privacidad
              </Link>
              . Si no estás de acuerdo con ellos, no uses el servicio.
            </p>
          </Section>

          <Section id="cuenta" title="2. Tu cuenta">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Para usar BG Planner necesitas una cuenta, que se crea con una dirección de correo
                electrónico válida a la que tengas acceso. No hay contraseñas: el acceso se hace
                mediante códigos de un solo uso enviados a ese correo.
              </li>
              <li>
                Debes tener al menos 14 años. Si eres menor de 18, necesitas el permiso de tus
                padres o tutores.
              </li>
              <li>
                Eres responsable de todo lo que ocurra en tu cuenta y de mantener el acceso a tu
                correo protegido. Avísanos si sospechas que alguien está usando tu cuenta.
              </li>
              <li>
                Una cuenta es personal: no la compartas ni la cedas a terceros, y no crees cuentas
                haciéndote pasar por otra persona.
              </li>
            </ul>
          </Section>

          <Section id="uso" title="3. Uso aceptable del servicio">
            <p>Al usar BG Planner te comprometes a no:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Usar el servicio para cualquier fin ilícito o contrario a estos términos.</li>
              <li>
                Suplantar la identidad de otra persona o dar información falsa sobre quién eres.
              </li>
              <li>
                Acceder a grupos, eventos o contenido a los que no has sido invitado, o intentar
                sortear los controles de acceso de la aplicación.
              </li>
              <li>
                Enviar spam, publicidad no solicitada o invitaciones masivas a personas que no te
                han pedido participar.
              </li>
              <li>
                Interferir en el funcionamiento del servicio: automatizar peticiones de forma
                abusiva, intentar saturarlo o explotar vulnerabilidades. Si encuentras un fallo de
                seguridad, cuéntanoslo en lugar de aprovecharlo.
              </li>
              <li>
                Extraer de forma masiva datos de la aplicación o de terceros a los que consultamos,
                como BoardGameGeek.
              </li>
            </ul>
          </Section>

          <Section id="contenido" title="4. El contenido que publicas">
            <p>
              BG Planner es una aplicación con contenido generado por sus usuarios: comentarios,
              opiniones y reseñas de juegos y eventos, nombres de grupos, descripciones y fotos de
              galería.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>El contenido sigue siendo tuyo.</strong> Al publicarlo nos concedes una
                licencia no exclusiva y gratuita para almacenarlo y mostrarlo dentro de la
                aplicación a las personas con las que lo compartes, con la única finalidad de
                prestar el servicio.
              </li>
              <li>
                <strong>Eres responsable de lo que publicas.</strong> Debes tener los derechos
                necesarios sobre las fotos y textos que subes. No publiques imágenes de otras
                personas sin su permiso.
              </li>
              <li>
                <strong>Puedes borrarlo.</strong> Puedes eliminar tus comentarios, opiniones y fotos
                desde la propia aplicación, y eliminar tu cuenta cuando quieras.
              </li>
            </ul>
          </Section>

          <Section id="tolerancia-cero" title="5. Tolerancia cero con el contenido ofensivo">
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
              <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed">
                <strong>
                  En BG Planner aplicamos una política de tolerancia cero con el contenido ofensivo
                  o abusivo y con los comportamientos de acoso.
                </strong>{" "}
                No se permite ningún tipo de contenido objetable, y quien lo publique se expone a la
                retirada inmediata del contenido y a la expulsión permanente del servicio, sin
                previo aviso.
              </p>
            </div>
            <p>Queda expresamente prohibido publicar, enviar o compartir contenido que:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Sea ofensivo, insultante, degradante o incite al odio o a la violencia por razón de
                raza, origen, sexo, orientación sexual, identidad de género, religión, discapacidad,
                edad o cualquier otra condición.
              </li>
              <li>
                Constituya acoso, amenazas, intimidación o difusión de datos personales de otra
                persona sin su consentimiento.
              </li>
              <li>
                Sea sexualmente explícito o pornográfico, o cualquier material que implique a
                menores.
              </li>
              <li>
                Sea violento, gráficamente perturbador, o promueva actividades ilegales,
                autolesiones o el consumo de sustancias ilícitas.
              </li>
              <li>
                Infrinja derechos de autor, marcas u otros derechos de terceros, o sea difamatorio o
                falso.
              </li>
              <li>Sea spam, estafa o intento de fraude.</li>
            </ul>

            <h3 className="text-base font-semibold text-[var(--text)] pt-2">
              Cómo denunciar contenido
            </h3>
            <p>
              Cualquier usuario puede denunciar contenido ofensivo o abusivo desde la propia
              aplicación, usando la opción <strong>Denunciar</strong> disponible en comentarios,
              opiniones y fotos. También puedes escribirnos directamente desde la{" "}
              <Link href="/contact" className="text-[var(--primary)] hover:underline">
                página de contacto
              </Link>{" "}
              indicando dónde está el contenido y por qué lo denuncias.
            </p>
            <p>
              Nos comprometemos a <strong>revisar toda denuncia y actuar en un plazo máximo de 24
              horas</strong>, retirando el contenido que incumpla estos términos y expulsando, si
              procede, a quien lo haya publicado.
            </p>

            <h3 className="text-base font-semibold text-[var(--text)] pt-2">Bloquear usuarios</h3>
            <p>
              Puedes <strong>bloquear</strong> a cualquier usuario desde su perfil o desde
              cualquiera de sus publicaciones. Al bloquear a alguien dejarás de ver su contenido y
              esa persona no podrá invitarte a grupos ni a eventos ni interactuar contigo dentro de
              la aplicación. Puedes gestionar tu lista de usuarios bloqueados desde tu perfil.
            </p>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                <strong className="text-amber-500">Aviso de borrador:</strong> las funciones de
                denunciar contenido y bloquear usuarios descritas en este apartado{" "}
                <strong>todavía no están implementadas en la versión actual de la aplicación</strong>
                . Son requisito de la directriz 1.2 de la App Store y deben existir antes de
                publicar la app. Mientras tanto, las denuncias se atienden por correo a través de la
                página de contacto.
              </p>
            </div>
          </Section>

          <Section id="moderacion" title="6. Moderación y suspensión de cuentas">
            <p>
              Podemos retirar contenido, suspender o eliminar una cuenta sin previo aviso cuando
              incumpla estos términos, especialmente el apartado anterior, o cuando su uso ponga en
              riesgo el servicio o a otros usuarios. También podemos retirar contenido si nos lo
              exige una autoridad competente.
            </p>
            <p>
              Los administradores de cada grupo pueden gestionar sus miembros y el contenido de su
              grupo. Eso no sustituye a la moderación de la aplicación: si algo se te ha ido de las
              manos dentro de un grupo, denúncialo igualmente.
            </p>
          </Section>

          <Section id="bgg" title="7. Contenido de terceros">
            <p>
              BG Planner consulta la información de los juegos y, si tú lo indicas, tu colección
              pública en{" "}
              <a
                href="https://boardgamegeek.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:underline"
              >
                BoardGameGeek
              </a>
              . Esos datos e imágenes pertenecen a BoardGameGeek y a sus respectivos titulares, y su
              uso está sujeto a las condiciones de ese servicio. BG Planner no está afiliado a
              BoardGameGeek ni a ningún editor de juegos de mesa.
            </p>
          </Section>

          <Section id="disponibilidad" title="8. Disponibilidad del servicio">
            <p>
              BG Planner se ofrece &laquo;tal cual&raquo; y de forma gratuita. Hacemos lo posible por
              mantenerlo disponible y por no perder tus datos, pero no garantizamos que funcione sin
              interrupciones ni errores. Podemos modificar, suspender o descontinuar funcionalidades
              en cualquier momento; si un cambio afecta de forma significativa a tus datos,
              intentaremos avisarte con antelación.
            </p>
          </Section>

          <Section id="responsabilidad" title="9. Limitación de responsabilidad">
            <p>
              En la medida en que lo permita la ley, no nos hacemos responsables de daños indirectos
              derivados del uso del servicio, de la pérdida de datos causada por fallos técnicos
              ajenos a nuestro control, ni del contenido publicado por otros usuarios. Nada en estos
              términos limita los derechos que la normativa de consumo te reconoce como usuario.
            </p>
          </Section>

          <Section id="baja" title="10. Cancelación">
            <p>
              Puedes dejar de usar BG Planner cuando quieras y eliminar tu cuenta desde{" "}
              <strong>Perfil → Eliminar cuenta</strong>. Podemos cancelar tu acceso si incumples
              estos términos. Consulta la{" "}
              <Link href="/privacidad" className="text-[var(--primary)] hover:underline">
                política de privacidad
              </Link>{" "}
              para saber qué ocurre con tus datos al darte de baja.
            </p>
          </Section>

          <Section id="cambios" title="11. Cambios en estos términos">
            <p>
              Podemos actualizar estos términos cuando cambien las funcionalidades de la aplicación
              o la normativa aplicable. La fecha de la última actualización aparece al principio de
              la página. Si el cambio es relevante, te avisaremos dentro de la app. Seguir usando el
              servicio después de un cambio implica que lo aceptas.
            </p>
          </Section>

          <Section id="ley" title="12. Ley aplicable y contacto">
            <p>
              Estos términos se rigen por la legislación española. Para cualquier duda o
              reclamación, escríbenos a{" "}
              <a
                href="mailto:cesar@tiradacritica.es"
                className="text-[var(--primary)] hover:underline"
              >
                cesar@tiradacritica.es
              </a>{" "}
              o desde la{" "}
              <Link href="/contact" className="text-[var(--primary)] hover:underline">
                página de contacto
              </Link>
              . Si necesitas ayuda con el uso de la app, visita la{" "}
              <Link href="/soporte" className="text-[var(--primary)] hover:underline">
                página de soporte
              </Link>
              .
            </p>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
