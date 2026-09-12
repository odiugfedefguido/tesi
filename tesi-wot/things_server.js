const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

const HASS_URL = "http://192.168.1.17:8123"; 

// 1. Devi generare un token reale su Home Assistant: 
// Clicca sul tuo Profilo (in basso a sx) -> Sicurezza -> Token di accesso di lunga durata
const HASS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJiZTQwMjZkOTNhYTI0YmUyOTE3YmU1YmRhZTZjNjU2YSIsImlhdCI6MTc4OTE3MzY2OSwiZXhwIjoyMTA0NTMzNjY5fQ.wjZT5w3Div2n54WROIjshEEdTrnJVzR721qe1VaGzn0";

async function main() {
  try {
    const servient = new Servient();
    
    // 2. Abilitiamo i CORS per permettere alla Dashboard di premere i tasti
    servient.addServer(new HttpServer({ 
      port: 8080, 
      cors: true // Aggiunto per sbloccare la Dashboard
    }));

    const WoT = await servient.start();
    console.log("🔌 Servient WoT avviato sulla porta 8080.");

    await require('./things/computer.js')(WoT, HASS_URL, HASS_TOKEN);
    await require('./things/lavatrice.js')(WoT, HASS_URL, HASS_TOKEN);
    await require('./things/friggitrice.js')(WoT, HASS_URL, HASS_TOKEN);
    await require('./things/aspirapolvere.js')(WoT, HASS_URL, HASS_TOKEN);

    console.log("✅ Tutte le Thing sono state esposte con successo!");
  } catch (err) {
    console.error("❌ Errore nell'avvio dei server WoT:", err);
  }
}

main();
