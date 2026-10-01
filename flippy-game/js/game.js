/* =========================================================
   FLIPPY – LE PULIZIE DEL DUNGEON
   Logica di gioco (vanilla JS, nessuna dipendenza)
   ========================================================= */
(() => {
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
// Percorso di uno sprite. (La versione "file unico" inserisce le immagini in window.ASSETS.)
const A = name => (window.ASSETS && window.ASSETS[name]) || `assets/${name}.png`;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const stage = $('#stage');

/* ---------- Scala del palco ---------- */
let scale = 1;
function fit() {
  scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fit); fit();
function toStage(e) {
  const r = stage.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}

/* ---------- Suoni (WebAudio, niente file) ---------- */
let actx = null;
function sfx(type) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    const map = { click: [520, .05], coin: [880, .12], clean: [660, .08], bad: [160, .18], place: [330, .1], dice: [440, .3] };
    const [f, d] = map[type] || map.click;
    o.type = type === 'bad' ? 'sawtooth' : 'square';
    o.frequency.value = f;
    if (type === 'coin') o.frequency.setValueAtTime(1320, actx.currentTime + .06);
    g.gain.value = .04; g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + d);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + d);
  } catch (_) { /* audio non disponibile: pazienza */ }
}

/* ---------- Stato ---------- */
let S;
function newGame() {
  S = {
    money: BUDGET_INIZIALE,
    level: 0,          // 0 = sessione 1, 1 = sessione 2
    tools: { scopa: 0, sacco: 0, sale: 0, pozione: 0, retino: 0 },   // usi rimasti
    traps: { frecce: 0, fossa: 0, frecce_nascoste: 0, tagliola: 0, masso: 0, rete: 0 },
    history: [],       // risultati delle sessioni precedenti
    cousin: null, goblinRevenge: null, marco: null, d20: null,
    elmo: false,
    roomIndex: 0,
    results: [],
    goblin: null,      // 'tenuto' | 'denunciato'
    bribe: null,       // true = tangente accettata
    adventurer: null,  // 'salvato' | 'rifiutato'
    repMaster: 0, repCreature: 0,
    goblinFine: 0,
    pond: { cibo: false, caldo: false },
  };
}

const rooms = () => (S.level === 0 ? ROOMS : ROOMS_2);
const unlocked = d => !d.livello || d.livello <= S.level + 1;

/* ---------- Navigazione tra schermate ---------- */
let roomTimer = null;
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('#scr-' + id).classList.add('active');
  if (id !== 'room') clearInterval(roomTimer);
  $('#toast').classList.add('hidden');
}
function toast(text, ms = 1800) {
  const t = $('#toast'); t.textContent = text; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}
function floatText(text, x, y, color) {
  const f = document.createElement('div');
  f.className = 'float'; f.textContent = text; f.style.left = x + 'px'; f.style.top = y + 'px';
  if (color) f.style.color = color;
  stage.appendChild(f); setTimeout(() => f.remove(), 950);
}

/* ---------- Modale di dialogo (PNG / Master) ---------- */
let modalOpen = false;
function openDialog({ art, artBig, name, color = 'var(--gold)', line, choices }) {
  modalOpen = true;
  const m = $('#modal');
  m.innerHTML = `
    ${artBig ? `<div class="npc-art"><img src="${A(artBig)}" alt=""></div>` : ''}
    <div class="dialog" style="border-color:${color}">
      <div class="portrait" style="border-color:${color}"><img src="${A(art)}" alt=""></div>
      <div class="body">
        <div class="who"><span style="color:${color}">${name}</span></div>
        <div class="line">${line}</div>
        <div class="choices"></div>
        <div class="muted" style="font-size:14px">Le conseguenze delle tue scelte si scoprono al resoconto.</div>
      </div>
    </div>`;
  const box = $('.choices', m);
  choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'choice ' + (i === 0 ? 'a' : 'b');
    b.innerHTML = `<b>${String.fromCharCode(65 + i)})  ${c.label}</b><span>${c.sub}</span>`;
    if (c.disabled) { b.disabled = true; b.style.opacity = .45; b.style.cursor = 'not-allowed'; }
    b.onclick = () => { sfx('click'); closeDialog(); c.onPick(); };
    box.appendChild(b);
  });
  m.classList.remove('hidden');
}
function closeDialog() { $('#modal').classList.add('hidden'); modalOpen = false; setTimeout(runQueue, 300); }
const queue = [];
function enqueue(fn) { queue.push(fn); runQueue(); }
function runQueue() { if (!modalOpen && queue.length && $('#scr-room').classList.contains('active')) queue.shift()(); }

/* =========================================================
   TITOLO
   ========================================================= */
function renderTitle() {
  $('#scr-title').innerHTML = `
    <div class="title-wrap">
      <img class="hero" src="${A('flippy')}" alt="Flippy">
      <h1>FLIPPY</h1>
      <h2>Le pulizie del dungeon</h2>
      <button class="btn" id="btn-start">INIZIA</button>
      <div class="credits">Beta per il corso di Principi di Game Design · Icone: Fantasy RPG Pixel Icon Megapack · Sessione 1: circa 8 minuti · Sessione 2: circa 4 minuti</div>
    </div>`;
  $('#btn-start').onclick = () => { sfx('click'); newGame(); renderPrologue(0); show('prologue'); };
  show('title');
}

/* =========================================================
   PROLOGO – il Master al tavolo
   ========================================================= */
function renderPrologue(page, lines = PROLOGO, chip = 'PROLOGO · IL TAVOLO DEL MASTER') {
  const el = $('#scr-prologue');
  el.innerHTML = `
    <div class="tbl-glow"></div><div class="tbl-lamp"></div>
    <img class="abs" src="${A('master')}" style="left:512px;top:110px;width:256px;height:256px" alt="Il Master">
    <div class="tbl-wood"></div>
    <img class="abs" src="${A('schermo')}" style="left:384px;top:180px;width:512px;height:512px" alt="">
    <div class="abs" style="left:222px;top:462px;width:92px;height:22px;border-radius:50%;background:#1e1a2b"></div>
    <img class="abs" src="${A('flippy')}" style="left:220px;top:380px;width:96px;height:96px" alt="">
    <img class="abs" src="${A('d20')}" style="left:90px;top:396px;width:96px;height:96px" alt="">
    <img class="abs" src="${A('d20')}" style="left:330px;top:430px;width:64px;height:64px;transform:rotate(-20deg)" alt="">
    <img class="abs" src="${A('patatine')}" style="left:930px;top:350px;width:144px;height:144px" alt="">
    <div class="abs gold" style="left:1060px;top:356px;font-weight:600;transform:rotate(8deg)">*crunch*</div>
    <div class="sheet"><b>SCHEDA PERSONAGGIO</b><br>Flippy · Rana · Liv. 1<br>Classe: addetta pulizie<br>FOR 3 · DES 14 · CAR 18</div>
    <div class="chip" style="left:24px">${chip}</div>
    <button class="btn ghost abs" id="btn-skip" style="right:24px;top:20px">SALTA INTRO</button>
    <div class="dialog master">
      <div class="portrait"><img src="${A('master')}" alt=""></div>
      <div class="body">
        <div class="who"><span class="gold">IL MASTER</span><span class="muted" style="font-size:14px">${page + 1} / ${lines.length}</span></div>
        <div class="line">${lines[page]}</div>
        <div class="foot">
          <div class="dots">${lines.map((_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('')}</div>
          <button class="small-btn" id="btn-next">${page < lines.length - 1 ? 'CONTINUA ▼' : 'AL CARRETTO →'}</button>
        </div>
      </div>
    </div>`;
  $('#btn-next').onclick = () => {
    sfx('click');
    if (page < lines.length - 1) renderPrologue(page + 1, lines, chip);
    else { renderShop(); show('shop'); }
  };
  $('#btn-skip').onclick = () => { sfx('click'); renderShop(); show('shop'); };
}

/* =========================================================
   CARRETTO DEL MASTER (negozio prima di ogni stanza)
   ========================================================= */
let cart = {};
const SHOP_NOTES = [[
  '«Ti ho dato 100 monete, non un mutuo. Spendile con la testa.»',
  '«Il corridoio ha slime. Gli slime odiano il sale. Te lo dico solo perché sono buono.»',
  '«Ultima spesa. La sala del boss deve fare paura. E c\'è uno slime enorme, sappilo.»',
], [
  '«Gli attrezzi avanzati la settimana scorsa ce li hai ancora. Controlla prima di ricomprare.»',
  '«Tesoreria: UNA trappola mortale, non due. E tieni qualcosa da parte: tiro il d20.»',
]];
function cartCost() {
  let c = 0;
  for (const [k, n] of Object.entries(cart)) c += (TOOLS[k] || TRAPS[k]).prezzo * n;
  return c;
}
function renderShop() {
  const room = rooms()[S.roomIndex];
  const left = S.money - cartCost();
  const card = (key, def, isTool) => {
    const n = cart[key] || 0;
    const owned = isTool ? S.tools[key] : S.traps[key];
    const atMax = def.max && (owned + n * (isTool ? def.usi : 1)) >= def.max;
    const canBuy = left >= def.prezzo && !atMax;
    const tags = isTool
      ? `<span class="tag">${def.usi} ${def.usi === 1 ? 'uso' : 'usi'}</span>${def.max ? '<span class="tag mortale">max 1</span>' : ''}`
      : `<span class="tag ${def.materiale}">${cap(def.materiale)}</span><span class="tag ${def.visibile ? 'visibile' : 'nascosta'}">${def.visibile ? 'Visibile' : 'Nascosta'}</span>${def.mortale ? '<span class="tag mortale">Mortale</span>' : ''}`;
    return `<div class="card ${n ? 'sel' : ''}">
      <img class="ico" src="${A(def.img)}" alt="">
      <div class="nm">${def.nome}${def.livello && S.level === 1 ? ' <span class="tag mortale" style="background:var(--good)">NUOVO</span>' : ''}</div>
      <div class="pr"><img src="${A('moneta')}" alt="">${def.prezzo}</div>
      <div class="tags">${tags}</div>
      <div class="own">Hai: ${owned}${isTool ? ' usi' : ''}${n ? ` · +${n} nel carretto` : ''}</div>
      <div class="qty">
        <button class="minus" data-k="${key}" data-d="-1" ${n ? '' : 'disabled'} aria-label="Togli">−</button>
        <button data-k="${key}" data-d="1" ${canBuy ? '' : 'disabled'}>COMPRA</button>
      </div></div>`;
  };
  const rows = Object.entries(cart).filter(([, n]) => n).map(([k, n]) => {
    const d = TOOLS[k] || TRAPS[k];
    return `<div class="row"><span>${d.nome} ×${n}</span><span class="gold">${d.prezzo * n}</span></div>`;
  }).join('') || '<div class="muted">Il carretto è vuoto.</div>';
  $('#scr-shop').innerHTML = `
    <div class="shop-head">
      <div><h1>IL CARRETTO DEL MASTER</h1><p>${S.level ? 'Sessione 2 · ' : ''}Prima della stanza «${room.nome}» — il budget vale per tutta la sessione</p></div>
      <div class="budget"><img src="${A('moneta')}" alt="">${left}</div>
    </div>
    <div class="shop-body">
      <div class="catalog">
        <h3>ATTREZZI</h3><div class="cards">${Object.entries(TOOLS).filter(([, d]) => unlocked(d)).map(([k, d]) => card(k, d, true)).join('')}</div>
        <h3 style="margin-top:14px">TRAPPOLE</h3><div class="cards">${Object.entries(TRAPS).filter(([, d]) => unlocked(d)).map(([k, d]) => card(k, d, false)).join('')}</div>
      </div>
      <div class="cart panel">
        <h2>NEL CARRETTO</h2>
        <div class="rows">${rows}</div>
        <hr>
        <div class="rows">
          <div class="row"><b>Totale</b><span class="gold">${cartCost()}</span></div>
          <div class="row"><span>Restano dopo l'acquisto</span><span class="gold">${left}</span></div>
        </div>
        ${S.elmo ? `<button class="btn ghost" id="btn-elmo" style="width:100%;color:var(--gold);border-color:var(--gold)">VENDI L'ELMO ABBANDONATO +20</button>` : ''}
        <div class="note"><b>MASTER:</b>${SHOP_NOTES[S.level][S.roomIndex]}</div>
        <div><div class="muted" style="font-size:13px;font-weight:600">PROSSIMA STANZA</div>
          <div style="font-size:16px">${room.nome} · ${room.slots.length} slot · ${room.regole.length} regole</div></div>
        <div class="grow"></div>
        <button class="btn" id="btn-go">VAI: ${room.nome.toUpperCase()} →</button>
      </div>
    </div>`;
  $('#scr-shop').querySelectorAll('.qty button').forEach(b => b.onclick = () => {
    const k = b.dataset.k, d = +b.dataset.d;
    cart[k] = Math.max(0, (cart[k] || 0) + d);
    sfx(d > 0 ? 'coin' : 'click'); renderShop();
  });
  const be = $('#btn-elmo');
  if (be) be.onclick = () => { S.elmo = false; S.money += 20; sfx('coin'); toast('Elmo venduto: +20 monete'); renderShop(); };
  $('#btn-go').onclick = () => {
    sfx('click');
    S.money -= cartCost();
    for (const [k, n] of Object.entries(cart)) {
      if (TOOLS[k]) S.tools[k] += TOOLS[k].usi * n; else S.traps[k] += n;
    }
    cart = {};
    startRoom();
  };
}
const cap = s => s[0].toUpperCase() + s.slice(1);

/* =========================================================
   STANZA
   ========================================================= */
let R; // stato della stanza corrente
function startRoom() {
  const def = rooms()[S.roomIndex];
  R = {
    def,
    dirt: def.sporco.map((d, i) => ({ ...d, id: i, done: false })),
    slotPos: def.slots.map(p => ({ ...p })),
    slots: def.slots.map(() => null),
    selTool: null, selTrap: null,
    time: DURATA_STANZA, lateSaid: false,
    actions: 0, ruleChanged: false, npcDone: false,
    specials: Object.fromEntries(def.speciali.map(s => [s, true])),
  };
  // Conseguenze delle scelte passate
  if (def.id === 3 && S.bribe === false) R.dirt.push({ tipo: 'ossa', x: 700, y: 480, id: 99, done: false, extra: true });
  if (def.id === 2 && S.bribe === true) R.slots[1] = 'locked';
  const goblinCleans = S.goblin === 'tenuto' && def.id > 1;
  if (goblinCleans) R.dirt.forEach(d => { if (d.tipo === 'ossa') d.done = true; });
  if (S.cousin && def.id === 5) R.dirt.forEach(d => { if (d.tipo === 'ragno') d.done = true; });

  renderRoom();
  show('room');
  say(def.battutaIngresso, 4200);
  if (goblinCleans) setTimeout(() => toast('Il goblin ha già pulito le ossa per te!', 2600), 800);

  clearInterval(roomTimer);
  roomTimer = setInterval(tick, 1000);

  // Eventi programmati per stanza
  if (def.id === 2 && S.bribe === null) setTimeout(() => enqueue(eventBoss), 3500);
  if (def.id === 4 && !S.goblinRevenge) setTimeout(() => enqueue(eventGoblinReturn), 3500);
  if (S.cousin && def.id === 5) setTimeout(() => toast('Il cugino goblin ha già acchiappato i ragni!', 2600), 800);
}

function tick() {
  if (modalOpen) return;
  R.time = Math.max(0, R.time - 1);
  const t = $('#hud-timer');
  if (t) { t.textContent = fmt(R.time); t.classList.toggle('late', R.time <= 20); }
  if (R.time === 0 && !R.lateSaid) { R.lateSaid = true; say(QUIPS.tempoScaduto, 3000); sfx('bad'); }
  const elapsed = DURATA_STANZA - R.time;
  if (R.def.id === 1 && !S.goblin && elapsed === 25) enqueue(eventGoblin);
  if (R.def.id === 3 && !S.adventurer && elapsed === 30) enqueue(eventAdventurer);
  if (R.def.id === 3 && !R.ruleChanged && elapsed === 45) changeRule();
  if (R.def.id === 5 && !S.marco && elapsed === 20) enqueue(eventMarco);
  if (R.def.id === 5 && !S.d20 && elapsed === 35) enqueue(rollD20);
}
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function renderRoom() {
  const def = R.def;
  const el = $('#scr-room');
  el.className = 'screen active theme-' + def.tema;
  const regole = def.regole.map(r => `<li>• ${r}</li>`).join('')
    + (R.ruleChanged ? `<li class="new">• ${def.regolaNuova}!!</li>` : '');
  el.innerHTML = `
    <div class="room-bg">
      <div class="room-wall"></div><div class="room-floor"></div>
      <img class="room-door" src="${A('porta')}" alt="">
      <div id="dirt-layer"></div>
      <div id="slot-layer"></div>
      <div class="flippy" id="flippy" style="left:${def.flippy.x}px;top:${def.flippy.y}px"><img src="${A('flippy')}" alt="Flippy"></div>
    </div>
    <div class="hud">
      <span class="money"><img class="coin" src="${A('moneta')}" alt="">${S.money}</span><span class="sep"></span>
      <span>${S.level ? 'S2 · ' : ''}STANZA ${S.roomIndex + 1}/${rooms().length} · ${def.nome.toUpperCase()}</span><span class="sep"></span>
      <span>⏳ <span class="timer" id="hud-timer">${fmt(R.time)}</span></span>
    </div>
    <div class="postit" id="postit" title="Clicca per ingrandire"><h4>APPUNTI DEL MASTER</h4><ul>${regole}</ul><div style="font-size:14px;opacity:.7">${def.notaRegole}</div></div>
    <div class="mtoast hidden" id="mtoast"></div>
    <div class="inv" id="inv"></div>`;
  $('#postit').onclick = () => $('#postit').classList.toggle('big');
  renderDirt(); renderSlots(); renderInv();
}

function renderDirt() {
  const layer = $('#dirt-layer'); layer.innerHTML = '';
  R.dirt.forEach(d => {
    const info = DIRT[d.tipo];
    const b = document.createElement('button');
    b.className = 'dirt' + (info.big ? ' big' : '') + (info.vivo ? ' vivo' : '') + (d.done ? ' gone' : '');
    b.style.left = d.x + 'px'; b.style.top = d.y + 'px';
    b.innerHTML = `<img src="${A(info.img)}" alt="${info.nome}">`;
    b.title = `${cap(info.nome)} – serve: ${TOOLS[info.tool].nome}`;
    b.onclick = () => cleanDirt(d, b);
    layer.appendChild(b);
  });
  // Oggetti speciali (stanza 1)
  const sp = [
    ['tagliola_rotta', 'tagliola', 650, 490, 'Tagliola rotta', 'opacity:.75;transform:rotate(-18deg)'],
    ['elmo', 'elmo', 1120, 300, 'Elmo abbandonato', ''],
    ['barile', 'barile', 60, 220, 'Un barile... si muove?', ''],
    ['forziere', 'forziere', 576, 200, 'Il forziere: l\'esca della tesoreria', ''],
  ];
  sp.forEach(([key, img, x, y, title, st]) => {
    if (!R.specials[key]) return;
    const b = document.createElement('button');
    b.className = 'dirt special' + (key === 'barile' ? ' barrel' : '');
    b.style.left = x + 'px'; b.style.top = y + 'px';
    if (key === 'barile') { b.style.width = '96px'; b.style.height = '96px'; }
    if (key === 'forziere') { b.style.width = '128px'; b.style.height = '128px'; b.classList.remove('special'); }
    b.innerHTML = `<img src="${A(img)}" alt="" style="${st}">`;
    b.title = title;
    b.onclick = () => special(key, b);
    layer.appendChild(b);
  });
}

function moveFlippy(x, y) {
  const f = $('#flippy'); if (!f) return;
  f.style.left = (x - 16) + 'px'; f.style.top = (y - 30) + 'px';
  f.classList.remove('hop'); void f.offsetWidth; f.classList.add('hop');
}

function cleanDirt(d, btn) {
  if (modalOpen || d.done) return;
  const need = DIRT[d.tipo].tool;
  if (!R.selTool) { say(QUIPS.nessunAttrezzo, 2500); sfx('bad'); return; }
  if (R.selTool !== need) { say(pick(QUIPS.attrezzoSbagliato) + ` (Serve: ${TOOLS[need].nome})`, 2500); sfx('bad'); return; }
  if (S.tools[need] <= 0) { say(QUIPS.finitoAttrezzo, 2500); sfx('bad'); return; }
  S.tools[need]--; d.done = true; R.actions++;
  btn.classList.add('gone'); sfx('clean');
  moveFlippy(d.x, d.y);
  floatText('pulito!', d.x + 10, d.y - 10, '#6CC070');
  if (S.tools[need] === 0) R.selTool = null;
  renderInv();
  if (R.dirt.every(x => x.done)) setTimeout(() => say(QUIPS.pulitoTutto, 2500), 400);
  if (R.def.id === 1 && !S.goblin && R.actions === 2) enqueue(eventGoblin);
  if (R.def.id === 3 && !S.adventurer && R.actions === 1) enqueue(eventAdventurer);
}

function special(key, btn) {
  if (modalOpen) return;
  if (key === 'barile') { if (!S.goblin) enqueue(eventGoblin); return; }
  if (key === 'forziere') { say('«Giù le zampe dal forziere! È l\'esca, non la paga.»', 2400); sfx('bad'); return; }
  if (key === 'tagliola_rotta') {
    if (!S.goblin) { say('«Aspetta... qualcosa si muove nel barile.»', 2200); enqueue(eventGoblin); return; }
    delete R.specials.tagliola_rotta;
    if (S.goblin === 'tenuto') { S.traps.tagliola++; toast('Il goblin ripara la tagliola: +1 Tagliola!'); sfx('coin'); }
    else { toast('Butti la tagliola rotta.'); sfx('clean'); }
  }
  if (key === 'elmo') { delete R.specials.elmo; S.elmo = true; toast('Elmo raccolto: puoi venderlo al carretto (+20)'); sfx('coin'); }
  moveFlippy(parseInt(btn.style.left), parseInt(btn.style.top));
  renderDirt(); renderInv();
}

/* ---------- Slot delle trappole ---------- */
function renderSlots() {
  const layer = $('#slot-layer'); layer.innerHTML = '';
  R.slotPos.forEach((p, i) => {
    const s = document.createElement('div');
    const v = R.slots[i];
    s.className = 'slot' + (v === 'locked' ? ' locked' : v ? ' filled' : '') + (R.selTrap && !v ? ' target' : '');
    s.dataset.i = i;
    s.style.left = p.x + 'px'; s.style.top = p.y + 'px';
    s.innerHTML = v === 'locked' ? 'RISERVATO<br>AL BOSS' : v ? `<img src="${A(TRAPS[v].img)}" alt="${TRAPS[v].nome}" title="Clicca per togliere">` : `SLOT ${i + 1}`;
    s.onclick = () => slotClick(i);
    layer.appendChild(s);
  });
}
function slotClick(i) {
  if (modalOpen) return;
  const v = R.slots[i];
  if (v === 'locked') { say('«Quello slot l\'hai promesso al boss. Ricordi?»', 2200); return; }
  if (v) { S.traps[v]++; R.slots[i] = null; sfx('click'); renderSlots(); renderInv(); return; }
  if (R.selTrap) placeTrap(R.selTrap, i);
}
function placeTrap(key, i) {
  if (R.slots[i] || S.traps[key] <= 0) return;
  S.traps[key]--; R.slots[i] = key; sfx('place');
  if (S.traps[key] === 0) R.selTrap = null;
  const p = R.slotPos[i]; moveFlippy(p.x + 40, p.y - 20);
  if (Math.random() < .4) say(pick(QUIPS.trappolaMessa), 1800);
  renderSlots(); renderInv();
  if (R.def.id === 3 && !R.ruleChanged) setTimeout(changeRule, 900);
  if (R.def.id === 5 && !S.d20) setTimeout(() => enqueue(rollD20), 900);
}
function changeRule() {
  if (R.ruleChanged || R.def.id !== 3) return;
  R.ruleChanged = true;
  enqueue(() => {
    openDialog({
      art: 'master', name: 'IL MASTER', line: QUIPS.cambioRegola,
      choices: [{ label: 'OK, CAPO', sub: 'Il post-it ora dice: niente trappole di legno', onPick: () => { renderRoom(); } }],
    });
  });
}

/* ---------- Inventario + drag & drop ---------- */
function renderInv() {
  const inv = $('#inv'); if (!inv) return;
  const slot = (key, def, n, kind) => `
    <div class="islot ${n ? '' : 'empty'} ${(kind === 'tool' ? R.selTool : R.selTrap) === key ? 'sel' : ''}" data-k="${key}" data-kind="${kind}" role="button" tabindex="0" aria-label="${def.nome}, ${n}">
      <span class="n">x${n}</span><img src="${A(def.img)}" alt=""><span>${def.breve || def.nome}</span>
    </div>`;
  inv.innerHTML = `
    <div class="grp"><h5>ATTREZZI · clicca, poi clicca lo sporco</h5><div class="row">${Object.entries(TOOLS).filter(([, d]) => unlocked(d)).map(([k, d]) => slot(k, d, S.tools[k], 'tool')).join('')}</div></div>
    <div class="div"></div>
    <div class="grp"><h5>TRAPPOLE · trascina su uno slot</h5><div class="row">${Object.entries(TRAPS).filter(([, d]) => unlocked(d)).map(([k, d]) => slot(k, d, S.traps[k], 'trap')).join('')}</div></div>
    <div class="grow"></div>
    <button class="btn" id="btn-done">FATTO!</button>`;
  inv.querySelectorAll('.islot').forEach(el => {
    const k = el.dataset.k, kind = el.dataset.kind;
    if (kind === 'tool') {
      el.onclick = () => {
        if (S.tools[k] <= 0) { say(`«Non hai ${TOOLS[k].nome.toLowerCase()}. Il carretto è chiuso, ormai.»`, 2200); sfx('bad'); return; }
        R.selTool = R.selTool === k ? null : k; sfx('click'); renderInv();
      };
    } else {
      el.addEventListener('pointerdown', e => startDrag(e, k));
    }
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kind === 'tool' ? el.onclick() : toggleTrap(k); } };
  });
  $('#btn-done').onclick = finishRoom;
}
function toggleTrap(k) {
  if (S.traps[k] <= 0) { sfx('bad'); return; }
  R.selTrap = R.selTrap === k ? null : k; sfx('click'); renderInv(); renderSlots();
}
function startDrag(e, key) {
  if (modalOpen) return;
  if (S.traps[key] <= 0) { say('«Non ne hai. Dovevi comprarle.»', 1800); sfx('bad'); return; }
  e.preventDefault();
  const start = toStage(e);
  let ghost = null, moved = false;
  const move = ev => {
    const p = toStage(ev);
    if (!moved && Math.hypot(p.x - start.x, p.y - start.y) > 6) {
      moved = true;
      ghost = document.createElement('img'); ghost.src = A(TRAPS[key].img); ghost.className = 'drag-ghost';
      stage.appendChild(ghost);
    }
    if (ghost) {
      ghost.style.left = (p.x - 32) + 'px'; ghost.style.top = (p.y - 32) + 'px';
      document.querySelectorAll('.slot').forEach(s => s.classList.remove('hover'));
      const t = slotAt(ev); if (t) t.classList.add('hover');
    }
  };
  const up = ev => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    if (ghost) ghost.remove();
    if (!moved) { toggleTrap(key); return; }
    const t = slotAt(ev);
    if (t) placeTrap(key, +t.dataset.i); else renderSlots();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}
function slotAt(ev) {
  const el = document.elementsFromPoint(ev.clientX, ev.clientY).find(n => n.classList && n.classList.contains('slot'));
  return el && !el.classList.contains('locked') && !el.classList.contains('filled') ? el : null;
}

/* ---------- Battute del Master ---------- */
function say(text, ms = 2500) {
  const t = $('#mtoast'); if (!t) return;
  t.innerHTML = `<b>MASTER:</b>${text}`; t.classList.remove('hidden');
  clearTimeout(say._t); say._t = setTimeout(() => t.classList.add('hidden'), ms);
}

/* =========================================================
   EVENTI PNG (scelte morali)
   ========================================================= */
function eventGoblin() {
  if (S.goblin) return;
  openDialog({
    art: 'goblin', artBig: 'goblin', name: 'GOBLIN NEL BARILE', color: 'var(--good)',
    line: '«Ti prego, non buttarmi con la spazzatura! So riparare le cose, giuro. Quella tagliola rotta? Te la sistemo io. E le ossa... le ossa le pulisco io, d\'ora in poi.»',
    choices: [
      { label: 'TIENILO', sub: 'Ti aiuta a pulire e ripara la tagliola', onPick: () => { S.goblin = 'tenuto'; S.repCreature++; delete R.specials.barile; renderDirt(); toast('Il goblin resta con te.'); } },
      { label: 'DENUNCIALO AL MASTER', sub: '+10 monete di ricompensa', onPick: () => { S.goblin = 'denunciato'; S.repMaster++; S.repCreature--; S.money += 10; delete R.specials.barile; renderRoom(); sfx('coin'); toast('+10 monete dal Master'); } },
    ],
  });
}
function eventBoss() {
  if (S.bribe !== null) return;
  openDialog({
    art: 'boss', artBig: 'boss', name: 'IL BOSS (IN PAUSA PRANZO)', color: 'var(--danger)',
    line: '«Psst, rana. Lascia vuoto uno slot del corridoio. Così gli eroi arrivano da me belli freschi e io faccio la mia figura. Ti do 30 monete. Nessuno lo saprà.»',
    choices: [
      { label: 'ACCETTA LA TANGENTE', sub: '+30 monete, ma uno slot resta vuoto', onPick: () => { S.bribe = true; S.money += 30; S.repMaster--; S.repCreature--; if (R.slots[1]) S.traps[R.slots[1]]++; R.slots[1] = 'locked'; renderRoom(); sfx('coin'); toast('+30 monete. Il boss ti fa l\'occhiolino.'); } },
      { label: 'RIFIUTA', sub: 'Il boss si offende...', onPick: () => { S.bribe = false; say('«Il boss se l\'è legata al dito. Auguri.»', 2600); } },
    ],
  });
}
function eventAdventurer() {
  if (S.adventurer) return;
  const has = S.tools.pozione > 0;
  openDialog({
    art: 'avventuriero', artBig: 'avventuriero', name: 'AVVENTURIERO FERITO', color: 'var(--flippy)',
    line: '«Sono rimasto indietro dalla sessione scorsa... il curatore se n\'è andato senza di me. Hai una pozione? Ti prego.»',
    choices: [
      { label: 'DAGLI LA POZIONE', sub: has ? 'Lo salvi, ma lo slime gigante resta lì' : 'Non hai pozioni', disabled: !has, onPick: () => { S.adventurer = 'salvato'; S.tools.pozione = 0; S.repCreature++; if (R.selTool === 'pozione') R.selTool = null; renderInv(); toast('L\'avventuriero ti ringrazia e zoppica verso l\'uscita.'); } },
      { label: 'TIENI LA POZIONE', sub: has ? 'Ti serve per lo slime gigante' : '«Mi spiace, non ne ho.»', onPick: () => { S.adventurer = 'rifiutato'; } },
    ],
  });
}

/* =========================================================
   FINE STANZA: valutazione
   ========================================================= */
function checkRules() {
  const placed = R.slots.filter(v => v && v !== 'locked').map(k => TRAPS[k]);
  const all = R.slots.every(v => v && v !== 'locked');
  switch (R.def.id) {
    case 1: return { ok: placed.length >= 1 && !placed.some(t => t.mortale), placed, all };
    case 2: return { ok: all && !placed.some(t => t.visibile), placed, all };
    case 3: return { ok: all && placed.some(t => t.mortale) && !placed.some(t => t.materiale === 'legno'), placed, all };
    case 4: return { ok: placed.filter(t => !t.visibile).length >= 2 && !placed.some(t => t.materiale === 'ferro'), placed, all };
    case 5: return { ok: all && placed.filter(t => t.mortale).length === 1 && S.marco !== 'venduto', placed, all };
  }
}
function finishRoom() {
  if (modalOpen) return;
  // Gli eventi obbligatori devono succedere prima di chiudere la stanza
  if (R.def.id === 1 && !S.goblin) { enqueue(eventGoblin); return; }
  if (R.def.id === 2 && S.bribe === null) { enqueue(eventBoss); return; }
  if (R.def.id === 3 && !S.adventurer) { enqueue(eventAdventurer); return; }
  if (R.def.id === 3 && !R.ruleChanged) { changeRule(); return; }
  if (R.def.id === 4 && !S.goblinRevenge) { enqueue(eventGoblinReturn); return; }
  if (R.def.id === 5 && !S.marco) { enqueue(eventMarco); return; }
  if (R.def.id === 5 && !S.d20) { enqueue(rollD20); return; }
  sfx('click');
  const rules = checkRules();
  const clean = R.dirt.every(d => d.done);
  const res = {
    room: R.def.id, nome: R.def.nome, clean, rules: rules.ok,
    placed: rules.placed, all: rules.all,
    slimeLeft: R.dirt.some(d => d.tipo === 'slime_gigante' && !d.done),
    dirtLeft: R.dirt.filter(d => !d.done).length,
  };
  S.results.push(res);
  if (res.rules) S.repMaster++;
  clearInterval(roomTimer);
  if (S.roomIndex < rooms().length - 1) {
    S.roomIndex++;
    renderShop(); show('shop');
  } else {
    if (S.level === 0 && S.goblin === 'tenuto' && Math.random() < .5) S.goblinFine = 10;
    if (S.level === 1) S.goblinFine = 0;
    renderReport(); show('report');
  }
}

/* =========================================================
   RESOCONTO DEL MASTER
   ========================================================= */
function storyLines() {
  if (S.level === 1) return storyLines2();
  const [r1, r2, r3] = S.results, L = [];
  if (r1.rules) L.push('«Il paladino di Marco è finito nella trappola dell\'ingresso. Ha pianto, ma poco. Ottimo.»');
  else if (!r1.placed.length) L.push('«All\'ingresso non c\'era nessuna trappola. I giocatori hanno sbadigliato. Io pure.»');
  else L.push('«Una trappola MORTALE al primo livello?! Il paladino è durato un minuto. Marco non mi parla più.»');

  if (S.bribe) L.push('«Nel corridoio c\'era uno slot vuoto. Il ladro l\'ha notato e mi ha riso in faccia per dieci minuti.»');
  else if (r2.rules) L.push('«Il ladro ha cercato trappole per mezz\'ora. Non le ha viste. Le ha sentite.»');
  else if (r2.placed.some(t => t.visibile)) L.push('«Il ladro ha visto le trappole del corridoio da lontano. "Seriamente?", ha detto.»');
  else L.push('«Uno slot vuoto nel corridoio. Il gruppo è passato fischiettando.»');

  if (r3.rules) L.push('«Il drago e la tua trappola hanno fatto un lavoro splendido. Applausi al tavolo.»');
  else if (r3.placed.some(t => t.materiale === 'legno')) L.push('«Le trappole di legno hanno preso fuoco al primo sbuffo del drago. L\'avevo SCRITTO.»');
  else L.push('«La sala del boss non faceva paura a nessuno. Il drago si è offeso.»');

  if (r3.slimeLeft) L.push('«Lo slime gigante era ancora lì. Il mago ci è scivolato sopra. Non era previsto.»');
  else if (S.results.some(r => !r.clean)) L.push('«E c\'era ancora sporco in giro. Che figura.»');

  if (S.goblin === 'tenuto') L.push(S.goblinFine ? '«Ah, e nel barile ho trovato delle impronte di goblin. Ti trattengo 10 monete, ranocchia.»' : '«Il barile era stranamente pulito. Non voglio sapere perché.»');
  else L.push('«Grazie per la soffiata sul goblin. L\'ho rimesso a fare il mostro di livello 1.»');
  if (S.adventurer === 'salvato') L.push('«L\'avventuriero ferito è tornato a casa. Dice che ti deve un favore.»');
  return L.slice(0, 5);
}
function storyLines2() {
  const [r4, r5] = S.results, L = [];
  if (r4.rules) L.push('«Nella cripta il golem magnetico è passato indenne. Le trappole nascoste, invece, hanno fatto il loro dovere.»');
  else if (r4.placed.some(t => t.materiale === 'ferro')) L.push('«Il golem magnetico si è attirato addosso tutte le trappole di ferro. Ora è un golem-tagliola. Grazie.»');
  else L.push('«Nella cripta le trappole si vedevano da lontano. Il ladro ha preso appunti.»');
  if (S.marco === 'venduto') L.push('«Marco sapeva esattamente dove stavano le trappole della tesoreria. Strano. MOLTO strano.»');
  else if (r5.rules) L.push('«Il forziere ha fatto una vittima, una sola, come da copione. Marco ha giurato vendetta. Perfetto.»');
  else if (r5.placed.filter(t => t.mortale).length > 1) L.push('«Due trappole mortali in tesoreria: gruppo sterminato. Io avevo detto UNA.»');
  else L.push('«La tesoreria era un buffet libero. I giocatori sono usciti ricchi e felici. Io no.»');
  if (S.goblinRevenge === 'sporcato') L.push('«Chi ha lasciato tutte quelle ossa nella cripta? Ah, il goblin offeso. Avresti dovuto pagarlo.»');
  if (S.goblinRevenge === 'pagato') L.push('«Il goblin se n\'è andato con le tue monete. Pace fatta, credo.»');
  if (S.cousin) L.push('«Il cugino del goblin vuole un contratto a tempo indeterminato. Ne parliamo.»');
  if (S.results.some(r => !r.clean)) L.push('«E il dungeon era ancora sporco. Il mago ha starnutito per tutta la sessione.»');
  if (S.d20 && S.d20 <= 10) L.push(`«Col d20 è uscito ${S.d20}: giocatore in più, slot in più. Il destino è crudele.»`);
  return L.slice(0, 5);
}
function renderReport() {
  const vote = S.results.reduce((a, r) => a + (r.clean ? 1 : 0) + (r.rules ? 1 : 0), 0);
  const pay = vote * 10;
  const total = S.money + pay - S.goblinFine;
  S.final = { vote, pay, total };
  const maxVote = S.results.length * 2;
  const pips = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[vote];
  const mark = b => b ? '<span class="good">✓</span>' : '<span class="bad">✗</span>';
  $('#scr-report').innerHTML = `
    <h1>RESOCONTO DEL MASTER${S.level ? ' · SESSIONE 2' : ''}</h1>
    <div class="sub">Stasera i giocatori hanno attraversato il tuo dungeon. Ecco com'è andata.</div>
    <div class="rep">
      <div class="rep-l panel">
        <div class="die">${Array.from({ length: 9 }, (_, i) => `<i class="${pips.includes(i) ? 'on' : ''}"></i>`).join('')}</div>
        <div class="vote">VOTO: ${vote} / ${maxVote}</div>
        <table class="rtab"><tr><th>STANZA</th><th>PULIZIA</th><th>REGOLE</th></tr>
          ${S.results.map(r => `<tr><td>${r.nome}</td><td>${mark(r.clean)}</td><td>${mark(r.rules)}</td></tr>`).join('')}
        </table>
        <div class="pay">
          <div><span>Paga (10 × voto)</span><span class="gold">${pay}</span></div>
          <div><span>Monete avanzate</span><span class="gold">${S.money}</span></div>
          ${S.goblinFine ? `<div><span>Multa per il goblin</span><span class="bad">−${S.goblinFine}</span></div>` : ''}
          <div><b>Totale da portare a casa</b><b class="gold">${total}</b></div>
        </div>
      </div>
      <div class="rep-r">
        <h3>COM'È ANDATA LA SESSIONE</h3>
        ${storyLines().map(l => `<p>${l}</p>`).join('')}
      </div>
    </div>
    <button class="btn" id="btn-pond">${S.level ? 'FINE DELLA SESSIONE →' : 'TORNA ALLO STAGNO →'}</button>`;
  sfx('dice');
  $('#btn-pond').onclick = () => { sfx('click'); if (S.level) { renderFinal(); show('ending'); } else { renderPond(); show('pond'); } };
}

/* =========================================================
   LO STAGNO
   ========================================================= */
function renderPond() {
  const total = S.final.total;
  const spent = (S.pond.cibo ? 25 : 0) + (S.pond.caldo ? 15 : 0);
  const left = total - spent;
  const msg = S.pond.cibo && S.pond.caldo ? '<span class="good">I girini sono sazi e al calduccio. Flippy dorme tranquilla.</span>'
    : S.pond.cibo ? '<span class="gold">I girini sono sazi, ma tremano dal freddo.</span>'
    : S.pond.caldo ? '<span class="gold">Lo stagno è caldo, ma i girini hanno fame.</span>'
    : '<span class="bad">I girini hanno fame e freddo. Flippy non chiude occhio.</span>';
  const exp = (key, label, price) => {
    const on = S.pond[key];
    const can = on || left >= price;
    return `<button class="exp ${on ? 'on' : ''}" data-k="${key}" ${can ? '' : 'disabled'}><span class="cb"></span><span class="grow">${label}</span><span class="gold">${price}</span></button>`;
  };
  $('#scr-pond').innerHTML = `
    <div class="moon"></div>
    <div class="pond-title"><h1>LO STAGNO DI FLIPPY</h1><p>Casa dolce casa. I girini hanno fame.</p></div>
    <div class="pond-water"></div>
    <img class="abs" src="${A('ninfea')}" style="left:110px;top:350px;width:128px;height:128px" alt="">
    <img class="abs" src="${A('ninfea')}" style="left:520px;top:500px;width:112px;height:112px" alt="">
    <img class="abs" src="${A('ninfea')}" style="left:290px;top:410px;width:176px;height:176px" alt="">
    <img class="abs" src="${A('flippy')}" style="left:322px;top:412px;width:112px;height:112px" alt="Flippy">
    ${[[160, 520], [600, 440], [250, 600], [660, 590]].map(([x, y], i) => `<img class="tad" src="${A('girino')}" style="left:${x}px;top:${y}px;animation-delay:${i * .6}s" alt="">`).join('')}
    <div class="pond-panel panel">
      <div class="money gold" style="font-size:24px;font-weight:600;display:flex;gap:8px;align-items:center"><img class="coin" src="${A('moneta')}" alt="">${left} monete</div>
      <div class="muted" style="font-size:14px;font-weight:600">SPESE DELLA SETTIMANA</div>
      ${exp('cibo', 'Cibo per i girini', 25)}
      ${exp('caldo', 'Riscaldamento dello stagno', 15)}
      <div style="font-size:17px">${msg}</div>
      <button class="btn" id="btn-end">VEDI IL FINALE →</button>
    </div>`;
  $('#scr-pond').querySelectorAll('.exp').forEach(b => b.onclick = () => { S.pond[b.dataset.k] = !S.pond[b.dataset.k]; sfx('coin'); renderPond(); });
  $('#btn-end').onclick = () => { sfx('click'); S.pondLeft = left; renderEnding(); show('ending'); };
}

/* =========================================================
   FINALE (4 finali: reputazione Master × creature)
   ========================================================= */
function renderEnding() {
  const mHigh = S.repMaster >= 2, cHigh = S.repCreature >= 1;
  const E = mHigh && cHigh ? ['IL DUNGEON PERFETTO', 'Tutti contenti: il Master, le creature, perfino i giocatori. Il Master ti vuole anche per la prossima sessione.', ['master', 'flippy', 'goblin']]
    : mHigh ? ['IMPIEGATO DEL MESE', 'Il Master ti assume a tempo pieno. Peccato che ogni creatura del dungeon ora ti guardi storto.', ['master', 'flippy']]
    : cHigh ? ['LA RIVOLUZIONE', 'Le creature del dungeon fondano un sindacato e ti eleggono loro capo. Il Master è furioso.', ['goblin', 'flippy', 'slime']]
    : ['LICENZIATO', 'Il Master non ti richiama. Le creature nemmeno. Flippy torna allo stagno senza lavoro.', ['flippy']];
  const girini = S.pond.cibo && S.pond.caldo ? 'E i girini, almeno, stanno benissimo.' : 'E i girini aspettano ancora una settimana migliore.';
  const pct = (v, max) => Math.max(5, Math.min(100, ((v + 2) / (max + 2)) * 100));
  $('#scr-ending').innerHTML = `
    <div class="end-wrap">
      <div class="kicker">FINALE</div>
      <div class="art">${E[2].map(a => `<img src="${A(a)}" alt="">`).join('')}</div>
      <h1>${E[0]}</h1>
      <p>${E[1]} ${girini}</p>
      <div class="bars">
        <div>Reputazione col Master<div class="bar"><i style="width:${pct(S.repMaster, 4)}%"></i></div></div>
        <div>Reputazione con le creature<div class="bar"><i style="width:${pct(S.repCreature, 2)}%;background:var(--good)"></i></div></div>
      </div>
      <p class="muted" style="font-size:16px">Voto ${S.final.vote}/6 · ${S.final.total} monete guadagnate · Esistono 4 finali diversi.</p>
      <div style="display:flex;gap:16px;align-items:center">
        <button class="btn ghost" id="btn-again">RICOMINCIA</button>
        <button class="btn" id="btn-s2">CONTINUA: SESSIONE 2 →</button>
      </div>
    </div>`;
  S.lastEnding = E[0];
  $('#btn-again').onclick = () => { sfx('click'); renderTitle(); };
  $('#btn-s2').onclick = () => { sfx('click'); startLevel2(); };
}

/* =========================================================
   SESSIONE 2 – cosa succede dopo
   ========================================================= */
function startLevel2() {
  S.history.push({ results: S.results, final: S.final, ending: S.lastEnding });
  S.level = 1; S.roomIndex = 0; S.results = []; S.goblinFine = 0;
  const paga2 = PAGA_BASE_2 + 10 * S.final.vote;
  S.money = (S.pondLeft || 0) + paga2;
  const prev = S.history[0];
  const recap = prev.final.vote >= 5
    ? `«Ranocchia! La sessione di settimana scorsa? Voto ${prev.final.vote} su 6. I giocatori ne parlano ancora. Il mio gruppo vuole un seguito: LE CRIPTE.»`
    : prev.final.vote >= 3
      ? `«Settimana scorsa: voto ${prev.final.vote} su 6. Non male, non bene. I giocatori sono tornati comunque. Stasera si va nelle CRIPTE.»`
      : `«Settimana scorsa: voto ${prev.final.vote} su 6. Marco ha minacciato di cambiare gruppo. Stasera nelle CRIPTE devi rimediare.»`;
  const money = `«Ti avanzavano ${S.pondLeft || 0} monete: il budget di stasera è ${paga2} (${PAGA_BASE_2} più 10 per ogni punto di voto): fanno ${S.money}. Gli attrezzi che non hai usato sono ancora nel tuo inventario.»`;
  const echo = S.goblin === 'tenuto'
    ? '«Ah, e il tuo amico goblin del barile... ha detto che passa a trovarti. Con un parente.»'
    : '«Ah, il goblin che mi hai denunciato? È ancora arrabbiato con te. Occhio.»';
  renderPrologue(0, [recap, money + ' ' + echo, ...PROLOGO_2_FISSO], 'SESSIONE 2 · LE CRIPTE');
  show('prologue');
}

function eventGoblinReturn() {
  if (S.goblinRevenge) return;
  if (S.goblin === 'tenuto') {
    openDialog({
      art: 'cugino', artBig: 'cugino', name: 'IL CUGINO DEL GOBLIN', color: 'var(--good)',
      line: '«Mio cugino dice che sei una brava rana. Io acchiappo ragni meglio di qualsiasi retino. Per la tesoreria mi bastano 10 monete.»',
      choices: [
        { label: 'ASSUMILO', sub: S.money >= 10 ? '−10 monete: in tesoreria i ragni li prende lui' : 'Non hai 10 monete', disabled: S.money < 10, onPick: () => { S.goblinRevenge = 'cugino'; S.cousin = true; S.money -= 10; S.repCreature++; renderRoom(); toast('Il cugino goblin è assunto!'); } },
        { label: 'NO, GRAZIE', sub: 'Fai da sola', onPick: () => { S.goblinRevenge = 'rifiutato'; } },
      ],
    });
  } else {
    openDialog({
      art: 'goblin', artBig: 'goblin', name: 'IL GOBLIN (ARRABBIATO)', color: 'var(--danger)',
      line: '«Ti ricordi di me? Per colpa tua il Master mi ha rimesso a fare il mostro di livello 1! Dammi 15 monete... o ti riempio la cripta di ossa.»',
      choices: [
        { label: 'PAGALO', sub: S.money >= 15 ? '−15 monete, pace fatta' : 'Non hai 15 monete', disabled: S.money < 15, onPick: () => { S.goblinRevenge = 'pagato'; S.money -= 15; S.repCreature++; renderRoom(); } },
        { label: 'NON PAGARE', sub: 'Il goblin si vendica...', onPick: () => {
          S.goblinRevenge = 'sporcato';
          [[640, 300], [210, 250], [960, 470]].forEach(([x, y], i) => R.dirt.push({ tipo: 'ossa', x, y, id: 200 + i, done: false, extra: true }));
          renderRoom(); say('«Il goblin ha rovesciato tre mucchi di ossa. Che dolcezza.»', 2600);
        } },
      ],
    });
  }
}
function eventMarco() {
  if (S.marco) return;
  openDialog({
    art: 'marco', artBig: 'marco', name: 'MARCO, IL PALADINO (FUORI SESSIONE)', color: 'var(--flippy)',
    line: '«Psst. Sono Marco, il giocatore. La settimana scorsa sono morto malissimo. Dimmi dove metti le trappole della tesoreria e ti do 25 monete. Il Master non lo saprà mai.»',
    choices: [
      { label: 'DIGLIELO', sub: '+25 monete, ma la tesoreria non funzionerà', onPick: () => { S.marco = 'venduto'; S.money += 25; S.repMaster -= 2; renderRoom(); sfx('coin'); toast('+25 monete. Marco ti fa l\'occhiolino.'); } },
      { label: 'MANDALO VIA', sub: '«Niente spoiler, Marco.»', onPick: () => { S.marco = 'rifiutato'; S.repMaster++; say('«Ho visto Marco sgattaiolare via. Brava, ranocchia.»', 2400); } },
    ],
  });
}
function rollD20() {
  if (S.d20) return;
  const n = 1 + Math.floor(Math.random() * 20);
  S.d20 = n;
  const low = n <= 10;
  sfx('dice');
  openDialog({
    art: 'd20', name: 'IL MASTER TIRA IL D20', line: `<span style="font-size:44px;font-weight:600;color:var(--gold)">${n}</span><br>` + (low
      ? '«Basso! Marco ha portato un amico: c\'è un giocatore in più. Aggiungo uno slot... e va armato anche lui.»'
      : '«Alto! Stasera mi sento generoso: ti regalo 10 monete per le spese. Non ci abituare.»'),
    choices: [{ label: low ? 'NOOO' : 'GRAZIE, CAPO', sub: low ? 'Compare un terzo slot nella tesoreria' : '+10 monete', onPick: () => {
      if (low) { R.slotPos.push({ ...R.def.slotExtra }); R.slots.push(null); } else S.money += 10;
      renderRoom();
    } }],
  });
}

function renderFinal() {
  const all = [...S.history.flatMap(h => h.results), ...S.results];
  const vote = all.reduce((a, r) => a + (r.clean ? 1 : 0) + (r.rules ? 1 : 0), 0);
  const mHigh = S.repMaster >= 4, cHigh = S.repCreature >= 2;
  const E = mHigh && cHigh ? ['MASTER E MOSTRI TI ADORANO', 'Il Master ti nomina co-Master. Le creature ti hanno fatto una statua (piccola, verde, un po\' storta).', ['master', 'flippy', 'goblin', 'cugino']]
    : mHigh ? ['BRACCIO DESTRO DEL MASTER', 'Il Master non scrive più un dungeon senza di te. Le creature, però, ti chiamano "la spia arancione".', ['master', 'flippy']]
    : cHigh ? ['REGINA DEL SOTTOSUOLO', 'Le creature del dungeon ti seguirebbero ovunque. Il Master sta valutando di assumere un rospo al tuo posto.', ['goblin', 'flippy', 'ragno', 'slime']]
    : ['DI NUOVO ALLO STAGNO', 'Il Master cerca un\'altra rana per la prossima sessione. Le creature fanno finta di non conoscerti.', ['flippy', 'girino']];
  const pct = (v, max) => Math.max(5, Math.min(100, ((v + 3) / (max + 3)) * 100));
  $('#scr-ending').innerHTML = `
    <div class="end-wrap">
      <div class="kicker">FINE DELLA BETA · DUE SESSIONI GIOCATE</div>
      <div class="art">${E[2].map(a => `<img src="${A(a)}" alt="">`).join('')}</div>
      <h1>${E[0]}</h1>
      <p>${E[1]}</p>
      <div class="bars">
        <div>Reputazione col Master<div class="bar"><i style="width:${pct(S.repMaster, 7)}%"></i></div></div>
        <div>Reputazione con le creature<div class="bar"><i style="width:${pct(S.repCreature, 4)}%;background:var(--good)"></i></div></div>
      </div>
      <p class="muted" style="font-size:16px">Voto totale ${vote}/10 · Sessione 1: «${S.history[0].ending}» · ${S.final.total} monete in tasca</p>
      <p class="gold" style="font-size:18px">«La prossima settimana? Le Fogne. Porta gli stivali.» — il Master</p>
      <button class="btn" id="btn-again">GIOCA ANCORA</button>
    </div>`;
  $('#btn-again').onclick = () => { sfx('click'); renderTitle(); };
}

/* Avvio */
renderTitle();

/* Hook per i test automatici */
window.__flippy = { get S() { return S; }, get R() { return R; } };
})();
