// Juegos de muestra para los mockups de la portada. Las carátulas son las
// miniaturas que BGG sirve desde su CDN (cf.geekdo-images.com, ya permitido
// en next.config.ts); ya vienen a 200 px, así que se pintan sin optimizar.

export interface DemoGame {
  bggId: number;
  name: string;
  thumb: string;
  rating: number;
  players: string;
  minutes: number;
}

const CDN = "https://cf.geekdo-images.com";

export const DEMO_GAMES: Record<string, DemoGame> = {
  brass: {
    bggId: 224517,
    name: "Brass: Birmingham",
    thumb: `${CDN}/x3zxjr-Vw5iU4yDPg70Jgw__small/img/o18rjEemoWaVru9Y2TyPwuIaRfE=/fit-in/200x150/filters:strip_icc()/pic3490053.jpg`,
    rating: 8.6,
    players: "2-4",
    minutes: 120,
  },
  arkNova: {
    bggId: 342942,
    name: "Ark Nova",
    thumb: `${CDN}/G4E49iT20jcf8XM8H_fNkA__small/img/JKelMpNqJU1BXXvVUZHQm7gJ-Eg=/fit-in/200x150/filters:strip_icc()/pic6657491.jpg`,
    rating: 8.5,
    players: "1-4",
    minutes: 150,
  },
  root: {
    bggId: 237182,
    name: "Root",
    thumb: `${CDN}/JUAUWaVUzeBgzirhZNmHHw__small/img/ACovMZzGGIsBRyEQXFnsT8282NM=/fit-in/200x150/filters:strip_icc()/pic4254509.jpg`,
    rating: 8.1,
    players: "2-4",
    minutes: 90,
  },
  arnak: {
    bggId: 312484,
    name: "Las Ruinas Perdidas de Arnak",
    thumb: `${CDN}/K3ITddDrb-EOIdLi62L03w__small/img/YMcM5IysbiwG2uK0FANRgd-aeS0=/fit-in/200x150/filters:strip_icc()/pic8507441.jpg`,
    rating: 8.1,
    players: "1-4",
    minutes: 120,
  },
  wyrmspan: {
    bggId: 410201,
    name: "Wyrmspan",
    thumb: `${CDN}/B3SjMAXcJevAxhsT6V_vmw__small/img/sBVn4XHr0Jz0MKnuaHtRwVVFt3M=/fit-in/200x150/filters:strip_icc()/pic7963789.jpg`,
    rating: 8.0,
    players: "1-5",
    minutes: 90,
  },
  viticulture: {
    bggId: 183394,
    name: "Viticulture",
    thumb: `${CDN}/DwoHlrEVXEuTHrMbBkbywA__small/img/Rc47YQku0xwk5PVZwAnhCg5my8E=/fit-in/200x150/filters:strip_icc()/pic3506752.png`,
    rating: 8.0,
    players: "1-6",
    minutes: 90,
  },
  dune: {
    bggId: 397598,
    name: "Dune: Imperium – Insurrección",
    thumb: `${CDN}/6QuUhZqo_Fhfh3EkzUuwIg__small/img/ewnCQeloR9CzeE7THZD7LbIn4eQ=/fit-in/200x150/filters:strip_icc()/pic8453379.png`,
    rating: 8.7,
    players: "1-6",
    minutes: 120,
  },
  seti: {
    bggId: 418059,
    name: "SETI",
    thumb: `${CDN}/8mZz_nHJCZIVMjxYsjOh7A__small/img/ZUJZ2ifpDEjcyoXfBubTpYXfWGQ=/fit-in/200x150/filters:strip_icc()/pic8673808.jpg`,
    rating: 8.4,
    players: "1-4",
    minutes: 160,
  },
  odin: {
    bggId: 177736,
    name: "El Banquete de Odín",
    thumb: `${CDN}/8UsY8V1vV8dZZobwbjrcaQ__small/img/byHGg39jMI3Rn05J-IdErK7TFw4=/fit-in/200x150/filters:strip_icc()/pic6267932.jpg`,
    rating: 8.2,
    players: "1-4",
    minutes: 120,
  },
  gaia: {
    bggId: 220308,
    name: "Gaia Project",
    thumb: `${CDN}/VqSwoKbIESW57WFOc3YslQ__small/img/u7WtlOpgm6Mn7cvQ973xcMSSAV4=/fit-in/200x150/filters:strip_icc()/pic3998208.jpg`,
    rating: 8.4,
    players: "1-4",
    minutes: 150,
  },
  revive: {
    bggId: 332772,
    name: "Revive",
    thumb: `${CDN}/9fvFXjgdBaQz50BdKKW8-Q__small/img/LaIT-iuRN9X7w7Ko7QoYqxnDzdk=/fit-in/200x150/filters:strip_icc()/pic7707423.jpg`,
    rating: 8.1,
    players: "1-4",
    minutes: 120,
  },
  darwin: {
    bggId: 322289,
    name: "Darwin's Journey",
    thumb: `${CDN}/-A_ABjMw4PdoAZrH-FjiiA__small/img/_rJRtHzqatLg9OQM0x1UaC1cRGY=/fit-in/200x150/filters:strip_icc()/pic5726930.png`,
    rating: 8.1,
    players: "1-4",
    minutes: 120,
  },
  altaTension: {
    bggId: 2651,
    name: "Alta Tensión",
    thumb: `${CDN}/kzzOiqOWF3coLfNkYyWHDg__small/img/sc0_Ob1UVCmO1PvG8MKINPW0pec=/fit-in/200x150/filters:strip_icc()/pic4459749.jpg`,
    rating: 7.8,
    players: "2-6",
    minutes: 120,
  },
  keyflower: {
    bggId: 122515,
    name: "Keyflower",
    thumb: `${CDN}/HbfgxDJZQnNEZQKvpmJxQg__small/img/5t1MtJEDdhSgtyJlmu3Hu1qR_ZQ=/fit-in/200x150/filters:strip_icc()/pic2278942.jpg`,
    rating: 7.7,
    players: "2-6",
    minutes: 120,
  },
  lorenzo: {
    bggId: 203993,
    name: "Lorenzo il Magnifico",
    thumb: `${CDN}/8G6GkImjt0F_L5aYb8fmtQ__small/img/MoUo5LUThQh7CyxGX6QnPBM5zAo=/fit-in/200x150/filters:strip_icc()/pic3175535.jpg`,
    rating: 7.8,
    players: "2-4",
    minutes: 120,
  },
  marvel: {
    bggId: 285774,
    name: "Marvel Champions",
    thumb: `${CDN}/kRvUgYiaOq07kC67ZK5UoQ__small/img/SDNWntiB06KhAINl06CDPkoipDc=/fit-in/200x150/filters:strip_icc()/pic4900321.jpg`,
    rating: 8.1,
    players: "1-4",
    minutes: 90,
  },
  clank: {
    bggId: 365717,
    name: "Clank!: Catacumbas",
    thumb: `${CDN}/gE13FNDHQvkdIw7-idfabQ__small/img/bmWwF_qcDkd1y4LXTIYZtEmXKPw=/fit-in/200x150/filters:strip_icc()/pic7863181.jpg`,
    rating: 8.2,
    players: "2-4",
    minutes: 90,
  },
  underwater: {
    bggId: 247763,
    name: "Underwater Cities",
    thumb: `${CDN}/PwOwTVHovJAUQgghnGqCOg__small/img/1gGYiRBx7W4wyLy826EHGTdjsKA=/fit-in/200x150/filters:strip_icc()/pic4837710.png`,
    rating: 8.0,
    players: "1-4",
    minutes: 150,
  },
  barrage: {
    bggId: 251247,
    name: "Barrage",
    thumb: `${CDN}/9zrDVRtf5W3R0O4byWydxw__small/img/wFLuMAPJ7xdwdUebORjgPmZMeK0=/fit-in/200x150/filters:strip_icc()/pic5222265.jpg`,
    rating: 8.1,
    players: "1-4",
    minutes: 180,
  },
  caverna: {
    bggId: 102794,
    name: "Caverna",
    thumb: `${CDN}/YQOGmXvuwSIwicpfUl1fQA__small/img/T0Hrorssn6rViTEXp0PZnG_Ocw8=/fit-in/200x150/filters:strip_icc()/pic7149151.png`,
    rating: 7.9,
    players: "1-7",
    minutes: 210,
  },
  aeons: {
    bggId: 191189,
    name: "Aeon's End",
    thumb: `${CDN}/6pb57_tmMkc2VMOyUtD5VQ__small/img/jYG0sgA8K4iyjtT6OC6Ob3co0Wk=/fit-in/200x150/filters:strip_icc()/pic7438965.jpg`,
    rating: 7.9,
    players: "1-4",
    minutes: 60,
  },
  beyondSun: {
    bggId: 317985,
    name: "Beyond the Sun",
    thumb: `${CDN}/RJq3FqLOBViK-BEeyp7-RA__small/img/HVUdgrkfMveeBlxhFh0Q_ZaBJAs=/fit-in/200x150/filters:strip_icc()/pic6607141.jpg`,
    rating: 7.9,
    players: "2-4",
    minutes: 120,
  },
};

export const MARQUEE_TOP = [
  "brass", "root", "wyrmspan", "arkNova", "viticulture", "dune", "seti",
  "odin", "gaia", "revive", "clank",
].map((k) => DEMO_GAMES[k]);

export const MARQUEE_BOTTOM = [
  "darwin", "altaTension", "keyflower", "arnak", "lorenzo", "marvel",
  "underwater", "barrage", "caverna", "aeons", "beyondSun",
].map((k) => DEMO_GAMES[k]);
