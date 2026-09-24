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
    date: "24 septiembre 2026",
    version: "1.32",
    title: "Un poco de magia por dentro",
    changes: [
      { type: "new", text: "Al entrar te saludamos con lo próximo que tienes en agenda" },
      { type: "new", text: "Animaciones al votar, al reordenar el ranking y en tu estantería" },
      { type: "improved", text: "Eventos en dos columnas y con el cartel entero" },
      { type: "fixed", text: "Votos que a veces no se marcaban a la primera" },
    ],
  },
  {
    date: "24 septiembre 2026",
    version: "1.31",
    title: "Una portada a la altura",
    changes: [
      { type: "new", text: "Portada nueva con un ranking en directo, una estantería para probar y los próximos eventos abiertos" },
      { type: "new", text: "Tarjeta de vista previa al compartir bgplanner.app" },
    ],
  },
  {
    date: "23 septiembre 2026",
    version: "1.30",
    title: "Insignias para presumir",
    changes: [
      { type: "new", text: "Insignias de bronce, plata y oro en tu perfil, y lo que te falta para el siguiente nivel" },
    ],
  },
  {
    date: "23 septiembre 2026",
    version: "1.29",
    title: "Comparte tu colección con quien sea",
    changes: [
      { type: "improved", text: "El enlace de tu colección ya se abre sin cuenta, también los que ya hubieras repartido. Puedes desactivarlo desde «Mi colección»" },
    ],
  },
  {
    date: "23 septiembre 2026",
    version: "1.28",
    title: "Comparte cualquier enlace y que se vea bien",
    changes: [
      { type: "new", text: "Los eventos abiertos se pueden compartir con cualquiera, tenga cuenta o no" },
      { type: "new", text: "Tarjeta de vista previa al compartir eventos, grupos e invitaciones" },
    ],
  },
  {
    date: "23 septiembre 2026",
    version: "1.26",
    title: "Tu perfil, enseñable a cualquiera",
    changes: [
      { type: "new", text: "Tu perfil se puede ver sin cuenta y sale con tu nombre y foto al compartirlo" },
    ],
  },
  {
    date: "21 septiembre 2026",
    version: "1.25",
    title: "Enseña tu colección a quien tú quieras",
    changes: [
      { type: "new", text: "Comparte tu colección con un enlace que puedes renovar o desactivar cuando quieras" },
      { type: "improved", text: "Añade juegos a tu vitrina con un clic desde el listado" },
    ],
  },
  {
    date: "21 septiembre 2026",
    version: "1.24",
    title: "Cada jugador, con su perfil",
    changes: [
      { type: "new", text: "Perfil público para cada jugador, con su vitrina, sus eventos y su actividad" },
      { type: "improved", text: "Toca a cualquiera en un grupo, un evento o la actividad para ir a su perfil" },
    ],
  },
  {
    date: "21 septiembre 2026",
    version: "1.23",
    title: "Mi colección, ahora al vuelo",
    changes: [
      { type: "new", text: "Pestaña «Sin valorar» con los juegos que te quedan por puntuar" },
      { type: "improved", text: "Filtrar, ordenar y buscar es instantáneo, y la lista se alarga sola al bajar" },
    ],
  },
  {
    date: "21 septiembre 2026",
    version: "1.22",
    title: "Mi colección: decide qué juegos se quedan",
    changes: [
      { type: "new", text: "«Mi colección»: tus juegos y tu wishlist de BGG, con vista de estantería" },
      { type: "new", text: "Puntúa qué juegos se quedan y cuáles venderías, y monta la vitrina de tu perfil" },
    ],
  },
  {
    date: "17 septiembre 2026",
    version: "1.21",
    title: "Las próximas funcionalidades las decidís vosotros",
    changes: [
      { type: "new", text: "«Ideas y mejoras»: propón funcionalidades, reporta errores y vota las propuestas de los demás" },
    ],
  },
  {
    date: "17 septiembre 2026",
    version: "1.20",
    title: "Emojis por todas partes 🎲🔥",
    changes: [
      { type: "new", text: "Selector de emojis en comentarios, opiniones y formularios" },
    ],
  },
  {
    date: "14 septiembre 2026",
    version: "1.19",
    title: "Vota sin perder el sitio en el ranking",
    changes: [
      { type: "improved", text: "El ranking ya no se mueve mientras votas: recolócalo cuando quieras con «Actualizar orden»" },
    ],
  },
  {
    date: "14 septiembre 2026",
    version: "1.18",
    title: "Cambia tu email sin perder la cuenta",
    changes: [
      { type: "new", text: "Cambia el email de tu cuenta desde tu perfil" },
    ],
  },
  {
    date: "12 septiembre 2026",
    version: "1.17",
    title: "Borrón y cuenta nueva en el ranking",
    changes: [
      { type: "new", text: "Los admins pueden poner el ranking a cero al convocar al grupo" },
    ],
  },
  {
    date: "22 agosto 2026",
    version: "1.16",
    title: "Ayúdame a elegir",
    changes: [
      { type: "new", text: "Una ruleta que sortea entre vuestros juegos favoritos" },
    ],
  },
  {
    date: "22 agosto 2026",
    version: "1.15.1",
    title: "Escribir en el móvil sin saltos de zoom",
    changes: [
      { type: "fixed", text: "La pantalla ya no hace zoom al escribir un comentario en el móvil" },
    ],
  },
  {
    date: "12 agosto 2026",
    version: "1.15",
    title: "Fotos sueltas en la galería del grupo",
    changes: [
      { type: "new", text: "Sube fotos a la galería del grupo sin asociarlas a un juego" },
    ],
  },
  {
    date: "12 agosto 2026",
    version: "1.14",
    title: "Opinar desde la galería y pestaña de Jugados",
    changes: [
      { type: "new", text: "Opina sobre cualquier juego desde la galería" },
      { type: "improved", text: "Los juegos jugados tienen su propia pestaña" },
    ],
  },
  {
    date: "12 agosto 2026",
    version: "1.13",
    title: "Galería y valoraciones de los eventos",
    changes: [
      { type: "new", text: "Galería de fotos y valoraciones con estrellas en cada evento" },
    ],
  },
  {
    date: "12 agosto 2026",
    version: "1.12",
    title: "Opiniones de partida y galería del grupo",
    changes: [
      { type: "new", text: "Deja tu opinión y fotos al jugar un juego, y revívelas en la galería del grupo" },
    ],
  },
  {
    date: "12 agosto 2026",
    version: "1.11",
    title: "La valoración de BGG, a todo color",
    changes: [
      { type: "new", text: "Nota de BGG con su color oficial y puesto en el ranking mundial" },
    ],
  },
  {
    date: "12 agosto 2026",
    version: "1.10",
    title: "Buscar juegos, mejor",
    changes: [
      { type: "new", text: "Añade al ranking juegos de BGG aunque nadie del grupo los tenga" },
      { type: "improved", text: "Resultados con foto y coincidencias exactas primero" },
    ],
  },
  {
    date: "28 abril 2026",
    version: "1.9",
    title: "Podio del grupo",
    changes: [
      { type: "new", text: "Podio con los tres juegos más votados en la portada del grupo" },
    ],
  },
  {
    date: "28 abril 2026",
    version: "1.8",
    title: "Comentarios en el ranking",
    changes: [
      { type: "new", text: "Deja un comentario al votar un juego para defender tus picks" },
    ],
  },
  {
    date: "24 abril 2026",
    version: "1.7",
    title: "Salta al grupo o evento desde el feed",
    changes: [
      { type: "improved", text: "Los grupos y eventos de la actividad reciente son ahora enlaces" },
    ],
  },
  {
    date: "24 abril 2026",
    version: "1.6",
    title: "Super voto más flexible",
    changes: [
      { type: "improved", text: "Al mover tu super voto, el juego anterior conserva un voto normal" },
    ],
  },
  {
    date: "24 abril 2026",
    version: "1.5",
    title: "El grupo en números",
    changes: [
      { type: "new", text: "Resumen del grupo: juegos, partidas, tiempo a la mesa y el más jugado" },
    ],
  },
  {
    date: "24 abril 2026",
    version: "1.4",
    title: "Eliminar un grupo",
    changes: [
      { type: "new", text: "El propietario puede eliminar su grupo" },
    ],
  },
  {
    date: "23 abril 2026",
    version: "1.3",
    title: "Tipos de grupo: ahora también «en pareja»",
    changes: [
      { type: "new", text: "Nuevo modo «en pareja», con una escala de votos más fina" },
    ],
  },
  {
    date: "23 abril 2026",
    version: "1.2",
    title: "Convoca a tu grupo a votar",
    changes: [
      { type: "new", text: "Convoca al grupo a votar con un mensaje personal" },
    ],
  },
  {
    date: "14 abril 2026",
    version: "1.1",
    title: "Super votos, imágenes de evento y dominio propio",
    changes: [
      { type: "new", text: "Mira quién tiene aún su super voto libre" },
      { type: "new", text: "Imagen propia para cada evento" },
      { type: "new", text: "Estrenamos dominio: bgplanner.app" },
    ],
  },
  {
    date: "10 abril 2026",
    version: "1.0",
    title: "BG Planner: nueva identidad y rediseño visual",
    changes: [
      { type: "new", text: "Nueva marca, logo y rediseño visual completo" },
    ],
  },
  {
    date: "7 abril 2026",
    version: "0.9",
    title: "Modo claro, feed de actividad y favoritos",
    changes: [
      { type: "new", text: "Modo claro y oscuro" },
      { type: "new", text: "Actividad en directo de tus grupos y eventos" },
      { type: "new", text: "Fija tus grupos favoritos y edita tus eventos" },
    ],
  },
  {
    date: "6 abril 2026",
    version: "0.8",
    title: "Sesiones rápidas, roles y gestión de juegos",
    changes: [
      { type: "new", text: "Crea una sesión desde el ranking en segundos" },
      { type: "new", text: "Marca juegos como jugados y archívalos" },
      { type: "new", text: "Roles de propietario, admin y miembro" },
    ],
  },
  {
    date: "5 abril 2026",
    version: "0.6",
    title: "Eventos, portada pública y perfiles",
    changes: [
      { type: "new", text: "Eventos públicos o privados con sus juegos e invitaciones" },
      { type: "new", text: "Portada pública para descubrir la app" },
    ],
  },
  {
    date: "4 abril 2026",
    version: "0.5",
    title: "Ranking visual y diseño responsive",
    changes: [
      { type: "new", text: "Medallas para el top 3 y detalle de quién votó qué" },
    ],
  },
  {
    date: "3 abril 2026",
    version: "0.4",
    title: "Sesiones de juego y votación inteligente",
    changes: [
      { type: "new", text: "Planificador que propone juegos según los votos y el tiempo que tengáis" },
    ],
  },
  {
    date: "2 abril 2026",
    version: "0.3",
    title: "Expansiones agrupadas y filtro Antiludoteca",
    changes: [
      { type: "new", text: "Expansiones agrupadas bajo su juego base" },
      { type: "new", text: "Filtro «Antiludoteca» para los juegos que aún no habéis probado" },
    ],
  },
  {
    date: "1 abril 2026",
    version: "0.2",
    title: "Colecciones BGG y sistema de votación",
    changes: [
      { type: "new", text: "Importa tu colección de BoardGameGeek" },
      { type: "new", text: "Votos, super voto y ranking automático" },
      { type: "new", text: "Invita a tus amigos por email" },
    ],
  },
  {
    date: "31 marzo 2026",
    version: "0.1",
    title: "MVP inicial",
    changes: [
      { type: "new", text: "Entra sin contraseña, con un código por email" },
      { type: "new", text: "Crea grupos y añade juegos para empezar a votar" },
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
