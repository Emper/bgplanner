// Novedades de la app, la más reciente primero. Se pintan en /changelog y la
// última con algo nuevo sale en el aviso «Nuevo» de la portada.

export interface ChangelogEntry {
  date: string;
  version: string;
  title: string;
  changes: { type: "new" | "improved" | "fixed"; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "21 octubre 2026",
    version: "1.58",
    title: "A cotillear estanterías",
    changes: [
      { type: "new", text: "Desde el perfil de cualquiera puedes abrir su colección entera de BGG y buscar, filtrar y ordenar como en la tuya" },
      { type: "improved", text: "Tus puntuaciones de permanencia solo las ven tus amigos: para el resto, tu colección sale sin ellas" },
      { type: "improved", text: "«Compartir» en Mi colección manda ya el enlace de tu perfil, sin llaves que generar ni revocar" },
      { type: "improved", text: "Rank, jugadores, duración, peso y partidas se leen igual en todos los listados de juegos, con su icono y su color" },
    ],
  },
  {
    date: "21 octubre 2026",
    version: "1.57",
    title: "¡A jugar! con los que estáis",
    changes: [
      { type: "new", text: "«Somos tres y tenemos dos horas»: dale a «¡A jugar!», marca quién juega y cuánto tiempo hay, y verás solo lo que encaja, ordenado con los votos de los que estáis a la mesa" },
      { type: "new", text: "¿Sin decidir? Sorteo entre los mejores para esa mesa, y si va de peso ligero o de quemar neuronas, también lo filtras" },
      { type: "new", text: "Cada sesión queda guardada sola al jugar: quién vino y a qué jugasteis" },
      { type: "improved", text: "Las sesiones se renuevan: ya no hace falta planificarlas, y lo que jugasteis antes sigue contando en vuestras partidas" },
    ],
  },
  {
    date: "21 octubre 2026",
    version: "1.56",
    title: "Cuentas que cuadran",
    changes: [
      { type: "fixed", text: "El número de juegos de un grupo es el mismo en todas partes: los archivados ya no cuentan" },
      { type: "fixed", text: "«Sugerir juegos» al montar una sesión ya no propone los que habéis jugado o archivado" },
      { type: "improved", text: "El botón «atrás» del navegador te devuelve a la pestaña del grupo en la que estabas" },
      { type: "improved", text: "El ranking cuenta cómo se desempata: a igualdad de puntos, gana la mejor nota en BGG" },
    ],
  },
  {
    date: "20 octubre 2026",
    version: "1.55",
    title: "Corazones y citas en la Comunidad",
    changes: [
      { type: "new", text: "Dale «me gusta» a las respuestas que te convencen, y te avisamos cuando le gusta a alguien lo que has escrito" },
      { type: "new", text: "Cita un mensaje para contestarlo: tu respuesta lleva el trocito al que respondes y quien lo escribió se entera" },
      { type: "new", text: "Nueva insignia para tu perfil por los «me gusta» que reciben tus respuestas" },
    ],
  },
  {
    date: "20 octubre 2026",
    version: "1.54",
    title: "Derecho a veto",
    changes: [
      { type: "new", text: "Nueva opción «No quiero jugarlo» en los juegos de un evento: se queda al final, tachado, y ese juego no sale en las mesas donde estés" },
      { type: "improved", text: "Las ganas de jugar se explican mejor, de «Necesito jugarlo» a «Solo si no queda otra», con colores que van de más a menos calor" },
    ],
  },
  {
    date: "20 octubre 2026",
    version: "1.53",
    title: "Reglas a mano",
    changes: [
      { type: "new", text: "En «Mi lista» de un evento, enlaza el manual de un juego (en BGG, Drive, Dropbox o la web de la editorial) y todo el que tenga ese juego lo tendrá a un clic" },
    ],
  },
  {
    date: "20 octubre 2026",
    version: "1.52",
    title: "Cada juego en su sitio",
    changes: [
      { type: "new", text: "Ordena los juegos de un evento por nombre, por ranking de BGG o con los que aún no has valorado primero" },
      { type: "improved", text: "Los juegos que salen de la lista de BGG se recogen al final en una caja compacta, para que no estorben" },
    ],
  },
  {
    date: "20 octubre 2026",
    version: "1.51",
    title: "La ludoteca se escribe sola",
    changes: [
      { type: "new", text: "Quien organiza un evento puede vincular una lista de BGG y sus juegos se convierten en la ludoteca del evento" },
      { type: "new", text: "La ludoteca se mantiene al día: lo que entra en la lista aparece en el evento, y si hay prisa, se reimporta con un botón" },
      { type: "improved", text: "Lo que ya habías marcado en juegos que están en la lista sigue ahí, y si alguno sale de ella, te avisamos en vez de borrártelo" },
      { type: "new", text: "Te avisamos en la campana cuando llegan juegos nuevos a la ludoteca de un evento al que vas" },
    ],
  },
  {
    date: "15 octubre 2026",
    version: "1.50",
    title: "Cabeceras a dieta",
    changes: [
      { type: "new", text: "En el ordenador, tu inicial arriba a la derecha abre tu cuenta: perfil, BGG, el tema claro, oscuro o el de tu sistema, y por fin cerrar sesión" },
      { type: "improved", text: "La cabecera ocupa todo el ancho de la página y se queda con lo que de verdad usas" },
      { type: "improved", text: "Sin cuenta, Eventos y Comunidad se ven siempre con su nombre, también en el móvil" },
      { type: "improved", text: "Todas las páginas comparten ancho, márgenes y titulares: se acabaron los saltos al cambiar de sección" },
    ],
  },
  {
    date: "15 octubre 2026",
    version: "1.49",
    title: "Las normas de la casa",
    changes: [
      { type: "new", text: "Nuevos términos de uso, en cristiano: tolerancia cero con el acoso y el contenido ofensivo, cómo denunciar y qué pasa si alguien se pasa de la raya" },
    ],
  },
  {
    date: "15 octubre 2026",
    version: "1.48",
    title: "Un sitio tranquilo para jugar",
    changes: [
      { type: "new", text: "Denuncia hilos, respuestas, fotos, opiniones o perfiles desde su menú ⋯ y lo revisaremos" },
      { type: "new", text: "Bloquea a quien te moleste: no verás sus mensajes en la Comunidad ni te llegarán sus avisos" },
      { type: "new", text: "Gestiona a quién has bloqueado desde tu perfil" },
    ],
  },
  {
    date: "15 octubre 2026",
    version: "1.47",
    title: "Tus datos, en tus manos",
    changes: [
      { type: "new", text: "Puedes borrar tu cuenta desde tu perfil: antes de confirmar te enseñamos qué se va y qué se queda" },
      { type: "new", text: "Si te vas, tus grupos y eventos pasan a quien más tiempo lleva en ellos y tus mensajes quedan como «Usuario eliminado», para no dejar conversaciones a medias" },
      { type: "new", text: "Nueva página de privacidad, clara y sin letra pequeña: qué guardamos, para qué y cuánto tiempo" },
    ],
  },
  {
    date: "15 octubre 2026",
    version: "1.46",
    title: "Todo a mano del pulgar",
    changes: [
      { type: "new", text: "En el móvil, Grupos, Eventos, Comunidad y tu Perfil viven en una barra abajo, como en cualquier app: un toque y estás" },
      { type: "new", text: "Toca otra vez la pestaña en la que estás y vuelves arriba del todo" },
      { type: "improved", text: "La cabecera del móvil respira: el logo te lleva al inicio y tu colección está a un toque desde tu perfil" },
    ],
  },
  {
    date: "15 octubre 2026",
    version: "1.45",
    title: "Que no se te escape ni una",
    changes: [
      { type: "new", text: "Después de publicar en la Comunidad, apuntarte a un evento o unirte a un grupo, te ofrecemos los avisos al móvil justo cuando más falta hacen" },
      { type: "new", text: "Desde la campana puedes activar los avisos en este móvil con un solo toque" },
      { type: "improved", text: "Al entrar en la app instalada te proponemos los avisos una vez, sin insistir: si dices «Ahora no», te dejamos en paz una temporada" },
    ],
  },
  {
    date: "14 octubre 2026",
    version: "1.44",
    title: "BG Planner, en tu bolsillo",
    changes: [
      { type: "new", text: "Instala BG Planner en el móvil como una app más: desde el navegador, «Añadir a pantalla de inicio», y se abre a pantalla completa con su propio icono" },
      { type: "new", text: "Avisos al móvil: activa «Avisarme en este dispositivo» en Notificaciones y te enterarás de convocatorias, respuestas en la Comunidad o juegos nuevos en tus eventos aunque tengas la app cerrada" },
      { type: "new", text: "El icono de la app instalada lleva el número de avisos que tienes sin leer" },
      { type: "improved", text: "Si te quedas sin cobertura, en vez de una página rota verás un aviso para volver a intentarlo" },
      { type: "improved", text: "En móviles con notch o barra de inicio, nada queda tapado por los bordes de la pantalla" },
    ],
  },
  {
    date: "14 octubre 2026",
    version: "1.43",
    title: "La Comunidad, por toda la casa",
    changes: [
      { type: "new", text: "Tu inicio enseña lo último que se habla en la Comunidad, con acceso directo para abrir un hilo" },
      { type: "new", text: "Nueva insignia para tu perfil por participar en la Comunidad: de «Rompehielos» a «Voz de la Comunidad»" },
      { type: "new", text: "Si organizas un evento abierto, anúncialo en la Comunidad con un clic: el hilo para buscar jugadores sale ya escrito, con la fecha, el sitio y el enlace" },
      { type: "improved", text: "La portada presenta la Comunidad con las conversaciones más recientes" },
      { type: "improved", text: "Las conversaciones de la Comunidad se pueden encontrar desde Google y se leen enteras sin tener cuenta" },
      { type: "improved", text: "Sin cuenta también llegas a la Comunidad y a los eventos abiertos desde la cabecera, también en el móvil" },
    ],
  },
  {
    date: "14 octubre 2026",
    version: "1.42",
    title: "Abrimos la Comunidad",
    changes: [
      { type: "new", text: "Nueva sección Comunidad: un foro para hablar con el resto de jugadores de BG Planner, más allá de tus grupos. Abre un hilo con su título y su mensaje, y la conversación sigue con las respuestas de los demás" },
      { type: "new", text: "Cada hilo lleva su etiqueta —Buscar partida, Crónicas, Opiniones, Dudas de reglas, Novedades u Offtopic— para que encuentres justo lo que te apetece leer" },
      { type: "new", text: "Buscador para dar con esa conversación sobre aquel juego, y los hilos con respuestas nuevas suben solos al principio" },
      { type: "new", text: "Puedes editar o borrar lo que hayas escrito, y los enlaces que pegues se pueden abrir directamente" },
      { type: "new", text: "Te avisamos en la campana cuando alguien responde a tu hilo o en una conversación en la que has participado, y el aviso te lleva directo a la respuesta" },
      { type: "fixed", text: "La barra de arriba ya no se sale de la pantalla en móviles y tablets: todo cabe a la primera" },
    ],
  },
  {
    date: "13 octubre 2026",
    version: "1.41",
    title: "Eventos con toda la info",
    changes: [
      { type: "new", text: "Los eventos estrenan «Info general»: horarios, normas, qué traer o cómo llegar, en su propia pestaña y en la página pública" },
      { type: "new", text: "Nueva página con todos los próximos eventos abiertos, para descubrir a cuáles apuntarte" },
      { type: "improved", text: "Los eventos abiertos se encuentran mejor en Google, con su fecha y su sitio, y la web carga más rápido" },
      { type: "fixed", text: "La hora de los eventos ya no se descuadra al editarlos ni en los enlaces compartidos" },
    ],
  },
  {
    date: "13 octubre 2026",
    version: "1.40.1",
    title: "Una cabecera que no baila",
    changes: [
      { type: "fixed", text: "La barra de arriba ya no da saltos al cambiar de página: tu cuenta de BGG, los avisos y el resto salen en su sitio desde el principio" },
    ],
  },
  {
    date: "13 octubre 2026",
    version: "1.40",
    title: "Tu campana de avisos",
    changes: [
      { type: "new", text: "Nueva campana de notificaciones: entérate de quién te añade a sus amigos, se une a tus grupos o se apunta a tus eventos" },
      { type: "new", text: "Los recordatorios para valorar partidas y eventos, los cambios de admin y tu super voto liberado llegan ahora a la campana en vez de a tu correo" },
      { type: "improved", text: "Si añaden varios juegos seguidos a un evento al que vas, te llega un solo aviso con todos" },
    ],
  },
  {
    date: "13 octubre 2026",
    version: "1.39",
    title: "Un inicio con más vida",
    changes: [
      { type: "new", text: "Tu inicio estrena barra lateral con tus grupos, tus próximos eventos y tus amigos siempre a mano" },
      { type: "improved", text: "La actividad reciente enseña las cajas de los juegos y se ordena por días" },
      { type: "improved", text: "Los juegos recientes, en tarjetas grandes con su carátula" },
    ],
  },
  {
    date: "13 octubre 2026",
    version: "1.38",
    title: "Tus amigos, a un toque",
    changes: [
      { type: "new", text: "Añade amigos con un clic desde su perfil o desde los miembros de un grupo o evento que compartáis" },
      { type: "new", text: "Tus amigos te esperan en la pantalla de inicio para saltar a su perfil cuando quieras" },
      { type: "new", text: "En el perfil de alguien verás si te tiene entre sus amigos" },
    ],
  },
  {
    date: "13 octubre 2026",
    version: "1.37",
    title: "Arma tu mesa",
    changes: [
      { type: "new", text: "En los asistentes de un evento, marca con quién vas a jugar y descubre qué os apetece a todos, ordenado para que nadie se aburra" },
      { type: "new", text: "Avisos si un juego no da para tanta gente y lo que alguien ya ha jugado, al final" },
      { type: "new", text: "Comparte la mesa con un enlace para que todos veáis lo mismo" },
    ],
  },
  {
    date: "13 octubre 2026",
    version: "1.36",
    title: "Organiza en equipo",
    changes: [
      { type: "new", text: "Nombra admins entre los asistentes de tu evento para que te echen una mano con los juegos, la invitación y los detalles" },
    ],
  },
  {
    date: "12 octubre 2026",
    version: "1.35",
    title: "Comparte tu lista con quien te acompaña",
    changes: [
      { type: "new", text: "Comparte tu lista de un evento con un enlace: verán qué te apetece jugar y qué has jugado ya" },
      { type: "new", text: "Cada pestaña de un evento tiene su propio enlace, para mandarla directamente" },
      { type: "improved", text: "El enlace de invitación del evento se puede plegar para que no ocupe tanto" },
    ],
  },
  {
    date: "12 octubre 2026",
    version: "1.34",
    title: "Tu lista, lista para la mesa",
    changes: [
      { type: "improved", text: "«Mi Lista» del evento es ahora un listado compacto para consultarlo de un vistazo durante la quedada" },
      { type: "new", text: "Marca los juegos como jugados y bajan a su propio apartado al final de la lista" },
    ],
  },
  {
    date: "4 octubre 2026",
    version: "1.33.1",
    title: "Votar sin sobresaltos en el móvil",
    changes: [
      { type: "fixed", text: "Al votar en el móvil ya no salta el teclado ni se mueve la página: el comentario te espera por si quieres escribirlo" },
    ],
  },
  {
    date: "2 octubre 2026",
    version: "1.33",
    title: "Juegos que te van a encantar",
    changes: [
      { type: "new", text: "Recomendaciones a partir de tu colección y tus notas: «si te gustó X, te gustará Y»" },
      { type: "new", text: "Solo juegos que no tienes, no has tenido y no has jugado, ni otras ediciones de los que ya conoces" },
      { type: "new", text: "Guárdalos en tu wishlist con un clic o descarta los que no te llamen" },
    ],
  },
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
