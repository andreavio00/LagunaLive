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

function windDirection(deg) {

  const dirs = [
    "N", "NE", "E", "SE",
    "S", "SO", "O", "NO"
  ];

  return dirs[Math.round(deg / 45) % 8];
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

// Le tabelle delle stazioni CPSM non hanno una riga di intestazione
// testuale: sono solo righe di dati ripetute. Per la "scheda" prendiamo
// quindi solo l'ULTIMA riga (il dato piu' recente) e la abbiniamo alle
// etichette note per quella stazione, invece di mostrare piu' righe di
// dati che confonderebbero l'utente.
function parseLastRowLabeled(text, labels) {

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

  return cells.map((value, i) => ({
    label: labels[i] || ("Colonna " + (i + 1)),
    value: value !== "" ? value : "n.d."
  }));
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

  const tempRows =
    data.filter(r => r.tipo === "TARIA2M");

  const humidityRows =
    data.filter(r => r.tipo === "UMID2M");

  const lastTemp = tempRows[tempRows.length - 1];
  const lastHumidity = humidityRows[humidityRows.length - 1];

  return {
    timestamp: lastTemp.dataora,
    temperature: parseFloat(lastTemp.valore),
    humidity: parseFloat(lastHumidity.valore)
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

  document.getElementById("stationsStatus").innerHTML =
    config.stations
      .map(station => "✓ " + station.name)
      .join("<br>");
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

async function openStationModal(title, url, labels) {

  showModal(title, "<p>Caricamento dati aggiornati...</p>");

  try {

    const response = await fetch(url);
    const text = await response.text();

    const rows = parseLastRowLabeled(text, labels);

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
    showModal(title, "<p>Errore nel caricamento dei dati.</p>");
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

    document.getElementById("humidityStation").innerHTML =
      "Osservatorio Cavanis &middot; " + formatTime(cavanis.timestamp);

    document.getElementById("humidityDetails").innerHTML = `
<div class="details">
  <div>Palazzo Cavalli: ${cavalli.humidity.toFixed(0)} % (${formatTime(cavalli.timestamp)})</div>
  <div>San Giorgio: ${sanGiorgio.humidity.toFixed(0)} % (${formatTime(sanGiorgio.timestamp)})</div>
</div>
`;

    // --- Card 3: mare ---

    document.getElementById("tide").innerHTML =
      puntaSalute.tide + " cm " + puntaSalute.trend;

    document.getElementById("waterTemp").innerHTML =
      puntaSalute.waterTemp != null
        ? puntaSalute.waterTemp.toFixed(1) + " °C"
        : "n.d.";

    document.getElementById("tideSource").innerHTML =
      puntaSalute.source;

    document.getElementById("tideTime").innerHTML =
      formatTime(puntaSalute.timestamp);

    // --- Card 4: vento, pioggia, pressione ---

    document.getElementById("wind").innerHTML =
      windDirection(sanGiorgio.windDir) +
      " " +
      Math.round(sanGiorgio.windSpeed * 3.6) +
      " km/h";

    document.getElementById("rain").innerHTML =
      cavalli.rain != null && !isNaN(cavalli.rain)
        ? cavalli.rain.toFixed(1) + " mm"
        : "n.d.";

    document.getElementById("pressure").innerHTML =
      cavalli.pressure.toFixed(1) + " hPa";

    document.getElementById("airTime").innerHTML =
      formatTime(cavalli.timestamp);

    document.getElementById("status").innerHTML = "";

  } catch (error) {

    console.error(error);

    document.getElementById("status").innerHTML =
      "Errore caricamento dati";
  }
}

setupInteractions();
loadStationsConfig();
loadAll();
