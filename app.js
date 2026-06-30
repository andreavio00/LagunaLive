async function testPuntaSalute() {
  const url =
    "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Punta_Salute.html";

  const response = await fetch(url);
  const text = await response.text();

  document.getElementById("status").innerHTML =
    text.substring(0, 2000).replaceAll("\n", "<br>");
}

testPuntaSalute();