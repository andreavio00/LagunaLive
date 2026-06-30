async function test() {
  const url =
    "https://r.jina.ai/http://www.comune.venezia.it/sites/default/files/publicCPSM2/stazioni/temporeale/Palazzo_Cavalli.html";

  const response = await fetch(url);
  const text = await response.text();

  document.getElementById("status").innerHTML =
    text.substring(0, 1000).replaceAll("\n", "<br>");
}

test();
