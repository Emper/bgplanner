"use client";

import Link from "next/link";
import Footer from "@/components/Footer";
import AnimatedLogo from "@/components/AnimatedLogo";
import { useTheme } from "@/lib/theme";

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
    title: "Modo claro y feed de actividad",
    changes: [
      { type: "new", text: "Modo claro/oscuro con detección automática del sistema y toggle manual" },
      { type: "new", text: "Feed de actividad en grupos y eventos con historial de todas las acciones" },
      { type: "new", text: "Sección 'Actividad reciente' en la portada" },
      { type: "new", text: "Pestaña 'Actividad' como vista principal en grupos y eventos" },
      { type: "new", text: "Fijar grupos como favoritos con chincheta en la portada" },
      { type: "new", text: "Edición de eventos (fecha, ubicación, asistentes, visibilidad)" },
      { type: "improved", text: "Miembros y asistentes ordenados alfabéticamente" },
      { type: "improved", text: "Navbar resalta la sección activa (Grupos, Eventos, Perfil)" },
    ],
  },
  {
    date: "6 abril 2026",
    version: "0.8",
    title: "Inicio rápido de sesión y gestión de jugados",
    changes: [
      { type: "new", text: "Selección rápida de juegos desde el ranking para crear sesiones" },
      { type: "new", text: "Barra sticky con contador de juegos seleccionados y botón 'Crear sesión'" },
      { type: "new", text: "Marcar juegos como jugados directamente desde el ranking" },
      { type: "new", text: "Al marcar jugado, los super votos se liberan automáticamente con notificación por email" },
      { type: "new", text: "Ocultar/archivar juegos ya jugados para mantener el ranking limpio" },
      { type: "new", text: "Rol 'Propietario' para el creador del grupo (inmutable)" },
      { type: "new", text: "Gestión de admins: promover y degradar miembros con emails de notificación" },
      { type: "improved", text: "Botones de gestión (marcar jugado, quitar) como texto sutil bajo los votos" },
      { type: "improved", text: "Solo admins pueden quitar juegos del grupo" },
    ],
  },
  {
    date: "6 abril 2026",
    version: "0.7",
    title: "URLs compartibles y reordenación",
    changes: [
      { type: "new", text: "Reordenar juegos en sesiones con botones ▲▼" },
      { type: "new", text: "URLs únicas para cada pestaña y sesión expandida (compartibles)" },
      { type: "improved", text: "Filtro de peso corregido con categorías claras: Ligero, Medio, Pesado" },
      { type: "fixed", text: "Corrección de permisos: propietario tiene mismos permisos que admin" },
    ],
  },
  {
    date: "5 abril 2026",
    version: "0.6",
    title: "Eventos y landing pública",
    changes: [
      { type: "new", text: "Sistema de eventos públicos y privados" },
      { type: "new", text: "Búsqueda de juegos de BGG para añadir a eventos" },
      { type: "new", text: "Lista de interés por juego con 5 niveles de prioridad y notas privadas" },
      { type: "new", text: "Enlace de invitación para eventos" },
      { type: "new", text: "Landing page pública con explicación de funcionalidades" },
      { type: "new", text: "Página de login separada con OTP" },
      { type: "new", text: "Sección 'Próximos eventos' en la portada" },
      { type: "new", text: "Fotos de perfil con fallback de inicial coloreada" },
    ],
  },
  {
    date: "4 abril 2026",
    version: "0.5",
    title: "Medallas, tooltips y responsive",
    changes: [
      { type: "new", text: "Medallas oro, plata y bronce para el top 3 del ranking" },
      { type: "new", text: "Tooltip con desglose de votos al pasar el ratón por la puntuación" },
      { type: "new", text: "Logo animado con dado que vibra y cambia de cara" },
      { type: "new", text: "Favicon personalizado de BG Planner" },
      { type: "improved", text: "Diseño responsive completo para móvil (~390px)" },
      { type: "improved", text: "Thumbnails de juegos sin recortar (object-contain)" },
      { type: "improved", text: "Enlace de invitación por link compartible" },
      { type: "fixed", text: "Detección de membresía existente al abrir enlace de invitación" },
    ],
  },
  {
    date: "3 abril 2026",
    version: "0.4",
    title: "Sesiones de juego",
    changes: [
      { type: "new", text: "Planificador de sesiones con sugerencias basadas en votos y tiempo disponible" },
      { type: "new", text: "Estados de juego en sesión: pendiente, jugando, completado, saltado" },
      { type: "new", text: "Sección de juegos 'ya jugados' separada del ranking" },
      { type: "improved", text: "Votación optimista: los votos se reflejan al instante sin esperar al servidor" },
      { type: "improved", text: "Auto-upvote al añadir un juego al grupo" },
    ],
  },
  {
    date: "2 abril 2026",
    version: "0.3",
    title: "Caché y rendimiento",
    changes: [
      { type: "new", text: "Caché de colecciones BGG en base de datos (24h TTL)" },
      { type: "new", text: "Filtro de expansiones como sub-elementos del juego base" },
      { type: "new", text: "Filtro 'Antiludoteca' para juegos no jugados" },
      { type: "improved", text: "Dashboard unificado en una sola llamada API" },
      { type: "improved", text: "Región EU para menor latencia" },
      { type: "improved", text: "Índices de base de datos optimizados" },
    ],
  },
  {
    date: "1 abril 2026",
    version: "0.2",
    title: "Colecciones BGG y votación",
    changes: [
      { type: "new", text: "Importación de colecciones desde BoardGameGeek" },
      { type: "new", text: "Sistema de votación: +1, +3 (super), -1" },
      { type: "new", text: "Ranking de juegos por puntuación con desempate por rating BGG" },
      { type: "new", text: "Paginación, búsqueda y filtros en la vista de añadir juegos" },
      { type: "new", text: "Invitaciones por email a grupos" },
    ],
  },
  {
    date: "31 marzo 2026",
    version: "0.1",
    title: "MVP inicial",
    changes: [
      { type: "new", text: "Autenticación OTP por email (sin contraseñas)" },
      { type: "new", text: "Creación de grupos" },
      { type: "new", text: "Añadir juegos a grupos por ID de BGG" },
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
  const { resolvedTheme, toggleTheme, mounted } = useTheme();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <nav className="px-4 sm:px-6 py-4 border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <AnimatedLogo />
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--accent-soft)] transition-all duration-200"
            >
              {!mounted ? (
                <span className="w-[18px] h-[18px]" />
              ) : resolvedTheme === "dark" ? (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <Link href="/login" className="text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
              Entrar
            </Link>
          </div>
        </div>
      </nav>

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
