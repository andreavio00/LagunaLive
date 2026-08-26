/* ============================================================
   PREVISIONI-RENDER.JS
   Legge la struttura dati da previsioni-data.js e la disegna.
   Gestisce 2 viste: NORMALE (prossime ore + 3 giorni) ed ESPLOSA
   (8 giorni in alto + dettaglio orario/fasce del giorno scelto).
   ============================================================ */

const ICON_PATH = "icons/";

/* ============================================================
   PREFERENZE UTENTE — modello principale + campi opzionali nel
   dettaglio orario. Salvate in localStorage (funziona normalmente
   su GitHub Pages, a differenza degli ambienti sandbox di sviluppo).
   ============================================================ */
const CHIAVE_PREFERENZE = "lagunalive-previsioni-preferenze";
const MAX_CAMPI_OPZIONALI = 4;

// Weathercode/icona, temperatura e pioggia restano sempre visibili
// (hanno uno slot dedicato in ogni card); questi sono i soli togglabili.
const CAMPI_OPZIONALI_DISPONIBILI = [
    { id: "percepita", label: "Temperatura percepita", icona: "🥵", unita: "°", arrotonda: true },
    { id: "umidita", label: "Umidità", icona: "💧", unita: "%" },
    { id: "vento", label: "Vento (solo se ≥40 km/h)", icona: "💨", unita: "km/h", speciale: "vento" },
    { id: "pressione", label: "Pressione", icona: "🔽", unita: "hPa", arrotonda: true },
    { id: "cin", label: "Inibizione convettiva (CIN)", icona: "🧊", unita: " J/kg" },
    { id: "neve", label: "Neve", icona: "❄️", unita: "cm" },
    { id: "marea", label: "Marea (stimata)", icona: "🌊", unita: "cm" }
];

const PREFERENZE_DEFAULT = {
    modelloPrincipale: "auto",
    campiOpzionali: ["percepita", "umidita", "vento"]
};

function caricaPreferenze() {
    try {
        const salvate = localStorage.getItem(CHIAVE_PREFERENZE);
        if (!salvate) return { ...PREFERENZE_DEFAULT };
        const parse = JSON.parse(salvate);
        return {
            modelloPrincipale: parse.modelloPrincipale || PREFERENZE_DEFAULT.modelloPrincipale,
            campiOpzionali: Array.isArray(parse.campiOpzionali)
                ? parse.campiOpzionali.slice(0, MAX_CAMPI_OPZIONALI)
                : [...PREFERENZE_DEFAULT.campiOpzionali]
        };
    } catch (e) {
        console.warn("Preferenze non leggibili, uso i valori di default:", e);
        return { ...PREFERENZE_DEFAULT };
    }
}

function salvaPreferenze(pref) {
    try {
        localStorage.setItem(CHIAVE_PREFERENZE, JSON.stringify(pref));
    } catch (e) {
        console.warn("Impossibile salvare le preferenze:", e);
    }
}

let preferenze = caricaPreferenze();

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
   CAMPI OPZIONALI — disegna solo quelli scelti nel pannello
   impostazioni, nell'ordine dell'elenco disponibile (non
   nell'ordine di selezione, per coerenza visiva tra le card).
   ============================================================ */
function renderCampoOpzionale(campoDef, modello) {
    if (!modello) return "";
    if (campoDef.speciale === "vento") {
        const txt = ventoTesto(modello.vento, modello.direzioneVento);
        return txt ? `<div>${txt}</div>` : "";
    }
    const v = modello[campoDef.id];
    if (v === null || v === undefined) return `<div>${campoDef.icona} —</div>`;
    const valore = campoDef.arrotonda ? Math.round(v) : v;
    return `<div>${campoDef.icona} ${valore}${campoDef.unita}</div>`;
}

function renderCampiOpzionali(modello) {
    return CAMPI_OPZIONALI_DISPONIBILI
        .filter(c => preferenze.campiOpzionali.includes(c.id))
        .map(c => renderCampoOpzionale(c, modello))
        .join("");
}

/* ============================================================
   BADGE ALLARMI — solo su giorni/fasce, mai sull'ora singola
   (il weathercode orario è già abbastanza esplicito, vedi chat).
   ============================================================ */
function badgeAllarmi(allarmi, mareaMassima = null) {
    if (!allarmi) return "";
    const pezzi = [];
    if (allarmi.temporaleForte) pezzi.push(`<span class="prvs-badge-allarme" title="Temporale forte">⛈️</span>`);
    if (allarmi.nebbiaPersistente) pezzi.push(`<span class="prvs-badge-allarme" title="Nebbia persistente">🌫️</span>`);
    if (allarmi.acquaAlta) {
        const titolo = mareaMassima !== null ? `Acqua alta — picco ${mareaMassima}cm` : "Acqua alta";
        pezzi.push(`<span class="prvs-badge-allarme" title="${titolo}">🌊</span>`);
    }
    return pezzi.join("");
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
        cella.innerHTML = `
            <div class="prvs-ora-testo">${String(ora.ora).padStart(2, "0")}:00</div>
            <div class="prvs-oraria-corpo">
                <div class="prvs-oraria-icona-temp">
                    ${iconaPer(ora.categoria, "chiaro", ora.ora)}
                    <div class="prvs-ora-temp-grande">${ora.temp !== null ? Math.round(ora.temp) + "°" : "—"}</div>
                </div>
                <div class="prvs-oraria-stats">
                    <div>🌧️ ${ora.precip !== null ? ora.precip.toFixed(1) + "mm" : "—"}</div>
                    ${renderCampiOpzionali(ora)}
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
        <div class="prvs-badge-riga">${badgeAllarmi(giorno.allarmi, giorno.mareaMassima)}</div>
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
                ${iconaPer(giorno.sintesi.categoria, "chiaro", 12)}
                <div class="prvs-giorno-temp-maxmin">
                    <div class="tmax">${giorno.sintesi.max !== null ? Math.round(giorno.sintesi.max) + "°" : "—"}</div>
                    <div class="tmin">${giorno.sintesi.min !== null ? Math.round(giorno.sintesi.min) + "°" : "—"}</div>
                </div>
                <div class="prvs-oraria-stats">
                    <div>🌧️ ${giorno.sintesi.pioggiaTotale !== null ? giorno.sintesi.pioggiaTotale + "mm" : "—"}</div>
                    ${rigaOmbrello}
                </div>
            </div>
            <div class="prvs-badge-riga-fissa">${badgeAllarmi(giorno.allarmi, giorno.mareaMassima)}</div>
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
            const arpae = fascia.modelli.arpae || null;
            const ecmwf = fascia.modelli.ecmwf || null;
            const seamless = fascia.modelli.icon || null;
            // Rappresentativo per la card: ARPAE se c'è (giorni 1-3), altrimenti ECMWF
            const rappresentativo = arpae || ecmwf;
            // Confronto per i pallini: ARPAE-vs-ECMWF finché disponibile,
            // altrimenti ECMWF-vs-Seamless (mai lo stesso modello con se stesso)
            const confrontoA = arpae || ecmwf;
            const confrontoB = arpae ? ecmwf : seamless;
            const oraRappresentativa = ORA_RAPPRESENTATIVA_FASCIA[fascia.fascia];
            const card = document.createElement("div");
            card.className = "prvs-giorno-card";
            card.innerHTML = `
                <div class="prvs-giorno-label">${fascia.label}</div>
                <div class="prvs-giorno-icona-temp">
                    ${iconaPer(fascia.sintesi ? fascia.sintesi.categoria : null, "scuro", oraRappresentativa)}
                    <div class="prvs-giorno-temp-grande">${rappresentativo ? rappresentativo.temp + "°" : "—"}</div>
                </div>
                <div class="prvs-giorno-dati-destra">
                    🌧️ ${rappresentativo ? (rappresentativo.precip ?? 0) + "mm" : "—"}
                </div>
                ${rigaConcordanza(confrontoA, confrontoB)}
                <div class="prvs-badge-riga">${badgeAllarmi(fascia.allarmi)}</div>
            `;
            card.addEventListener("click", () =>
                apriDettaglioConfronto(`${fascia.label} — ${giorno.label}`, arpae, ecmwf, seamless)
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
            const arpae = oraDett.modelli.arpae || null;
            const ecmwf = oraDett.modelli.ecmwf || null;
            const seamless = oraDett.modelli.icon || null;
            const rappresentativo = arpae || ecmwf;
            const confrontoA = arpae || ecmwf;
            const confrontoB = arpae ? ecmwf : seamless;
            const card = document.createElement("div");
            card.className = "prvs-giorno-card";
            card.innerHTML = `
                <div class="prvs-giorno-label">${String(oraDett.ora).padStart(2, "0")}:00</div>
                <div class="prvs-giorno-icona-temp">
                    ${iconaPer(oraDett.sintesi ? oraDett.sintesi.categoria : null, "scuro", oraDett.ora)}
                    <div class="prvs-giorno-temp-grande">${rappresentativo ? rappresentativo.temp + "°" : "—"}</div>
                </div>
                <div class="prvs-oraria-stats-scuro">
                    ${renderCampiOpzionali({ ...rappresentativo, marea: oraDett.marea })}
                </div>
                <div class="prvs-giorno-dati-destra">
                    🌧️ ${rappresentativo ? (rappresentativo.precip ?? 0) + "mm" : "—"}
                </div>
                ${rigaConcordanza(confrontoA, confrontoB)}
            `;
            card.addEventListener("click", () =>
                apriDettaglioConfronto(`Ore ${String(oraDett.ora).padStart(2, "0")}:00 — ${giorno.label}`, arpae, ecmwf, seamless)
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

/* Formatta un valore per la tabella: "n.d." se il modello manca del
   tutto o se il campo specifico è null/undefined — mai un errore JS
   anche quando un modello (tipicamente ARPAE oltre il 3° giorno) non
   è disponibile per quella voce. */
function formattaValore(modello, campo, unita, arrotonda = false) {
    if (!modello) return "n.d.";
    const v = modello[campo];
    if (v === null || v === undefined) return "n.d.";
    return (arrotonda ? Math.round(v) : v) + unita;
}

function apriDettaglioConfronto(titolo, arpae, ecmwf, seamless) {
    document.getElementById("prvs-modal-title").textContent = titolo;

    const body = document.getElementById("prvs-modal-body");
    body.innerHTML = "";

    const riga = (etichetta, campo, unita, arrotonda = false) => `
        <tr>
            <td>${etichetta}</td>
            <td>${formattaValore(arpae, campo, unita, arrotonda)}</td>
            <td>${formattaValore(ecmwf, campo, unita, arrotonda)}</td>
            <td>${formattaValore(seamless, campo, unita, arrotonda)}</td>
        </tr>
    `;

    const tabella = document.createElement("table");
    tabella.className = "prvs-table-oraria";
    tabella.innerHTML = `
        <thead>
            <tr>
                <th>Voce</th>
                <th>ARPAE</th>
                <th>ECMWF</th>
                <th>Seamless</th>
            </tr>
        </thead>
        <tbody>
            ${riga("Temperatura", "temp", "°")}
            ${riga("Percepita", "percepita", "°")}
            ${riga("Umidità", "umidita", "%")}
            ${riga("Pioggia", "precip", "mm")}
            ${riga("Vento", "vento", "km/h", true)}
            ${riga("Pressione", "pressione", "hPa", true)}
            ${riga("CIN", "cin", " J/kg")}
            ${riga("Neve", "neve", "cm")}
        </tbody>
    `;

    body.appendChild(tabella);
    modal.style.display = "flex";
}

/* ============================================================
   PANNELLO IMPOSTAZIONI — modello principale + campi opzionali
   ============================================================ */
const modalImpostazioni = document.getElementById("prvs-modal-impostazioni");

const MODELLI_SCELTA = [
    { id: "auto", label: "Automatico (ARPAE → ECMWF → Seamless)" },
    { id: "arpae", label: "ARPAE (locale)" },
    { id: "ecmwf", label: "ECMWF (globale)" },
    { id: "icon", label: "Météo-France Seamless" }
];

function costruisciSceltaModello() {
    const cont = document.getElementById("prvs-scelta-modello");
    cont.innerHTML = MODELLI_SCELTA.map(m => `
        <label class="prvs-opzione-riga">
            <input type="radio" name="prvs-modello" value="${m.id}" ${preferenze.modelloPrincipale === m.id ? "checked" : ""}>
            ${m.label}
        </label>
    `).join("");
}

function costruisciSceltaCampi() {
    const cont = document.getElementById("prvs-scelta-campi");
    cont.innerHTML = CAMPI_OPZIONALI_DISPONIBILI.map(c => `
        <label class="prvs-opzione-riga">
            <input type="checkbox" class="prvs-check-campo" value="${c.id}" ${preferenze.campiOpzionali.includes(c.id) ? "checked" : ""}>
            ${c.icona} ${c.label}
        </label>
    `).join("");
    aggiornaLimiteCampi();
    cont.querySelectorAll(".prvs-check-campo").forEach(chk => {
        chk.addEventListener("change", aggiornaLimiteCampi);
    });
}

// Disabilita le caselle non selezionate quando si raggiunge il limite,
// così l'utente capisce visivamente perché non riesce a spuntarne altre
function aggiornaLimiteCampi() {
    const checks = [...document.querySelectorAll(".prvs-check-campo")];
    const selezionati = checks.filter(c => c.checked).length;
    checks.forEach(c => {
        if (!c.checked) c.disabled = selezionati >= MAX_CAMPI_OPZIONALI;
    });
}

document.getElementById("prvs-btn-impostazioni").addEventListener("click", () => {
    costruisciSceltaModello();
    costruisciSceltaCampi();
    modalImpostazioni.style.display = "flex";
});

document.getElementById("prvs-impostazioni-close").addEventListener("click", () => {
    modalImpostazioni.style.display = "none";
});
modalImpostazioni.onclick = e => { if (e.target === modalImpostazioni) modalImpostazioni.style.display = "none"; };

document.getElementById("prvs-btn-salva-impostazioni").addEventListener("click", () => {
    const modelloScelto = document.querySelector('input[name="prvs-modello"]:checked')?.value || "auto";
    const campiScelti = [...document.querySelectorAll(".prvs-check-campo:checked")].map(c => c.value);
    const modelloCambiato = modelloScelto !== preferenze.modelloPrincipale;

    preferenze = { modelloPrincipale: modelloScelto, campiOpzionali: campiScelti };
    salvaPreferenze(preferenze);
    modalImpostazioni.style.display = "none";

    if (modelloCambiato) {
        PrevisioniData.impostaPreferenzaModello(preferenze.modelloPrincipale);
    }

    // Sia che sia cambiato il modello sia i campi: nessuna nuova chiamata
    // di rete, tutti e 3 i modelli sono già scaricati. Ricalcoliamo solo
    // la sintesi (istantaneo) e ridisegniamo la vista corrente.
    if (previsioniCache) {
        previsioniCache = PrevisioniData.ricalcolaPrevisioni() || previsioniCache;
        if (stato.giornoSelezionato) renderVistaEsplosa(previsioniCache);
        else renderVistaNormale(previsioniCache);
    }
});

/* ============================================================
   INIT
   ============================================================ */
async function init() {
    renderAttuale();
    PrevisioniData.impostaPreferenzaModello(preferenze.modelloPrincipale);
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
