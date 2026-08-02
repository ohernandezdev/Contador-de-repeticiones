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
let cameraStream = null;

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

// ===== CONEXIONES DEL ESQUELETO (para dibujar) =====
const POSE_CONNECTIONS = [
    [11, 12], [11, 23], [12, 24], [23, 24],
    [11, 13], [13, 15], [12, 14], [14, 16],
    [23, 25], [25, 27], [27, 29], [27, 31],
    [24, 26], [26, 28], [28, 30], [28, 32],
];

// ===== CÁMARA =====
async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        logMessage('❌ Esta página necesita HTTPS (o localhost) para usar la cámara', 'error');
        return false;
    }

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
        });
        video.srcObject = cameraStream;

        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                resolve();
            };
        });

        logMessage('📷 Cámara iniciada', 'success');
        return true;
    } catch (error) {
        logMessage('❌ Error accediendo a la cámara: ' + error.message, 'error');
        return false;
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        cameraStream = null;
        video.srcObject = null;
    }
}

// ===== DIBUJO DEL ESQUELETO =====
function drawSkeleton(landmarks) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;

    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 3;
    POSE_CONNECTIONS.forEach(([a, b]) => {
        const pa = landmarks[a];
        const pb = landmarks[b];
        if (!pa || !pb) return;
        if ((pa.visibility ?? 1) < 0.4 || (pb.visibility ?? 1) < 0.4) return;
        ctx.beginPath();
        ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
        ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
        ctx.stroke();
    });

    ctx.fillStyle = '#7b2ffc';
    landmarks.forEach((p) => {
        if ((p.visibility ?? 1) < 0.4) return;
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

// ===== LOOP DE DETECCIÓN =====
async function detectionLoop() {
    if (!squatCounter.state.isRunning) return;

    const landmarks = await poseDetector.detect(video);

    if (landmarks) {
        drawSkeleton(landmarks);

        const rightLeg = poseDetector.getRightLegPoints(landmarks);
        const leftLeg = poseDetector.getLeftLegPoints(landmarks);

        const rightOk = poseDetector.hasGoodConfidence([rightLeg.hip, rightLeg.knee, rightLeg.ankle]);
        const leftOk = poseDetector.hasGoodConfidence([leftLeg.hip, leftLeg.knee, leftLeg.ankle]);

        let leg = null;
        if (rightOk && leftOk) {
            const rightConf = Math.min(rightLeg.hip.visibility, rightLeg.knee.visibility, rightLeg.ankle.visibility);
            const leftConf = Math.min(leftLeg.hip.visibility, leftLeg.knee.visibility, leftLeg.ankle.visibility);
            leg = rightConf >= leftConf ? rightLeg : leftLeg;
        } else if (rightOk) {
            leg = rightLeg;
        } else if (leftOk) {
            leg = leftLeg;
        }

        if (leg) {
            const angle = poseDetector.calculateAngle(leg.hip, leg.knee, leg.ankle);
            const confidence = Math.min(leg.hip.visibility, leg.knee.visibility, leg.ankle.visibility);
            squatCounter.processAngle(angle, confidence);
        }
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    animationId = requestAnimationFrame(detectionLoop);
}

// ===== CALLBACKS DE LA MÁQUINA DE ESTADOS =====
squatCounter.setCallbacks({
    onRepComplete: (repCount, total) => {
        repCountEl.textContent = repCount;
        sound.playCorrect();
    },
    onRepInvalid: () => {
        sound.playIncorrect();
    },
    onAngleUpdate: (angle) => {
        angleValueEl.textContent = `${Math.round(angle)}°`;
        angleValueEl.classList.toggle('angle-good', angle < POSE_CONFIG.ANGLE_THRESHOLD_DOWN || angle > POSE_CONFIG.ANGLE_THRESHOLD_UP);
        angleValueEl.classList.toggle('angle-bad', !(angle < POSE_CONFIG.ANGLE_THRESHOLD_DOWN || angle > POSE_CONFIG.ANGLE_THRESHOLD_UP));
    },
    onStatusUpdate: (text, className) => {
        statusTextEl.textContent = text;
        statusTextEl.className = `value ${className}`;
    },
    onSessionComplete: (stats) => {
        sound.playComplete();
        modalMessage.textContent = `Completaste ${stats.total} repeticiones`;
        modalStats.textContent = `Válidas: ${stats.valid} | Fallidas: ${stats.invalid}`;
        modal.classList.add('show');
        stopSession();
    },
});

// ===== CONTROL DE SESIÓN =====
async function beginSession() {
    btnStart.disabled = true;
    statusTextEl.textContent = '⏳ Cargando...';
    statusTextEl.className = 'value status-loading';

    const cameraOk = await startCamera();
    if (!cameraOk) {
        btnStart.disabled = false;
        return;
    }

    if (!poseDetector.isLoaded) {
        const loaded = await poseDetector.init();
        if (!loaded) {
            btnStart.disabled = false;
            stopCamera();
            return;
        }
    }

    sound.playStart();
    const target = parseInt(targetInput.value, 10) || 10;
    targetDisplayEl.textContent = `/ ${target}`;
    squatCounter.startSession(target);

    btnStart.classList.add('hidden');
    btnStop.classList.remove('hidden');
    btnStart.disabled = false;
    targetInput.disabled = true;

    detectionLoop();
}

function stopSession() {
    squatCounter.stopSession();

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    stopCamera();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    btnStart.classList.remove('hidden');
    btnStop.classList.add('hidden');
    targetInput.disabled = false;
}

function resetUI() {
    modal.classList.remove('show');
    repCountEl.textContent = '0';
    angleValueEl.textContent = '--°';
    statusTextEl.textContent = '⏳ Iniciar';
    statusTextEl.className = 'value status-waiting';
}

// ===== EVENTOS =====
btnStart.addEventListener('click', beginSession);
btnStop.addEventListener('click', stopSession);
modalBtn.addEventListener('click', resetUI);

logMessage('📱 App lista - Presiona Iniciar', 'info');
