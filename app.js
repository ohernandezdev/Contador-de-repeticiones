// ============================================================
//  CONTROLADOR PRINCIPAL - app.js
//  Orquesta todos los módulos y maneja la UI
// ============================================================

// ===== REFERENCIAS DOM =====
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const repCountEl = document.getElementById('rep-count');
const targetDisplayEl = document.getElementById('target-display');
const statusTextEl = document.getElementById('status-text');
const angleValueEl = document.getElementById('angle-value');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const targetInput = document.getElementById('target-input');
const modal = document.getElementById('modal');
const modalMessage = document.getElementById('modal-message');
const modalStats = document.getElementById('modal-stats');
const modalBtn = document.getElementById('modal-btn');

let animationId = null;

// ===== FUNCIONES DE LOG =====
const debugLog = document.getElementById('debug-log');

function logMessage(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    debugLog.appendChild(entry);
    debugLog.scrollTop = debugLog.scrollHeight;
    while (debugLog.children.length > 20) {
        debugLog.removeChild(debugLog.firstChild);
    }
    console.log(`[${type}] ${message}`);
}
