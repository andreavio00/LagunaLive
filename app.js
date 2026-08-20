// Numero di versione mostrato accanto all'orario di aggiornamento in
// fondo alla pagina. Da allineare manualmente al numero della cache
// in sw.js (CACHE_NAME) quando si rilascia una nuova versione, cosi'
// i due numeri restano sempre coerenti tra loro.
const APP_VERSION = "v2.24";

const CAVANIS_URL =
  "https://www.meteonetwork.eu/it/weather-station/vnt375-stazione-meteorologica-di-osservatorio-cavanis-venezia";

const PALAZZO_CAVALLI_URL =
  "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Palazzo_Cavalli.html";

const SAN_GIORGIO_URL =
  "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/San_Giorgio.html";

const PUNTA_SALUTE_URL =
  "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Punta_Salute.html";

const MISERICORDIA_URL =
  "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Misericordia.html";

const CAVANIS_API_URL =
  "https://api.arpa.veneto.it/REST/v1/meteo_meteogrammi_tabella?codseqst=300000154";

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

// Etichette non verificate direttamente sul sito (nessuno screenshot
// di riferimento come per Cavalli/San Giorgio/Punta Salute): se
// l'ordine reale delle colonne fosse diverso, le colonne in eccesso
// compariranno comunque come "Colonna N" invece di rompere la scheda.
const MISERICORDIA_LABELS = [
  "Data/Ora",
  "Marea (m)"
];

const STATION_LABELS = {
  punta_salute: PUNTA_SALUTE_LABELS,
  misericordia: MISERICORDIA_LABELS,
  palazzo_cavalli: PALAZZO_CAVALLI_LABELS,
  san_giorgio: SAN_GIORGIO_LABELS
};

// Colonne verificate direttamente su uno screenshot della scheda reale.
// Per le stazioni non verificate (Misericordia) nascondiamo le
// colonne extra invece di etichettarle genericamente "Colonna N", che
// non da' nessuna informazione utile.
const STATION_LABELS_VERIFIED = {
  punta_salute: true,
  misericordia: false,
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
    -42.379 +
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
function parseLastRowLabeled(text, labels, showUnknown = true) {

  const dataLines = text
    .split("\n")
    .filter(line => /^\|\s*\d{4}-\d{2}-\d{2}/.test(line));

  if (dataLines.length === 0) {
    return null;
  }

  const lastRow = dataLines[dataLines.length - 1];

  const cells = lastRow
    .split("|")
    .map(c => c.trim())
    .filter((c, idx, arr) => {
      if (idx === 0 && c === "") return false;
      if (idx === arr.length - 1 && c === "") return false;
      return true;
    });

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

async function loadPalazzoCavalli() {

  const response = await fetch(PALAZZO_CAVALLI_URL);
  const text = await response.text();

  const rows = text
    .split("\n")
    .filter(line => line.startsWith("| 2026-"));

  const parsedRows = rows.map(line => {

    const cols = line.split("|").map(x => x.trim());

    return {
      timestamp: cols[1],
      pressure: parseFloat(cols[2]),
      temperature: parseFloat(cols[3]),
      humidity: parseFloat(cols[4]),
      radiation: parseFloat(cols[5]),
      rain: parseFloat(cols[6])
    };
  });

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

  const response = await fetch(SAN_GIORGIO_URL);
  const text = await response.text();

  const rows = text
    .split("\n")
    .filter(line => line.startsWith("| 2026-"));

  const lastRow = rows[rows.length - 1];

  const cols = lastRow
    .split("|")
    .map(x => x.trim());

  return {
    timestamp: cols[1],
    windDir: parseFloat(cols[2]),
    windSpeed: parseFloat(cols[3]),
    windGust: parseFloat(cols[4]),
    temperature: parseFloat(cols[5]),
    humidity: parseFloat(cols[6])
  };
}

async function loadCavanis() {

  const response = await fetch(CAVANIS_API_URL);
  const json = await response.json();

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

async function loadPuntaSalute() {

  const response = await fetch(PUNTA_SALUTE_URL);
  const text = await response.text();

  const rows = text
    .split("\n")
    .filter(line => line.startsWith("| 2026-"));

  const lastRow = rows[rows.length - 1];
  const previousRow = rows[rows.length - 3];

  const cols = lastRow
    .split("|")
    .map(x => x.trim());

  const prevCols = previousRow
    .split("|")
    .map(x => x.trim());

  const tide = Math.round(parseFloat(cols[2]) * 100);
  const prevTide = Math.round(parseFloat(prevCols[2]) * 100);

  let trend = "→";

  if (tide > prevTide) trend = "↑";
  if (tide < prevTide) trend = "↓";

  return {
    timestamp: cols[1],
    tide,
    trend,
    waterTemp: parseFloat(cols[3])
  };
}

async function loadMisericordia() {

  const response = await fetch(MISERICORDIA_URL);
  const text = await response.text();

  const rows = text
    .split("\n")
    .filter(line => line.startsWith("| 2026-"));

  const lastRow = rows[rows.length - 1];
  const previousRow = rows[rows.length - 3];

  const cols = lastRow
    .split("|")
    .map(x => x.trim());

  const prevCols = previousRow
    .split("|")
    .map(x => x.trim());

  const tide = Math.round(parseFloat(cols[2]) * 100);
  const prevTide = Math.round(parseFloat(prevCols[2]) * 100);

  let trend = "→";

  if (tide > prevTide) trend = "↑";
  if (tide < prevTide) trend = "↓";

  return {
    timestamp: cols[1],
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

      // Nota: la card principale in alto (temperatura) continua a
      // linkare la pagina Meteonetwork tramite mainTempLink. Qui,
      // nella lista delle stazioni, si mostra invece una scheda con
      // i dati grezzi dell'API ARPA, come per le altre stazioni.
      if (station.type === "meteonetwork") {
        openCavanisModal();
        return;
      }

      if (station.url) {
        const labels = STATION_LABELS[station.id] || ["Data/Ora"];
        const verified = STATION_LABELS_VERIFIED[station.id] !== false;
        openStationModal(station.name, "https://r.jina.ai/" + station.url, labels, verified);
      }
    });

    container.appendChild(row);
  });
}

// --- Modale "scheda" stazione ---

function showModal(title, bodyHtml) {

  document.getElementById("modalTitle").innerHTML = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modalOverlay").classList.add("open");
}

function hideModal() {
  document.getElementById("modalOverlay").classList.remove("open");
}

async function openStationModal(title, url, labels, showUnknown = true) {

  showModal(title, "<p>Caricamento dati aggiornati...</p>");

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

    showModal(title, html);

  } catch (err) {

    console.error(err);
    showModal(title, "<p>Errore nel caricamento dei dati. Riprova tra qualche minuto: se il problema persiste, la stazione potrebbe essere temporaneamente offline sul sito del Comune.</p>");
  }
}

// Scheda dati ARPA per Osservatorio Cavanis, usata dalla lista
// "Stazioni utilizzate" in fondo alla pagina. La card principale in
// alto (temperatura) continua invece a linkare la pagina Meteonetwork
// tramite mainTempLink/CAVANIS_URL: qui si tratta di una scheda
// separata, coerente nello stile con le altre stazioni della lista
// (Palazzo Cavalli, San Giorgio, Punta della Salute), ma con dati
// presi dall'API ARPA invece che dalle pagine del Comune.
async function openCavanisModal() {

  showModal("Osservatorio Cavanis", "<p>Caricamento dati aggiornati...</p>");

  try {

    const cavanis = await loadCavanis();

    const rows = [
      { label: "Temperatura", value: cavanis.temperature != null ? cavanis.temperature.toFixed(1) + " °C" : "n.d." },
      { label: "Umidità", value: cavanis.humidity != null ? cavanis.humidity.toFixed(0) + " %" : "n.d." },
      {
        label: "Vento",
        value:
          (cavanis.windDir != null && !isNaN(cavanis.windDir) ? windDirection(cavanis.windDir) + " " : "") +
          (cavanis.windSpeed != null && !isNaN(cavanis.windSpeed) ? Math.round(cavanis.windSpeed * 3.6) + " km/h" : "n.d.")
      },
      { label: "Radiazione solare", value: cavanis.radiation != null ? Math.round(cavanis.radiation) + " W/mq" : "n.d." },
      { label: "Pioggia", value: cavanis.rain != null ? cavanis.rain.toFixed(1) + " mm" : "n.d." },
      { label: "Aggiornato", value: formatTime(cavanis.timestamp) }
    ];

    const html = rows
      .map(r =>
        `<div class="modal-row"><span class="modal-label">${r.label}</span><span class="modal-value">${r.value}</span></div>`
      )
      .join("");

    showModal("Osservatorio Cavanis", html);

  } catch (err) {

    console.error(err);
    showModal("Osservatorio Cavanis", "<p>Errore nel caricamento dei dati. Riprova tra qualche minuto: se il problema persiste, l'API ARPA potrebbe essere temporaneamente offline.</p>");
  }
}

function setupInteractions() {

  document.getElementById("mainTempLink").addEventListener("click", () => {
    window.open(CAVANIS_URL, "_blank");
  });

  document.getElementById("subCavalli").addEventListener("click", () => {
    openStationModal("Palazzo Cavalli", PALAZZO_CAVALLI_URL, PALAZZO_CAVALLI_LABELS);
  });

  document.getElementById("subSanGiorgio").addEventListener("click", () => {
    openStationModal("San Giorgio", SAN_GIORGIO_URL, SAN_GIORGIO_LABELS);
  });

  document.getElementById("mareLink").addEventListener("click", () => {
    openStationModal("Punta della Dogana (Punta Salute)", PUNTA_SALUTE_URL, PUNTA_SALUTE_LABELS);
  });

  document.getElementById("modalClose").addEventListener("click", hideModal);

  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") hideModal();
  });
}

async function loadAll() {

  document.getElementById("status").innerHTML = "Caricamento...";

  try {

    // Tutte le stazioni vengono interrogate in parallelo invece che in
    // sequenza, per velocizzare il caricamento della pagina.
    const [cavalli, sanGiorgio, cavanis, puntaSalute] = await Promise.all([
      loadPalazzoCavalli(),
      loadSanGiorgio(),
      loadCavanis(),
      loadTide()
    ]);

    // --- Card 1: temperatura, Cavanis come stazione principale ---

    document.getElementById("temp").innerHTML =
      cavanis.temperature.toFixed(1) + " °C";

    document.getElementById("tempStation").innerHTML =
      "Osservatorio Cavanis &middot; 🕐 " + formatTime(cavanis.timestamp);

    document.getElementById("subCavalli").innerHTML =
      "Palazzo Cavalli: " + cavalli.temperature.toFixed(1) +
      " °C (" + formatTime(cavalli.timestamp) + ")";

    document.getElementById("subSanGiorgio").innerHTML =
      "San Giorgio: " + sanGiorgio.temperature.toFixed(1) +
      " °C (" + formatTime(sanGiorgio.timestamp) + ")";

    // --- Card 2: umidita' e temperatura percepita (da Cavanis) ---

    document.getElementById("humidity").innerHTML =
      cavanis.humidity.toFixed(0) + " %";

    const hi = heatIndex(cavanis.temperature, cavanis.humidity);

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
        cavanis.radiationTimestamp != null &&
        minutesBetween(cavanis.timestamp, cavanis.radiationTimestamp) <= STALE_MINUTES;

      thsw = apparentTemperatureSun(
        cavanis.temperature,
        cavanis.humidity,
        radiationFresh ? cavanis.radiation : null,
        radiationFresh ? cavanis.radiationTimestamp : null
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
      "Osservatorio Cavanis &middot; 🕐 " + formatTime(cavanis.timestamp);

    document.getElementById("humidityDetails").innerHTML = `
<div class="sub-station">Palazzo Cavalli: ${cavalli.humidity.toFixed(0)} % (${formatTime(cavalli.timestamp)}) <span class="sub-station-extra">&middot; percepiti ${heatIndex(cavalli.temperature, cavalli.humidity).toFixed(1)} °C</span></div>
<div class="sub-station">San Giorgio: ${sanGiorgio.humidity.toFixed(0)} % (${formatTime(sanGiorgio.timestamp)}) <span class="sub-station-extra">&middot; percepiti ${heatIndex(sanGiorgio.temperature, sanGiorgio.humidity).toFixed(1)} °C</span></div>
`;

    // --- Card 3: mare ---

    document.getElementById("tide").innerHTML =
      puntaSalute.tide + " cm " + puntaSalute.trend;

    document.getElementById("waterTemp").innerHTML =
      puntaSalute.waterTemp != null
        ? puntaSalute.waterTemp.toFixed(1) + " °C"
        : "n.d.";

    document.getElementById("tideInfo").innerHTML =
      formatTime(puntaSalute.timestamp) + " &middot; " + puntaSalute.source;

    // --- Card 4: vento, pioggia, pressione ---

    // cavanis.windSpeed arriva dall'API ARPA in m/s (confermato dal
    // campo "unitnm":"m/s" nella risposta JSON grezza): va convertito
    // in km/h per la visualizzazione.
    document.getElementById("wind").innerHTML =
      (cavanis.windDir != null && !isNaN(cavanis.windDir)
        ? windDirection(cavanis.windDir) + " "
        : "") +
      (cavanis.windSpeed != null && !isNaN(cavanis.windSpeed)
        ? Math.round(cavanis.windSpeed * 3.6) + " km/h"
        : "n.d.");

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
      " &middot; " + APP_VERSION;

  } catch (error) {

    console.error(error);

    document.getElementById("status").innerHTML =
      "Errore caricamento dati &middot; " + APP_VERSION;
  }
}

setupInteractions();
loadStationsConfig();
loadAll();

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

  // Il "true" forza il browser a ignorare qualsiasi copia in cache
  // anche per il ricaricamento stesso della pagina HTML.
  window.location.reload(true);
});
