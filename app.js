function median(values) {
  values.sort((a, b) => a - b);

  const middle = Math.floor(values.length / 2);

  if (values.length % 2 === 0) {
    return (values[middle - 1] + values[middle]) / 2;
  }

  return values[middle];
}
function formatTime(timestamp) {

  return timestamp
    .replace("T", " ")
    .split(" ")[1]
    .substring(0,5);

}
function windDirection(deg) {

  const dirs = [
    "N", "NE", "E", "SE",
    "S", "SO", "O", "NO"
  ];

  return dirs[Math.round(deg / 45) % 8];
}

async function loadPalazzoCavalli() {

  const url =
    "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Palazzo_Cavalli.html";

  const response = await fetch(url);
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
    humidity: parseFloat(cols[4])
  };
}

async function loadSanGiorgio() {

  const url =
    "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/San_Giorgio.html";

  const response = await fetch(url);
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

  const url =
    "https://api.arpa.veneto.it/REST/v1/meteo_meteogrammi_tabella?codseqst=300000154";

  const response = await fetch(url);
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

  const url =
"https://r.jina.ai/http://www.comune.venezia.it/PUNTA_SALUTE_NON_ESISTE.html";

  const response = await fetch(url);
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

  const url =
    "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Misericordia.html";

  const response = await fetch(url);
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
    source: "Misericordia"
  };
}

async function loadStationsConfig() {

  const response = await fetch("stations.json");
  const config = await response.json();

  document.getElementById("stationsStatus").innerHTML =
    config.stations
      .map(station => "✓ " + station.name)
      .join("<br>");
}

async function loadAll() {

  try {

    const cavalli = await loadPalazzoCavalli();
const sanGiorgio = await loadSanGiorgio();
const cavanis = await loadCavanis();

let puntaSalute;

try {

  puntaSalute = await loadPuntaSalute();
  puntaSalute.source = "Punta Salute";

} catch (err) {

  console.warn("Punta Salute non disponibile");

  puntaSalute = await loadMisericordia();
}

    const temp = median([
  cavalli.temperature,
  sanGiorgio.temperature,
  cavanis.temperature
]);

    const humidity = median([
  cavalli.humidity,
  sanGiorgio.humidity,
  cavanis.humidity
]);

    document.getElementById("tide").innerHTML =
      puntaSalute.tide +
      " cm " +
      puntaSalute.trend;

    document.getElementById("waterTemp").innerHTML =
      puntaSalute.waterTemp.toFixed(1) +
      " °C";

    document.getElementById("temp").innerHTML =
      temp.toFixed(1) +
      " °C<br><small>(3 sensori)</small>";

document.getElementById("tempDetails").innerHTML =
`
<div class="details">
  <div>Palazzo Cavalli: ${cavalli.temperature.toFixed(1)} °C (${formatTime(cavalli.timestamp)})</div>
  <div>San Giorgio: ${sanGiorgio.temperature.toFixed(1)} °C (${formatTime(sanGiorgio.timestamp)})</div>
  <div>Cavanis: ${cavanis.temperature.toFixed(1)} °C (${formatTime(cavanis.timestamp)})</div>
</div>
`;
    document.getElementById("humidity").innerHTML =
      humidity.toFixed(0) +
      " %<br><small>(3 sensori)</small>";

document.getElementById("humidityDetails").innerHTML =
`
<div class="details">
  <div>Palazzo Cavalli: ${cavalli.humidity.toFixed(0)} % (${formatTime(cavalli.timestamp)})</div>
  <div>San Giorgio: ${sanGiorgio.humidity.toFixed(0)} % (${formatTime(sanGiorgio.timestamp)})</div>
  <div>Cavanis: ${cavanis.humidity.toFixed(0)} % (${formatTime(cavanis.timestamp)})</div>
</div>
`;
    document.getElementById("pressure").innerHTML =
      cavalli.pressure.toFixed(1) +
      " hPa";

    document.getElementById("wind").innerHTML =
      windDirection(sanGiorgio.windDir) +
      " " +
      Math.round(sanGiorgio.windSpeed * 3.6) +
      " km/h";
document.getElementById("tideSource").innerHTML =
  puntaSalute.source;
   document.getElementById("tideTime").innerHTML =
  formatTime(puntaSalute.timestamp);

document.getElementById("airTime").innerHTML =
  formatTime(cavalli.timestamp);
 document.getElementById("status").innerHTML = "";

  } catch (error) {

    console.error(error);

    document.getElementById("status").innerHTML =
      "Errore caricamento dati";
  }
}

loadStationsConfig();
loadAll();
