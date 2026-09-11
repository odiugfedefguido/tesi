const fs = require("fs");

const DEVICES = [
  {
    id: "lavatrice",
    name: "Lavatrice",
    endpoint: "http://localhost:8080/smartplug_lavatrice",
    csvFile: "consumi_lavatrice.csv"
  },
  {
    id: "friggitrice",
    name: "Friggitrice ad Aria",
    endpoint: "http://localhost:8080/smartplug_friggitrice",
    csvFile: "consumi_friggitrice.csv"
  },
  {
    id: "computer",
    name: "Computer",
    endpoint: "http://localhost:8080/smartplug_computer",
    csvFile: "consumi_computer.csv"
  },
  {
    id: "aspirapolvere",
    name: "Aspirapolvere",
    endpoint: "http://localhost:8080/smartplug_aspirapolvere",
    csvFile: "consumi_aspirapolvere.csv"
  }
];

DEVICES.forEach((device) => {
  if (!fs.existsSync(device.csvFile)) {
    fs.writeFileSync(device.csvFile, "Timestamp,Stato,Potenza_W\n");
    console.log(`Creato file CSV dedicato: ${device.csvFile}`);
  }
});

async function collectMetricsForDevice(device) {
  try {
    const resStatus = await fetch(`${device.endpoint}/properties/status`);
    const status = await resStatus.json();

    const resPower = await fetch(`${device.endpoint}/properties/power`);
    const power = await resPower.json();

    const timestamp = new Date().toISOString();
    const row = `${timestamp},${status},${power}\n`;

    fs.appendFileSync(device.csvFile, row);
    console.log(`[LOG ${device.name}] ${timestamp} | Stato: ${status} | Potenza: ${power} W`);
  } catch (err) {
    console.error(`Errore lettura per ${device.name}:`, err.message);
  }
}

async function collectAllMetrics() {
  for (const device of DEVICES) {
    await collectMetricsForDevice(device);
  }
}

console.log("Data Logger WoT Multi-File attivo!");
console.log("Monitoraggio ogni 5 secondi per i 4 elettrodomestici.\n");

setInterval(collectAllMetrics, 5000);