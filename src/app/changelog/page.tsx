"use client";

import Footer from "@/components/Footer";
import SmartNav from "@/components/SmartNav";

interface ChangelogEntry {
  date: string;
  version: string;
  title: string;
  changes: { type: "new" | "improved" | "fixed"; text: string }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "23 abril 2026",
    version: "1.3",
    title: "Tipos de grupo: ahora también «en pareja»",
    changes: [
      { type: "new", text: "Al crear un grupo eliges su modo: el clásico «con amigos» (👍, 👎 y un super voto) o el nuevo «en pareja» con una escala más fina del -1 al +5 para decidir entre dos con más matiz" },
      { type: "new", text: "Selector vistoso al crear un grupo que te explica para qué situación encaja mejor cada modo" },
      { type: "new", text: "Insignia con el modo del grupo junto a su nombre, para que se vea de un vistazo" },
    ],
  },
  {
    date: "23 abril 2026",
    version: "1.2",
    title: "Convoca a tu grupo a votar",
    changes: [
      { type: "new", text: "Nuevo botón \"Convocar a los jugadores\" para avisar al resto del grupo cuando queráis organizar la próxima partida, con la opción de añadir un mensaje personal" },
    ],
  },
  {
    date: "14 abril 2026",
    version: "1.1",
    title: "Super votos, imágenes de evento y dominio propio",
    changes: [
      { type: "new", text: "Indicador de super votos libres en el ranking: ve quién aún no lo ha usado y anímalo a jugársela" },
      { type: "new", text: "Sube una imagen para cada evento: aparece en el listado y en su ficha" },
      { type: "new", text: "Estrenamos dominio propio: la app vive ya en bgplanner.app" },
      { type: "fixed", text: "Los super votos se liberan al completar un juego también desde una sesión" },
      { type: "improved", text: "Tarjetas del modo oscuro con mejor contraste y más legibles" },
      { type: "improved", text: "La cabecera del ranking ya no se solapa con la barra de navegación" },
    ],
  },
  {
    date: "10 abril 2026",
    version: "1.0",
    title: "BG Planner: nueva identidad y rediseño visual",
    changes: [
      { type: "new", text: "Nueva marca: la app se llama ahora BG Planner, con logo e identidad renovados" },
      { type: "new", text: "Rediseño visual completo: nueva paleta, tipografía y portada pública" },
      { type: "new", text: "Animación circular al cambiar entre modo claro y oscuro" },
      { type: "new", text: "Loader con dado giratorio mientras cargan las páginas" },
      { type: "new", text: "Badge \"Powered by BGG\" en el pie" },
      { type: "improved", text: "La actividad del grupo carga notablemente más rápido" },
      { type: "improved", text: "Ya no tendrás que volver a iniciar sesión cada semana" },
      { type: "improved", text: "Se muestra el perfil de BGG en las listas de miembros y asistentes" },
      { type: "improved", text: "Los emails de los miembros quedan ocultos en las listas" },
    ],
  },
  {
    date: "7 abril 2026",
    version: "0.9",
    title: "Modo claro, feed de actividad y favoritos",
    changes: [
      { type: "new", text: "Modo claro y oscuro: se adapta a tu sistema o cámbialo a mano" },
      { type: "new", text: "Feed de actividad: ve en directo lo que pasa en tus grupos y eventos" },
      { type: "new", text: "Fija tus grupos favoritos con chincheta para tenerlos siempre a mano" },
      { type: "new", text: "Edita eventos después de crearlos: fecha, ubicación, asistentes o visibilidad" },
      { type: "improved", text: "Navegación más clara con la sección activa destacada" },
    ],
  },
  {
    date: "6 abril 2026",
    version: "0.8",
    title: "Sesiones rápidas, roles y gestión de juegos",
    changes: [
      { type: "new", text: "Crea una sesión desde el ranking: elige los juegos y lanza la partida en segundos" },
      { type: "new", text: "Marca juegos como jugados y archívalos para mantener el ranking limpio" },
      { type: "new", text: "Al completar un juego se avisa por email a quien tenía un super voto puesto" },
      { type: "new", text: "Roles de grupo: propietario, admin y miembro, con permisos diferenciados" },
      { type: "new", text: "Comparte la vista exacta que estás viendo: cada pestaña y sesión tiene su enlace" },
      { type: "improved", text: "Reordena juegos en una sesión y filtra por peso (Ligero, Medio, Pesado)" },
    ],
  },
  {
    date: "5 abril 2026",
    version: "0.6",
    title: "Eventos, portada pública y perfiles",
    changes: [
      { type: "new", text: "Eventos: organiza quedadas públicas o privadas, añade juegos y comparte el enlace de invitación" },
      { type: "new", text: "Lista de interés por juego con niveles y notas privadas" },
      { type: "new", text: "Nueva portada pública para que nuevos jugadores descubran la app" },
      { type: "new", text: "Foto de perfil con inicial coloreada cuando aún no has subido una" },
      { type: "new", text: "Los próximos eventos se ven directamente en la portada" },
    ],
  },
  {
    date: "4 abril 2026",
    version: "0.5",
    title: "Ranking visual y diseño responsive",
    changes: [
      { type: "new", text: "Medallas de oro, plata y bronce para el top 3 del ranking" },
      { type: "new", text: "Pasa el cursor por la puntuación para ver quién votó qué" },
      { type: "new", text: "Logo animado con dado giratorio e icono propio en la pestaña" },
      { type: "improved", text: "La app se ve bien en cualquier pantalla, móvil incluido" },
      { type: "fixed", text: "Las invitaciones por enlace detectan si ya eres miembro del grupo" },
    ],
  },
  {
    date: "3 abril 2026",
    version: "0.4",
    title: "Sesiones de juego y votación inteligente",
    changes: [
      { type: "new", text: "Planificador de sesiones: la app propone juegos según los votos y el tiempo que tengáis" },
      { type: "new", text: "Estado de cada juego en una sesión: pendiente, jugando, completado o saltado" },
      { type: "improved", text: "Tus votos se reflejan al instante" },
      { type: "improved", text: "Al añadir un juego al grupo queda registrado tu voto a favor automáticamente" },
    ],
  },
  {
    date: "2 abril 2026",
    version: "0.3",
    title: "Filtros avanzados y velocidad",
    changes: [
      { type: "new", text: "Las expansiones aparecen agrupadas bajo su juego base" },
      { type: "new", text: "Filtro \"Antiludoteca\" para descubrir juegos de la colección que aún no habéis probado" },
      { type: "improved", text: "Carga notablemente más rápida en toda la app" },
    ],
  },
  {
    date: "1 abril 2026",
    version: "0.2",
    title: "Colecciones BGG y sistema de votación",
    changes: [
      { type: "new", text: "Importa tu colección de BoardGameGeek con un clic" },
      { type: "new", text: "Sistema de votación: voto normal, super voto (suma más) y voto en contra" },
      { type: "new", text: "Ranking automático por puntuación" },
      { type: "new", text: "Invita a amigos al grupo por email" },
    ],
  },
  {
    date: "31 marzo 2026",
    version: "0.1",
    title: "MVP inicial",
    changes: [
      { type: "new", text: "Entra sin contraseña: te mandamos un código de acceso por email" },
      { type: "new", text: "Crea grupos y añade juegos de BoardGameGeek para empezar a votar" },
      { type: "new", text: "Diseño en modo oscuro de serie" },
    ],
  },
];

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "Nuevo", color: "bg-emerald-500/20 text-emerald-400" },
  improved: { label: "Mejora", color: "bg-blue-500/20 text-blue-400" },
  fixed: { label: "Fix", color: "bg-[var(--accent-soft)] text-[var(--primary)]" },
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SmartNav />

      <main className="max-w-3xl mx-auto py-8 sm:py-12 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Changelog</h1>
        <p className="text-[var(--text-secondary)] mb-10">
          Historial de cambios y mejoras de BG Planner.
        </p>

        <div className="space-y-10">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="relative">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-[var(--primary)] text-[var(--primary-text)]">
                  v{entry.version}
                </span>
                <h2 className="text-lg font-semibold text-[var(--text)]">{entry.title}</h2>
                <span className="text-xs text-[var(--text-muted)]">{entry.date}</span>
              </div>
              <ul className="space-y-2 ml-1">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium mt-0.5 ${TYPE_LABELS[change.type].color}`}>
                      {TYPE_LABELS[change.type].label}
                    </span>
                    <span className="text-[var(--text-secondary)]">{change.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
