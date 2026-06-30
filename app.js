async function test() {
  const url = "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Palazzo_Cavalli.html";

  try {
    const response = await fetch(url);
    const text = await response.text();

    document.getElementById("status").innerHTML =
      "Ricevuti " + text.length + " caratteri";
  } catch (e) {
    document.getElementById("status").innerHTML =
      "Errore: " + e.message;
  }
}

test();
