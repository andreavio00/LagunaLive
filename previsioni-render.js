/* ============================================================
   PREVISIONI-RENDER.JS
   Legge la struttura dati da previsioni-data.js e la disegna.
   Gestisce 2 viste: NORMALE (prossime ore + 3 giorni) ed ESPLOSA
   (8 giorni in alto + dettaglio orario/fasce del giorno scelto).
   ============================================================ */

const ICON_PATH = "icons/";

const ICONE = {
    sun: "sole.png",
    sun_notte: "luna.png",
    partly: "poco_nuvoloso.png",
    partly_notte: "poco_nuvoloso_notte.png",
    cloud: "nuvoloso.png",
    rain: "pioggia.png",
    storm: "temporale.png",
    snow: "neve.png",
    fog: "nebbia.png"
};

/* Ore rappresentative per le fasce, quando non abbiamo un'ora precisa
   (es. riepilogo giorno o card fascia) ma serve decidere sole/luna */
const ORA_RAPPRESENTATIVA_FASCIA = { notte: 3, mattina: 9, pomeriggio: 15, sera: 21 };

function fileIcona(categoria, notte) {
    if (categoria === "sun") return notte ? ICONE.sun_notte : ICONE.sun;
    if (categoria === "partly") return notte ? ICONE.partly_notte : ICONE.partly;
    return ICONE[categoria] || ICONE.cloud;
}

/* contesto: "chiaro" (riga in alto, sfondo chiaro, serve contrasto)
   oppure "scuro" (righe sotto, sfondo blu scuro, contrasto già ok).
   ora: 0-23, usata per scegliere sole/luna e poco-nuvoloso giorno/notte. */
function iconaPer(categoria, contesto = "scuro", ora = 12) {
    const notte = ora < 7 || ora >= 20;
    const file = fileIcona(categoria, notte);

    if (contesto === "chiaro") {
        if (categoria === "sun" && !notte) {
            return `<img src="${ICON_PATH}${file}" width="40" alt="sole">`;
        }
        return `<span class="prvs-icona-badge"><img src="${ICON_PATH}${file}" width="34" alt="${categoria || ''}"></span>`;
    }

    return `<img src="${ICON_PATH}${file}" width="36" alt="${categoria || ''}">`;
}

/* ============================================================
   VENTO — mostrato solo se forte (soglia decisa in chat: 40 km/h),
   con nome bora/scirocco quando la direzione rientra nei settori.
   ============================================================ */
function direzioneNome(gradi) {
    if (gradi === null || gradi === undefined) return "";
    if (gradi >= 30 && gradi <= 90) return "Bora";
    if (gradi >= 110 && gradi <= 160) return "Scirocco";
    const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
    return dirs[Math.round(gradi / 45) % 8];
}

function ventoTesto(vento, direzione) {
    if (vento === null || vento === undefined || vento < 40) return null;
    return `💨 ${Math.round(vento)}km/h ${direzioneNome(direzione)}`.trim();
}

/* ============================================================
   BADGE ALLARMI — solo su giorni/fasce, mai sull'ora singola
   (il weathercode orario è già abbastanza esplicito, vedi chat).
   ============================================================ */
function badgeAllarmi(allarmi) {
    if (!allarmi) return "";
    const pezzi = [];
    if (allarmi.temporaleForte) pezzi.push(`<span class="prvs-badge-allarme" title="Temporale forte">⛈️</span>`);
    if (allarmi.nebbiaPersistente) pezzi.push(`<span class="prvs-badge-allarme" title="Nebbia persistente">🌫️</span>`);
    if (allarmi.acquaAlta) pezzi.push(`<span class="prvs-badge-allarme" title="Acqua alta">🌊</span>`);
    return pezzi.length ? `<div class="prvs-badge-riga">${pezzi.join("")}</div>` : "";
}

/* Versione compatta dell'allerta, come piccolo badge sovrapposto
   all'angolo dell'icona invece di una riga a parte: usata dove serve
   mantenere l'altezza della scheda uniforme con le altre (striscia
   scorrevole in alto), a differenza di badgeAllarmi() che va bene
   nelle liste verticali dove ogni riga può avere altezza propria. */
function badgeOverlay(allarmi) {
    if (!allarmi) return "";
    if (allarmi.temporaleForte) return `<span class="prvs-badge-overlay" title="Temporale forte">⛈️</span>`;
    if (allarmi.nebbiaPersistente) return `<span class="prvs-badge-overlay" title="Nebbia persistente">🌫️</span>`;
    if (allarmi.acquaAlta) return `<span class="prvs-badge-overlay" title="Acqua alta">🌊</span>`;
    return "";
}

/* ============================================================
   CONCORDANZA TRA MODELLI — 3 pallini (temp/pioggia/vento),
   calcolo delegato a previsioni-data.js (soglie centralizzate lì).
   ============================================================ */
function rigaConcordanza(m1, m2) {
    const c = PrevisioniData.calcolaConcordanza(m1, m2);
    const pallino = (livello, etichetta) => livello
        ? `<span class="prvs-pallino prvs-pallino-${livello}" title="${etichetta}"></span>`
        : "";
    if (!c.temp && !c.pioggia && !c.vento) return "";
    return `<div class="prvs-concordanza">
        ${pallino(c.temp, "Accordo temperatura")}
        ${pallino(c.pioggia, "Accordo pioggia")}
        ${pallino(c.vento, "Accordo vento")}
    </div>`;
}

/* Stato della vista esplosa. null = vista normale. */
let stato = {
    giornoSelezionato: null,
    modalitaDettaglio: "fasce"
};

let previsioniCache = null;

/* ============================================================
   FASCIA 1 — Situazione attuale
   ============================================================ */
function renderAttuale() {
    const el = document.getElementById("prvs-attuale");
    // TODO: collegare qui la stessa fonte dati (stazioni osservate)
    // già usata nella dashboard principale di LagunaLive.
    el.innerHTML = `<span class="prvs-attuale-caricamento">
        Dato osservato — da collegare alle stazioni LagunaLive
    </span>`;
}

/* ============================================================
   VISTA NORMALE — prossime 10 ore + 3 righe giorno
   ============================================================ */
function renderVistaNormale(previsioni) {
    rimuoviControlliEsplosione();
    document.getElementById("prvs-label-striscia").textContent = "Prossime ore";

    const scroll = document.getElementById("prvs-oggi-scroll");
    scroll.innerHTML = "";

    for (const ora of previsioni.prossimeOre) {
        const cella = document.createElement("div");
        cella.className = "prvs-oraria-cell";
        const ventoTxt = ventoTesto(ora.vento, ora.direzioneVento);
        cella.innerHTML = `
            <div class="prvs-ora-testo">${String(ora.ora).padStart(2, "0")}:00</div>
            <div class="prvs-oraria-corpo">
                <div class="prvs-oraria-icona-temp">
                    ${iconaPer(ora.categoria, "chiaro", ora.ora)}
                    <div class="prvs-ora-temp-grande">${ora.temp !== null ? Math.round(ora.temp) + "°" : "—"}</div>
                </div>
                <div class="prvs-oraria-stats">
                    <div>🌧️ ${ora.precip !== null ? ora.precip.toFixed(1) + "mm" : "—"}</div>
                    <div>💧 ${ora.umidita !== null ? ora.umidita + "%" : "—"}</div>
                    <div>🥵 ${ora.percepita !== null ? Math.round(ora.percepita) + "°" : "—"}</div>
                    ${ventoTxt ? `<div>${ventoTxt}</div>` : ""}
                </div>
            </div>
        `;
        cella.addEventListener("click", () => apriEsplosione(previsioni, ora.data));
        scroll.appendChild(cella);
    }

    const contenitore = document.getElementById("prvs-fascia-giorni");
    contenitore.innerHTML = "";

    const inizio = previsioni.indiceInizioRiepilogo;
    const giorniDaMostrare = previsioni.riepilogoGiorni.slice(inizio, inizio + 3);

    for (const giorno of giorniDaMostrare) {
        const card = creaCardGiorno(giorno);
        card.addEventListener("click", () => apriEsplosione(previsioni, giorno.data));
        contenitore.appendChild(card);
    }
}

function creaCardGiorno(giorno) {
    const card = document.createElement("div");
    card.className = "prvs-giorno-card";
    card.innerHTML = `
        <div class="prvs-giorno-label">${giorno.label}</div>
        ${iconaPer(giorno.sintesi.categoria, "scuro", 12)}
        <div class="prvs-giorno-dati">
            <div class="prvs-giorno-temp-minmax">
                🌡️ ${giorno.sintesi.max !== null ? Math.round(giorno.sintesi.max) + "°" : "—"}
                / ${giorno.sintesi.min !== null ? Math.round(giorno.sintesi.min) + "°" : "—"}
            </div>
            <div class="prvs-giorno-pioggia">
                🌧️ ${giorno.sintesi.pioggiaTotale !== null ? giorno.sintesi.pioggiaTotale + "mm" : "—"}
            </div>
        </div>
        ${badgeAllarmi(giorno.allarmi)}
    `;
    return card;
}

/* ============================================================
   VISTA ESPLOSA
   Riga 1: 8 schede giorno (oggi + 7gg), stesso formato delle ore.
   Sotto: toggle Ore/Fasce + dettaglio del giorno selezionato.
   ============================================================ */
function apriEsplosione(previsioni, dataSelezionata) {
    stato.giornoSelezionato = dataSelezionata;
    renderVistaEsplosa(previsioni);
}

function renderVistaEsplosa(previsioni) {
    document.getElementById("prvs-label-striscia").textContent = "Prossimi giorni";

    // --- Riga 1: 8 schede giorno ---
    const scroll = document.getElementById("prvs-oggi-scroll");
    scroll.innerHTML = "";

    for (const [idx, giorno] of previsioni.riepilogoGiorni.entries()) {
        const cella = document.createElement("div");
        cella.className = "prvs-oraria-cell";
        if (giorno.data === stato.giornoSelezionato) cella.classList.add("selezionata");

        // Dal 3° giorno in poi (indice 2+) mostriamo anche la probabilità
        // di pioggia dal modello globale, oltre ai mm — vedi chat.
        const rigaOmbrello = idx >= 2 && giorno.sintesi.probPioggiaGenerale !== null
            ? `<div>☂️ ${giorno.sintesi.probPioggiaGenerale}%</div>`
            : "";

        cella.innerHTML = `
            <div class="prvs-ora-testo">${giorno.label}</div>
            <div class="prvs-oraria-corpo">
                <div class="prvs-icona-wrapper">
                    ${iconaPer(giorno.sintesi.categoria, "chiaro", 12)}
                    ${badgeOverlay(giorno.allarmi)}
                </div>
                <div class="prvs-giorno-temp-maxmin">
                    <div class="tmax">${giorno.sintesi.max !== null ? Math.round(giorno.sintesi.max) + "°" : "—"}</div>
                    <div class="tmin">${giorno.sintesi.min !== null ? Math.round(giorno.sintesi.min) + "°" : "—"}</div>
                </div>
                <div class="prvs-oraria-stats">
                    <div>🌧️ ${giorno.sintesi.pioggiaTotale !== null ? giorno.sintesi.pioggiaTotale + "mm" : "—"}</div>
                    ${rigaOmbrello}
                </div>
            </div>
        `;
        cella.addEventListener("click", () => apriEsplosione(previsioni, giorno.data));
        scroll.appendChild(cella);
    }

    // --- Controlli sopra il dettaglio: torna indietro + toggle ore/fasce ---
    inserisciControlliEsplosione(previsioni);

    // --- Dettaglio del giorno selezionato ---
    const giorno = previsioni.riepilogoGiorni.find(g => g.data === stato.giornoSelezionato);
    const contenitore = document.getElementById("prvs-fascia-giorni");
    contenitore.innerHTML = "";

    if (!giorno) return;

    if (stato.modalitaDettaglio === "fasce") {
        for (const fascia of giorno.fasceGiorno) {
            const primoModello = fascia.modelli.arpae || fascia.modelli.ecmwf;
            const secondoModello = fascia.modelli.ecmwf || fascia.modelli.icon;
            const oraRappresentativa = ORA_RAPPRESENTATIVA_FASCIA[fascia.fascia];
            const card = document.createElement("div");
            card.className = "prvs-giorno-card";
            card.innerHTML = `
                <div class="prvs-giorno-label">${fascia.label}</div>
                <div class="prvs-giorno-icona-temp">
                    ${iconaPer(fascia.sintesi ? fascia.sintesi.categoria : null, "scuro", oraRappresentativa)}
                    <div class="prvs-giorno-temp-grande">${primoModello ? primoModello.temp + "°" : "—"}</div>
                </div>
                <div class="prvs-giorno-dati-destra">
                    🌧️ ${primoModello ? (primoModello.precip ?? 0) + "mm" : "—"}
                </div>
                ${rigaConcordanza(primoModello, secondoModello)}
                ${badgeAllarmi(fascia.allarmi)}
            `;
            card.addEventListener("click", () =>
                apriDettaglioConfronto(`${fascia.label} — ${giorno.label}`, primoModello, secondoModello)
            );
            contenitore.appendChild(card);
        }
    } else {
        // Modalità "ore": se il giorno è oggi, solo le ore da adesso in poi.
        // Niente badge allarmi qui: il weathercode orario è già chiaro,
        // gli allarmi servono per farsi un'idea rapida su giorno/fascia.
        let oreDaMostrare = giorno.oreDettaglio;
        if (giorno.data === previsioni.oggiStr) {
            const oraCorrente = new Date().getHours();
            oreDaMostrare = oreDaMostrare.filter(o => o.ora >= oraCorrente);
        }

        for (const oraDett of oreDaMostrare) {
            const primoModello = oraDett.modelli.arpae || oraDett.modelli.ecmwf;
            const secondoModello = oraDett.modelli.ecmwf || oraDett.modelli.icon;
            const card = document.createElement("div");
            card.className = "prvs-giorno-card";
            card.innerHTML = `
                <div class="prvs-giorno-label">${String(oraDett.ora).padStart(2, "0")}:00</div>
                <div class="prvs-giorno-icona-temp">
                    ${iconaPer(oraDett.sintesi ? oraDett.sintesi.categoria : null, "scuro", oraDett.ora)}
                    <div class="prvs-giorno-temp-grande">${primoModello ? primoModello.temp + "°" : "—"}</div>
                </div>
                <div class="prvs-giorno-dati-destra">
                    🌧️ ${primoModello ? (primoModello.precip ?? 0) + "mm" : "—"}
                </div>
                ${rigaConcordanza(primoModello, secondoModello)}
            `;
            card.addEventListener("click", () =>
                apriDettaglioConfronto(`Ore ${String(oraDett.ora).padStart(2, "0")}:00 — ${giorno.label}`, primoModello, secondoModello)
            );
            contenitore.appendChild(card);
        }
    }
}

/* Controlli sopra il dettaglio: link "torna" + toggle Ore/Fasce. */
function inserisciControlliEsplosione(previsioni) {
    rimuoviControlliEsplosione();

    const barra = document.createElement("div");
    barra.id = "prvs-controlli-esplosione";
    barra.className = "prvs-controlli-esplosione";
    barra.innerHTML = `
        <span class="prvs-torna">← Torna</span>
        <div class="prvs-toggle">
            <button class="prvs-toggle-btn" data-modo="fasce">Fasce</button>
            <button class="prvs-toggle-btn" data-modo="ore">Ore</button>
        </div>
    `;

    barra.querySelector(".prvs-torna").addEventListener("click", () => {
        stato.giornoSelezionato = null;
        renderVistaNormale(previsioni);
    });

    barra.querySelectorAll(".prvs-toggle-btn").forEach(btn => {
        if (btn.dataset.modo === stato.modalitaDettaglio) btn.classList.add("attivo");
        btn.addEventListener("click", () => {
            stato.modalitaDettaglio = btn.dataset.modo;
            renderVistaEsplosa(previsioni);
        });
    });

    const contenitore = document.getElementById("prvs-fascia-giorni");
    contenitore.parentNode.insertBefore(barra, contenitore);
}

function rimuoviControlliEsplosione() {
    const esistente = document.getElementById("prvs-controlli-esplosione");
    if (esistente) esistente.remove();
}

/* ============================================================
   MODAL — confronto tra i 2 modelli per una singola voce
   (fascia o ora), aperto dal secondo livello di esplosione.
   ============================================================ */
const modal = document.getElementById("prvs-modal");
const modalClose = document.getElementById("prvs-modal-close");

modalClose.onclick = () => modal.style.display = "none";
modal.onclick = e => { if (e.target === modal) modal.style.display = "none"; };

function apriDettaglioConfronto(titolo, primoModello, secondoModello) {
    document.getElementById("prvs-modal-title").textContent = titolo;

    const body = document.getElementById("prvs-modal-body");
    body.innerHTML = "";

    const riga = (etichetta, v1, v2, unita) => `
        <tr>
            <td>${etichetta}</td>
            <td>${v1 !== null && v1 !== undefined ? v1 + unita : "—"}</td>
            <td>${v2 !== null && v2 !== undefined ? v2 + unita : "—"}</td>
        </tr>
    `;

    const tabella = document.createElement("table");
    tabella.className = "prvs-table-oraria";
    tabella.innerHTML = `
        <thead>
            <tr>
                <th>Voce</th>
                <th>Modello locale</th>
                <th>Modello globale</th>
            </tr>
        </thead>
        <tbody>
            ${riga("Temperatura", primoModello?.temp, secondoModello?.temp, "°")}
            ${riga("Percepita", primoModello?.percepita, secondoModello?.percepita, "°")}
            ${riga("Umidità", primoModello?.umidita, secondoModello?.umidita, "%")}
            ${riga("Pioggia", primoModello?.precip, secondoModello?.precip, "mm")}
            ${riga("Vento", primoModello?.vento !== null && primoModello?.vento !== undefined ? Math.round(primoModello.vento) : null, secondoModello?.vento !== null && secondoModello?.vento !== undefined ? Math.round(secondoModello.vento) : null, "km/h")}
        </tbody>
    `;

    body.appendChild(tabella);
    modal.style.display = "flex";
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
    renderAttuale();
    try {
        previsioniCache = await PrevisioniData.ottieniPrevisioni();
        renderVistaNormale(previsioniCache);
    } catch (errore) {
        console.error("Errore nel caricamento delle previsioni:", errore);
        document.getElementById("prvs-oggi-scroll").innerHTML =
            `<span class="prvs-caricamento">Errore nel caricamento. Riprova più tardi.</span>`;
    }
}

init();
