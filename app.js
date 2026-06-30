async function loadPalazzoCavalli() {
  const url =
    "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Palazzo_Cavalli.html";

  const response = await fetch(url);
  const text = await response.text();

  const rows = text.split("\n")
    .filter(line => line.startsWith("| 2026-"));

  const lastRow = rows[rows.length - 1];

  const cols = lastRow.split("|").map(x => x.trim());

  document.getElementById("temp").innerHTML =
    cols[3] + " °C";

  document.getElementById("humidity").innerHTML =
    cols[4] + " %";

  document.getElementById("pressure").innerHTML =
    cols[2] + " hPa";
}

async function loadPuntaSalute() {
  const url =
    "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Punta_Salute.html";

  const response = await fetch(url);
  const text = await response.text();

  const rows = text.split("\n")
    .filter(line => line.startsWith("| 2026-"));

  const lastRow = rows[rows.length - 1];

  const cols = lastRow.split("|").map(x => x.trim());

  const livelloMetri = parseFloat(cols[2]);
  const livelloCm = Math.round(livelloMetri * 100);

  document.getElementById("tide").innerHTML =
    livelloCm + " cm";

  document.getElementById("waterTemp").innerHTML =
    cols[3] + " °C";
}

async function loadAll() {
  await Promise.all([
    loadPalazzoCavalli(),
    loadPuntaSalute()
  ]);

  document.getElementById("status").innerHTML =
    "Aggiornato: " +
    new Date().toLocaleTimeString("it-IT");
}

loadAll();