const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

// Configurato con l'IP corretto di Home Assistant rilevato dal browser
const HASS_URL = "http://192.168.1.17:8123"; 
const HASS_TOKEN = "IL_TUO_TOKEN_LUNGO_DI_HOME_ASSISTANT";

async function main() {
  try {
    const servient = new Servient();
    servient.addServer(new HttpServer({ port: 8080 }));

    const WoT = await servient.start();
    console.log("🔌 Servient WoT avviato sulla porta 8080.");

    // Carica i dispositivi dalla cartella 'things'
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