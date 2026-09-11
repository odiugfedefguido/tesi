/**
 * SMART WOT ENERGY CONTROLLER (HEMS Dinamico basato su Thing Descriptions)
 */

// Endpoint radice dei singoli server WoT dei dispositivi
const THING_URLS = [
  "http://localhost:8080/smartplug_computer",
  "http://localhost:8080/smartplug_lavatrice",
  "http://localhost:8080/smartplug_friggitrice",
  "http://localhost:8080/smartplug_aspirapolvere"
];

const MAX_POWER_LIMIT_W = 3000; 
const CHECK_INTERVAL_MS = 5000;

// Tracciamento contatori per lo standby (Politica 3)
const standbyCounters = {};

// Simulazione Produzione Solare in Watt (Politica 4)
const SIMULATED_SOLAR_PRODUCTION_W = 2500; 

function getCurrentTariffZone() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  if (day === 0 || day === 6) return "F2/F3 (Economica)";
  if (hour >= 8 && hour < 19) return "F1 (Costosa/Picco)";
  return "F2/F3 (Economica)";
}

/**
 * Fase di Discovery: scarica le TD e mappa dinamicamente endpoint e politiche
 */
async function discoverDevices() {
  const discoveredDevices = [];
  console.log("🔍 Avvio discovery dei dispositivi tramite Thing Descriptions...");

  for (const url of THING_URLS) {
    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/json" }
      });
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const text = await res.text();
      if (!text) throw new Error("Risposta vuota dal server WoT");
      
      const td = JSON.parse(text);

      // Estrae dinamicamente gli URL d'interazione dalle "forms" della TD
      const statusHref = td.properties.status.forms[0].href;
      const powerHref = td.properties.power.forms[0].href;
      const toggleHref = td.actions.toggle.forms[0].href;
      
      // Legge i metadati personalizzati definiti nella TD (priorità e differibilità)
      const metadata = td['hems:metadata'] || { priority: 99, deferrable: false };

      discoveredDevices.push({
        id: td.title.toLowerCase().replace('smartplug_', ''),
        name: td.title,
        statusHref,
        powerHref,
        toggleHref,
        priority: metadata.priority,
        deferrable: metadata.deferrable
      });

      console.log(`  ✅ Scoperto: ${td.title} | Prio: ${metadata.priority} | Differibile: ${metadata.deferrable}`);
    } catch (err) {
      console.error(`  ⚠️ Impossibile raggiungere la TD a ${url}:`, err.message);
    }
  }

  return discoveredDevices;
}

async function getDeviceData(device) {
  try {
    const resStatus = await fetch(device.statusHref);
    const status = await resStatus.json();

    const resPower = await fetch(device.powerHref);
    const power = await resPower.json();

    return { ...device, status, power: typeof power === "number" ? power : 0 };
  } catch (err) {
    console.error(`⚠️ Errore comunicazione ${device.name}:`, err.message);
    return { ...device, status: "off", power: 0 };
  }
}

async function turnOffDevice(device, reason) {
  console.warn(`🚨 AZIONE WOT [${reason}]: Spegnimento ${device.name}...`);
  try {
    await fetch(device.toggleHref, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    console.log(`✅ ${device.name} disattivato con successo!`);
  } catch (err) {
    console.error(`❌ Errore spegnimento ${device.name}:`, err.message);
  }
}

async function evaluateEnergyPolicies(devices) {
  const tariffZone = getCurrentTariffZone();
  console.log(`\n=============================================================`);
  console.log(`--- [${new Date().toLocaleTimeString()}] Valutazione HEMS Dinamica (TD-Driven) ---`);
  console.log(` Fascia Oraria: ${tariffZone} | Prod. Solare Stimata: ${SIMULATED_SOLAR_PRODUCTION_W} W`);

  const states = await Promise.all(devices.map(getDeviceData));
  const totalPower = states.reduce((acc, dev) => acc + dev.power, 0);

  console.log(`Potenza Totale Assorbita: ${totalPower.toFixed(2)} W / Limite: ${MAX_POWER_LIMIT_W} W`);
  states.forEach(d => {
    console.log(`   • ${d.name} (Prio: ${d.priority}) | Stato: ${d.status.toUpperCase()} | Potenza: ${d.power} W`);
  });

  // -------------------------------------------------------------
  // POLITICA 1: Anti-Sovraccarico (Peak Shaving basato sulle Priorità)
  // -------------------------------------------------------------
  if (totalPower > MAX_POWER_LIMIT_W) {
    console.warn(`\nPOLITICA 1 [SICUREZZA]: Sovraccarico Rilevato!`);
    const activeByPriority = states
      .filter(dev => dev.status === "on" && dev.power > 0)
      .sort((a, b) => b.priority - a.priority);

    if (activeByPriority.length > 0) {
      await turnOffDevice(activeByPriority[0], "SOVRACCARICO 3kW");
      return;
    }
  }

  // -------------------------------------------------------------
  // POLITICA 2: Ottimizzazione Economica (Time-of-Use)
  // -------------------------------------------------------------
  if (tariffZone.startsWith("F1")) {
    const highLoadInF1 = states.filter(d => d.status === "on" && d.deferrable && d.power > 500);
    if (highLoadInF1.length > 0) {
      console.warn(`\nPOLITICA 2 [ECONOMICA]: Rilevato uso di carichi elevati in fascia F1 costosa.`);
    }
  }

  // -------------------------------------------------------------
  // POLITICA 3: Taglio Consumi Fantasma (Standby Killer)
  // -------------------------------------------------------------
  states.forEach(d => {
    if (d.status === "on" && d.power >= 2 && d.power <= 15) {
      standbyCounters[d.id] = (standbyCounters[d.id] || 0) + 1;
      console.warn(`\nPOLITICA 3 [STANDBY]: ${d.name} in consumo fantasma (${d.power} W). Rilevamento ${standbyCounters[d.id]}/3.`);
      
      if (standbyCounters[d.id] >= 3) {
        turnOffDevice(d, "TAGLIO STANDBY FANTASMA");
        standbyCounters[d.id] = 0;
      }
    } else {
      standbyCounters[d.id] = 0;
    }
  });

  // -------------------------------------------------------------
  // POLITICA 4: Self-Consumption Solare (Surplus Fotovoltaico)
  // -------------------------------------------------------------
  const solarSurplus = SIMULATED_SOLAR_PRODUCTION_W - totalPower;
  if (solarSurplus > 500) {
    console.log(`\nPOLITICA 4 [ECOLOGICA]: Surplus solare disponibile: +${solarSurplus.toFixed(2)} W!`);
    const offDeferrable = states.filter(d => d.status === "off" && d.deferrable);
    if (offDeferrable.length > 0) {
      console.log(` Consigliato avvio carichi differibili: ${offDeferrable.map(d => d.name).join(", ")}`);
    }
  }
}

async function main() {
  console.log("Avvio del Controller HEMS WoT...");
  
  const devices = await discoverDevices();
  
  if (devices.length === 0) {
    console.error("❌ Nessun dispositivo trovato. Verifica che i server WoT siano attivi.");
    return;
  }

  setInterval(() => evaluateEnergyPolicies(devices), CHECK_INTERVAL_MS);
  evaluateEnergyPolicies(devices);
}

main();