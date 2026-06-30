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

  const pressione = cols[2];
  const temperatura = cols[3];
  const umidita = cols[4];

  document.getElementById("status").innerHTML =
    "Palazzo Cavalli OK";

  document.getElementById("temp").innerHTML =
    temperatura + " °C";
document.getElementById("humidity").innerHTML =
  umidita + " %";

document.getElementById("pressure").innerHTML =
  pressione + " hPa";

  console.log({
    pressione,
    temperatura,
    umidita
  });
}

loadPalazzoCavalli();
