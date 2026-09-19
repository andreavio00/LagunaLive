// Numero di versione mostrato accanto all'orario di aggiornamento in
// fondo alla pagina. Da allineare manualmente al numero della cache
// in sw.js (CACHE_NAME) quando si rilascia una nuova versione, cosi'
// i due numeri restano sempre coerenti tra loro.
const APP_VERSION = "v4.1";

const CAVANIS_URL =
  "https://www.meteonetwork.eu/it/weather-station/vnt375-stazione-meteorologica-di-osservatorio-cavanis-venezia";

const PALESTRA_WORKER_URL =
  "https://weathercloude-worker.andrea-vio.workers.dev/wunderground/selected";
const PALESTRA_SOURCE_URL =
  "https://www.wunderground.com/dashboard/pws/IVENIC160";

const PALAZZO_CAVALLI_SOURCE_URL =
  "https://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Palazzo_Cavalli.html";
const SAN_GIORGIO_SOURCE_URL =
  "https://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/San_Giorgio.html";
const PUNTA_SALUTE_SOURCE_URL =
  "https://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Punta_Salute.html";
const MISERICORDIA_SOURCE_URL =
  "https://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Misericordia.html";
const LIDO_METEO_SOURCE_URL =
  "https://www.venezia.isprambiente.it/index.php?folder_id=2115";

// Worker Cloudflare personale dell'utente (generico: accetta qualsiasi
// URL consentito tramite ?url=, con allowlist di dominio lato Worker
// per sicurezza). Sostituisce r.jina.ai per le pagine CPSM del Comune
// di Venezia: r.jina.ai applica un'elaborazione "leggibilita'" pensata
// per articoli che a volte deforma tabelle/dati grezzi, mentre il
// Worker fa da semplice passa-carte. Usato inizialmente solo per Lido
// Meteo (ISPRA) e poi esteso anche alle pagine CPSM il 22/08/2026 dopo
// aver notato che queste ultime, ancora su r.jina.ai, si caricavano
// molto piu' lentamente.
const PROXY_WORKER_URL = "https://lagunalive-proxy.andrea-vio.workers.dev/";

function proxyUrl(targetUrl) {
  return PROXY_WORKER_URL + "?url=" + encodeURIComponent(targetUrl);
}

const CAVANIS_API_URL =
  "https://api.arpa.veneto.it/REST/v1/meteo_meteogrammi_tabella?codseqst=300000154";

// File XML "grezzo" dietro la webgis ISPRA (RMLV): contiene tutte le
// stazioni della rete con l'ultimo dato disponibile per ogni
// strumento. Trovato analizzando il sorgente di webgis.html (funzione
// initialDownload -> downloadUrl("../dati/Dati2.xml", ...)). Nessuna
// documentazione ufficiale, nessuna garanzia di stabilita' nel tempo:
// se ISPRA cambia il sito questo endpoint puo' smettere di funzionare
// senza preavviso.
const ISPRAMBIENTE_DATI_URL =
  "https://www.venezia.isprambiente.it/dati/Dati2.xml";

// id della stazione "Lido Meteo" nel file Dati2.xml (marker id="115"),
// confermato dall'utente incollando il contenuto reale del file.
const LIDO_METEO_MARKER_ID = "115";

// Sopra questa soglia (minuti) i dati di Lido Meteo vengono mostrati
// con un avviso "dati non aggiornati" invece che silenziosamente come
// se fossero freschi: la rete RMLV ha gia' mostrato di poter restare
// ferma per giorni senza preavviso (vedi cronologia di questa
// conversazione, dati fermi al 17/08 quando si e' controllato il 21/08).
const LIDO_METEO_STALE_MINUTES = 120;

// Etichette delle colonne cosi' come compaiono nelle tabelle delle
// stazioni CPSM (prima colonna = data/ora, poi le altre nell'ordine in
// cui il sito del Comune le pubblica). Usate per la "scheda" con i
// dati completi di ogni stazione.
const PALAZZO_CAVALLI_LABELS = [
  "Data/Ora",
  "Pressione (hPa)",
  "Temperatura (°C)",
  "Umidità (%)",
  "Radiazione solare (W/mq)",
  "Pioggia (mm)"
];

const SAN_GIORGIO_LABELS = [
  "Data/Ora",
  "Direzione vento (°)",
  "Velocità vento (m/s)",
  "Raffica vento (m/s)",
  "Temperatura (°C)",
  "Umidità (%)",
  "Radiazione solare (W/mq)"
];

const PUNTA_SALUTE_LABELS = [
  "Data/Ora",
  "Marea (m)",
  "Temperatura acqua (°C)"
];

// Etichette verificate sulla tabella ufficiale del Comune: marea,
// direzione e velocita' media del vento, raffica, onda significativa
// e onda massima compaiono esattamente in quest'ordine.
const MISERICORDIA_LABELS = [
  "Data/Ora",
  "Marea (m)",
  "Direzione vento (°)",
  "Velocità vento (m/s)",
  "Raffica vento (m/s)",
  "Onda significativa (m)",
  "Onda massima (m)"
];

const STATION_LABELS = {
  punta_salute: PUNTA_SALUTE_LABELS,
  misericordia: MISERICORDIA_LABELS,
  palazzo_cavalli: PALAZZO_CAVALLI_LABELS,
  san_giorgio: SAN_GIORGIO_LABELS
};

// Colonne verificate direttamente sulle tabelle pubblicate dalle fonti.
const STATION_LABELS_VERIFIED = {
  punta_salute: true,
  misericordia: true,
  palazzo_cavalli: true,
  san_giorgio: true
};

function formatTime(timestamp) {

  const date = new Date(
    timestamp.replace(" ", "T") + "+01:00"
  );

  return date.toLocaleTimeString(
    "it-IT",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

function formatEpochTime(epochMs) {

  const date = new Date(Number(epochMs));

  if (isNaN(date.getTime())) return null;

  return date.toLocaleTimeString(
    "it-IT",
    {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Rome"
    }
  );
}

function numberOrNull(value) {

  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Le tabelle del Comune riportano sempre l'ora solare (UTC+1, tutto
// l'anno). Questa funzione converte in data/ora "civile" (ora legale
// quando è in vigore), stesso meccanismo usato da formatTime().
function formatDateTime(timestamp) {

  const date = new Date(
    timestamp.replace(" ", "T") + "+01:00"
  );

  return date.toLocaleString(
    "it-IT",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

// Il file Dati2.xml di ISPRA usa un formato data diverso da quello
// delle tabelle CPSM/ARPA usate altrove in questo file: "DD/MM/YYYY
// HH:MM:SS" invece di "YYYY-MM-DD HH:MM:SS". L'ora e' comunque solare
// (UTC+1) come tutte le altre fonti, quindi la conversione a ora
// civile e' la stessa (+01:00, lasciamo fare al browser la conversione
// a ora legale quando serve).
function parseIsprambienteTimestamp(timestamp) {

  const [datePart, timePart] = timestamp.trim().split(" ");
  const [day, month, year] = datePart.split("/");

  return new Date(`${year}-${month}-${day}T${timePart}+01:00`);
}

function formatTimeIsprambiente(timestamp) {

  return parseIsprambienteTimestamp(timestamp).toLocaleTimeString(
    "it-IT",
    { hour: "2-digit", minute: "2-digit" }
  );
}

// Minuti trascorsi da un timestamp ISPRA ad ora (usato per l'avviso
// "dati non aggiornati" di Lido Meteo).
function minutesSinceIsprambiente(timestamp) {

  const then = parseIsprambienteTimestamp(timestamp);

  return (Date.now() - then.getTime()) / 60000;
}

function windDirection(deg) {

  const dirs = [
    "N", "NE", "E", "SE",
    "S", "SO", "O", "NO"
  ];

  return dirs[Math.round(deg / 45) % 8];
}

// Minuti trascorsi tra due timestamp delle tabelle (stesso formato
// "solare" di formatTime/formatDateTime, il fuso non conta per una
// differenza).
function minutesBetween(t1, t2) {

  const d1 = new Date(t1.replace(" ", "T") + "+01:00");
  const d2 = new Date(t2.replace(" ", "T") + "+01:00");

  return Math.abs(d1 - d2) / 60000;
}

// Indice di calore (heat index), formula di Rothfusz (NWS).
// Sotto i 27°C circa l'effetto e' trascurabile, quindi restituiamo
// semplicemente la temperatura reale.
function heatIndex(tempC, humidity) {

  if (humidity == null || isNaN(humidity)) {
    return tempC;
  }

  // Sotto i 27°C (80°F) la regressione completa di Rothfusz non e'
  // valida: il NWS prescrive in questo intervallo una formula
  // semplificata, che ammorbidisce il passaggio invece del taglio
  // netto "sotto 27°C = temperatura dell'aria" usato in precedenza.
  if (tempC < 27) {

    const T = tempC * 9 / 5 + 32; // Fahrenheit
    const R = humidity;

    const simpleHI = 0.5 * (T + 61.0 + ((T - 68.0) * 1.2) + (R * 0.094));
    const simpleHiC = (simpleHI - 32) * 5 / 9;

    // Stessa logica di floor della formula completa qui sotto: sotto
    // il 40% di umidita' anche questa formula puo' scendere sotto la
    // temperatura reale in modo non piu' fisicamente significativo.
    if (humidity < 40) {
      return Math.max(simpleHiC, tempC);
    }

    return simpleHiC;
  }

  const T = tempC * 9 / 5 + 32; // Fahrenheit
  const R = humidity;

  let HI =
    -42.389 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R;

  const heatIndexC = (HI - 32) * 5 / 9; // torna in Celsius

  // La regressione di Rothfusz e' ufficialmente valida (calibrata sui
  // dati di Steadman) solo per umidita' relativa >= 40%. Al di sotto,
  // il risultato e' un'estrapolazione della formula: puo' scendere
  // sotto la temperatura dell'aria in modo sempre piu' marcato quanto
  // piu' l'umidita' e' bassa, senza che questo rifletta piu' un
  // fenomeno fisico reale. Entro il range valido (RH >= 40%) la
  // formula non ha invece bisogno di alcun aggiustamento: puo'
  // legittimamente restituire un valore leggermente sotto la
  // temperatura dell'aria (evaporazione del sudore efficiente), e in
  // quel caso lo lasciamo cosi' com'e'.
  if (humidity < 40) {
    return Math.max(heatIndexC, tempC);
  }

  return heatIndexC;
}

const VENICE_LAT = 45.4408;
const VENICE_LON = 12.3155;
const ITALY_STANDARD_MERIDIAN = 15; // riferimento del fuso UTC+1

function degToRad(d) {
  return d * Math.PI / 180;
}

// Seno dell'altezza del sole sull'orizzonte a Venezia, dato un timestamp
// in ora solare UTC+1 (lo stesso formato "grezzo" restituito dall'API
// ARPA, prima della conversione a ora legale usata per la visualizzazione).
// Negativo quando il sole e' sotto l'orizzonte (notte).
function solarElevationSin(timestamp) {

  // Il timestamp puo' arrivare sia come "YYYY-MM-DD HH:MM:SS" (spazio,
  // formato usato altrove in questo file) sia come "YYYY-MM-DDTHH:MM:SS"
  // (ISO con "T", formato effettivamente restituito per il campo
  // dataora della radiazione dall'API ARPA): normalizziamo prima di
  // separare data e ora, altrimenti con la "T" non c'e' nessuno spazio
  // da trovare e timePart risulta undefined.
  const [datePart, timePart] = timestamp.replace("T", " ").split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hh, mm, ss] = timePart.split(":").map(Number);

  const clockHours = hh + mm / 60 + (ss || 0) / 3600;

  const startOfYear = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.round((current - startOfYear) / 86400000) + 1;

  // Declinazione solare (formula di Cooper)
  const decl = degToRad(23.45 * Math.sin(degToRad(360 / 365 * (284 + dayOfYear))));

  // Equazione del tempo, in minuti
  const B = degToRad(360 / 365 * (dayOfYear - 81));
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // Correzione da ora del fuso a ora solare vera, in minuti (longitudine +
  // equazione del tempo)
  const timeCorrectionMinutes = 4 * (VENICE_LON - ITALY_STANDARD_MERIDIAN) + eot;

  const solarTimeHours = clockHours + timeCorrectionMinutes / 60;
  const hourAngle = degToRad(15 * (solarTimeHours - 12));

  const lat = degToRad(VENICE_LAT);

  return Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
}

// Temperatura percepita "al sole". Il THSW di Davis Instruments e'
// una formula proprietaria mai resa pubblica dal produttore, quindi
// non e' riproducibile esattamente. Questa e' la seconda versione
// dell'approssimazione, corretta dopo aver scoperto due cose
// verificando 46 letture orarie reali della stazione Davis di Villar
// Perosa (TO):
//
// 1) Il THW reale di Davis (temperatura+umidita'+vento, "al buio") in
//    queste 46 righe e' SEMPRE risultato identico, alla decina di
//    grado, all'Heat Index (Rothfusz). Il vento non lo modifica mai,
//    perche' la formula di wind chill vera si applica solo sotto i
//    10°C: alle nostre temperature (quasi sempre ben sopra), il
//    contributo del vento e' semplicemente zero. La versione
//    precedente di questa funzione aveva un termine "-0.70*vento"
//    completamente indipendente dall'Heat Index (con base
//    T+vapore anziche' l'Heat Index gia' calcolato altrove): con
//    umidita' molto alta questo produceva un "al sole" anche 3°C
//    SOPRA "all'ombra" con radiazione zero (di notte!), un risultato
//    privo di senso fisico. Rimosso: ora si parte direttamente
//    dall'Heat Index, la stessa funzione usata per "all'ombra", cosi'
//    le due schermate non possono piu' divergere per un errore di
//    formula.
//
// 2) Confrontando THW e THSW reali, lo scarto (che rappresenta il
//    "bonus" dovuto al sole) segue bene il modello
//    THSW = THW - 0.8 + 0.0132 * R * sin(h)
//    (regressione sui 46 punti, errore medio assoluto 0.71°C, contro
//    1.50°C della versione precedente). Il -0.8 e' una costante
//    piccola e pressoche' indipendente dal vento osservato (0-21
//    km/h), non un termine di raffreddamento eolico.
function apparentTemperatureSun(tempC, humidity, radiationWm2, radiationTimestamp) {

  const hi = heatIndex(tempC, humidity);

  if (radiationWm2 == null || isNaN(radiationWm2) || !radiationTimestamp) {
    return hi - 0.8;
  }

  // Limite di sicurezza contro letture anomale del sensore: la
  // radiazione solare reale a livello del mare non supera mai
  // valori dell'ordine di 1100 W/mq.
  const R = Math.max(0, Math.min(1100, radiationWm2));
  const sinH = Math.max(0, solarElevationSin(radiationTimestamp));

  return hi - 0.8 + 0.0132 * R * sinH;
}

// Le tabelle delle stazioni CPSM non hanno una riga di intestazione
// testuale: sono solo righe di dati ripetute. Per la "scheda" prendiamo
// quindi solo l'ULTIMA riga (il dato piu' recente) e la abbiniamo alle
// etichette note per quella stazione, invece di mostrare piu' righe di
// dati che confonderebbero l'utente.
//
// showUnknown: se true, le colonne oltre quelle etichettate vengono
// comunque mostrate come "Colonna N" (utile quando l'ordine delle
// colonne e' stato verificato, es. Palazzo Cavalli). Se false, le
// colonne senza etichetta verificata vengono nascoste invece di
// mostrare un dato senza indicazione di cosa sia.
function parseLastRowLabeled(html, labels, showUnknown = true) {

  const tableRows = parseStationTableRows(html);

  if (tableRows.length === 0) {
    return null;
  }

  const cells = tableRows[tableRows.length - 1];

  const rows = [];

  cells.forEach((value, i) => {

    if (i >= labels.length && !showUnknown) {
      return;
    }

    const label = labels[i] || ("Colonna " + (i + 1));

    let displayValue;
    if (i === 0) {
      displayValue = value !== "" ? formatDateTime(value) : "n.d.";
    } else if (label.startsWith("Direzione vento") && value !== "" && !isNaN(parseFloat(value))) {
      // La direzione arriva in gradi (es. "45"): la mostriamo nel
      // formato a punti cardinali piu' leggibile, tenendo comunque i
      // gradi tra parentesi per chi vuole il dato preciso.
      const deg = parseFloat(value);
      displayValue = windDirection(deg) + " (" + Math.round(deg) + "°)";
    } else {
      displayValue = value !== "" ? value : "n.d.";
    }

    rows.push({ label, value: displayValue });
  });

  return rows;
}

// Estrae le righe di una tabella HTML (<tr><td>...</td>...</tr>) come
// array di array di stringhe, una per riga, saltando automaticamente
// le righe di intestazione (che usano <th>, non <td>). Sostituisce il
// vecchio parsing "a barre verticali" (split("|")) che funzionava solo
// quando le pagine CPSM passavano attraverso r.jina.ai: quel servizio
// convertiva la tabella HTML in una tabella markdown con quel formato.
// Dal 22/08/2026 le pagine CPSM passano invece dal Worker Cloudflare
// dell'utente, che restituisce l'HTML originale della pagina (vedi
// PROXY_WORKER_URL) - da qui la necessita' di leggere <td> veri
// invece di celle separate da "|".
function parseHtmlTableRows(html) {

  const rows = [];
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;

  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {

    const rowContent = rowMatch[1];

    // Le righe di intestazione usano <th>, non <td>: le saltiamo senza
    // bisogno di riconoscerle esplicitamente, semplicemente perche'
    // non contengono nessuna cella <td>.
    if (!rowContent.includes("<td")) continue;

    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;

    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      cells.push(cellMatch[1].trim());
    }

    rows.push(cells);
  }

  return rows;
}

// r.jina.ai trasforma la tabella HTML in Markdown. Viene usato solo
// come riserva quando il Worker personale riceve dal Comune una pagina
// di protezione al posto dei dati. Accettiamo esclusivamente righe la
// cui prima cella e' un timestamp, cosi' intestazioni e testo estraneo
// non possono essere scambiati per misure.
function parseMarkdownTableRows(text) {
  return text
    .split(/\r?\n/)
    .filter(line => /^\|\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*\|/.test(line))
    .map(line => line
      .split("|")
      .slice(1, -1)
      .map(cell => cell.trim())
    );
}

function parseStationTableRows(text) {
  const htmlRows = parseHtmlTableRows(text);
  return htmlRows.length ? htmlRows : parseMarkdownTableRows(text);
}

const CPSM_TABLE_CACHE_MS = 5 * 60 * 1000;
const cpsmTableCache = new Map();

async function fetchCpsmTableRows(sourceUrl) {
  const cached = cpsmTableCache.get(sourceUrl);
  if (cached && Date.now() - cached.savedAt < CPSM_TABLE_CACHE_MS) {
    return cached.rows;
  }

  const legacyUrl = sourceUrl.replace("https:", "http:");
  const candidates = [
    proxyUrl(legacyUrl),
    "https://r.jina.ai/" + legacyUrl
  ];
  let lastError = null;

  for (let index = 0; index < candidates.length; index++) {
    try {
      const response = await fetchWithTimeout(candidates[index], index === 0 ? 6000 : 20000);
      if (!response.ok) throw new Error("HTTP " + response.status);

      const text = await response.text();
      const rows = parseStationTableRows(text);
      if (rows.length) {
        cpsmTableCache.set(sourceUrl, { savedAt: Date.now(), rows });
        return rows;
      }

      throw new Error("Nessuna riga dati riconoscibile");
    } catch (error) {
      lastError = error;
      console.warn("Tabella CPSM non disponibile da", candidates[index], error);
    }
  }

  throw lastError || new Error("Tabella CPSM non disponibile");
}

async function loadPalazzoCavalliTable() {
  const tableRows = await fetchCpsmTableRows(PALAZZO_CAVALLI_SOURCE_URL);

  const rows = tableRows.map(cols => ({
    timestamp: cols[0],
    pressure: parseFloat(cols[1]),
    temperature: parseFloat(cols[2]),
    humidity: parseFloat(cols[3]),
    radiation: parseFloat(cols[4]),
    rain: parseFloat(cols[5])
  }));

  if (rows.length === 0) {
    throw new Error("Nessuna riga dati trovata per Palazzo Cavalli");
  }

  return rows;
}

async function loadPalazzoCavalli() {

  const parsedRows = await loadPalazzoCavalliTable();

  const last = parsedRows[parsedRows.length - 1];

  // Ogni lettura di pioggia rappresenta i 5 minuti tra una rilevazione
  // e l'altra (confermato). Per la pioggia dell'ultima ora sommiamo
  // tutte le letture entro 60 minuti dall'ultimo dato disponibile.
  const latestTime = new Date(last.timestamp.replace(" ", "T") + "+01:00");

  const rainLastHour = parsedRows
    .filter(r => {
      const t = new Date(r.timestamp.replace(" ", "T") + "+01:00");
      const diffMinutes = (latestTime - t) / 60000;
      return diffMinutes >= 0 && diffMinutes < 60;
    })
    .reduce((sum, r) => sum + (isNaN(r.rain) ? 0 : r.rain), 0);

  // La tabella scaricata copre gia' le ultime 24 ore (confermato), quindi
  // per il totale giornaliero basta sommare tutte le righe disponibili.
  const rain24h = parsedRows
    .reduce((sum, r) => sum + (isNaN(r.rain) ? 0 : r.rain), 0);

  return {
    ...last,
    rainLastHour,
    rain24h
  };
}

async function loadSanGiorgio() {
  const tableRows = await fetchCpsmTableRows(SAN_GIORGIO_SOURCE_URL);
  const cols = tableRows[tableRows.length - 1];

  return {
    timestamp: cols[0],
    windDir: parseFloat(cols[1]),
    windSpeed: parseFloat(cols[2]),
    windGust: parseFloat(cols[3]),
    temperature: parseFloat(cols[4]),
    humidity: parseFloat(cols[5])
  };
}

// La Palestra Marsico viene letta dal worker gia' usato dalla pagina
// delle stazioni amatoriali. Rimane separata dal caricamento principale:
// se Weather Underground non risponde, le altre card continuano a
// funzionare e soltanto queste due righe mostrano "n.d.".
async function loadCannaregioPalestra() {

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {

    const response = await fetch(PALESTRA_WORKER_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const payload = await response.json();
    const station = Array.isArray(payload)
      ? payload.find(item => item.id === "IVENIC160")
      : null;

    if (!station || station.error) {
      throw new Error(station?.error || "Stazione non trovata");
    }

    return {
      available: true,
      temperature: numberOrNull(station.temp),
      humidity: numberOrNull(station.humidity),
      dewPoint: numberOrNull(station.dewPoint),
      heatIndex: numberOrNull(station.heatIndex),
      pressure: numberOrNull(station.pressure),
      windSpeed: numberOrNull(station.windSpeed),
      windGust: numberOrNull(station.windGust),
      windDir: numberOrNull(station.windDir),
      rainRate: numberOrNull(station.rainLive ?? station.rainRate),
      rain60min: numberOrNull(station.rain60min),
      rain24h: numberOrNull(station.rain24h ?? station.rain),
      solarRadiation: numberOrNull(station.solarRad),
      uvIndex: numberOrNull(station.uvIndex),
      updatedAt: numberOrNull(station.updatedAt),
      stale: Boolean(station.stale)
    };

  } finally {
    clearTimeout(timeout);
  }
}

// Cavanis viene richiesto prima attraverso il Worker e poi, se serve,
// direttamente ad ARPA Veneto. Il doppio percorso evita che filtri o
// problemi di rete legati a uno specifico operatore mobile rendano la
// stazione irraggiungibile anche quando la fonte e' disponibile.
async function loadCavanis() {

  const sources = [proxyUrl(CAVANIS_API_URL), CAVANIS_API_URL];
  let json = null;

  for (const url of sources) {
    try {
      const response = await fetchWithTimeout(url, 8000);
      if (!response.ok) throw new Error("HTTP " + response.status);
      json = await response.json();
      break;
    } catch (err) {
      console.warn("Cavanis: fonte fallita (" + url + "):", err);
    }
  }

  if (!json || !Array.isArray(json.data)) {
    throw new Error("Cavanis: nessuna fonte disponibile");
  }

  const data = json.data;

  const lastOfType = (tipo) => {
    const rows = data.filter(r => r.tipo === tipo);
    return rows.length ? rows[rows.length - 1] : null;
  };

  const lastTemp = lastOfType("TARIA2M");
  const lastHumidity = lastOfType("UMID2M");
  const lastRadiation = lastOfType("RADSOL");
  const lastWindSpeed = lastOfType("VVENTO10M");
  const lastWindDir = lastOfType("DVENTO10M");
  const lastRain = lastOfType("PREC");

  if (!lastTemp || !lastHumidity) {
    throw new Error("Cavanis: temperatura o umidita non disponibili");
  }

  // RADSOL e' in MJ/mq (energia cumulata nell'ultima ora), non in
  // W/mq (potenza istantanea) come serve alla formula della
  // temperatura percepita al sole. Si converte moltiplicando per
  // 1.000.000 (MJ -> J) e dividendo per 3600 secondi (un'ora).
  const MJ_TO_WATT_PER_SQM = 1000000 / 3600;

  const radiationWm2 =
    lastRadiation != null
      ? parseFloat(lastRadiation.valore) * MJ_TO_WATT_PER_SQM
      : null;

  return {
    timestamp: lastTemp.dataora,
    temperature: parseFloat(lastTemp.valore),
    humidity: parseFloat(lastHumidity.valore),
    radiation: radiationWm2,
    radiationTimestamp: lastRadiation ? lastRadiation.dataora : null,
    // VVENTO10M e' in m/s (confermato dall'utente, e' l'unita' nativa
    // del sensore): chi lo mostra in scheda deve moltiplicare per 3.6
    // per ottenere km/h; le formule che vogliono m/s (es.
    // apparentTemperatureSun) lo possono usare direttamente cosi'.
    windSpeed: lastWindSpeed ? parseFloat(lastWindSpeed.valore) : null,
    windSpeedTimestamp: lastWindSpeed ? lastWindSpeed.dataora : null,
    windDir: lastWindDir ? parseFloat(lastWindDir.valore) : null,
    // PREC e' gia' in mm, nessuna conversione necessaria.
    rain: lastRain ? parseFloat(lastRain.valore) : null
  };
}

// Estrae i dati della stazione "Lido Meteo" da un testo che contiene
// (anche solo in parte, anche con roba non-XML attorno) il blocco
// <marker id="115" ...>...</marker> del file Dati2.xml. Usa
// espressioni regolari invece di DOMParser di proposito: cosi' la
// stessa funzione funziona sia sul file XML diretto sia su una
// versione passata da un proxy tipo r.jina.ai, che a volte avvolge il
// contenuto in testo/markdown aggiuntivo e romperebbe un parsing XML
// rigido. Restituisce null se il blocco marker non viene trovato
// (dominio offline, proxy che ha restituito una pagina di errore,
// ecc.), senza mai lanciare eccezioni: chi chiama decide cosa fare.
function extractLidoMeteoFromText(text) {

  // \\s* attorno agli "=" perche' fonti diverse formattano l'XML in
  // modo diverso: il file originale ISPRA usa attributi senza spazi
  // (id="115"), ma il Worker proxy (che passa il contenuto attraverso
  // il proprio motore di fetch) lo restituisce con spazi attorno al
  // segno di uguale (id = "115") - bug reale riscontrato il
  // 22/08/2026: la regex rigida non trovava piu' la stazione anche se
  // il Worker rispondeva correttamente.
  const markerRegex = new RegExp(
    '<marker[^>]*id\\s*=\\s*"' + LIDO_METEO_MARKER_ID + '"[^>]*>([\\s\\S]*?)<\\/marker>'
  );

  const markerMatch = text.match(markerRegex);
  if (!markerMatch) return null;

  const markerContent = markerMatch[1];

  const instrumentRegex = /<instrument[^>]*type\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/instrument>/g;

  let temperature = null;
  let humidity = null;
  let windDir = null;
  let windSpeed = null;
  let pressure = null;
  let rain = null;
  let timestamp = null;

  let m;
  while ((m = instrumentRegex.exec(markerContent)) !== null) {

    const type = m[1];
    const instrBlock = m[2];

    const valueMatch = instrBlock.match(/<value[^>]*datetime\s*=\s*"([^"]*)"[^>]*>\s*([^<]*?)\s*<\/value>/);
    if (!valueMatch) continue;

    const ts = valueMatch[1];
    const value = parseFloat(valueMatch[2].trim());

    // Tutti gli strumenti di questa stazione condividono lo stesso
    // datetime (rilevazione istantanea unica per ciclo): ne basta uno
    // qualsiasi per l'avviso di aggiornamento.
    if (timestamp == null) timestamp = ts;

    if (type === "Temperatura") temperature = value;
    else if (type === "Umid") humidity = value;
    else if (type === "Vento dir.") windDir = value;
    else if (type === "Vento vel.") windSpeed = value;
    else if (type === "Press") pressure = value;
    else if (type === "Pioggia") rain = value;
  }

  if (temperature == null && humidity == null) return null;

  return { temperature, humidity, windDir, windSpeed, pressure, rain, timestamp };
}

// Timeout (ms) per ogni singolo tentativo di fetch di Lido Meteo.
// Senza questo, un fetch che resta "appeso" (nessuna risposta, nessun
// errore) blocca l'intera funzione a tempo indeterminato invece di
// passare rapidamente alla fonte successiva - bug reale riscontrato
// il 22/08/2026: l'intera app restava in caricamento per minuti.
const LIDO_METEO_FETCH_TIMEOUT_MS = 6000;

function fetchWithTimeout(url, timeoutMs) {

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

// Legge temperatura e umidita' della stazione "Lido Meteo" (RMLV,
// ISPRA). A differenza delle altre loadXxx() di questo file, questa
// NON lancia mai un'eccezione verso l'esterno: se fallisce (Worker
// giu', XML non trovato, stazione assente) restituisce semplicemente
// { available: false }, cosi' un problema con questa singola fonte non
// puo' mai bloccare il caricamento delle altre card. Inoltre non viene
// nemmeno incluso nel Promise.all principale di loadAll() (vedi li'):
// anche se per qualsiasi motivo finisse per bloccarsi comunque, il
// resto dell'app deve restare utilizzabile.
//
// Prova, in ordine, ciascuno con un timeout di pochi secondi:
// 1) Worker Cloudflare personale dell'utente (ora generico, vedi
//    proxyUrl() e PROXY_WORKER_URL): scarica il file lato server
//    (nessun problema di CORS) e lo restituisce con l'header
//    Access-Control-Allow-Origin. Verificato funzionante il
//    22/08/2026. Preferito perche' sotto il controllo diretto
//    dell'utente, a differenza dei proxy pubblici sottostanti che si
//    sono gia' dimostrati inaffidabili;
// 2) fetch diretto del file ISPRA: fallisce quasi certamente per CORS
//    (dominio governativo senza Access-Control-Allow-Origin), tenuto
//    come tentativo a costo zero nel caso ISPRA cambiasse politica;
// 3-4) codetabs.com e AllOrigins come ultima riserva: entrambi si sono
//    gia' dimostrati inaffidabili in pratica (rispettivamente offline
//    con errore Cloudflare 522, e errore 500 lato loro, il 21-22/08/2026)
//    ma restano un tentativo a costo quasi zero se il Worker personale
//    dovesse smettere di funzionare (es. quota giornaliera Cloudflare
//    esaurita, molto improbabile per l'uso di una sola persona: il
//    piano gratuito consente 100.000 richieste al giorno).
async function loadLidoMeteo() {

  const sources = [
    proxyUrl(ISPRAMBIENTE_DATI_URL),
    ISPRAMBIENTE_DATI_URL,
    "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(ISPRAMBIENTE_DATI_URL),
    "https://api.allorigins.win/raw?url=" + encodeURIComponent(ISPRAMBIENTE_DATI_URL)
  ];

  for (const url of sources) {

    try {

      const response = await fetchWithTimeout(url, LIDO_METEO_FETCH_TIMEOUT_MS);
      if (!response.ok) throw new Error("HTTP " + response.status);

      const text = await response.text();
      const data = extractLidoMeteoFromText(text);

      if (data) {
        return {
          available: true,
          ...data,
          stale: data.timestamp != null && minutesSinceIsprambiente(data.timestamp) > LIDO_METEO_STALE_MINUTES
        };
      }

      console.warn("Lido Meteo: nessun dato riconoscibile da", url);

    } catch (err) {
      console.warn("Lido Meteo: fonte fallita (" + url + "):", err);
    }
  }

  return { available: false };
}

async function loadPuntaSalute() {
  const tableRows = await fetchCpsmTableRows(PUNTA_SALUTE_SOURCE_URL);
  const cols = tableRows[tableRows.length - 1];
  const prevCols = tableRows[tableRows.length - 3];

  const tide = Math.round(parseFloat(cols[1]) * 100);
  const prevTide = Math.round(parseFloat(prevCols[1]) * 100);

  let trend = "→";

  if (tide > prevTide) trend = "↑";
  if (tide < prevTide) trend = "↓";

  return {
    timestamp: cols[0],
    tide,
    trend,
    waterTemp: parseFloat(cols[2])
  };
}

// Scarica e fa il parsing COMPLETO della tabella di Misericordia
// (tutte le righe disponibili, non solo l'ultima): serve sia per la
// marea di backup sia, soprattutto, per il grafico del vento che
// mostra l'andamento nel tempo e non solo l'ultimo valore. L'ordine
// delle colonne vento/onda segue l'intestazione della tabella ufficiale
// giornaliera del Comune di Venezia.
async function loadMisericordiaTable() {
  const tableRows = await fetchCpsmTableRows(MISERICORDIA_SOURCE_URL);

  const rows = tableRows.map(cols => ({
    timestamp: cols[0],
    tide: parseFloat(cols[1]),
    windDir: parseFloat(cols[2]),
    windSpeed: parseFloat(cols[3]),
    windGust: parseFloat(cols[4]),
    waveHeight: parseFloat(cols[5]),
    waveMax: parseFloat(cols[6])
  }));

  if (rows.length === 0) {
    throw new Error("Nessuna riga dati trovata per Misericordia");
  }

  return rows;
}

async function loadMisericordia() {

  const rows = await loadMisericordiaTable();

  const last = rows[rows.length - 1];
  const previous = rows[rows.length - 3] || rows[rows.length - 2] || last;

  const tide = Math.round(last.tide * 100);
  const prevTide = Math.round(previous.tide * 100);

  let trend = "→";

  if (tide > prevTide) trend = "↑";
  if (tide < prevTide) trend = "↓";

  return {
    timestamp: last.timestamp,
    tide,
    trend,
    source: "Misericordia",
    waterTemp: null
  };
}

async function loadTide() {

  try {

    const puntaSalute = await loadPuntaSalute();
    puntaSalute.source = "Punta Salute";
    return puntaSalute;

  } catch (err) {

    console.warn("Punta Salute non disponibile, uso Misericordia");
    return await loadMisericordia();
  }
}

// Ultimo dato di vento di Misericordia per la card principale.
// Non lancia mai un'eccezione verso l'esterno (stesso principio di
// loadLidoMeteo): se Misericordia non e' raggiungibile, il vento
// mostra semplicemente "n.d." invece di rompere il caricamento di
// tutta la pagina.
async function loadMisericordiaWind() {

  try {

    const rows = await loadMisericordiaTable();
    const last = rows[rows.length - 1];

    return {
      available: true,
      timestamp: last.timestamp,
      windDir: last.windDir,
      windSpeed: last.windSpeed,
      windGust: last.windGust
    };

  } catch (err) {

    console.warn("Vento Misericordia non disponibile:", err);
    return { available: false };
  }
}

async function loadStationsConfig() {

  const response = await fetch("stations.json");
  const config = await response.json();

  const container = document.getElementById("stationsStatus");
  container.innerHTML = "";

  config.stations.forEach(station => {

    const row = document.createElement("div");
    row.className = "sub-station clickable";
    row.textContent = "✓ " + station.name;

    row.addEventListener("click", () => {

      if (station.id === "punta_salute") {
        openPuntaSaluteModal();
        return;
      }

      if (station.id === "misericordia") {
        openMisericordiaStationModal();
        return;
      }

      if (station.id === "palazzo_cavalli") {
        openPalazzoCavalliModal();
        return;
      }

      if (station.type === "meteonetwork") {
        openCavanisModal();
        return;
      }

      if (station.type === "isprambiente") {
        openLidoMeteoModal();
        return;
      }

      if (station.type === "wunderground") {
        openCannaregioPalestraModal();
        return;
      }

      if (station.url) {
        const labels = STATION_LABELS[station.id] || ["Data/Ora"];
        const verified = STATION_LABELS_VERIFIED[station.id] !== false;
        openStationModal(station.name, proxyUrl(station.url), labels, verified, {
          sourceUrl: station.url,
          sourceLabel: station.sourceLabel || "Apri la pagina della fonte ↗"
        });
      }
    });

    container.appendChild(row);
  });
}

// --- Modale "scheda" stazione ---

function showModal(title, bodyHtml, options = {}) {

  const modalCard = document.getElementById("modalCard");
  const modalSubtitle = document.getElementById("modalSubtitle");
  document.getElementById("modalTitle").innerHTML = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  modalCard.dataset.theme = options.theme || "default";
  modalSubtitle.textContent = options.subtitle || "";
  modalSubtitle.hidden = !options.subtitle;
  document.getElementById("modalOverlay").classList.add("open");
  document.getElementById("modalOverlay").setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function hideModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  document.getElementById("modalOverlay").setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderStationMetric(icon, label, value, wide = false) {
  if (value === null || value === undefined || value === "") return "";

  return `
<div class="station-detail-metric${wide ? " wide" : ""}">
  <span class="station-detail-metric-icon" aria-hidden="true">${icon}</span>
  <span class="station-detail-metric-copy">
    <small>${escapeHtml(label)}</small>
    <strong>${escapeHtml(value)}</strong>
  </span>
</div>`;
}

function renderStationReadings(metrics) {
  const content = metrics.filter(Boolean).join("");
  return content ? `<div class="station-detail-readings">${content}</div>` : "";
}

function detailComfortLabel(value) {
  if (value == null || !Number.isFinite(value)) return "Dato n.d.";
  if (value < 5) return "Freddo";
  if (value < 13) return "Fresco";
  if (value < 22) return "Confortevole";
  if (value < 27) return "Caldo";
  if (value < 32) return "Afoso";
  return "Afa intensa";
}

function detailTemperatureColour(value) {
  if (value == null || !Number.isFinite(value)) return "#9ca6af";
  if (value < 13) return "#4f83c9";
  if (value < 27) return "#5a9a69";
  return "#c45d49";
}

function renderDetailTemperatureScale(temperature, humidity) {
  if (temperature == null || !Number.isFinite(temperature)) return "";

  const apparent = heatIndex(temperature, humidity);
  const percent = Math.max(0, Math.min(100, ((apparent + 5) / 45) * 100));
  const colour = detailTemperatureColour(apparent);

  return `
<div class="detail-temperature-scale">
  <div class="detail-temperature-heading">
    <span>Temperatura percepita</span>
    <strong>${apparent.toFixed(1)} °C</strong>
  </div>
  <div class="detail-temperature-row">
    <div class="detail-temperature-track">
      <i class="detail-temperature-marker" style="left:${percent.toFixed(1)}%;border-color:${colour}"></i>
    </div>
    <span class="detail-temperature-label" style="color:${colour}">${detailComfortLabel(apparent)}</span>
  </div>
</div>`;
}

function renderTemperaturePrimary(temperature, humidity) {
  const temperatureText = temperature != null && Number.isFinite(temperature)
    ? temperature.toFixed(1) + " °C"
    : "n.d.";
  const humidityText = humidity != null && Number.isFinite(humidity)
    ? "💧 " + humidity.toFixed(0) + " %"
    : "💧 n.d.";

  return `
<div class="station-detail-primary">
  <span class="station-detail-main-value">${temperatureText}</span>
  <span class="station-detail-secondary-value">${humidityText}</span>
</div>
${renderDetailTemperatureScale(temperature, humidity)}`;
}

function renderPrimaryValues(mainValue, secondaryValue) {
  return `
<div class="station-detail-primary">
  <span class="station-detail-main-value">${escapeHtml(mainValue)}</span>
  ${secondaryValue
    ? `<span class="station-detail-secondary-value">${escapeHtml(secondaryValue)}</span>`
    : ""}
</div>`;
}

function renderUpdatedDetail(value) {
  return value
    ? `<div class="station-detail-updated">🕐 Ultimo dato: ${escapeHtml(value)}</div>`
    : "";
}

function renderSourceLink(url, label) {
  if (!url) return "";
  return `<a class="modal-source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label || "Apri la pagina della fonte ↗")}</a>`;
}

async function openStationModal(title, url, labels, showUnknown = true, options = {}) {

  const modalOptions = {
    theme: options.theme || "neutral",
    subtitle: options.subtitle || "Dati della stazione"
  };

  showModal(title, "<p>Caricamento dati aggiornati...</p>", modalOptions);

  try {

    const response = await fetch(url);
    const text = await response.text();

    const rows = parseLastRowLabeled(text, labels, showUnknown);

    if (!rows) {
      throw new Error("Dati non trovati");
    }

    const html = rows
      .map(r =>
        `<div class="modal-row"><span class="modal-label">${r.label}</span><span class="modal-value">${r.value}</span></div>`
      )
      .join("");

    showModal(
      title,
      html + renderSourceLink(options.sourceUrl, options.sourceLabel),
      modalOptions
    );

  } catch (err) {

    console.error(err);
    showModal(
      title,
      "<p>Errore nel caricamento dei dati. Riprova tra qualche minuto: se il problema persiste, la stazione potrebbe essere temporaneamente offline sul sito del Comune.</p>" +
        renderSourceLink(options.sourceUrl, options.sourceLabel),
      modalOptions
    );
  }
}

async function openPalazzoCavalliModal() {
  const options = {
    theme: "temperature",
    subtitle: "Comune di Venezia · stazione urbana"
  };
  showModal("Palazzo Cavalli", "<p>Caricamento dati aggiornati...</p>", options);

  try {
    const data = await loadPalazzoCavalli();
    const readings = renderStationReadings([
      renderStationMetric("⏲️", "Pressione", Number.isFinite(data.pressure) ? data.pressure.toFixed(1) + " hPa" : null),
      renderStationMetric("☀️", "Radiazione solare", Number.isFinite(data.radiation) ? Math.round(data.radiation) + " W/mq" : null),
      renderStationMetric("🌧️", "Ultimi 5 minuti", Number.isFinite(data.rain) ? data.rain.toFixed(1) + " mm" : null),
      renderStationMetric("☔", "Ultima ora", Number.isFinite(data.rainLastHour) ? data.rainLastHour.toFixed(1) + " mm" : null),
      renderStationMetric("🌦️", "Ultime 24 ore", Number.isFinite(data.rain24h) ? data.rain24h.toFixed(1) + " mm" : null)
    ]);

    showModal(
      "Palazzo Cavalli",
      renderTemperaturePrimary(data.temperature, data.humidity) +
        readings +
        renderUpdatedDetail(formatDateTime(data.timestamp)) +
        renderSourceLink(PALAZZO_CAVALLI_SOURCE_URL, "Apri la tabella giornaliera del Comune ↗"),
      options
    );
  } catch (err) {
    console.error(err);
    showModal(
      "Palazzo Cavalli",
      "<p>Dati temporaneamente non disponibili.</p>" +
        renderSourceLink(PALAZZO_CAVALLI_SOURCE_URL, "Apri la tabella giornaliera del Comune ↗"),
      options
    );
  }
}

async function openPuntaSaluteModal() {
  const options = {
    theme: "sea",
    subtitle: "Comune di Venezia · stazione mareografica"
  };
  showModal("Punta della Dogana (Punta Salute)", "<p>Caricamento dati aggiornati...</p>", options);

  try {
    const data = await loadPuntaSalute();
    const trendLabel = data.trend === "↑"
      ? "Marea in aumento"
      : data.trend === "↓"
        ? "Marea in diminuzione"
        : "Marea stabile";

    showModal(
      "Punta della Dogana (Punta Salute)",
      renderPrimaryValues(
        Number.isFinite(data.tide) ? data.tide + " cm " + data.trend : "n.d.",
        Number.isFinite(data.waterTemp) ? "🌡️ acqua " + data.waterTemp.toFixed(1) + " °C" : null
      ) +
        renderStationReadings([
          renderStationMetric("🌊", "Tendenza", trendLabel),
          renderStationMetric("🌡️", "Temperatura acqua", Number.isFinite(data.waterTemp) ? data.waterTemp.toFixed(1) + " °C" : null)
        ]) +
        renderUpdatedDetail(formatDateTime(data.timestamp)) +
        renderSourceLink(PUNTA_SALUTE_SOURCE_URL, "Apri la tabella giornaliera del Comune ↗"),
      options
    );
  } catch (err) {
    console.error(err);
    showModal(
      "Punta della Dogana (Punta Salute)",
      "<p>Dati temporaneamente non disponibili.</p>" +
        renderSourceLink(PUNTA_SALUTE_SOURCE_URL, "Apri la tabella giornaliera del Comune ↗"),
      options
    );
  }
}

async function openMisericordiaStationModal() {
  const options = {
    theme: "wind",
    subtitle: "Comune di Venezia · marea, vento e moto ondoso"
  };
  showModal("Misericordia", "<p>Caricamento dati aggiornati...</p>", options);

  try {
    const rows = await loadMisericordiaTable();
    const last = rows[rows.length - 1];
    const windKmh = Number.isFinite(last.windSpeed) ? last.windSpeed * 3.6 : null;
    const gustKmh = Number.isFinite(last.windGust) ? last.windGust * 3.6 : null;

    showModal(
      "Misericordia",
      renderPrimaryValues(
        Number.isFinite(last.tide) ? Math.round(last.tide * 100) + " cm" : "n.d.",
        windKmh != null ? "💨 " + Math.round(windKmh) + " km/h" : null
      ) +
        renderStationReadings([
          renderStationMetric("🧭", "Direzione vento", Number.isFinite(last.windDir) ? windDirection(last.windDir) + " (" + Math.round(last.windDir) + "°)" : null),
          renderStationMetric("🌬️", "Raffica", gustKmh != null ? Math.round(gustKmh) + " km/h" : null),
          renderStationMetric("🌊", "Onda significativa", Number.isFinite(last.waveHeight) ? last.waveHeight.toFixed(2) + " m" : null),
          renderStationMetric("〰️", "Onda massima", Number.isFinite(last.waveMax) ? last.waveMax.toFixed(2) + " m" : null)
        ]) +
        renderUpdatedDetail(formatDateTime(last.timestamp)) +
        renderSourceLink(MISERICORDIA_SOURCE_URL, "Apri la tabella giornaliera del Comune ↗"),
      options
    );
  } catch (err) {
    console.error(err);
    showModal(
      "Misericordia",
      "<p>Dati temporaneamente non disponibili.</p>" +
        renderSourceLink(MISERICORDIA_SOURCE_URL, "Apri la tabella giornaliera del Comune ↗"),
      options
    );
  }
}

// Scheda ARPA con lo stesso linguaggio visivo dei dettagli delle
// stazioni amatoriali. Il collegamento esterno resta disponibile, ma
// soltanto in fondo alla scheda: il tocco sul dato non porta più via
// direttamente da LagunaLive.
async function openCavanisModal() {
  const options = {
    theme: "temperature",
    subtitle: "ARPAV · Osservatorio Cavanis"
  };
  showModal("Osservatorio Cavanis", "<p>Caricamento dati aggiornati...</p>", options);

  try {
    const data = await loadCavanis();
    const windText = Number.isFinite(data.windSpeed)
      ? Math.round(data.windSpeed * 3.6) + " km/h" +
        (Number.isFinite(data.windDir) ? " · " + windDirection(data.windDir) : "")
      : null;

    showModal(
      "Osservatorio Cavanis",
      renderTemperaturePrimary(data.temperature, data.humidity) +
        renderStationReadings([
          renderStationMetric("💨", "Vento", windText),
          renderStationMetric("☀️", "Radiazione solare", Number.isFinite(data.radiation) ? Math.round(data.radiation) + " W/mq" : null),
          renderStationMetric("🌧️", "Pioggia", Number.isFinite(data.rain) ? data.rain.toFixed(1) + " mm" : null)
        ]) +
        renderUpdatedDetail(formatDateTime(data.timestamp)) +
        renderSourceLink(CAVANIS_URL, "Apri la pagina della stazione ↗"),
      options
    );
  } catch (err) {
    console.error(err);
    showModal(
      "Osservatorio Cavanis",
      "<p>Dati temporaneamente non disponibili.</p>" +
        renderSourceLink(CAVANIS_URL, "Apri la pagina della stazione ↗"),
      options
    );
  }
}

async function openCannaregioPalestraModal() {
  const options = {
    theme: "temperature",
    subtitle: "Weather Underground · S. Alvise"
  };
  showModal("S. Alvise", "<p>Caricamento dati aggiornati...</p>", options);

  try {
    const data = await loadCannaregioPalestra();
    const windText = Number.isFinite(data.windSpeed)
      ? data.windSpeed.toFixed(1) + " km/h" +
        (Number.isFinite(data.windDir) ? " · " + windDirection(data.windDir) : "")
      : null;
    const staleWarning = data.stale
      ? '<p class="stale-warning">⚠️ Il dato non risulta recente.</p>'
      : "";

    showModal(
      "S. Alvise",
      staleWarning +
        renderTemperaturePrimary(data.temperature, data.humidity) +
        renderStationReadings([
          renderStationMetric("🌡️", "Punto di rugiada", Number.isFinite(data.dewPoint) ? data.dewPoint.toFixed(1) + " °C" : null),
          renderStationMetric("⏲️", "Pressione", Number.isFinite(data.pressure) ? data.pressure.toFixed(1) + " hPa" : null),
          renderStationMetric("💨", "Vento", windText),
          renderStationMetric("🌬️", "Raffica", Number.isFinite(data.windGust) ? data.windGust.toFixed(1) + " km/h" : null),
          renderStationMetric("🌧️", "Intensità pioggia", Number.isFinite(data.rainRate) ? data.rainRate.toFixed(1) + " mm/h" : null),
          renderStationMetric("🌦️", "Pioggia 24 ore", Number.isFinite(data.rain24h) ? data.rain24h.toFixed(1) + " mm" : null),
          renderStationMetric("☀️", "Radiazione solare", Number.isFinite(data.solarRadiation) ? Math.round(data.solarRadiation) + " W/mq" : null),
          renderStationMetric("🔆", "Indice UV", Number.isFinite(data.uvIndex) ? data.uvIndex.toFixed(1) : null)
        ]) +
        renderUpdatedDetail(data.updatedAt ? new Date(data.updatedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }) : null) +
        renderSourceLink(PALESTRA_SOURCE_URL, "Apri la pagina della stazione ↗"),
      options
    );
  } catch (err) {
    console.error(err);
    showModal(
      "S. Alvise",
      "<p>Dati temporaneamente non disponibili.</p>" +
        renderSourceLink(PALESTRA_SOURCE_URL, "Apri la pagina della stazione ↗"),
      options
    );
  }
}

async function openLidoMeteoModal() {
  const options = {
    theme: "sea",
    subtitle: "ISPRA · Rete Mareografica della Laguna di Venezia"
  };
  showModal("Lido Meteo", "<p>Caricamento dati aggiornati...</p>", options);

  try {
    const data = await loadLidoMeteo();
    if (!data.available) throw new Error("Dati non disponibili");

    const windText = Number.isFinite(data.windSpeed)
      ? Math.round(data.windSpeed * 3.6) + " km/h" +
        (Number.isFinite(data.windDir) ? " · " + windDirection(data.windDir) : "")
      : null;
    const staleWarning = data.stale
      ? '<p class="stale-warning">⚠️ La stazione risulta ferma da più di 2 ore.</p>'
      : "";

    showModal(
      "Lido Meteo",
      staleWarning +
        renderTemperaturePrimary(data.temperature, data.humidity) +
        renderStationReadings([
          renderStationMetric("💨", "Vento", windText),
          renderStationMetric("⏲️", "Pressione", Number.isFinite(data.pressure) ? data.pressure.toFixed(1) + " hPa" : null),
          renderStationMetric("🌧️", "Pioggia", Number.isFinite(data.rain) ? data.rain.toFixed(1) + " mm" : null)
        ]) +
        renderUpdatedDetail(data.timestamp ? formatTimeIsprambiente(data.timestamp) : null) +
        renderSourceLink(LIDO_METEO_SOURCE_URL, "Apri la scheda ufficiale ISPRA ↗"),
      options
    );
  } catch (err) {
    console.error(err);
    showModal(
      "Lido Meteo",
      "<p>Dati temporaneamente non disponibili; la rete ISPRA/RMLV può restare offline per alcuni giorni.</p>" +
        renderSourceLink(LIDO_METEO_SOURCE_URL, "Apri la scheda ufficiale ISPRA ↗"),
      options
    );
  }
}

// Disegna un grafico vento (velocita' e raffica, in km/h) su canvas,
// senza librerie esterne, coerente con lo stile "no-build" del
// progetto. La direzione viene mostrata come piccole frecce ruotate
// lungo l'asse del tempo invece che come terza linea, perche' un
// valore angolare (0-360°) non e' leggibile insieme a due linee
// lineari sullo stesso grafico.
function drawWindChart(canvas, rows) {

  const ctx = canvas.getContext("2d");

  // Dimensiona il canvas alla larghezza reale mostrata a schermo,
  // tenendo conto del devicePixelRatio per una resa nitida sugli
  // schermi dei telefoni (altrimenti il canvas risulta sfocato).
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 320;
  const cssHeight = 220;

  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.height = cssHeight + "px";

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const padding = { top: 16, right: 12, bottom: 44, left: 36 };
  const plotWidth = cssWidth - padding.left - padding.right;
  const plotHeight = cssHeight - padding.top - padding.bottom;

  const speeds = rows.map(r => (isNaN(r.windSpeed) ? 0 : r.windSpeed * 3.6));
  const gusts = rows.map(r => (isNaN(r.windGust) ? 0 : r.windGust * 3.6));

  const maxVal = Math.max(1, ...speeds, ...gusts) * 1.15;

  const xForIndex = (i) =>
    padding.left + (i / Math.max(1, rows.length - 1)) * plotWidth;

  const yForValue = (v) =>
    padding.top + plotHeight - (v / maxVal) * plotHeight;

  // Griglia orizzontale + etichette km/h
  ctx.strokeStyle = "#eee";
  ctx.fillStyle = "#888";
  ctx.font = "11px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const v = (maxVal / gridLines) * i;
    const y = yForValue(v);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotWidth, y);
    ctx.stroke();
    ctx.fillText(Math.round(v) + "", padding.left - 6, y);
  }

  // Etichette orario sull'asse x (circa 5 tacche)
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const tickCount = Math.min(5, rows.length);
  for (let t = 0; t < tickCount; t++) {
    const i = Math.round((t / Math.max(1, tickCount - 1)) * (rows.length - 1));
    const x = xForIndex(i);
    ctx.fillText(formatMisericordiaTime(rows[i].timestamp), x, padding.top + plotHeight + 6);
  }

  // Linea raffica (dietro, piu' chiara)
  ctx.strokeStyle = "#a8c3f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  gusts.forEach((v, i) => {
    const x = xForIndex(i);
    const y = yForValue(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Linea velocita' media (sopra, piu' scura)
  ctx.strokeStyle = "#1a3c8f";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  speeds.forEach((v, i) => {
    const x = xForIndex(i);
    const y = yForValue(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Frecce di direzione, disegnate a intervalli regolari appena sotto
  // l'asse x (una freccia ogni ~6 punti per non affollare il grafico).
  const arrowStep = Math.max(1, Math.round(rows.length / 16));

  ctx.strokeStyle = "#555";
  ctx.fillStyle = "#555";
  ctx.lineWidth = 1.5;

  for (let i = 0; i < rows.length; i += arrowStep) {

    const dir = rows[i].windDir;
    if (dir == null || isNaN(dir)) continue;

    const x = xForIndex(i);
    const y = padding.top + plotHeight + 24;
    const angle = degToRad(dir - 90); // 0° = Nord verso l'alto
    const len = 6;

    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;

    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * len, y - Math.sin(angle) * len);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Piccola punta a freccia
    const headAngle1 = angle + Math.PI * 0.8;
    const headAngle2 = angle - Math.PI * 0.8;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 + Math.cos(headAngle1) * 3, y2 + Math.sin(headAngle1) * 3);
    ctx.lineTo(x2 + Math.cos(headAngle2) * 3, y2 + Math.sin(headAngle2) * 3);
    ctx.closePath();
    ctx.fill();
  }
}

function summarizeRainRows(rows) {
  const last = rows[rows.length - 1];
  const latestTime = new Date(last.timestamp.replace(" ", "T") + "+01:00");

  const rainLastHour = rows
    .filter(row => {
      const time = new Date(row.timestamp.replace(" ", "T") + "+01:00");
      const diffMinutes = (latestTime - time) / 60000;
      return diffMinutes >= 0 && diffMinutes < 60;
    })
    .reduce((sum, row) => sum + (Number.isFinite(row.rain) ? Math.max(0, row.rain) : 0), 0);

  const rain24h = rows
    .reduce((sum, row) => sum + (Number.isFinite(row.rain) ? Math.max(0, row.rain) : 0), 0);

  return {
    last,
    rainLastHour,
    rain24h
  };
}

function groupRainByHour(rows) {
  const groups = new Map();

  rows.forEach(row => {
    if (!row.timestamp) return;
    const hourKey = row.timestamp.slice(0, 13);
    const group = groups.get(hourKey) || {
      timestamp: hourKey + ":00:00",
      rain: 0
    };
    group.rain += Number.isFinite(row.rain) ? Math.max(0, row.rain) : 0;
    groups.set(hourKey, group);
  });

  return Array.from(groups.values()).slice(-24);
}

// Grafico a barre degli accumuli orari. I dati originali di Palazzo
// Cavalli sono intervalli da cinque minuti: sommarli per ora rende il
// grafico leggibile sul telefono senza perdere il totale delle 24 ore.
function drawRainChart(canvas, rows) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 320;
  const cssHeight = 220;

  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.height = cssHeight + "px";

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const padding = { top: 16, right: 10, bottom: 36, left: 38 };
  const plotWidth = cssWidth - padding.left - padding.right;
  const plotHeight = cssHeight - padding.top - padding.bottom;
  const values = rows.map(row => Number.isFinite(row.rain) ? row.rain : 0);
  const maxValue = Math.max(1, ...values) * 1.15;
  const gridLines = 4;

  ctx.strokeStyle = "#e6edf3";
  ctx.fillStyle = "#7a8794";
  ctx.font = "11px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let index = 0; index <= gridLines; index++) {
    const value = maxValue / gridLines * index;
    const y = padding.top + plotHeight - value / maxValue * plotHeight;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotWidth, y);
    ctx.stroke();
    ctx.fillText(value < 1 ? value.toFixed(1) : value.toFixed(0), padding.left - 6, y);
  }

  const slotWidth = plotWidth / Math.max(1, rows.length);
  const barWidth = Math.max(3, slotWidth * 0.68);
  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
  gradient.addColorStop(0, "#75b8dc");
  gradient.addColorStop(1, "#3979a7");
  ctx.fillStyle = gradient;

  rows.forEach((row, index) => {
    const height = row.rain / maxValue * plotHeight;
    const x = padding.left + index * slotWidth + (slotWidth - barWidth) / 2;
    const y = padding.top + plotHeight - height;
    ctx.fillRect(x, y, barWidth, Math.max(row.rain > 0 ? 2 : 0, height));
  });

  ctx.fillStyle = "#7a8794";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const tickCount = Math.min(5, rows.length);
  for (let tick = 0; tick < tickCount; tick++) {
    const index = Math.round(tick / Math.max(1, tickCount - 1) * (rows.length - 1));
    const x = padding.left + (index + 0.5) * slotWidth;
    ctx.fillText(formatTime(rows[index].timestamp), x, padding.top + plotHeight + 7);
  }
}

// Formato orario per i timestamp di Misericordia (stesso formato
// "YYYY-MM-DD HH:MM:SS" delle altre tabelle CPSM: riusa formatTime).
function formatMisericordiaTime(timestamp) {
  return formatTime(timestamp);
}

async function openWindChartModal() {
  const options = {
    theme: "wind",
    subtitle: "Misericordia · Comune di Venezia"
  };

  showModal("Vento", "<p>Caricamento dati aggiornati...</p>", options);

  try {

    const rows = await loadMisericordiaTable();

    if (rows.length === 0) {
      throw new Error("Nessun dato disponibile");
    }

    const last = rows[rows.length - 1];
    const speed = Number.isFinite(last.windSpeed) ? last.windSpeed * 3.6 : null;
    const gust = Number.isFinite(last.windGust) ? last.windGust * 3.6 : null;

    const summaryHtml =
      renderPrimaryValues(
        speed != null ? Math.round(speed) + " km/h" : "n.d.",
        gust != null ? "raffica " + Math.round(gust) + " km/h" : null
      ) +
      renderStationReadings([
        renderStationMetric("🧭", "Direzione", Number.isFinite(last.windDir) ? windDirection(last.windDir) + " (" + Math.round(last.windDir) + "°)" : null),
        renderStationMetric("🌬️", "Raffica", gust != null ? Math.round(gust) + " km/h" : null)
      ]);

    const chartHtml = `
<div class="wind-chart-wrap">
  <canvas id="windChartCanvas" role="img" aria-label="Andamento del vento medio, delle raffiche e della direzione a Misericordia"></canvas>
  <div class="wind-chart-legend">
    <span><span class="legend-dot legend-speed"></span> Velocità</span>
    <span><span class="legend-dot legend-gust"></span> Raffica</span>
    <span>➤ Direzione</span>
  </div>
  <p class="wind-chart-caption">Ultime ${rows.length} rilevazioni di Misericordia: vento medio, raffica e direzione.</p>
</div>
`;

    showModal(
      "Vento",
      summaryHtml +
        chartHtml +
        renderUpdatedDetail(formatDateTime(last.timestamp)) +
        renderSourceLink(MISERICORDIA_SOURCE_URL, "Apri la tabella giornaliera del Comune ↗"),
      options
    );

    // Il canvas va disegnato DOPO che showModal ha inserito l'HTML nel
    // DOM (l'elemento non esiste prima di quel momento).
    const canvas = document.getElementById("windChartCanvas");
    if (canvas) {
      drawWindChart(canvas, rows);
    }

  } catch (err) {

    console.error(err);
    showModal(
      "Vento",
      "<p>Errore nel caricamento dei dati. Riprova tra qualche minuto.</p>" +
        renderSourceLink(MISERICORDIA_SOURCE_URL, "Apri la tabella giornaliera del Comune ↗"),
      options
    );
  }
}

async function openRainChartModal() {
  const options = {
    theme: "rain",
    subtitle: "Palazzo Cavalli · Comune di Venezia"
  };

  showModal("Pioggia", "<p>Caricamento dati aggiornati...</p>", options);

  try {
    const rows = await loadPalazzoCavalliTable();
    const summary = summarizeRainRows(rows);
    const hourlyRows = groupRainByHour(rows);
    const lastRain = Number.isFinite(summary.last.rain) ? Math.max(0, summary.last.rain) : null;

    const summaryHtml =
      renderPrimaryValues(
        summary.rainLastHour.toFixed(1) + " mm",
        "nell’ultima ora"
      ) +
      renderStationReadings([
        renderStationMetric("🌧️", "Ultimo intervallo (5 min)", lastRain != null ? lastRain.toFixed(1) + " mm" : null),
        renderStationMetric("☔", "Ultima ora", summary.rainLastHour.toFixed(1) + " mm"),
        renderStationMetric("🌦️", "Ultime 24 ore", summary.rain24h.toFixed(1) + " mm")
      ]);

    const chartHtml = `
<div class="rain-chart-wrap">
  <canvas id="rainChartCanvas" role="img" aria-label="Accumulo orario della pioggia a Palazzo Cavalli nelle ultime 24 ore"></canvas>
  <div class="rain-chart-legend">
    <span><span class="legend-dot legend-rain"></span> Accumulo orario (mm)</span>
  </div>
  <p class="rain-chart-caption">Accumuli orari calcolati sommando le rilevazioni ogni 5 minuti di Palazzo Cavalli.</p>
</div>`;

    showModal(
      "Pioggia",
      summaryHtml +
        chartHtml +
        renderUpdatedDetail(formatDateTime(summary.last.timestamp)) +
        renderSourceLink(PALAZZO_CAVALLI_SOURCE_URL, "Apri la tabella giornaliera del Comune ↗"),
      options
    );

    const canvas = document.getElementById("rainChartCanvas");
    if (canvas) drawRainChart(canvas, hourlyRows);

  } catch (err) {
    console.error(err);
    showModal(
      "Pioggia",
      "<p>Errore nel caricamento dei dati. Riprova tra qualche minuto.</p>" +
        renderSourceLink(PALAZZO_CAVALLI_SOURCE_URL, "Apri la tabella giornaliera del Comune ↗"),
      options
    );
  }
}

function setupInteractions() {

  document.getElementById("mainTempLink").addEventListener("click", openCavanisModal);

  document.getElementById("subCavalli").addEventListener("click", openPalazzoCavalliModal);

  document.getElementById("subPalestra").addEventListener("click", openCannaregioPalestraModal);

  document.getElementById("mareLink").addEventListener("click", openPuntaSaluteModal);

  document.getElementById("subLidoMeteo").addEventListener("click", openLidoMeteoModal);

  document.getElementById("windLine").addEventListener("click", openWindChartModal);

  document.getElementById("rainLine").addEventListener("click", openRainChartModal);

  document.getElementById("modalClose").addEventListener("click", hideModal);

  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") hideModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.getElementById("modalOverlay").classList.contains("open")) {
      hideModal();
    }
  });
}

// Aggiorna le due righe di Lido Meteo (temperatura e umidita') in modo
// indipendente dal resto della pagina: chiamata sia dal flusso
// normale in loadAll() sia dal catch di riserva, cosi' la card mostra
// sempre uno stato definito (mai bloccata su "caricamento...").
function updateLidoMeteoUI(lidoMeteo) {

  // L'ora e' solare (UTC+1) come le altre fonti, ma il formato del
  // timestamp e' diverso (DD/MM/YYYY) quindi usa il suo formattatore
  // dedicato.
  document.getElementById("subLidoMeteo").innerHTML =
    lidoMeteo.available && lidoMeteo.temperature != null
      ? "Lido: " + lidoMeteo.temperature.toFixed(1) +
        " °C (" + formatTimeIsprambiente(lidoMeteo.timestamp) + ")" +
        (lidoMeteo.stale ? ' <span class="stale-warning">⚠️ dati non aggiornati</span>' : "")
      : "Lido: n.d.";

  document.getElementById("humidityLidoMeteo").innerHTML =
    lidoMeteo.available && lidoMeteo.humidity != null
      ? "Lido: " + lidoMeteo.humidity.toFixed(0) +
        " % (" + formatTimeIsprambiente(lidoMeteo.timestamp) + ")" +
        (lidoMeteo.temperature != null
          ? ` <span class="sub-station-extra">&middot; percepiti ${heatIndex(lidoMeteo.temperature, lidoMeteo.humidity).toFixed(1)} °C</span>`
          : "") +
        (lidoMeteo.stale ? ' <span class="stale-warning">⚠️ dati non aggiornati</span>' : "")
      : "Lido: n.d.";
}

function updateCannaregioPalestraUI(palestra) {

  const time = palestra.available && palestra.updatedAt != null
    ? formatEpochTime(palestra.updatedAt)
    : null;
  const timeText = time ? " (" + time + ")" : "";
  const staleText = palestra.stale
    ? ' <span class="stale-warning">⚠️ dati non aggiornati</span>'
    : "";

  document.getElementById("subPalestra").innerHTML =
    palestra.available && palestra.temperature != null
      ? "S. Alvise: " + palestra.temperature.toFixed(1) +
        " °C" + timeText + staleText
      : "S. Alvise: n.d.";

  document.getElementById("humidityPalestra").innerHTML =
    palestra.available && palestra.humidity != null
      ? "S. Alvise: " + palestra.humidity.toFixed(0) +
        " %" + timeText +
        (palestra.temperature != null
          ? ` <span class="sub-station-extra">&middot; percepiti ${heatIndex(palestra.temperature, palestra.humidity).toFixed(1)} °C</span>`
          : "") +
        staleText
      : "S. Alvise: n.d.";
}

async function loadAll() {

  document.getElementById("status").innerHTML = "Caricamento...";

  try {

    // Tutte le stazioni vengono interrogate in parallelo invece che in
    // sequenza, per velocizzare il caricamento della pagina.
    // misericordiaWind non lancia mai eccezioni (vedi commento sulla
    // funzione): un problema con questa fonte non puo' bloccare le
    // altre card.
    //
    // Lido Meteo NON e' incluso qui di proposito: dipende da proxy
    // esterni che si sono gia' dimostrati inaffidabili in pratica
    // (vedi commenti su loadLidoMeteo). Anche con il timeout interno a
    // quella funzione, tenerlo fuori dal Promise.all principale
    // garantisce che il resto dell'app si carichi sempre a prescindere
    // da cosa succede con quella singola fonte: viene avviato subito
    // sotto, in parallelo ma non atteso qui, e aggiorna le sue due
    // righe (temperatura e umidita') in modo indipendente quando
    // arriva un risultato.
    loadLidoMeteo()
      .then(updateLidoMeteoUI)
      .catch(err => {
        console.warn("Lido Meteo: errore imprevisto, mostro n.d.", err);
        updateLidoMeteoUI({ available: false });
      });

    loadCannaregioPalestra()
      .then(updateCannaregioPalestraUI)
      .catch(err => {
        console.warn("S. Alvise: dati non disponibili", err);
        updateCannaregioPalestraUI({ available: false, stale: false });
      });

    const [cavalli, cavanis, puntaSalute, misericordiaWind] = await Promise.all([
      loadPalazzoCavalli(),
      loadCavanis().catch(err => {
        // Cavanis non deve mai impedire il caricamento delle altre card.
        // Se sia il Worker sia ARPA falliscono, temperatura e umidita'
        // usano temporaneamente Palazzo Cavalli come fonte principale.
        console.warn("Cavanis non disponibile, uso Palazzo Cavalli:", err);
        return null;
      }),
      loadTide(),
      loadMisericordiaWind()
    ]);

    const thermalSource = cavanis || {
      timestamp: cavalli.timestamp,
      temperature: cavalli.temperature,
      humidity: cavalli.humidity,
      radiation: cavalli.radiation,
      radiationTimestamp: cavalli.timestamp
    };

    // --- Card 1: temperatura, Cavanis come stazione principale ---

    document.getElementById("temp").innerHTML =
      thermalSource.temperature.toFixed(1) + " °C";

    document.getElementById("tempStation").innerHTML =
      (cavanis ? "Osservatorio Cavanis" : "Palazzo Cavalli &middot; Cavanis n.d.") +
      " &middot; 🕐 " + formatTime(thermalSource.timestamp);

    document.getElementById("subCavalli").innerHTML =
      cavanis
        ? "Palazzo Cavalli: " + cavalli.temperature.toFixed(1) +
          " °C (" + formatTime(cavalli.timestamp) + ")"
        : "Osservatorio Cavanis: n.d.";

    // --- Card 2: umidita' e temperatura percepita (da Cavanis) ---

    document.getElementById("humidity").innerHTML =
      thermalSource.humidity.toFixed(0) + " %";

    const hi = heatIndex(thermalSource.temperature, thermalSource.humidity);

    document.getElementById("heatIndex").innerHTML =
      hi.toFixed(1) + " °C";

    const STALE_MINUTES = 30;

    // Il calcolo "al sole" e' isolato in un try/catch dedicato: se per
    // qualsiasi motivo imprevisto va in errore (es. un caso limite nei
    // dati non ancora visto), "al sole" torna semplicemente uguale ad
    // "all'ombra" invece di bloccare il caricamento di tutto il resto
    // della pagina (mare, vento, pioggia, pressione).
    let thsw = hi;

    try {

      const radiationFresh =
        thermalSource.radiationTimestamp != null &&
        minutesBetween(thermalSource.timestamp, thermalSource.radiationTimestamp) <= STALE_MINUTES;

      thsw = apparentTemperatureSun(
        thermalSource.temperature,
        thermalSource.humidity,
        radiationFresh ? thermalSource.radiation : null,
        radiationFresh ? thermalSource.radiationTimestamp : null
      );

      if (thsw == null || isNaN(thsw)) {
        thsw = hi;
      }

    } catch (thswError) {
      console.error("Errore nel calcolo dell'indice al sole, uso il valore all'ombra:", thswError);
    }

    document.getElementById("thsw").innerHTML =
      thsw.toFixed(1) + " °C";

    document.getElementById("humidityStation").innerHTML =
      (cavanis ? "Osservatorio Cavanis" : "Palazzo Cavalli &middot; Cavanis n.d.") +
      " &middot; 🕐 " + formatTime(thermalSource.timestamp);

    document.getElementById("humidityCavalli").innerHTML =
      cavanis
        ? `Palazzo Cavalli: ${cavalli.humidity.toFixed(0)} % (${formatTime(cavalli.timestamp)}) <span class="sub-station-extra">&middot; percepiti ${heatIndex(cavalli.temperature, cavalli.humidity).toFixed(1)} °C</span>`
        : "Osservatorio Cavanis: n.d.";

    // humidityLidoMeteo e humidityPalestra vengono aggiornati dai
    // rispettivi caricamenti indipendenti (vedi commenti sopra).

    // --- Card 3: mare ---

    document.getElementById("tide").innerHTML =
      puntaSalute.tide + " cm " + puntaSalute.trend;

    document.getElementById("waterTemp").innerHTML =
      puntaSalute.waterTemp != null
        ? puntaSalute.waterTemp.toFixed(1) + " °C"
        : "n.d.";

    document.getElementById("tideInfo").innerHTML =
      formatTime(puntaSalute.timestamp) + " &middot; " + puntaSalute.source;

    // --- Card 4: vento (Misericordia), pioggia, pressione ---

    // Vento preso da Misericordia invece che da Cavanis (ARPA): piu'
    // vicina a casa dell'utente. La tabella ufficiale CPSM espone la
    // velocita' in m/s; nella card viene convertita in km/h.
    document.getElementById("wind").innerHTML =
      misericordiaWind.available
        ? (misericordiaWind.windDir != null && !isNaN(misericordiaWind.windDir)
            ? windDirection(misericordiaWind.windDir) + " "
            : "") +
          (misericordiaWind.windSpeed != null && !isNaN(misericordiaWind.windSpeed)
            ? Math.round(misericordiaWind.windSpeed * 3.6) + " km/h"
            : "n.d.")
        : "n.d.";

    const rainHourText =
      cavalli.rainLastHour != null && !isNaN(cavalli.rainLastHour)
        ? cavalli.rainLastHour.toFixed(1) + " mm/h"
        : "n.d.";

    const rain24hText =
      cavalli.rain24h != null && !isNaN(cavalli.rain24h)
        ? cavalli.rain24h.toFixed(1) + " mm/24h"
        : "n.d.";

    document.getElementById("rain").innerHTML =
      rainHourText + " &middot; " + rain24hText;

    document.getElementById("pressure").innerHTML =
      cavalli.pressure.toFixed(1) + " hPa";

    document.getElementById("airTime").innerHTML =
      formatTime(cavalli.timestamp);

    const now = new Date();

    document.getElementById("status").innerHTML =
      "Aggiornato alle " +
      now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) +
      (cavanis ? "" : " &middot; Cavanis non disponibile") +
      " &middot; " + APP_VERSION;

  } catch (error) {

    console.error(error);

    document.getElementById("status").innerHTML =
      "Errore caricamento dati &middot; " + APP_VERSION;
  }
}

/* ============================================================
   ANTEPRIMA PREVISIONI DI OGGI + AVVISO ALLARME IN HOME
   Usa previsioni-data.js (lo stesso modulo dati di previsioni.html)
   per mostrare qui la sintesi di oggi nella scheda "Previsioni della
   settimana" e, se per oggi risulta un allarme (temporale forte,
   nebbia persistente o acqua alta), un piccolo avviso sopra le card
   delle stazioni.
   Tenuta fuori dal Promise.all principale, stesso principio di Lido
   Meteo: scarica 3 modelli meteo e la marea, più lenta delle altre
   fonti, e non deve ritardare il resto della dashboard. */

const ICONE_PREVISIONI_HOME = {
  sun: "☀️", partly: "🌤️", cloud: "☁️", rain: "🌧️",
  storm: "⛈️", snow: "❄️", fog: "🌫️"
};

const CATEGORIA_TESTO_HOME = {
  sun: "Sereno", partly: "Poco nuvoloso", cloud: "Nuvoloso",
  rain: "Pioggia", storm: "Temporale", snow: "Neve", fog: "Nebbia"
};

function updatePrevisioniPreviewUI(fascia, oggi) {
  const icona = document.getElementById("previsioniIcon");
  const fasciaLabel = document.getElementById("previsioniFascia");
  const temp = document.getElementById("previsioniTemp");
  const categoria = document.getElementById("previsioniCategoria");
  const extra = document.getElementById("previsioniExtra");

  if (!fascia || !fascia.sintesi) {
    icona.textContent = "📅";
    fasciaLabel.textContent = "";
    temp.textContent = "Previsioni non disponibili";
    categoria.textContent = "";
    extra.textContent = "";
    return;
  }

  const s = fascia.sintesi;

  icona.textContent = ICONE_PREVISIONI_HOME[s.categoria] || "📅";
  fasciaLabel.textContent = fascia.label;
  temp.textContent = s.temp != null ? Math.round(s.temp) + "°" : "—";
  categoria.textContent = CATEGORIA_TESTO_HOME[s.categoria] || "—";

  // Dato di riempimento: un solo elemento, quello più rilevante in
  // questo momento. Priorita': acqua alta (se prevista sopra soglia
  // in questa fascia) > pioggia (solo se prevista, in mm) > umidita'
  // (sempre disponibile, usata come ripiego).
  if (fascia.allarmi && fascia.allarmi.acquaAlta && oggi && oggi.mareaMassima != null) {
    extra.textContent = `🌊 Picco marea previsto: ${oggi.mareaMassima} cm`;
  } else if (s.precip != null && s.precip > 0) {
    extra.textContent = `🌧️ ${s.precip} mm attesi`;
  } else if (s.umidita != null) {
    extra.textContent = `💧 Umidità ${s.umidita}%`;
  } else {
    extra.textContent = "";
  }
}

function updateAllarmeUI(oggi) {
  const el = document.getElementById("allarmeMeteo");

  if (!oggi || !oggi.allarmi) {
    el.style.display = "none";
    return;
  }

  const messaggi = [];
  if (oggi.allarmi.temporaleForte) {
    messaggi.push("⚡ Temporale forte previsto oggi");
  }
  if (oggi.allarmi.nebbiaPersistente) {
    messaggi.push("🌫️ Nebbia persistente prevista oggi");
  }
  if (oggi.allarmi.acquaAlta) {
    const cm = oggi.mareaMassima != null ? ` · ${oggi.mareaMassima} cm` : "";
    messaggi.push("🌊 Acqua alta prevista oggi" + cm);
  }

  if (messaggi.length === 0) {
    el.style.display = "none";
    return;
  }

  el.innerHTML = messaggi.join(" &middot; ");
  el.style.display = "block";
}

async function loadPrevisioniPreview() {
  try {
    const previsioni = await PrevisioniData.ottieniPrevisioni();
    const oggi = previsioni.riepilogoGiorni.find((g) => g.data === previsioni.oggiStr);

    // Fascia oraria corrente (notte/mattina/pomeriggio/sera), stessa
    // suddivisione usata in previsioni.html: la home mostra "adesso"
    // invece del riepilogo dell'intera giornata, per restare coerente
    // con lo spirito "tempo reale" del resto della dashboard.
    const oraAttuale = new Date().getHours();
    const fasciaOraria = PrevisioniData.FASCE_ORARIE.find(
      (f) => oraAttuale >= f.oreInizio && oraAttuale < f.oreFine
    );
    const fasciaAttuale = oggi && fasciaOraria
      ? oggi.fasceGiorno.find((f) => f.fascia === fasciaOraria.id)
      : null;

    updatePrevisioniPreviewUI(fasciaAttuale, oggi);
    updateAllarmeUI(oggi);

  } catch (err) {
    console.warn("Anteprima previsioni non disponibile:", err);
    updatePrevisioniPreviewUI(null, null);
    updateAllarmeUI(null);
  }
}

setupInteractions();
loadStationsConfig();
loadAll();
loadPrevisioniPreview();

// Registra il service worker per rendere la pagina installabile come
// app (PWA): l'icona in home, l'apertura a schermo intero e l'avvio
// piu' rapido funzionano solo se questo va a buon fine.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((registration) => {

        // Il browser controlla se sw.js e' cambiato solo periodicamente
        // (anche una volta al giorno): forziamo un controllo subito ad
        // ogni apertura, invece di aspettare quel ciclo automatico.
        registration.update();

        // Quando l'app installata (icona in home) torna in primo piano
        // dopo essere stata in background, spesso Android/Chrome si
        // limita a riattivare l'istanza gia' in memoria senza un vero
        // evento "load": senza questo, il controllo aggiornamento
        // sopra non scatterebbe mai in quei casi, e la PWA potrebbe
        // restare indietro finche' non viene chiusa e riaperta da zero
        // (o aperta nello stesso browser da una scheda normale).
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update();
          }
        });

        // Quando viene rilevata e attivata una versione piu' recente
        // del service worker durante questa sessione, ricarica la
        // pagina una volta sola cosi' l'aggiornamento si vede subito,
        // senza dover cancellare manualmente la cache dal telefono.
        let alreadyReloaded = false;

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (alreadyReloaded) return;
          alreadyReloaded = true;
          window.location.reload();
        });
      })
      .catch((err) => console.warn("Service worker non registrato:", err));
  });
}

// Pulsante "Forza aggiornamento app": rete di sicurezza per i casi in
// cui l'app installata (icona in home) resta indietro nonostante i
// controlli automatici sopra - un problema noto delle PWA su Android,
// dove il sistema puo' ritardare l'aggiornamento del service worker
// indipendentemente da cosa fa questo codice. A differenza del
// normale ciclo di aggiornamento (che aspetta una nuova versione),
// questo cancella TUTTO incondizionatamente (service worker + cache)
// e ricarica da zero, cosi' funziona anche se per qualche motivo il
// controllo automatico non ha mai rilevato la nuova versione.
document.getElementById("forceUpdateLink").addEventListener("click", async () => {

  const link = document.getElementById("forceUpdateLink");
  link.textContent = "🔄 Aggiornamento in corso...";

  try {

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

  } catch (err) {
    console.warn("Errore durante la pulizia forzata:", err);
  }

  // NON si usa location.reload(true): il parametro booleano che un
  // tempo forzava il bypass della cache e' ormai ignorato dai browser
  // moderni (bug reale riscontrato il 22/08/2026, serviva cancellare
  // la cache di Chrome a mano per vedere gli aggiornamenti). Invece,
  // si naviga verso un indirizzo con un numero casuale in coda: essendo
  // un indirizzo mai visto prima, il browser non ha alcuna copia in
  // cache a cui appoggiarsi e deve per forza richiederlo alla rete.
  window.location.href =
    window.location.pathname + "?forceupdate=" + Date.now();
});
