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
    date: "14 abril 2026",
    version: "1.1",
    title: "Super votos, imágenes de evento y dominio propio",
    changes: [
      { type: "new", text: "Indicador de super votos libres en el ranking: ve quién tiene su super voto disponible y anima a usarlo" },
      { type: "new", text: "Imagen identificativa para eventos: sube un logo o foto al crear o editar un evento, visible en el listado y la ficha" },
      { type: "new", text: "Dominio propio: la app ahora vive en bgplanner.app" },
      { type: "fixed", text: "Los super votos ahora se liberan correctamente al completar un juego desde una sesión (antes solo funcionaba al marcar jugado manualmente)" },
      { type: "improved", text: "Mayor contraste en las tarjetas del modo oscuro para mejor legibilidad" },
      { type: "improved", text: "El header sticky del ranking ya no se solapa con la barra de navegación" },
    ],
  },
  {
    date: "10 abril 2026",
    version: "1.0",
    title: "BG Planner: nueva identidad y rediseño visual",
    changes: [
      { type: "new", text: "Renombrado de WeBoard a BG Planner con nueva marca, logo y favicon" },
      { type: "new", text: "Rediseño visual completo: nueva paleta de colores, tipografía y landing page" },
      { type: "new", text: "Transición de tema con animación circular desde el toggle (View Transitions API)" },
      { type: "new", text: "Loader animado con dado giratorio en todas las páginas" },
      { type: "new", text: "Badge oficial \"Powered by BGG\" en el footer" },
      { type: "improved", text: "Carga del feed de actividad más rápida con skeleton loader y caché local" },
      { type: "improved", text: "Sesión de usuario extendida de 7 a 60 días" },
      { type: "improved", text: "Perfil de BGG visible en las listas de miembros y asistentes" },
      { type: "improved", text: "Emails de miembros ocultos en las listas por privacidad" },
    ],
  },
  {
    date: "7 abril 2026",
    version: "0.9",
    title: "Modo claro, feed de actividad y favoritos",
    changes: [
      { type: "new", text: "Modo claro/oscuro: se adapta automáticamente a tu sistema o cámbialo con el toggle" },
      { type: "new", text: "Feed de actividad: ve todo lo que pasa en tus grupos y eventos en tiempo real" },
      { type: "new", text: "Fija tus grupos favoritos con chincheta para tenerlos siempre a mano en la portada" },
      { type: "new", text: "Edita eventos después de crearlos: cambia fecha, ubicación, asistentes o visibilidad" },
      { type: "improved", text: "Navegación más clara con indicador de sección activa" },
    ],
  },
  {
    date: "6 abril 2026",
    version: "0.8",
    title: "Sesiones rápidas, roles y gestión de juegos",
    changes: [
      { type: "new", text: "Crea sesiones desde el ranking: selecciona juegos, ajusta el plan y lanza la partida en segundos" },
      { type: "new", text: "Marca juegos como jugados y archívalos para mantener el ranking limpio y actualizado" },
      { type: "new", text: "Los super votos se liberan automáticamente al marcar un juego como jugado, con email de aviso" },
      { type: "new", text: "Roles de grupo: propietario, admin y miembro, con gestión de permisos y notificaciones" },
      { type: "new", text: "URLs compartibles: cada pestaña y sesión tiene su propia dirección para compartir con el grupo" },
      { type: "improved", text: "Reordena juegos en sesiones y filtra por peso (Ligero, Medio, Pesado)" },
    ],
  },
  {
    date: "5 abril 2026",
    version: "0.6",
    title: "Eventos, landing pública y perfiles",
    changes: [
      { type: "new", text: "Sistema de eventos: crea quedadas públicas o privadas, añade juegos de BGG y comparte el enlace de invitación" },
      { type: "new", text: "Lista de interés por juego con niveles de prioridad y notas privadas para organizar qué quieres jugar" },
      { type: "new", text: "Landing page pública para que nuevos jugadores descubran la app" },
      { type: "new", text: "Fotos de perfil con inicial coloreada como fallback" },
      { type: "new", text: "Próximos eventos visibles directamente en la portada" },
    ],
  },
  {
    date: "4 abril 2026",
    version: "0.5",
    title: "Ranking visual y diseño responsive",
    changes: [
      { type: "new", text: "Medallas oro, plata y bronce para el top 3 del ranking" },
      { type: "new", text: "Tooltip con desglose de votos: pasa el ratón por la puntuación para ver quién votó qué" },
      { type: "new", text: "Logo animado con dado giratorio y favicon propio" },
      { type: "improved", text: "Diseño completamente responsive: la app se ve bien en cualquier pantalla" },
      { type: "fixed", text: "Las invitaciones por enlace ya detectan si ya eres miembro del grupo" },
    ],
  },
  {
    date: "3 abril 2026",
    version: "0.4",
    title: "Sesiones de juego y votación inteligente",
    changes: [
      { type: "new", text: "Planificador de sesiones: la app sugiere juegos según los votos del grupo y el tiempo disponible" },
      { type: "new", text: "Seguimiento de cada juego en sesión: pendiente, jugando, completado o saltado" },
      { type: "improved", text: "Votación instantánea: tus votos se reflejan al momento sin esperar al servidor" },
      { type: "improved", text: "Al añadir un juego al grupo se registra automáticamente tu voto a favor" },
    ],
  },
  {
    date: "2 abril 2026",
    version: "0.3",
    title: "Filtros avanzados y rendimiento",
    changes: [
      { type: "new", text: "Filtro de expansiones agrupadas bajo su juego base para encontrar lo que buscas más rápido" },
      { type: "new", text: "Filtro 'Antiludoteca' para descubrir juegos de la colección que aún no habéis probado" },
      { type: "improved", text: "Carga más rápida en toda la app gracias a caché de colecciones y optimizaciones de servidor" },
    ],
  },
  {
    date: "1 abril 2026",
    version: "0.2",
    title: "Colecciones BGG y sistema de votación",
    changes: [
      { type: "new", text: "Importa tu colección de BoardGameGeek con un clic: todos tus juegos disponibles al instante" },
      { type: "new", text: "Sistema de votación con voto normal (+1), super voto (+3) y voto en contra (-1)" },
      { type: "new", text: "Ranking automático por puntuación con desempate por rating de BGG" },
      { type: "new", text: "Invita a amigos al grupo por email" },
    ],
  },
  {
    date: "31 marzo 2026",
    version: "0.1",
    title: "MVP inicial",
    changes: [
      { type: "new", text: "Login sin contraseña: entra con un código que te enviamos al email" },
      { type: "new", text: "Crea grupos y añade juegos de BoardGameGeek para empezar a votar" },
      { type: "new", text: "Diseño dark mode con paleta amber" },
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
