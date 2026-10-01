/* =========================================================
   DATI DI GIOCO – modifica qui numeri, testi e stanze
   ========================================================= */

const BUDGET_INIZIALE = 100;
const DURATA_STANZA = 120; // secondi (timer "morbido": non blocca la partita)

/* Attrezzi per pulire: usi = quante pulizie fa un acquisto */
const TOOLS = {
  scopa:   { nome: 'Scopa',   prezzo: 5,  usi: 5, pulisce: 'ragnatela', img: 'scopa' },
  sacco:   { nome: 'Sacco',   prezzo: 5,  usi: 6, pulisce: 'ossa',      img: 'sacco' },
  sale:    { nome: 'Sale',    prezzo: 10, usi: 2, pulisce: 'slime',     img: 'sale' },
  pozione: { nome: 'Pozione', prezzo: 15, usi: 1, pulisce: 'slime_gigante', img: 'pozione', max: 1 },
  retino:  { nome: 'Retino',  prezzo: 6,  usi: 3, pulisce: 'ragno',     img: 'retino', livello: 2 },
};

/* Trappole: materiale, visibile, mortale servono per le regole del Master */
const TRAPS = {
  frecce:          { nome: 'Frecce',        breve: 'Frecce',     prezzo: 10, materiale: 'legno',  visibile: true,  mortale: false, img: 'frecce' },
  fossa:           { nome: 'Fossa coperta', breve: 'Fossa',      prezzo: 15, materiale: 'legno',  visibile: false, mortale: false, img: 'fossa' },
  frecce_nascoste: { nome: 'Frecce nasc.',  breve: 'Frecce na.', prezzo: 20, materiale: 'legno',  visibile: false, mortale: false, img: 'frecce_nascoste' },
  tagliola:        { nome: 'Tagliola',      breve: 'Tagliola',   prezzo: 20, materiale: 'ferro',  visibile: true,  mortale: false, img: 'tagliola' },
  masso:           { nome: 'Masso',         breve: 'Masso',      prezzo: 25, materiale: 'pietra', visibile: false, mortale: true,  img: 'masso' },
  rete:            { nome: 'Rete',          breve: 'Rete',       prezzo: 15, materiale: 'corda',  visibile: false, mortale: false, img: 'rete', livello: 2 },
};

/* Tipi di sporco: quale attrezzo serve */
const DIRT = {
  ragnatela:     { nome: 'ragnatela',     tool: 'scopa',   img: 'ragnatela' },
  ossa:          { nome: 'mucchio di ossa', tool: 'sacco', img: 'ossa' },
  slime:         { nome: 'slime',         tool: 'sale',    img: 'slime' },
  slime_gigante: { nome: 'slime gigante', tool: 'pozione', img: 'slime', big: true },
  ragno:         { nome: 'ragno',         tool: 'retino',  img: 'ragno', vivo: true },
};

/* Prologo: il Master spiega il gioco al tavolo */
const PROLOGO = [
  '«Benvenuta al mio tavolo, ranocchia! Funziona come una partita di ruolo: io sono il Master. Scrivo il dungeon, tiro i dadi dietro lo schermo e decido le regole. Tu? Tu sei la miniatura arancione lì in fondo.»',
  '«Stasera arrivano i miei giocatori. Problema: il dungeon è ancora sporco dalla sessione scorsa. Ragnatele, ossa, slime... uno schifo. Il tuo lavoro è pulire e rimettere le trappole giuste.»',
  '«Ti do 100 monete d\'oro. Prima di ogni stanza passi dal mio carretto e compri attrezzi e trappole. Il budget è uno solo per tutto il dungeon: se lo bruci subito, poi sono affari tuoi.»',
  '«Le regole di ogni stanza le trovi sul mio post-it. Leggile. Potrei cambiarle. Anzi, le cambierò. E se incontri qualcuno nel dungeon... fai le tue scelte. Io lo verrò a sapere. Si comincia!»',
];

/* Stanze. Coordinate in pixel sul palco 1280x720 (l'area di gioco è alta 560). */
const ROOMS = [
  {
    id: 1, nome: 'Ingresso', tema: 1,
    battutaIngresso: '«Ragnatele ovunque. Che schifo. Pulisci, ranocchia.»',
    regole: ['Almeno 1 trappola', 'Niente trappole mortali'],
    notaRegole: '(è il primo livello!!)',
    slots: [{ x: 330, y: 380 }, { x: 800, y: 380 }],
    sporco: [
      { tipo: 'ragnatela', x: 150, y: 120 }, { tipo: 'ragnatela', x: 470, y: 150 }, { tipo: 'ragnatela', x: 880, y: 150 },
      { tipo: 'ossa', x: 200, y: 470 }, { tipo: 'ossa', x: 1010, y: 480 },
    ],
    speciali: ['tagliola_rotta', 'elmo', 'barile'],
    flippy: { x: 592, y: 392 },
  },
  {
    id: 2, nome: 'Corridoio', tema: 2,
    battutaIngresso: '«Il corridoio. Il ladro del gruppo controlla ogni mattonella: niente trappole visibili, intesi?»',
    regole: ['Tutti gli slot armati', 'Niente trappole visibili'],
    notaRegole: '(il ladro ha Percezione +5)',
    slots: [{ x: 230, y: 380 }, { x: 565, y: 430 }, { x: 900, y: 380 }],
    sporco: [
      { tipo: 'ragnatela', x: 160, y: 110 }, { tipo: 'ragnatela', x: 930, y: 190 },
      { tipo: 'ossa', x: 420, y: 300 }, { tipo: 'ossa', x: 1100, y: 470 },
      { tipo: 'slime', x: 120, y: 330 }, { tipo: 'slime', x: 760, y: 300 },
    ],
    speciali: [],
    flippy: { x: 600, y: 300 },
  },
  {
    id: 3, nome: 'Sala del boss', tema: 3,
    battutaIngresso: '«La sala del boss. Deve fare paura: voglio almeno una trappola mortale. Il paladino se lo merita.»',
    regole: ['Tutti gli slot armati', 'Almeno 1 trappola mortale'],
    notaRegole: '(che paura!!)',
    regolaNuova: 'Niente trappole di legno',
    slots: [{ x: 300, y: 400 }, { x: 830, y: 400 }],
    sporco: [
      { tipo: 'ossa', x: 170, y: 300 }, { tipo: 'ossa', x: 1040, y: 300 },
      { tipo: 'slime_gigante', x: 576, y: 300 },
    ],
    speciali: [],
    flippy: { x: 440, y: 300 },
  },
];

/* Battute del Master durante la stanza */
const QUIPS = {
  attrezzoSbagliato: ['«Con quello? Davvero?»', '«No. Quello non serve a niente qui.»', '«Ranocchia, attrezzo sbagliato. Concentrati.»'],
  finitoAttrezzo: '«Hai finito gli usi. Il carretto era lì apposta.»',
  nessunAttrezzo: '«Prima scegli un attrezzo dall\'inventario. Poi clicchi sullo sporco.»',
  pulitoTutto: '«Pulito. Quasi mi commuovo.»',
  tempoScaduto: '«Stanno parcheggiando. STANNO PARCHEGGIANDO!»',
  trappolaMessa: ['«Mh. Interessante.»', '«Ok, vediamo come va.»', '«Il paladino ringrazia. Forse.»'],
  cambioRegola: '«Aspetta, aspetta. Ho cambiato idea: il boss adesso è un DRAGO. Niente trappole di legno, bruciano. L\'ho scritto sul post-it.»',
};

/* =========================================================
   SESSIONE 2 – "Le cripte"
   Si gioca dopo il finale della sessione 1: soldi avanzati,
   attrezzi rimasti e scelte fatte si portano avanti.
   ========================================================= */
const PAGA_BASE_2 = 40;   // la paga della sessione 2 è PAGA_BASE_2 + 10 × voto della sessione 1

const ROOMS_2 = [
  {
    id: 4, nome: 'Cripta', tema: 4,
    battutaIngresso: '«La cripta. Ci sono ragni ovunque: al carretto c\'è il retino nuovo, usalo.»',
    regole: ['Almeno 2 trappole nascoste', 'Niente trappole di ferro'],
    notaRegole: '(c\'è un golem magnetico!!)',
    slots: [{ x: 250, y: 400 }, { x: 565, y: 440 }, { x: 880, y: 400 }],
    sporco: [
      { tipo: 'ragnatela', x: 140, y: 110 }, { tipo: 'ragnatela', x: 900, y: 200 },
      { tipo: 'ragno', x: 420, y: 160 }, { tipo: 'ragno', x: 860, y: 290 }, { tipo: 'ragno', x: 120, y: 330 },
      { tipo: 'ossa', x: 400, y: 490 }, { tipo: 'ossa', x: 1100, y: 480 },
    ],
    speciali: [],
    flippy: { x: 600, y: 300 },
  },
  {
    id: 5, nome: 'Tesoreria', tema: 5,
    battutaIngresso: '«La tesoreria. Il forziere deve sembrare irresistibile... e costare caro a chi lo tocca.»',
    regole: ['Tutti gli slot armati', 'Esattamente 1 trappola mortale'],
    notaRegole: '(una sola: non sono un mostro)',
    slots: [{ x: 300, y: 410 }, { x: 830, y: 410 }],
    slotExtra: { x: 565, y: 470 },
    sporco: [
      { tipo: 'slime', x: 150, y: 320 }, { tipo: 'slime', x: 1050, y: 300 },
      { tipo: 'ragno', x: 380, y: 170 }, { tipo: 'ragno', x: 880, y: 160 },
      { tipo: 'ossa', x: 700, y: 330 },
    ],
    speciali: ['forziere'],
    flippy: { x: 450, y: 300 },
  },
];

/* Il prologo della sessione 2 è in parte dinamico (vedi game.js → prologo2) */
const PROLOGO_2_FISSO = [
  '«Novità di stasera: al carretto trovi il RETINO per i ragni e la RETE, una trappola di corda. Nascosta, non mortale, e soprattutto non è di ferro. Ti servirà.»',
  '«E da stasera tiro il d20 quando mi pare. Se esce basso, qualcosa cambia. Se esce alto... cambia lo stesso, ma in meglio. Forse. Al lavoro!»',
];
