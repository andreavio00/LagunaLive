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

  if (tempC < 27 || humidity == null || isNaN(humidity)) {
    return tempC;
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

  return (HI - 32) * 5 / 9; // torna in Celsius
}

// Temperatura percepita "al sole". Il THSW di Davis Instruments e'
// una formula proprietaria che il produttore non ha mai reso
// pubblica, quindi non e' riproducibile esattamente.
//
// Versione precedente (sbagliata): calcolava "al sole" con la formula
// dell'Apparent Temperature di Steadman per intero, come valore
// assoluto indipendente. Il problema e' che quella formula e l'indice
// di calore "all'ombra" (Rothfusz) sono due formule diverse, con basi
// di calcolo diverse: potevano quindi benissimo dare "al sole" piu'
// basso di "all'ombra" anche in pieno giorno, senza che ci fosse
// nessuna vera incoerenza fisica nei dati - solo due formule scollegate.
//
// Versione corretta: "al sole" parte sempre dal valore "all'ombra" e
// ci aggiunge solo l'effetto aggiuntivo del sole (mai negativo). Cosi'
// "al sole" e' garantito essere sempre >= "all'ombra", e i due
// coincidono quando non c'e' radiazione solare (es. di notte), come
// ci si aspetta.
//
// L'effetto aggiuntivo del sole e' preso dal termine solare della
// stessa Apparent Temperature di Steadman (1994) usata dal Bureau of
// Meteorology australiano: 0.70 * radiazione / (vento + 10). La
// radiazione va limitata a un intervallo fisico ragionevole, altrimenti
// con vento vicino a zero il termine esplode: usiamo lo stesso limite
// che Davis documenta per il termine "sole" del proprio indice (fino a
// +130 W/mq).
function apparentTemperatureSun(tempC, humidity, windSpeedMs, solarRadiation) {

  const hi = heatIndex(tempC, humidity);

  if (
    solarRadiation == null || isNaN(solarRadiation) ||
    windSpeedMs == null || isNaN(windSpeedMs)
  ) {
    return hi;
  }

  const Q = Math.max(0, Math.min(130, solarRadiation));
  const solarBoost = 0.70 * (Q / (windSpeedMs + 10));

  return hi + solarBoost;
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

    rows.push({
      label: labels[i] || ("Colonna " + (i + 1)),
      value: i === 0
        ? (value !== "" ? formatDateTime(value) : "n.d.")
        : (value !== "" ? value : "n.d.")
    });
  });

  return rows;
}

async function loadPalazzoCavalli() {

  const response = await fetch(PALAZZO_CAVALLI_URL);
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
    pressure: parseFloat(cols[2]),
    temperature: parseFloat(cols[3]),
    humidity: parseFloat(cols[4]),
    radiation: parseFloat(cols[5]),
    rain: parseFloat(cols[6])
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

      if (station.type === "meteonetwork") {
        window.open(CAVANIS_URL, "_blank");
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
      "Osservatorio Cavanis &middot; " + formatTime(cavanis.timestamp);

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

    const windFresh =
      cavanis.windSpeedTimestamp != null &&
      minutesBetween(cavanis.timestamp, cavanis.windSpeedTimestamp) <= STALE_MINUTES;

    const radiationFresh =
      cavanis.radiationTimestamp != null &&
      minutesBetween(cavanis.timestamp, cavanis.radiationTimestamp) <= STALE_MINUTES;

    const thsw = apparentTemperatureSun(
      cavanis.temperature,
      cavanis.humidity,
      windFresh ? cavanis.windSpeed : null,
      radiationFresh ? cavanis.radiation : null
    );

    document.getElementById("thsw").innerHTML =
      thsw.toFixed(1) + " °C";

    document.getElementById("humidityStation").innerHTML =
      "Osservatorio Cavanis &middot; " + formatTime(cavanis.timestamp);

    document.getElementById("humidityDetails").innerHTML = `
<div class="sub-station">Palazzo Cavalli: ${cavalli.humidity.toFixed(0)} % (${formatTime(cavalli.timestamp)})</div>
<div class="sub-station">San Giorgio: ${sanGiorgio.humidity.toFixed(0)} % (${formatTime(sanGiorgio.timestamp)})</div>
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

    document.getElementById("wind").innerHTML =
      (cavanis.windDir != null && !isNaN(cavanis.windDir)
        ? windDirection(cavanis.windDir) + " "
        : "") +
      (cavanis.windSpeed != null && !isNaN(cavanis.windSpeed)
        ? Math.round(cavanis.windSpeed * 3.6) + " km/h"
        : "n.d.");

    document.getElementById("rain").innerHTML =
      cavanis.rain != null && !isNaN(cavanis.rain)
        ? cavanis.rain.toFixed(1) + " mm"
        : "n.d.";

    document.getElementById("pressure").innerHTML =
      cavalli.pressure.toFixed(1) + " hPa";

    document.getElementById("airTime").innerHTML =
      formatTime(cavalli.timestamp);

    const now = new Date();

    document.getElementById("status").innerHTML =
      "Aggiornato alle " +
      now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  } catch (error) {

    console.error(error);

    document.getElementById("status").innerHTML =
      "Errore caricamento dati";
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
      .catch((err) => console.warn("Service worker non registrato:", err));
  });
}
