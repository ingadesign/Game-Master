# Flippy – Le pulizie del dungeon 🐸

Beta giocabile per il corso di **Principi di Game Design**: sessione 1 (circa 8 minuti) e sessione 2 (circa 4 minuti).

Flippy è una piccola rana arancione. Il Master le affida un compito ingrato: pulire il dungeon dopo la sessione precedente e rimettere le trappole giuste prima che arrivino i giocatori. Il budget è poco, le regole cambiano e nel dungeon si incontra gente con cui fare scelte difficili, nello stile di *Papers, Please*.

## Come si gioca

1. **Prologo:** il Master spiega il gioco al tavolo.
2. **Carretto del Master:** prima di ogni stanza compri attrezzi e trappole. Le 100 monete valgono per tutto il dungeon.
3. **Stanza:**
   - **Pulire:** clicchi un attrezzo nell'inventario, poi clicchi lo sporco. Scopa per le ragnatele, sacco per le ossa, sale per gli slime, pozione per lo slime gigante.
   - **Trappole:** le trascini dall'inventario sugli slot (oppure le clicchi e poi clicchi lo slot). Per toglierne una, clicchi lo slot.
   - **Regole:** le trovi sul post-it del Master, in alto a destra. Leggile bene.
   - **Fine stanza:** premi **FATTO!**
4. **PNG:** goblin, boss e avventuriero ti chiedono qualcosa. Le conseguenze si scoprono alla fine.
5. **Resoconto:** il voto va da 0 a 6 (pulizia + regole, per 3 stanze). Poi torni allo stagno, paghi le spese dei girini e vedi uno dei **4 finali**.

## Sessione 2 – Le cripte (cosa succede dopo)

Dopo il finale della sessione 1 si può continuare con **CONTINUA: SESSIONE 2**. Tutto quello che hai fatto ha delle conseguenze:

- **Soldi:** le monete avanzate dallo stagno restano. Il Master aggiunge 40 monete più 10 per ogni punto di voto della sessione 1.
- **Inventario:** attrezzi e trappole non usati restano.
- **Il goblin torna.** Se l'avevi tenuto, porta il cugino, che per 10 monete acchiappa i ragni della tesoreria. Se l'avevi denunciato, vuole 15 monete, altrimenti ti riempie la cripta di ossa.
- **Novità al carretto:** il **retino** per i ragni (nuovo tipo di sporco) e la **rete**, una trappola di corda nascosta e non di ferro.
- **Due stanze nuove:** la **Cripta** ("almeno 2 trappole nascoste, niente ferro") e la **Tesoreria** ("tutti gli slot armati, esattamente 1 trappola mortale").
- **Il d20 del Master:** in tesoreria il Master tira il dado. Se esce basso arriva un giocatore in più e compare un terzo slot da armare. Se esce alto ti regala 10 monete.
- **Marco, il giocatore,** si intrufola fuori sessione e offre 25 monete per sapere dove sono le trappole.
- **Finale complessivo:** 4 finali basati sulla reputazione accumulata in tutte e due le sessioni.

## Provarlo sul computer

È tutto HTML, CSS e JavaScript: non c'è niente da installare.

- **Il modo più semplice:** apri `dist/flippy.html` con doppio clic. È il gioco intero in un solo file.
- **Dalla cartella del progetto,** con un piccolo server locale:
  ```bash
  python3 -m http.server 8000
  ```
  Poi apri http://localhost:8000

## Pubblicarlo su GitHub Pages

Il gioco si trova nella cartella `flippy-game` del repository `Game-Master`. Per pubblicarlo, vai su **Settings → Pages** e in "Build and deployment" scegli **Deploy from a branch**, branch **main** e cartella **/ (root)**, poi clicca **Save**.

Quando la pubblicazione è attiva, il gioco è raggiungibile qui: [https://ingadesign.github.io/Game-Master/flippy-game/](https://ingadesign.github.io/Game-Master/flippy-game/). Potrebbe volerci qualche minuto dopo il salvataggio delle impostazioni.

## Modificare il gioco

Prezzi, usi degli attrezzi, regole delle stanze, posizione dello sporco e testi del Master sono tutti in **`js/data.js`**: si cambiano senza toccare la logica.

Dopo una modifica, rigenera la versione a file unico con:
```bash
python3 tools/build_single.py
```

## Struttura

```
index.html          pagina del gioco
css/style.css       grafica e layout (palco 1280×720, si adatta alla finestra)
js/data.js          numeri, stanze, testi (sessione 1 e ROOMS_2 per la sessione 2)
js/game.js          logica: schermate, negozio, pulizia, trappole, PNG, finali
assets/             sprite in pixel art 32×32
dist/flippy.html    tutto il gioco in un solo file
tools/              script di build
```

## Crediti

- Game design, grafica e sviluppo: il team del progetto.
- Icone e personaggi (oggetti, goblin, boss, avventuriero, Master...): **Fantasy RPG Pixel Icon Megapack (lite)**. Prima di pubblicare, controllate che la licenza del pack ne permetta la redistribuzione.
- Flippy, scopa, girini, ninfee, muri, pavimenti, acqua, porta, tavolo, d20, patatine e schermo del Master: disegnati apposta per il gioco, nello stile del pack.
- Font: [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) (SIL Open Font License).
