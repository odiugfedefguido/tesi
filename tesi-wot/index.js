const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Avvio del sistema WoT HEMS in corso...');

// 1. Avvia il server delle Thing WoT (porta 8080)
const thingsProcess = spawn('node', [path.join(__dirname, 'things_server.js')], {
    stdio: 'inherit'
});

thingsProcess.on('error', (err) => {
    console.error('❌ Errore nell\'avvio del server delle Thing:', err);
});

// 2. Avvia lo Smart Controller (dopo 2 secondi)
setTimeout(() => {
    const smartControllerPath = path.join(__dirname, 'smart_controller.js');
    if (fs.existsSync(smartControllerPath)) {
        console.log('⚡ Avvio dello Smart Controller...');
        const smartProcess = spawn('node', [smartControllerPath], { stdio: 'inherit' });
        smartProcess.on('error', (err) => console.error('❌ Errore nello smart controller:', err));
    }
}, 2000);

// 3. Avvia la Dashboard (dopo 3.5 secondi)
setTimeout(() => {
    console.log('📊 Avvio della Dashboard HEMS...');
    const dashboardProcess = spawn('node', [path.join(__dirname, 'dashboard.js')], {
        stdio: 'inherit'
    });

    dashboardProcess.on('error', (err) => {
        console.error('❌ Errore nell\'avvio della dashboard:', err);
    });

    // Chiusura pulita di tutto con CTRL+C
    process.on('SIGINT', () => {
        console.log('\n🛑 Arresto di tutti i servizi HEMS WoT...');
        thingsProcess.kill();
        dashboardProcess.kill();
        process.exit(0);
    });
}, 3500);