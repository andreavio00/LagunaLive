/* ============================================================
   PREVISIONI-DATA.JS
   Livello dati: fetch multi-modello, normalizzazione, fasce orarie.
   Nessun accesso al DOM qui dentro: solo dati pronti da consumare.
   ============================================================ */

/* COORDINATE VENEZIA (centro storico) */
const LAT = 45.4456;
const LON = 12.3283;

/* MODELLI OPEN-METEO
   Tenerli qui come unica fonte di verità: per cambiare modello
   di riferimento in futuro basta modificare queste 3 righe. */
const MODEL_LOCALE = "italia_meteo_arpae_icon_2i"; // ARPAE/ItaliaMeteo, 2km, orizzonte 3gg
const MODEL_GLOBALE = "ecmwf_ifs025";              // ECMWF IFS, 9km, orizzonte 15gg (noi usiamo fino a 7)
const MODEL_GLOBALE_2 = "icon_seamless";           // DWD ICON globale, 11km, orizzonte ~7.5gg

const GIORNI_TOTALI = 7; // fermiamo le previsioni a 1 settimana

/* Fasce orarie del giorno (0-23) */
const FASCE_ORARIE = [
    { id: "notte",       label: "Notte",       oreInizio: 0,  oreFine: 6 },
    { id: "mattina",     label: "Mattina",     oreInizio: 6,  oreFine: 12 },
    { id: "pomeriggio",  label: "Pomeriggio",  oreInizio: 12, oreFine: 18 },
    { id: "sera",        label: "Sera",        oreInizio: 18, oreFine: 24 }
];

/* ============================================================
   MAPPATURA WEATHERCODE WMO -> CATEGORIA ICONA
   Tabella ufficiale WMO 4677, usata da tutti i modelli Open-Meteo.
   Fonte: https://open-meteo.com/en/docs (sezione WMO Weather codes)
   ============================================================ */
function wmoToCategoria(code) {
    if (code === 0) return "sun";
    if (code === 1) return "sun";           // prevalentemente sereno
    if (code === 2) return "partly";        // parzialmente nuvoloso
    if (code === 3) return "cloud";         // coperto
    if (code === 45 || code === 48) return "fog";
    if ([51, 53, 55, 56, 57].includes(code)) return "rain"; // pioggerella
    if ([61, 63, 65, 66, 67].includes(code)) return "rain"; // pioggia
    if ([80, 81, 82].includes(code)) return "rain";         // rovesci
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
    if ([95, 96, 99].includes(code)) return "storm";
    return "cloud"; // fallback prudente
}

/* Severità relativa di una categoria, usata per confronti "il più severo vince" */
const SEVERITA = { sun: 0, partly: 1, cloud: 2, fog: 3, rain: 4, snow: 5, storm: 6 };

/* ============================================================
   FETCH — una sola chiamata per tutti e 3 i modelli, 7 giorni.
   ARPAE oltre il suo orizzonte (3gg) restituirà semplicemente
   valori null: li ignoriamo in normalizzazione.
   ============================================================ */
async function fetchPrevisioniGrezze() {
    const modelli = [MODEL_LOCALE, MODEL_GLOBALE, MODEL_GLOBALE_2].join(",");
    // precipitation_probability tolta: inutile sui modelli deterministici
    // che usiamo (vedi discussione in chat) — teniamo solo i mm effettivi.
    // precipitation_probability: la teniamo SOLO per le schede giorno dal
    // 3° in poi (vedi chat) — non per l'orario, dove resta inaffidabile sui
    // modelli deterministici. La prendiamo comunque solo dal modello globale.
    const variabili = "temperature_2m,apparent_temperature,relative_humidity_2m," +
        "precipitation,precipitation_probability,weathercode,windspeed_10m,winddirection_10m,cape";

    const url = `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${LAT}&longitude=${LON}` +
        `&hourly=${variabili}` +
        `&models=${modelli}` +
        `&forecast_days=${GIORNI_TOTALI}` +
        `&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Errore Open-Meteo: ${res.status}`);
    return res.json();
}

/* Legge un valore orario per un dato modello, gestendo suffissi e null */
function leggiValore(hourly, variabile, modello, indice) {
    const chiave = `${variabile}_${modello}`;
    const arr = hourly[chiave];
    if (!arr) return null;
    const v = arr[indice];
    return (v === null || v === undefined) ? null : v;
}

/* Costruisce, per un dato indice orario, l'oggetto con i dati di tutti
   i modelli disponibili in quell'ora (quelli non disponibili non compaiono) */
function costruisciOraModelli(hourly, indice) {
    const modelliDaProvare = [
        ["arpae", MODEL_LOCALE],
        ["ecmwf", MODEL_GLOBALE],
        ["icon", MODEL_GLOBALE_2]
    ];

    const out = {};
    for (const [chiaveCorta, nomeModello] of modelliDaProvare) {
        const temp = leggiValore(hourly, "temperature_2m", nomeModello, indice);
        const percepita = leggiValore(hourly, "apparent_temperature", nomeModello, indice);
        const umidita = leggiValore(hourly, "relative_humidity_2m", nomeModello, indice);
        const precip = leggiValore(hourly, "precipitation", nomeModello, indice);
        const code = leggiValore(hourly, "weathercode", nomeModello, indice);
        const vento = leggiValore(hourly, "windspeed_10m", nomeModello, indice);
        const direzioneVento = leggiValore(hourly, "winddirection_10m", nomeModello, indice);
        const cape = leggiValore(hourly, "cape", nomeModello, indice);
        const probPioggia = leggiValore(hourly, "precipitation_probability", nomeModello, indice);

        if (temp === null && code === null) continue; // modello non disponibile a quest'ora

        out[chiaveCorta] = {
            temp,
            percepita,
            umidita,
            precip,
            weathercode: code,
            categoria: code !== null ? wmoToCategoria(code) : null,
            vento,
            direzioneVento,
            cape,
            probPioggia
        };
    }
    return out;
}

/* ============================================================
   SINTESI META-MODELLO
   Priorità: ARPAE se disponibile, altrimenti ECMWF, altrimenti ICON.
   Usata per scegliere UN'icona/temperatura rappresentativa quando
   serve un valore solo (es. fascia riepilogo, scroll di oggi).
   ============================================================ */
function sintesiPrioritaria(modelli) {
    if (modelli.arpae) return modelli.arpae;
    if (modelli.ecmwf) return modelli.ecmwf;
    if (modelli.icon) return modelli.icon;
    return null;
}

/* Variante "il più severo vince", utile in futuro per un indicatore
   di disaccordo tra modelli (non usata ancora nella UI attuale) */
function categoriaPiuSevera(modelli) {
    let peggiore = null;
    for (const m of Object.values(modelli)) {
        if (!m || m.categoria === null) continue;
        if (peggiore === null || SEVERITA[m.categoria] > SEVERITA[peggiore]) {
            peggiore = m.categoria;
        }
    }
    return peggiore;
}

/* ============================================================
   ETICHETTE GIORNO — "Oggi 23/08", "Domani 24/08",
   "Lunedì 25/08" per i giorni successivi.
   ============================================================ */
const GIORNI_SETTIMANA_IT = [
    "Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"
];

function formattaDataBreve(dataStr) {
    // dataStr in formato YYYY-MM-DD -> "gg/mm"
    const [, mese, giorno] = dataStr.split("-");
    return `${giorno}/${mese}`;
}

function etichettaGiorno(dataStr, indiceGiorno) {
    const dataBreve = formattaDataBreve(dataStr);
    if (indiceGiorno === 0) return `Oggi ${dataBreve}`;
    if (indiceGiorno === 1) return `Domani ${dataBreve}`;

    const d = new Date(dataStr + "T12:00:00"); // mezzogiorno per evitare problemi di fuso
    const nomeGiorno = GIORNI_SETTIMANA_IT[d.getDay()];
    return `${nomeGiorno} ${dataBreve}`;
}

/* ============================================================
   CATEGORIA RAPPRESENTATIVA DEL GIORNO
   Regola: la categoria più severa che compare per PIÙ DI UN'ORA
   nell'intera giornata. Se nessuna severa supera 1 ora (es. un
   solo temporale isolato), si scende alla successiva più severa
   con più di un'ora, altrimenti si usa la categoria prevalente.
   ============================================================ */
function categoriaGiorno(oreDelGiorno) {
    const categorie = oreDelGiorno
        .map(o => sintesiPrioritaria(o.modelli)?.categoria)
        .filter(Boolean);

    if (categorie.length === 0) return null;

    const conteggio = {};
    categorie.forEach(c => conteggio[c] = (conteggio[c] || 0) + 1);

    const categorieOrdinatePerSeverita = Object.keys(conteggio)
        .sort((a, b) => SEVERITA[b] - SEVERITA[a]);

    // prima categoria (dalla più severa) che compare per più di un'ora
    for (const c of categorieOrdinatePerSeverita) {
        if (conteggio[c] > 1) return c;
    }

    // fallback: nessuna categoria supera un'ora singola -> la più frequente
    return categorieOrdinatePerSeverita
        .reduce((piuFrequente, c) =>
            conteggio[c] > conteggio[piuFrequente] ? c : piuFrequente,
            categorieOrdinatePerSeverita[0]
        );
}

/* ============================================================
   AGGREGAZIONE IN FASCE (00-6 / 6-12 / 12-18 / 18-24)
   Riceve un array di "ore modelli" (vedi costruisciOraModelli)
   già filtrate per un singolo giorno, e restituisce le 4 fasce.
   ============================================================ */
function aggregaInFasce(oreDelGiorno) {
    return FASCE_ORARIE.map(fascia => {
        const oreFascia = oreDelGiorno.filter(o =>
            o.ora >= fascia.oreInizio && o.ora < fascia.oreFine
        );

        // Per ciascun modello presente, facciamo la media di temp/percepita/
        // umidità/vento e prendiamo il weathercode più severo della fascia
        // (più prudente di una media, che non ha senso per un codice categorico).
        const modelliFascia = {};
        const chiaviModello = ["arpae", "ecmwf", "icon"];

        for (const chiave of chiaviModello) {
            const valori = oreFascia
                .map(o => o.modelli[chiave])
                .filter(v => v && v.temp !== null);

            if (valori.length === 0) continue;

            const media = campo => {
                const vals = valori.map(v => v[campo]).filter(x => x !== null && x !== undefined);
                return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
            };
            const massimo = campo => {
                const vals = valori.map(v => v[campo]).filter(x => x !== null && x !== undefined);
                return vals.length ? Math.max(...vals) : null;
            };

            const tempMedia = media("temp");
            const percepitaMedia = media("percepita");
            const umiditaMedia = media("umidita");
            const precipTot = valori.reduce((s, v) => s + (v.precip || 0), 0);
            const ventoMax = massimo("vento");
            const capeMax = massimo("cape");

            // Direzione vento: prendiamo quella dell'ora con vento più forte
            // della fascia (mediare gradi circolari non avrebbe senso)
            let direzioneVentoMax = null;
            let maxVentoTrovato = -1;
            for (const v of valori) {
                if (v.vento !== null && v.vento > maxVentoTrovato) {
                    maxVentoTrovato = v.vento;
                    direzioneVentoMax = v.direzioneVento;
                }
            }

            let categoriaFascia = null;
            for (const v of valori) {
                if (v.categoria && (categoriaFascia === null ||
                    SEVERITA[v.categoria] > SEVERITA[categoriaFascia])) {
                    categoriaFascia = v.categoria;
                }
            }

            // Temporale "forte": weathercode di temporale E CAPE alto nella
            // stessa ora (soglia 800 J/kg, da tarare con più dati reali)
            const temporaleForte = valori.some(v =>
                v.weathercode >= 95 && v.cape !== null && v.cape > 800
            );

            modelliFascia[chiave] = {
                temp: tempMedia !== null ? Math.round(tempMedia * 10) / 10 : null,
                percepita: percepitaMedia !== null ? Math.round(percepitaMedia * 10) / 10 : null,
                umidita: umiditaMedia !== null ? Math.round(umiditaMedia) : null,
                precip: Math.round(precipTot * 10) / 10,
                vento: ventoMax,
                direzioneVento: direzioneVentoMax,
                cape: capeMax,
                categoria: categoriaFascia,
                temporaleForte
            };
        }

        return {
            fascia: fascia.id,
            label: fascia.label,
            modelli: modelliFascia,
            sintesi: sintesiPrioritaria(modelliFascia),
            allarmi: {
                temporaleForte: Object.values(modelliFascia).some(m => m && m.temporaleForte),
                nebbiaPersistente: nebbiaPersistente(oreFascia),
                acquaAlta: null
            }
        };
    });
}

/* ============================================================
   DATA LOCALE (senza conversione UTC)
   toISOString() converte sempre in UTC: a Venezia in CEST (UTC+2)
   questo fa scivolare le ore 00:00-01:59 locali al giorno prima,
   disallineando tutto il raggruppamento per giorno. Usiamo invece
   i componenti locali del Date (getFullYear/getMonth/getDate).
   ============================================================ */
function dataLocaleISO(date) {
    const anno = date.getFullYear();
    const mese = String(date.getMonth() + 1).padStart(2, "0");
    const giorno = String(date.getDate()).padStart(2, "0");
    return `${anno}-${mese}-${giorno}`;
}

/* ============================================================
   CONCORDANZA TRA 2 MODELLI
   Un pallino per argomento (temperatura/pioggia/vento), soglie
   decise in chat. Se manca uno dei due modelli, torna null per
   quell'argomento (non mostriamo un pallino senza dati).
   ============================================================ */
function livelloConcordanza(differenza, sogliaVerde, sogliaGialla) {
    if (differenza === null) return null;
    const d = Math.abs(differenza);
    if (d < sogliaVerde) return "verde";
    if (d <= sogliaGialla) return "giallo";
    return "rosso";
}

function calcolaConcordanza(m1, m2) {
    if (!m1 || !m2) return { temp: null, pioggia: null, vento: null };
    return {
        temp: livelloConcordanza(
            m1.temp !== null && m2.temp !== null ? m1.temp - m2.temp : null, 1.5, 3
        ),
        pioggia: livelloConcordanza(
            m1.precip !== null && m2.precip !== null ? m1.precip - m2.precip : null, 2, 8
        ),
        vento: livelloConcordanza(
            m1.vento !== null && m2.vento !== null ? m1.vento - m2.vento : null, 10, 25
        )
    };
}

/* ============================================================
   NEBBIA PERSISTENTE
   True se la categoria "fog" compare per "soglia" ore consecutive
   nell'insieme di ore passato (soglia di default 4, decisa in chat:
   un'ora isolata di nebbia non conta). Riusata sia per giorno intero
   che per singola fascia, passando i rispettivi array di ore.
   ============================================================ */
function nebbiaPersistente(ore, soglia = 4) {
    let streak = 0;
    for (const o of ore) {
        const cat = sintesiPrioritaria(o.modelli)?.categoria;
        if (cat === "fog") {
            streak++;
            if (streak >= soglia) return true;
        } else {
            streak = 0;
        }
    }
    return false;
}

/* ============================================================
   FUNZIONE PRINCIPALE — restituisce la struttura dati unificata
   pronta per il rendering (vedi schema discusso in chat).
   ============================================================ */
async function ottieniPrevisioni() {
    const data = await fetchPrevisioniGrezze();
    const hourly = data.hourly;
    const now = new Date();

    // Costruiamo un array di "ore modelli" con data/ora leggibili
    const oreComplete = hourly.time.map((t, i) => {
        const d = new Date(t);
        return {
            timestamp: t,
            data: dataLocaleISO(d),
            ora: d.getHours(),
            modelli: costruisciOraModelli(hourly, i)
        };
    });

    // OGGI — solo ore future, sintesi prioritaria per ogni ora
    const oggiStr = dataLocaleISO(now);

    // PROSSIME 10 ORE — striscia unica che può attraversare la mezzanotte,
    // invece di fermarsi alle ore residue di oggi.
    const indicePartenza = oreComplete.findIndex(o => {
        const [anno, mese, giorno] = o.data.split("-").map(Number);
        const dataOra = new Date(anno, mese - 1, giorno, o.ora);
        return dataOra >= now;
    });

    const prossimeOre = oreComplete
        .slice(Math.max(indicePartenza, 0), Math.max(indicePartenza, 0) + 10)
        .map(o => ({
            data: o.data,
            ora: o.ora,
            ...sintesiPrioritaria(o.modelli)
        }));

    // RIEPILOGO GIORNI — include oggi (indice 0), fino a GIORNI_TOTALI giorni.
    // La UI decide quanti/quali mostrarne in base a "indiceInizioRiepilogo".
    const dateUniche = [...new Set(oreComplete.map(o => o.data))]
        .slice(0, GIORNI_TOTALI);

    const riepilogoGiorni = dateUniche.map((dataGiorno, idx) => {
        const oreDelGiorno = oreComplete.filter(o => o.data === dataGiorno);
        const fasceGiorno = aggregaInFasce(oreDelGiorno);

        // Dettaglio ora per ora coi modelli grezzi, per la vista "esplosa"
        const oreDettaglio = oreDelGiorno.map(o => ({
            ora: o.ora,
            modelli: o.modelli,
            sintesi: sintesiPrioritaria(o.modelli)
        }));

        const temperature = oreDelGiorno
            .map(o => sintesiPrioritaria(o.modelli))
            .filter(v => v && v.temp !== null)
            .map(v => v.temp);

        const pioggiaTotale = oreDelGiorno
            .map(o => sintesiPrioritaria(o.modelli))
            .filter(v => v && v.precip !== null)
            .reduce((s, v) => s + v.precip, 0);

        // Probabilità pioggia SOLO dal modello globale (ECMWF), non dalla
        // sintesi prioritaria: la UI la userà solo dal 3° giorno in poi.
        const probPioggiaValori = oreDelGiorno
            .map(o => o.modelli.ecmwf?.probPioggia)
            .filter(v => v !== null && v !== undefined);
        const probPioggiaGenerale = probPioggiaValori.length ? Math.max(...probPioggiaValori) : null;

        const temporaleForteGiorno = fasceGiorno.some(f =>
            Object.values(f.modelli).some(m => m && m.temporaleForte)
        );

        return {
            data: dataGiorno,
            label: etichettaGiorno(dataGiorno, idx),
            sintesi: {
                min: temperature.length ? Math.min(...temperature) : null,
                max: temperature.length ? Math.max(...temperature) : null,
                categoria: categoriaGiorno(oreDelGiorno),
                pioggiaTotale: Math.round(pioggiaTotale * 10) / 10,
                probPioggiaGenerale
            },
            allarmi: {
                temporaleForte: temporaleForteGiorno,
                nebbiaPersistente: nebbiaPersistente(oreDelGiorno),
                acquaAlta: null // TODO: nessuna fonte dati collegata ancora
            },
            fasceGiorno,
            oreDettaglio
        };
    });

    // Se l'ultima ora della striscia "prossime 10 ore" è già domani,
    // il riepilogo giorni parte da domani (indice 1) invece che da oggi.
    const ultimaOra = prossimeOre[prossimeOre.length - 1];
    const indiceInizioRiepilogo = (ultimaOra && ultimaOra.data === oggiStr) ? 0 : 1;

    return {
        aggiornatoAlle: new Date().toISOString(),
        oggiStr,
        prossimeOre,
        riepilogoGiorni,
        indiceInizioRiepilogo
    };
}

/* Esportiamo le funzioni che serviranno al modulo di rendering */
window.PrevisioniData = {
    ottieniPrevisioni,
    wmoToCategoria,
    etichettaGiorno,
    formattaDataBreve,
    calcolaConcordanza,
    FASCE_ORARIE,
    MODEL_LOCALE,
    MODEL_GLOBALE,
    MODEL_GLOBALE_2
};
