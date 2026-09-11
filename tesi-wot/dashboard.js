const express = require('express');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const app = express();
const PORT = 3000;

const DEVICES = [
  { id: "lavatrice", name: "Lavatrice", endpoint: "http://localhost:8080/smartplug_lavatrice", nationalAvgMonth: 35.0, csvFile: "consumi_lavatrice.csv", color: "#2b5c8f" },
  { id: "computer", name: "Computer", endpoint: "http://localhost:8080/smartplug_computer", nationalAvgMonth: 20.0, csvFile: "consumi_computer.csv", color: "#d95f02" },
  { id: "friggitrice", name: "Friggitrice ad Aria", endpoint: "http://localhost:8080/smartplug_friggitrice", nationalAvgMonth: 22.0, csvFile: "consumi_friggitrice.csv", color: "#7570b3" },
  { id: "aspirapolvere", name: "Aspirapolvere", endpoint: "http://localhost:8080/smartplug_aspirapolvere", nationalAvgMonth: 12.0, csvFile: "consumi_aspirapolvere.csv", color: "#1b9e77" }
];

// Funzione backend per calcolare i kWh registrati nei CSV per uno specifico mese ed anno
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

            // Filtra per anno e mese selezionato (i mesi in JS vanno da 0 a 11)
            if (timestamp.getFullYear() === targetYear && timestamp.getMonth() === targetMonth) {
                const powerW = parseFloat(parts[2]) || 0;
                const hours = 60 / 3600; // Campionamento ogni 60 secondi
                totalKwh += (powerW / 1000) * hours;
            }
        }
    }

    return parseFloat(totalKwh.toFixed(3));
}

// Endpoint API con parametri opzionali year e month
app.get('/api/monthly-stats', async (req, res) => {
    try {
        const now = new Date();
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();
        const month = req.query.month !== undefined ? parseInt(req.query.month) : now.getMonth();

        const realKwhData = await Promise.all(
            DEVICES.map(dev => calculateKwhFromCSV(path.join(__dirname, dev.csvFile), year, month))
        );

        // 1. Dataset per i singoli dispositivi HEMS
        const deviceDatasets = DEVICES.map((dev, index) => {
            const val = realKwhData[index];
            const dataArray = [0, 0, 0, 0, 0];
            
            dataArray[index] = val;
            dataArray[4] = val;

            return {
                label: dev.name,
                data: dataArray,
                backgroundColor: dev.color,
                stack: 'hems'
            };
        });

        // 2. Calcolo del totale mensile ARERA
        const totalArera = DEVICES.reduce((acc, d) => acc + d.nationalAvgMonth, 0);

        const areraDataset = {
            label: 'Media Nazionale ARERA (Totale)',
            data: [0, 0, 0, 0, totalArera],
            backgroundColor: '#e7298a',
            stack: 'arera'
        };

        res.json({
            datasets: [...deviceDatasets, areraDataset]
        });
    } catch (err) {
        res.status(500).json({ error: "Errore nella lettura dei CSV" });
    }
});

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>HEMS - Dashboard WoT con Grafici</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f4f6f9; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .charts-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; }
        .chart-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .on { color: green; font-weight: bold; }
        .off { color: red; font-weight: bold; }
        button { padding: 6px 10px; margin-top: 8px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; }
        select { padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px; }
    </style>
</head>
<body>
    <h1>🏠 HEMS - Monitoraggio & Analytics WoT</h1>
    <h3>Potenza Istantanea Totale: <span id="total-power">0</span> W / 3000 W</h3>

    <div class="grid" id="grid"></div>

    <div class="charts-grid">
        <div class="chart-card">
            <h3>📊 Ripartizione Consumi Istantanei</h3>
            <canvas id="pieChart"></canvas>
        </div>
        <div class="chart-card">
            <div class="chart-header">
                <h3>🇮🇹 Consumo Reale HEMS vs ARERA (kWh)</h3>
                <select id="monthSelector" onchange="updateMonthlyBarChart()">
                    <!-- Popolato dinamicamente via JS -->
                </select>
            </div>
            <canvas id="barChart"></canvas>
        </div>
    </div>

    <script>
        const devices = ${JSON.stringify(DEVICES)};
        let pieChart, barChart;

        const monthNames = [
            "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
            "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
        ];

        function populateMonthSelector() {
            const selector = document.getElementById('monthSelector');
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();

            let options = '';
            // Popola con i mesi dell'anno corrente
            for (let m = 0; m <= 11; m++) {
                const selected = (m === currentMonth) ? 'selected' : '';
                options += \`<option value="\${currentYear}-\${m}" \${selected}>\${monthNames[m]} \${currentYear}</option>\`;
            }
            selector.innerHTML = options;
        }

        function initDOM() {
            const grid = document.getElementById('grid');
            grid.innerHTML = devices.map(dev => \`
                <div class="card" id="card-\${dev.id}">
                    <h4>\${dev.name}</h4>
                    <p>Stato: <span id="status-\${dev.id}">-</span></p>
                    <p>Potenza: <strong id="power-\${dev.id}">0</strong> W</p>
                    <button onclick="toggle('\${dev.endpoint}')">TOGGLE</button>
                </div>
            \`).join('');
            
            populateMonthSelector();
        }

        async function initCharts() {
            const ctxPie = document.getElementById('pieChart').getContext('2d');
            pieChart = new Chart(ctxPie, {
                type: 'pie',
                data: {
                    labels: devices.map(d => d.name),
                    datasets: [{ data: [0, 0, 0, 0], backgroundColor: devices.map(d => d.color) }]
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

            for (const dev of devices) {
                try {
                    const resS = await fetch(dev.endpoint + '/properties/status');
                    const status = await resS.json();
                    const resP = await fetch(dev.endpoint + '/properties/power');
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
        }

        async function toggle(endpoint) {
            await fetch(endpoint + '/actions/toggle', { method: 'POST' });
            update();
        }

        window.onload = async () => {
            initDOM();
            await initCharts();
            setInterval(update, 5000);
            setInterval(updateMonthlyBarChart, 60000);
            update();
        };
    </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Dashboard HEMS attiva su http://localhost:${PORT}`);
});