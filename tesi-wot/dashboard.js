/**
 * SMART WOT ENERGY DASHBOARD & CONTROLLER
 * Legge dinamicamente le Thing Descriptions dei dispositivi WoT
 */

const express = require('express');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const app = express();
const PORT = 3000;

const THING_URLS = [
  "http://localhost:8080/smartplug_computer",
  "http://localhost:8080/smartplug_lavatrice",
  "http://localhost:8080/smartplug_friggitrice",
  "http://localhost:8080/smartplug_aspirapolvere"
];

let DEVICES = [];

async function loadDevicesFromTDs() {
  const discovered = [];
  console.log("🔍 Avvio discovery dei dispositivi per la Dashboard tramite TD...");

  for (const url of THING_URLS) {
    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/json" }
      });
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const text = await res.text();
      if (!text) throw new Error("Risposta vuota dal server WoT");
      
      const td = JSON.parse(text);

      const titleLower = td.title.toLowerCase();
      const id = titleLower.replace('smartplug_', '');
      
      const baseEndpoint = `http://localhost:8080/${titleLower}`;
      const statusHref = `${baseEndpoint}/properties/status`;
      const powerHref = `${baseEndpoint}/properties/power`;
      const toggleHref = `${baseEndpoint}/actions/toggle`;
      
      const metadata = td['hems:metadata'] || { priority: 99, deferrable: false };

      discovered.push({
        id: id,
        name: td.title.replace(/smartplug_/i, ''), 
        endpoint: baseEndpoint,
        statusHref,
        powerHref,
        toggleHref,
        priority: metadata.priority,
        deferrable: metadata.deferrable,
        nationalAvgMonth: 20.0,
        csvFile: `consumi_${id}.csv`,
        color: id === 'computer' ? '#d95f02' : id === 'lavatrice' ? '#2b5c8f' : id === 'friggitrice' ? '#7570b3' : '#1b9e77'
      });

      console.log(`  ✅ Dashboard ha mappato: ${td.title}`);
    } catch (err) {
      console.error(`  ⚠️ Impossibile leggere la TD da ${url}:`, err.message);
    }
  }
  DEVICES = discovered;
  console.log(`📊 Dashboard pronta: ${DEVICES.length} dispositivi configurati.`);
}

async function calculateKwhFromCSV(filePath, targetYear, targetMonth) {
    if (!fs.existsSync(filePath)) return 0;
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let totalKwh = 0;
    let isHeader = true;
    for await (const line of rl) {
        if (isHeader) { isHeader = false; continue; }
        const parts = line.split(',');
        if (parts.length >= 3) {
            const timestamp = new Date(parts[0].trim());
            if (timestamp.getFullYear() === targetYear && timestamp.getMonth() === targetMonth) {
                const powerW = parseFloat(parts[2]) || 0;
                totalKwh += (powerW / 1000) * (60 / 3600);
            }
        }
    }
    return parseFloat(totalKwh.toFixed(3));
}

app.get('/api/devices', (req, res) => {
    res.json(DEVICES);
});

// Endpoint di supporto per calcolare lo stato delle politiche da mostrare in UI
app.get('/api/hems-status', async (req, res) => {
    try {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        
        let tariff = "F2/F3 (Economica)";
        if (day !== 0 && day !== 6 && hour >= 8 && hour < 19) {
            tariff = "F1 (Costosa/Picco)";
        }

        res.json({
            tariffZone: tariff,
            simulatedSolar: 2500
        });
    } catch (e) {
        res.status(500).json({ error: "Errore calcolo politiche" });
    }
});

app.get('/api/monthly-stats', async (req, res) => {
    try {
        const now = new Date();
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();
        const month = req.query.month !== undefined ? parseInt(req.query.month) : now.getMonth();

        const realKwhData = await Promise.all(
            DEVICES.map(dev => calculateKwhFromCSV(path.join(__dirname, dev.csvFile), year, month))
        );

        const deviceDatasets = DEVICES.map((dev, index) => {
            const val = realKwhData[index];
            const dataArray = new Array(DEVICES.length + 1).fill(0);
            dataArray[index] = val;
            dataArray[DEVICES.length] = val;

            return {
                label: dev.name,
                data: dataArray,
                backgroundColor: dev.color,
                stack: 'hems'
            };
        });

        const totalArera = DEVICES.reduce((acc, d) => acc + d.nationalAvgMonth, 0);
        const areraDataset = {
            label: 'Media Nazionale ARERA (Totale)',
            data: [...new Array(DEVICES.length).fill(0), totalArera],
            backgroundColor: '#e7298a',
            stack: 'arera'
        };

        res.json({ datasets: [...deviceDatasets, areraDataset] });
    } catch (err) {
        res.status(500).json({ error: "Errore nella lettura dei file CSV" });
    }
});

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>HEMS - Dashboard WoT con Politiche</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f4f6f9; color: #333; }
        h1 { margin-bottom: 5px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .card { background: white; padding: 18px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border-top: 5px solid #007bff; }
        .card h4 { margin-top: 0; margin-bottom: 10px; font-size: 18px; text-transform: capitalize; }
        .badge-container { margin: 10px 0; display: flex; gap: 6px; flex-wrap: wrap; }
        .badge { display: inline-block; padding: 4px 8px; font-size: 11px; border-radius: 4px; background: #e9ecef; font-weight: bold; }
        .badge-priority { background: #e2e3e5; color: #383d41; }
        .badge-type { background: #d1ecf1; color: #0c5460; }
        .charts-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; margin-top: 20px; }
        .chart-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .on { color: #28a745; font-weight: bold; }
        .off { color: #dc3545; font-weight: bold; }
        button { padding: 8px 10px; margin-top: 10px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; width: 100%; font-weight: bold; transition: background 0.2s; }
        button:hover { background: #0056b3; }
        @media(max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <h1>🏠 HEMS - Monitoraggio & Politiche WoT</h1>
    <h3>Potenza Istantanea Totale: <span id="total-power">0</span> W / 3000 W</h3>

    <!-- Pannello Politiche Energetiche HEMS integrato -->
    <div class="card" style="margin-bottom: 25px; border-top-color: #28a745;">
        <h3>🌱 Stato Politiche HEMS & Ottimizzazione Attiva</h3>
        <p><strong>Fascia Oraria (Time-of-Use):</strong> <span id="hems-tariff" style="color: #d95f02; font-weight: bold;">Caricamento...</span></p>
        <p><strong>Surplus Solare Stimato:</strong> <span id="hems-solar">0</span> W</p>
        <p><strong>Suggerimento Politica Ecologica / Carichi:</strong> <span id="hems-advice" style="color: #007bff; font-weight: bold;">Analisi in corso...</span></p>
    </div>

    <div class="grid" id="grid">Caricamento dispositivi da Thing Descriptions...</div>

    <div class="charts-grid">
        <div class="chart-card">
            <h3>📊 Ripartizione Consumi Istantanei</h3>
            <canvas id="pieChart"></canvas>
        </div>
        <div class="chart-card">
            <h3>🇮🇹 Consumo Reale HEMS vs ARERA (kWh)</h3>
            <select id="monthSelector" onchange="updateMonthlyBarChart()" style="padding: 5px; margin-bottom: 15px; border-radius: 4px; border: 1px solid #ccc;"></select>
            <canvas id="barChart"></canvas>
        </div>
    </div>

    <script>
        let devices = [];
        let pieChart, barChart;

        async function fetchDevices() {
            const res = await fetch('/api/devices');
            devices = await res.json();
            initDOM();
            await initCharts();
            setInterval(update, 5000);
            update();
        }

        function initDOM() {
            const grid = document.getElementById('grid');
            grid.innerHTML = devices.map(dev => \`
                <div class="card" style="border-color: \${dev.color}">
                    <h4>\${dev.name}</h4>
                    <p>Stato: <span id="status-\${dev.id}">-</span></p>
                    <p>Potenza: <strong id="power-\${dev.id}">0</strong> W</p>
                    <div class="badge-container">
                      <span class="badge badge-priority">Prio: \${dev.priority}</span>
                      <span class="badge badge-type">\${dev.deferrable ? '🔄 Differibile' : '⚡ Fisso'}</span>
                    </div>
                    <button onclick="toggle('\${dev.toggleHref}')">TOGGLE</button>
                </div>
            \`).join('');
            populateMonthSelector();
        }

        function populateMonthSelector() {
            const selector = document.getElementById('monthSelector');
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

            let options = '';
            for (let m = 0; m <= 11; m++) {
                const selected = (m === currentMonth) ? 'selected' : '';
                options += \`<option value="\${currentYear}-\${m}" \${selected}>\${monthNames[m]} \${currentYear}</option>\`;
            }
            selector.innerHTML = options;
        }

        async function initCharts() {
            const ctxPie = document.getElementById('pieChart').getContext('2d');
            pieChart = new Chart(ctxPie, {
                type: 'pie',
                data: {
                    labels: devices.map(d => d.name),
                    datasets: [{ data: new Array(devices.length).fill(0), backgroundColor: devices.map(d => d.color) }]
                }
            });

            const selector = document.getElementById('monthSelector');
            const [year, month] = selector.value.split('-');
            const resStats = await fetch(\`/api/monthly-stats?year=\${year}&month=\${month}\`);
            const stats = await resStats.json();

            const ctxBar = document.getElementById('barChart').getContext('2d');
            barChart = new Chart(ctxBar, {
                type: 'bar',
                data: {
                    labels: [...devices.map(d => d.name), 'TOTALE'],
                    datasets: stats.datasets
                },
                options: {
                    responsive: true,
                    scales: {
                        x: { stacked: true },
                        y: { stacked: true, beginAtZero: true }
                    }
                }
            });
        }

        async function updateMonthlyBarChart() {
            if (!barChart) return;
            const selector = document.getElementById('monthSelector');
            const [year, month] = selector.value.split('-');
            const resStats = await fetch(\`/api/monthly-stats?year=\${year}&month=\${month}\`);
            const stats = await resStats.json();
            
            stats.datasets.forEach((ds, i) => {
                if (barChart.data.datasets[i]) {
                    barChart.data.datasets[i].data = ds.data;
                }
            });
            barChart.update();
        }

        async function update() {
            let total = 0;
            let powers = [];

            // Legge lo stato dei dispositivi
            for (const dev of devices) {
                try {
                    const resS = await fetch(dev.statusHref);
                    const status = await resS.json();
                    const resP = await fetch(dev.powerHref);
                    const power = await resP.json();

                    const pVal = typeof power === 'number' ? power : 0;
                    if (status === 'on') total += pVal;
                    powers.push(status === 'on' ? pVal : 0);

                    const statusEl = document.getElementById(\`status-\${dev.id}\`);
                    const powerEl = document.getElementById(\`power-\${dev.id}\`);

                    if (statusEl && powerEl) {
                        statusEl.textContent = status.toUpperCase();
                        statusEl.className = status;
                        powerEl.textContent = pVal;
                    }
                } catch(e) { 
                    powers.push(0); 
                }
            }

            document.getElementById('total-power').innerText = total.toFixed(2);
            if (pieChart) {
                pieChart.data.datasets[0].data = powers;
                pieChart.update();
            }

            // Aggiorna lo stato delle politiche HEMS nella card dedicata
            try {
                const resHems = await fetch('/api/hems-status');
                const hemsData = await resHems.json();
                document.getElementById('hems-tariff').innerText = hemsData.tariffZone;

                const solarSurplus = hemsData.simulatedSolar - total;
                document.getElementById('hems-solar').innerText = solarSurplus.toFixed(2);

                const adviceEl = document.getElementById('hems-advice');
                if (total > 3000) {
                    adviceEl.innerText = "⚠️ ATTENZIONE: Sovraccarico di potenza in corso (>3kW)! Politica di protezione attiva.";
                    adviceEl.style.color = "#dc3545";
                } else if (solarSurplus > 500) {
                    const offDeferrableNames = devices.filter(d => {
                        const statusEl = document.getElementById(\`status-\${d.id}\`);
                        return d.deferrable && statusEl && statusEl.textContent === 'OFF';
                    }).map(d => d.name);

                    if (offDeferrableNames.length > 0) {
                        adviceEl.innerText = \`☀️ Surplus solare ottimale! Consigliato avviare: \${offDeferrableNames.join(', ')}\`;
                        adviceEl.style.color = "#28a745";
                    } else {
                        adviceEl.innerText = "☀️ Ottimo surplus solare, carichi differibili già attivi.";
                        adviceEl.style.color = "#28a745";
                    }
                } else {
                    adviceEl.innerText = "✅ Sistema bilanciato nei limiti energetici.";
                    adviceEl.style.color = "#007bff";
                }
            } catch (e) {
                console.error("Errore aggiornamento politiche HEMS:", e);
            }
        }

        async function toggle(toggleHref) {
            try {
                const response = await fetch(toggleHref, { method: 'POST' });
                if (response.ok) update(); 
            } catch (err) {
                console.error("Errore invio toggle:", err);
            }
        }

        window.onload = () => {
            fetchDevices();
        };
    </script>
</body>
</html>
  `);
});

app.listen(PORT, async () => {
    await loadDevicesFromTDs();
    console.log(`🌐 Dashboard HEMS attiva su http://localhost:${PORT}`);
});