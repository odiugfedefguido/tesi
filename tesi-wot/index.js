/**
 * Entry Point principale - Tesi WoT HEMS (Home Energy Management System)
 * Avvia i servizi e coordina i componenti della smart home.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Avvio del sistema WoT HEMS in corso...');

// 1. Avvio del server della dashboard principale (dashboard.js)
const dashboardProcess = spawn('node', [path.join(__dirname, 'dashboard.js')], {
    stdio: 'inherit'
});

dashboardProcess.on('error', (err) => {
    console.error('❌ Errore nell\'avvio della dashboard:', err);
});

// 2. Se possiedi un controller o uno script di simulazione per le smart plug (es. smat_controller.js)
const smartControllerPath = path.join(__dirname, 'smat_controller.js');
const fs = require('fs');

if (fs.existsSync(smartControllerPath)) {
    const smartProcess = spawn('node', [smartControllerPath], {
        stdio: 'inherit'
    });

    smartProcess.on('error', (err) => {
        console.error('❌ Errore nell\'avvio dello smart controller:', err);
    });
}

// Gestione della chiusura pulita dei processi con CTRL+C
process.on('SIGINT', () => {
    console.log('\n🛑 Arresto di tutti i servizi HEMS WoT...');
    dashboardProcess.kill();
    process.exit(0);
});