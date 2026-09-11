/**
 * SMART WOT ENERGY CONTROLLER (HEMS Complete)
 * Modulo Consumer con 4 Politiche Energetiche Avanzate per la Tesi.
 */

const DEVICES = [
  { id: "lavatrice", name: "Lavatrice", endpoint: "http://localhost:8080/smartplug_lavatrice", priority: 1, deferrable: true },
  { id: "computer", name: "Computer", endpoint: "http://localhost:8080/smartplug_computer", priority: 2, deferrable: false },
  { id: "friggitrice", name: "Friggitrice ad Aria", endpoint: "http://localhost:8080/smartplug_friggitrice", priority: 3, deferrable: true },
  { id: "aspirapolvere", name: "Aspirapolvere", endpoint: "http://localhost:8080/smartplug_aspirapolvere", priority: 4, deferrable: true }
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

async function getDeviceData(device) {
  try {
    const resStatus = await fetch(`${device.endpoint}/properties/status`);
    const status = await resStatus.json();

    const resPower = await fetch(`${device.endpoint}/properties/power`);
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
    await fetch(`${device.endpoint}/actions/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    console.log(`✅ ${device.name} disattivato con successo!`);
  } catch (err) {
    console.error(`❌ Errore spegnimento ${device.name}:`, err.message);
  }
}

async function evaluateEnergyPolicies() {
  const tariffZone = getCurrentTariffZone();
  console.log(`\n=============================================================`);
  console.log(`--- [${new Date().toLocaleTimeString()}] Valutazione HEMS Multi-Politica ---`);
  console.log(` Fascia Oraria: ${tariffZone} | Prod. Solare Stimata: ${SIMULATED_SOLAR_PRODUCTION_W} W`);

  const states = await Promise.all(DEVICES.map(getDeviceData));
  const totalPower = states.reduce((acc, dev) => acc + dev.power, 0);

  console.log(`Potenza Totale Assorbita: ${totalPower.toFixed(2)} W / Limite: ${MAX_POWER_LIMIT_W} W`);
  states.forEach(d => {
    console.log(`   • ${d.name} (Prio: ${d.priority}) | Stato: ${d.status.toUpperCase()} | Potenza: ${d.power} W`);
  });

  // -------------------------------------------------------------
  // POLITICA 1: Anti-Sovraccarico (Peak Shaving)
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
    // Se consuma tra 2W e 15W è considerato in standby
    if (d.status === "on" && d.power >= 2 && d.power <= 15) {
      standbyCounters[d.id] = (standbyCounters[d.id] || 0) + 1;
      console.warn(`\nPOLITICA 3 [STANDBY]: ${d.name} in consumo fantasma (${d.power} W). Rilevamento ${standbyCounters[d.id]}/3.`);
      
      if (standbyCounters[d.id] >= 3) { // Dopo 3 rilevamenti consecutivi (15 sec)
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

console.log("Avvio HEMS Controller Completo (4 Politiche WoT)...");
setInterval(evaluateEnergyPolicies, CHECK_INTERVAL_MS);