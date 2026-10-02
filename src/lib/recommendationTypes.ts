// Tipos de las recomendaciones SIN dependencias de servidor: los importa
// también la página. El motor vive en recommendations.ts.

export interface RecommendedGame {
  bggId: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  weight: number | null;
  bggRating: number | null;
  bggRank: number | null;
  /** El juego tuyo que más pesa en esta recomendación. */
  because: { bggId: number; name: string } | null;
  /** Lo que comparte con ese juego, ya en castellano ("De Uwe Rosenberg"). */
  traits: string[];
  /** Jugadores de BG Planner a los que les encantan los dos juegos. */
  communityFans: number;
}

export interface TasteAnchor {
  bggId: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  /** Por qué creemos que te gusta ("Le diste un 9 en BGG"). */
  why: string;
}

export interface RecommendationsStatus {
  /** Cuándo trajimos de BGG lo que has jugado y puntuado. null = nunca. */
  historyFetchedAt: string | null;
  historyStale: boolean;
  /** Juegos tuyos de los que aún no sabemos de qué van. */
  tasteMissing: number;
  /** Juegos candidatos que aún no hemos estudiado. */
  poolMissing: number;
  /** Juegos tuyos que ya usamos para conocer tus gustos. */
  tasteCount: number;
  /** Juegos entre los que elegimos. */
  poolSize: number;
}

export interface RecommendationsResponse {
  connected: boolean;
  forYou: RecommendedGame[];
  becauseYouLiked: { anchor: TasteAnchor; games: RecommendedGame[] }[];
  status: RecommendationsStatus;
}

// ── Traducciones ────────────────────────────────────────────────────────
// BGG nombra mecánicas y categorías en inglés. Traducimos las habituales; el
// resto se enseña tal cual, que tampoco es grave.

const MECHANICS_ES: Record<string, string> = {
  "Worker Placement": "Colocación de trabajadores",
  "Worker Placement, Different Worker Types": "Trabajadores de varios tipos",
  "Deck, Bag, and Pool Building": "Construcción de mazos",
  "Hand Management": "Gestión de la mano",
  "Set Collection": "Colección de sets",
  "Area Majority / Influence": "Mayorías",
  "Tile Placement": "Colocación de losetas",
  "Engine Building": "Construcción de motor",
  "Drafting": "Draft",
  "Open Drafting": "Draft abierto",
  "Closed Drafting": "Draft cerrado",
  "Card Drafting": "Draft de cartas",
  "Cooperative Game": "Cooperativo",
  "Dice Rolling": "Dados",
  "Network and Route Building": "Construcción de rutas",
  "Variable Player Powers": "Poderes asimétricos",
  "Variable Set-up": "Preparación variable",
  "Modular Board": "Tablero modular",
  "Action Points": "Puntos de acción",
  "Action Drafting": "Selección de acciones",
  "Action Queue": "Cola de acciones",
  "Action Retrieval": "Recuperar acciones",
  "Auction/Bidding": "Subastas",
  "Auction / Bidding": "Subastas",
  "Simultaneous Action Selection": "Acciones simultáneas",
  "Hidden Roles": "Roles ocultos",
  "Team-Based Game": "Por equipos",
  "Trading": "Comercio",
  "Negotiation": "Negociación",
  "Push Your Luck": "Tentar a la suerte",
  "Pattern Building": "Construcción de patrones",
  "Grid Movement": "Movimiento en cuadrícula",
  "Area Movement": "Movimiento por áreas",
  "Point to Point Movement": "Movimiento punto a punto",
  "Hexagon Grid": "Hexágonos",
  "Income": "Ingresos",
  "Market": "Mercado",
  "Contracts": "Contratos",
  "End Game Bonuses": "Bonus de final de partida",
  "Turn Order: Claim Action": "Orden de turno por acción",
  "Turn Order: Progressive": "Orden de turno progresivo",
  "Turn Order: Stat-Based": "Orden de turno por estado",
  "Solo / Solitaire Game": "Modo solitario",
  "Campaign / Battle Card Driven": "Conducido por cartas",
  "Legacy Game": "Legacy",
  "Scenario / Mission / Campaign Game": "Campaña",
  "Storytelling": "Narrativo",
  "Role Playing": "Rol",
  "Deduction": "Deducción",
  "Memory": "Memoria",
  "Bluffing": "Faroles",
  "Betting and Bluffing": "Apuestas y faroles",
  "Voting": "Votaciones",
  "Real-Time": "Tiempo real",
  "Paper-and-Pencil": "Lápiz y papel",
  "Roll / Spin and Move": "Tirar y mover",
  "Trick-taking": "Bazas",
  "Tableau Building": "Construcción de tableau",
  "Track Movement": "Movimiento en track",
  "Race": "Carreras",
  "Player Elimination": "Eliminación de jugadores",
  "Take That": "Puñetazo en la mesa",
  "Cube Tower": "Torre de cubos",
  "Dice Placement": "Colocación de dados",
  "Mancala": "Mancala",
  "Rondel": "Rondel",
  "Time Track": "Track de tiempo",
  "Programmed Movement": "Movimiento programado",
  "Pick-up and Deliver": "Recoger y entregar",
  "Enclosure": "Cercar áreas",
  "Square Grid": "Cuadrícula",
  "Grid Coverage": "Cubrir la cuadrícula",
  "Melding and Splaying": "Combinar y desplegar",
  "Line Drawing": "Trazar líneas",
  "Ownership": "Propiedades",
  "Stock Holding": "Acciones de bolsa",
  "Loans": "Préstamos",
  "Commodity Speculation": "Especulación",
  "Bias": "Sesgo",
  "Communication Limits": "Comunicación limitada",
  "Traitor Game": "Traidor",
  "Semi-Cooperative Game": "Semicooperativo",
  "Events": "Eventos",
  "Critical Hits and Failures": "Críticos y pifias",
  "Movement Points": "Puntos de movimiento",
  "Zone of Control": "Zonas de control",
  "Line of Sight": "Línea de visión",
  "Increase Value of Unchosen Resources": "Recursos que ganan valor",
  "Follow": "Seguir la acción",
  "Multi-Use Cards": "Cartas multiuso",
  "Hidden Movement": "Movimiento oculto",
  "Secret Unit Deployment": "Despliegue oculto",
  "Narrative Choice / Paragraph": "Elige tu aventura",
  "Map Addition": "Mapa que crece",
  "Map Reduction": "Mapa que encoge",
  "Once-Per-Game Abilities": "Habilidades de un solo uso",
  "Ratio / Combat Results Table": "Tabla de combate",
  "Chit-Pull System": "Saco de fichas",
  "Card Play Conflict Resolution": "Combate con cartas",
  "Delayed Purchase": "Compra diferida",
  "Victory Points as a Resource": "Puntos de victoria como recurso",
  "Variable Phase Order": "Orden de fases variable",
  "Bingo": "Bingo",
  "Layering": "Superposición",
  "Spatial": "Espacial",
};

const CATEGORIES_ES: Record<string, string> = {
  "Economic": "Económico",
  "Card Game": "De cartas",
  "Fantasy": "Fantasía",
  "Science Fiction": "Ciencia ficción",
  "Space Exploration": "Exploración espacial",
  "Adventure": "Aventura",
  "Exploration": "Exploración",
  "Fighting": "Combate",
  "Wargame": "Wargame",
  "Civilization": "Civilización",
  "Medieval": "Medieval",
  "Ancient": "Antigüedad",
  "Renaissance": "Renacimiento",
  "Industry / Manufacturing": "Industria",
  "Farming": "Granjas",
  "Animals": "Animales",
  "Environmental": "Naturaleza",
  "City Building": "Construcción de ciudades",
  "Territory Building": "Construcción de territorios",
  "Nautical": "Náutico",
  "Trains": "Trenes",
  "Transportation": "Transporte",
  "Travel": "Viajes",
  "Horror": "Terror",
  "Zombies": "Zombis",
  "Mythology": "Mitología",
  "Miniatures": "Miniaturas",
  "Party Game": "Party",
  "Abstract Strategy": "Abstracto",
  "Puzzle": "Puzle",
  "Deduction": "Deducción",
  "Bluffing": "Faroles",
  "Murder / Mystery": "Misterio",
  "Spies / Secret Agents": "Espías",
  "Political": "Político",
  "Negotiation": "Negociación",
  "Humor": "Humor",
  "Dice": "Dados",
  "Word Game": "Palabras",
  "Trivia": "Preguntas",
  "Educational": "Educativo",
  "Children's Game": "Infantil",
  "Puzzle Game": "Puzle",
  "Real-time": "Tiempo real",
  "Racing": "Carreras",
  "Sports": "Deportes",
  "Pirates": "Piratas",
  "Novel-based": "Basado en novela",
  "Movies / TV / Radio theme": "Cine y series",
  "Comic Book / Strip": "Cómic",
  "Video Game Theme": "Videojuegos",
  "Collectible Components": "Coleccionable",
  "American West": "Lejano Oeste",
  "Prehistoric": "Prehistoria",
  "Post-Napoleonic": "Siglo XIX",
  "World War II": "Segunda Guerra Mundial",
  "World War I": "Primera Guerra Mundial",
  "Modern Warfare": "Guerra moderna",
  "Age of Reason": "Ilustración",
  "Arabian": "Árabe",
  "Mature / Adult": "Adultos",
  "Religious": "Religión",
  "Medical": "Medicina",
  "Pike and Shot": "Picas y arcabuces",
  "Napoleonic": "Napoleónico",
  "Aviation / Flight": "Aviación",
  "Maze": "Laberintos",
  "Number": "Números",
  "Memory": "Memoria",
  "Action / Dexterity": "Habilidad",
  "Electronic": "Electrónico",
  "Math": "Matemáticas",
  "Book": "Libro",
};

export function mechanicLabel(name: string): string {
  return MECHANICS_ES[name] ?? name;
}

export function categoryLabel(name: string): string {
  return CATEGORIES_ES[name] ?? name;
}
