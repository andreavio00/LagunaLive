function median(values) {
  values.sort((a, b) => a - b);

  const middle = Math.floor(values.length / 2);

  if (values.length % 2 === 0) {
    return (values[middle - 1] + values[middle]) / 2;
  }

  return values[middle];
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

async function loadPuntaSalute() {

  const url =
    "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Punta_Salute.html";

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

    const [
      cavalli,
      sanGiorgio,
      puntaSalute
    ] = await Promise.all([
      loadPalazzoCavalli(),
      loadSanGiorgio(),
      loadPuntaSalute()
    ]);

    const temp = median([
      cavalli.temperature,
      sanGiorgio.temperature
    ]);

    const humidity = median([
      cavalli.humidity,
      sanGiorgio.humidity
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
      " °C<br><small>(2 sensori)</small>";

    document.getElementById("humidity").innerHTML =
      humidity.toFixed(0) +
      " %<br><small>(2 sensori)</small>";

    document.getElementById("pressure").innerHTML =
      cavalli.pressure.toFixed(1) +
      " hPa";

    document.getElementById("wind").innerHTML =
      windDirection(sanGiorgio.windDir) +
      " " +
      Math.round(sanGiorgio.windSpeed * 3.6) +
      " km/h";

    document.getElementById("status").innerHTML =
      "Marea: " + puntaSalute.timestamp +
      "<br>Aria: " + cavalli.timestamp;

  } catch (error) {

    console.error(error);

    document.getElementById("status").innerHTML =
      "Errore caricamento dati";
  }
}

loadStationsConfig();
loadAll();
