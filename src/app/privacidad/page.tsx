import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import SmartNav from "@/components/SmartNav";

export const metadata: Metadata = {
  title: "Política de privacidad · BG Planner",
  description:
    "Cómo BG Planner recoge, usa y protege tus datos personales: qué guardamos, con quién lo compartimos y qué derechos tienes.",
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

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SmartNav />

      <main className="max-w-3xl mx-auto py-8 sm:py-12 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Política de privacidad</h1>
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
            jurídico</strong> y puede contener imprecisiones, apartados incompletos o datos
            identificativos por completar. No debe considerarse el texto legal definitivo de BG
            Planner. Si detectas algo que no encaja con lo que hace la app,{" "}
            <Link href="/contact" className="text-[var(--primary)] hover:underline">
              escríbenos
            </Link>
            .
          </p>
        </div>

        <div className="space-y-10">
          <Section id="responsable" title="1. Quién es el responsable">
            <p>
              BG Planner (<span className="font-mono text-xs">bgplanner.app</span>) es un proyecto
              personal que permite a grupos de amigos organizar sus partidas de juegos de mesa.
            </p>
            <p>
              Datos de contacto del responsable del tratamiento:{" "}
              <a
                href="mailto:cesar@tiradacritica.es"
                className="text-[var(--primary)] hover:underline"
              >
                cesar@tiradacritica.es
              </a>{" "}
              o el{" "}
              <Link href="/contact" className="text-[var(--primary)] hover:underline">
                formulario de contacto
              </Link>
              .
            </p>
            <p className="text-[var(--text-muted)] text-sm">
              Pendiente de completar: identificación fiscal y domicilio del responsable, exigidos
              por el RGPD en la versión definitiva.
            </p>
          </Section>

          <Section id="datos" title="2. Qué datos recogemos">
            <p>
              Solo tratamos los datos necesarios para que la aplicación funcione. No compramos
              datos a terceros ni elaboramos perfiles publicitarios.
            </p>

            <h3 className="text-base font-semibold text-[var(--text)] pt-2">
              Datos de acceso a la cuenta
            </h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Dirección de correo electrónico.</strong> BG Planner no usa contraseñas:
                para entrar te enviamos un código de un solo uso de 6 dígitos a tu email. Ese
                código se guarda temporalmente asociado a tu dirección y caduca a los 10 minutos.
              </li>
              <li>
                <strong>Sesión iniciada.</strong> Tras validar el código guardamos en tu navegador
                o dispositivo una cookie técnica (<span className="font-mono text-xs">session</span>
                ) con un identificador firmado. Caduca a los 60 días y es imprescindible para
                mantenerte dentro de la app.
              </li>
            </ul>

            <h3 className="text-base font-semibold text-[var(--text)] pt-2">Datos de perfil</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Nombre, apellidos y nombre visible</strong> con el que apareces ante el
                resto de miembros de tus grupos.
              </li>
              <li>
                <strong>Ubicación</strong> (texto libre, por ejemplo tu ciudad), para que otros
                jugadores sepan por dónde te mueves.
              </li>
              <li>
                <strong>Foto de perfil</strong>, si decides subir una.
              </li>
              <li>
                <strong>Nombre de usuario de BoardGameGeek</strong>, si quieres importar tu
                colección de juegos.
              </li>
            </ul>
            <p>
              Todos estos campos son opcionales salvo el correo electrónico. Puedes editarlos o
              vaciarlos en cualquier momento desde tu perfil.
            </p>

            <h3 className="text-base font-semibold text-[var(--text)] pt-2">
              Contenido que creas en la app
            </h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Grupos y eventos</strong> que creas o a los que te unes, tu rol en ellos y
                las invitaciones que envías (que incluyen la dirección de correo de la persona
                invitada).
              </li>
              <li>
                <strong>Votos</strong> sobre los juegos de cada grupo, que alimentan el ranking.
              </li>
              <li>
                <strong>Comentarios, opiniones y reseñas</strong> de juegos y eventos, con su
                puntuación y su texto.
              </li>
              <li>
                <strong>Partidas y sesiones</strong> planificadas o jugadas, y tu nivel de interés
                en los juegos propuestos para un evento.
              </li>
              <li>
                <strong>Fotos</strong> que subes a las galerías de grupo y de evento o adjuntas a
                una opinión de partida.
              </li>
            </ul>

            <h3 className="text-base font-semibold text-[var(--text)] pt-2">
              Registro de actividad
            </h3>
            <p>
              La app guarda un historial de acciones (crear un grupo, unirse, añadir un juego,
              votar, publicar una opinión, apuntarse a un evento, subir una foto...) con quién la
              hizo, en qué grupo o evento y cuándo. Sirve para construir el muro de actividad que
              ven los miembros de tu grupo y, en algunos casos concretos —como crear un grupo o
              apuntarse a un evento—, el muro público de la aplicación.
            </p>

            <h3 className="text-base font-semibold text-[var(--text)] pt-2">
              Mensajes que nos envías
            </h3>
            <p>
              Los formularios de contacto y de feedback nos llegan por correo electrónico junto con
              el nombre y la dirección desde la que escribes, y las imágenes que adjuntes. Esos
              mensajes no se guardan en la base de datos de la aplicación, viven en nuestro buzón
              de correo.
            </p>

            <h3 className="text-base font-semibold text-[var(--text)] pt-2">
              Datos técnicos y de uso
            </h3>
            <p>
              Nuestro proveedor de alojamiento recoge estadísticas de uso agregadas y anónimas
              (páginas visitadas, tipo de dispositivo, país aproximado) para saber qué partes de la
              app se usan. No utilizamos cookies publicitarias ni de seguimiento entre sitios.
            </p>
          </Section>

          <Section id="finalidad" title="3. Para qué usamos tus datos y con qué base legal">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Prestar el servicio</strong> (identificarte, mostrarte tus grupos, calcular
                rankings, organizar partidas y eventos): ejecución del contrato que aceptas al
                registrarte.
              </li>
              <li>
                <strong>Enviarte correos imprescindibles</strong>: códigos de acceso, invitaciones
                a grupos y eventos, convocatorias para votar y recordatorios para valorar una
                partida o un evento pasado. Ejecución del contrato e interés legítimo en que la
                aplicación cumpla su función.
              </li>
              <li>
                <strong>Importar tu colección de BoardGameGeek</strong>: consentimiento, que
                otorgas al indicar voluntariamente tu nombre de usuario de BGG.
              </li>
              <li>
                <strong>Mantener la seguridad y evitar abusos</strong> (límites de envío de
                códigos, moderación de contenido denunciado): interés legítimo.
              </li>
              <li>
                <strong>Mejorar la aplicación</strong> mediante estadísticas agregadas: interés
                legítimo.
              </li>
            </ul>
            <p>
              No tomamos decisiones automatizadas con efectos jurídicos sobre ti ni hacemos
              elaboración de perfiles con fines comerciales.
            </p>
          </Section>

          <Section id="visibilidad" title="4. Quién puede ver lo que publicas">
            <p>
              Tu perfil, tus votos, tus comentarios, tus opiniones y tus fotos son visibles para el
              resto de miembros del grupo o de los participantes del evento correspondiente. Los
              eventos marcados como públicos, y algunas acciones del registro de actividad, pueden
              verse desde fuera del grupo dentro de la aplicación.
            </p>
            <p>
              Ten en cuenta además que <strong>las imágenes que subes se almacenan en direcciones
              de acceso público</strong>: cualquiera que conozca la URL exacta de una foto puede
              abrirla aunque no tenga cuenta en BG Planner. No subas imágenes que no quieras que
              salgan de tu círculo.
            </p>
          </Section>

          <Section id="encargados" title="5. Con quién compartimos tus datos">
            <p>
              No vendemos ni cedemos tus datos personales. Para funcionar nos apoyamos en los
              siguientes proveedores, que los tratan por cuenta nuestra y siguiendo nuestras
              instrucciones:
            </p>
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface-alt)] text-[var(--text)]">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2.5">Proveedor</th>
                    <th className="text-left font-semibold px-4 py-2.5">Para qué</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <tr>
                    <td className="px-4 py-3 align-top font-medium text-[var(--text)]">Supabase</td>
                    <td className="px-4 py-3 align-top">
                      Base de datos donde vive tu cuenta y todo el contenido de grupos y eventos, y
                      almacenamiento de las fotos que subes.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 align-top font-medium text-[var(--text)]">Vercel</td>
                    <td className="px-4 py-3 align-top">
                      Alojamiento de la aplicación y estadísticas de uso agregadas.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 align-top font-medium text-[var(--text)]">Resend</td>
                    <td className="px-4 py-3 align-top">
                      Envío de los correos de la aplicación: códigos de acceso, invitaciones,
                      convocatorias y recordatorios.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 align-top font-medium text-[var(--text)]">
                      BoardGameGeek
                    </td>
                    <td className="px-4 py-3 align-top">
                      Consulta de la ficha de los juegos y, si nos lo pides, de tu colección
                      pública. Le enviamos únicamente el nombre de usuario de BGG que tú nos has
                      indicado.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Algunos de estos proveedores están radicados fuera del Espacio Económico Europeo o
              pueden procesar datos en servidores situados fuera de él. En esos casos la
              transferencia se ampara en las cláusulas contractuales tipo aprobadas por la Comisión
              Europea u otras garantías equivalentes previstas en sus condiciones de servicio.
            </p>
            <p className="text-[var(--text-muted)] text-sm">
              Pendiente de completar: confirmar la región concreta de alojamiento de cada proveedor
              y enlazar sus respectivos acuerdos de tratamiento de datos.
            </p>
          </Section>

          <Section id="conservacion" title="6. Cuánto tiempo guardamos tus datos">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Códigos de acceso</strong>: caducan a los 10 minutos y quedan invalidados
                en cuanto los usas.
              </li>
              <li>
                <strong>Sesión iniciada</strong>: 60 días, o hasta que cierras sesión.
              </li>
              <li>
                <strong>Cuenta, perfil y contenido</strong>: mientras mantengas la cuenta activa.
              </li>
              <li>
                <strong>Colección importada de BoardGameGeek</strong>: se guarda una copia que se
                refresca cada 24 horas y se elimina si dejas de tener un usuario de BGG asociado.
              </li>
              <li>
                <strong>Registro de actividad</strong>: mientras exista el grupo o el evento al que
                se refiere.
              </li>
            </ul>
            <p>
              Cuando eliminas tu cuenta borramos tus datos personales de inmediato. El contenido que
              pertenece a la vida del grupo —los juegos que añadiste o el histórico de partidas
              organizadas— se conserva traspasado a otro miembro, sin vincularlo ya a tu identidad.
              Consulta el detalle en el apartado de eliminación de cuenta.
            </p>
          </Section>

          <Section id="derechos" title="7. Tus derechos">
            <p>
              El Reglamento General de Protección de Datos te reconoce los siguientes derechos, que
              puedes ejercer de forma gratuita:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Acceso</strong>: saber qué datos tuyos tratamos y obtener una copia.
              </li>
              <li>
                <strong>Rectificación</strong>: corregir datos inexactos. La mayoría los puedes
                cambiar tú mismo desde tu perfil.
              </li>
              <li>
                <strong>Supresión</strong>: pedir que borremos tus datos.
              </li>
              <li>
                <strong>Oposición y limitación</strong>: oponerte a determinados tratamientos o
                pedir que los restrinjamos.
              </li>
              <li>
                <strong>Portabilidad</strong>: recibir tus datos en un formato estructurado y de
                uso común.
              </li>
              <li>
                <strong>Retirar el consentimiento</strong> en cualquier momento, sin que ello
                afecte a la licitud del tratamiento anterior.
              </li>
            </ul>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--card-shadow)]">
              <h3 className="text-base font-semibold text-[var(--text)] mb-1.5">
                Eliminar tu cuenta
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Puedes borrar tu cuenta y los datos asociados tú mismo desde la propia aplicación,
                en <strong>Perfil → Eliminar cuenta</strong>. Para evitar borrados accidentales te
                pediremos que escribas tu dirección de correo como confirmación.
              </p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-3">
                La eliminación es inmediata y definitiva, y no se puede deshacer. Se borran tu
                perfil, tus votos, tus comentarios, tus opiniones y reseñas, tus intereses en
                eventos, tus pertenencias a grupos, tu registro de actividad, los códigos de acceso
                pendientes y las fotos que hayas subido, tanto de la base de datos como del
                almacenamiento.
              </p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-3">
                Lo que pertenece al grupo y no a ti —los juegos que añadiste a un grupo, las
                partidas que organizaste o el propio grupo o evento si lo creaste tú— no se destruye:
                se traspasa a otro miembro para no borrar el histórico de los demás. Si no queda
                nadie más en ese grupo o evento, se elimina por completo.
              </p>
            </div>

            <p>
              Para ejercer cualquiera de estos derechos escríbenos a{" "}
              <a
                href="mailto:cesar@tiradacritica.es"
                className="text-[var(--primary)] hover:underline"
              >
                cesar@tiradacritica.es
              </a>{" "}
              o usa el{" "}
              <Link href="/contact" className="text-[var(--primary)] hover:underline">
                formulario de contacto
              </Link>
              . Te responderemos en el plazo máximo de un mes. Si consideras que no hemos atendido
              tu solicitud correctamente, puedes reclamar ante la Agencia Española de Protección de
              Datos (
              <a
                href="https://www.aepd.es"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:underline"
              >
                aepd.es
              </a>
              ).
            </p>
          </Section>

          <Section id="menores" title="8. Menores de edad">
            <p>
              BG Planner está pensado para mayores de 14 años. Si eres menor de esa edad no debes
              crear una cuenta. Si detectamos que una cuenta pertenece a un menor de 14 años sin el
              consentimiento de sus tutores, la eliminaremos.
            </p>
          </Section>

          <Section id="seguridad" title="9. Seguridad">
            <p>
              No usamos contraseñas, así que no hay contraseñas que puedan filtrarse. El acceso se
              hace mediante códigos de un solo uso con caducidad corta y límite de envíos, y la
              sesión viaja en una cookie que el navegador no expone a JavaScript. Todo el tráfico va
              cifrado. Aun así, ningún sistema es infalible: si detectamos una brecha que afecte a
              tus datos te lo comunicaremos y lo notificaremos a la autoridad de control cuando
              proceda.
            </p>
          </Section>

          <Section id="cambios" title="10. Cambios en esta política">
            <p>
              Podemos actualizar esta política si cambian las funcionalidades de la aplicación o los
              proveedores que utilizamos. La fecha de la última actualización aparece al principio
              de la página, y te avisaremos dentro de la app si el cambio es relevante.
            </p>
          </Section>

          <Section id="contacto" title="11. Contacto">
            <p>
              Para cualquier duda sobre esta política o sobre cómo tratamos tus datos, escríbenos a{" "}
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
              . También puedes consultar los{" "}
              <Link href="/terminos" className="text-[var(--primary)] hover:underline">
                términos de uso
              </Link>{" "}
              o la{" "}
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
