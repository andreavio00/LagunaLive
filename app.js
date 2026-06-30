
async function testSource(name,url){
  try{
    const r=await fetch(url);
    return `${name}: OK (${r.status})`;
  }catch(e){
    return `${name}: ERRORE/CORS`;
  }
}
(async()=>{
 const results=await Promise.all([
   testSource('CPSM','https://www.comune.venezia.it/'),
   testSource('MeteoNetwork','https://www.meteonetwork.eu/')
 ]);
 document.getElementById('status').innerHTML=results.join('<br>');
})();
