// ============================================================
//  LÓGICA DE SENTADILLA - squat-logic.js
//  Máquina de estados para contar repeticiones
// ============================================================

class SquatCounter {
    constructor() {
        // Estado de la máquina
        this.state = {
            isRunning: false,
            repCount: 0,
            targetReps: 10,
            repPhase: 'up',        // 'up' | 'down'
            angle: 0,
            lastRepTime: 0,
            repStartTime: 0,
            validReps: 0,
            invalidReps: 0,
            isDown: false,
            lastValidAngle: 0,
            sessionComplete: false,
        };

        // Callbacks para eventos
        this.callbacks = {
            onRepComplete: null,   // (repCount, total) => void
            onRepInvalid: null,    // (reason) => void
            onSessionComplete: null, // (stats) => void
            onAngleUpdate: null,   // (angle) => void
            onStatusUpdate: null,  // (status, className) => void
        };
    }

    /**
     * Configura los callbacks de eventos
     * @param {Object} callbacks 
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Inicia una nueva sesión
     * @param {number} target - Número objetivo de repeticiones
     */
    startSession(target) {
        this.state.targetReps = Math.max(1, Math.min(100, target));
        this.state.repCount = 0;
        this.state.validReps = 0;
        this.state.invalidReps = 0;
        this.state.repPhase = 'up';
        this.state.isDown = false;
        this.state.sessionComplete = false;
        this.state.lastValidAngle = 180;
        this.state.isRunning = true;

        this._updateStatus('⬆️ De pie', 'status-waiting');
        logMessage(`🚀 Sesión iniciada - Objetivo: ${this.state.targetReps}`, 'success');
    }

    /**
     * Detiene la sesión actual
     */
    stopSession() {
        this.state.isRunning = false;
        this._updateStatus('⏹ Detenido', 'status-waiting');
        logMessage('⏹ Sesión detenida', 'info');
    }

    /**
     * Procesa un nuevo ángulo de rodilla
     * @param {number} angle - Ángulo en grados
     * @param {number} confidence - Confianza de la detección
     */
    processAngle(angle, confidence) {
        if (!this.state.isRunning || this.state.sessionComplete) return;
        if (confidence < POSE_CONFIG.CONFIDENCE_MIN) return;

        const now = Date.now();
        this.state.angle = angle;

        // Notificar actualización de ángulo
        if (this.callbacks.onAngleUpdate) {
            this.callbacks.onAngleUpdate(angle);
        }

        // Máquina de estados
        if (this.state.repPhase === 'up') {
            // Detectando bajada
            if (angle < POSE_CONFIG.ANGLE_THRESHOLD_DOWN && !this.state.isDown) {
                this.state.isDown = true;
                this.state.repStartTime = now;
                this.state.lastValidAngle = angle;
                this._updateStatus('⬇️ Bajando...', 'status-waiting');
                logMessage(`⬇️ Bajando: ${Math.round(angle)}°`, 'info');
            }

            // Detectando subida (fin de repetición)
            if (this.state.isDown && angle > POSE_CONFIG.ANGLE_THRESHOLD_UP) {
                this._completeRepetition(now);
            }
        }

        // Actualizar ángulo mínimo de la repetición actual
        if (this.state.isDown && angle < this.state.lastValidAngle) {
            this.state.lastValidAngle = angle;
        }
    }

    /**
     * Completa una repetición (subida detectada)
     * @param {number} now - Timestamp actual
     */
    _completeRepetition(now) {
        const timeElapsed = now - this.state.repStartTime;

        // Validar la repetición
        const isValid = (
            this.state.lastValidAngle <= POSE_CONFIG.ANGLE_THRESHOLD_DOWN &&
            timeElapsed >= POSE_CONFIG.MIN_REP_TIME &&
            timeElapsed <= POSE_CONFIG.MAX_REP_TIME
        );

        if (isValid) {
            // ✅ REPETICIÓN VÁLIDA
            this.state.repCount++;
            this.state.validReps++;
            this.state.repPhase = 'up';
            this.state.isDown = false;

            this._updateStatus('✅ Correcta!', 'status-correct');
            logMessage(`✅ ${this.state.repCount}/${this.state.targetReps}`, 'success');

            if (this.callbacks.onRepComplete) {
                this.callbacks.onRepComplete(this.state.repCount, this.state.targetReps);
            }

            // Verificar si se completó el objetivo
            if (this.state.repCount >= this.state.targetReps) {
                this._completeSession();
                return;
            }

            this.state.lastRepTime = now;
        } else {
            // ❌ REPETICIÓN INVÁLIDA
            this.state.invalidReps++;
            this.state.repPhase = 'up';
            this.state.isDown = false;

            const reason = this._getFailureReason(timeElapsed);
            this._updateStatus(`❌ ${reason}`, 'status-incorrect');
            logMessage(`❌ Fallida: ${reason}`, 'warning');

            if (this.callbacks.onRepInvalid) {
                this.callbacks.onRepInvalid(reason);
            }
        }
    }

    /**
     * Determina la razón del fallo
     * @param {number} timeElapsed - Tiempo de la repetición
     * @returns {string} Razón del fallo
     */
    _getFailureReason(timeElapsed) {
        if (this.state.lastValidAngle > POSE_CONFIG.ANGLE_THRESHOLD_DOWN) {
            return 'No bajaste suficiente';
        } else if (timeElapsed < POSE_CONFIG.MIN_REP_TIME) {
            return 'Muy rápido';
        } else if (timeElapsed > POSE_CONFIG.MAX_REP_TIME) {
            return 'Muy lento';
        }
        return 'Forma incorrecta';
    }

    /**
     * Completa la sesión exitosamente
     */
    _completeSession() {
        this.state.sessionComplete = true;
        this.state.isRunning = false;

        this._updateStatus('🏆 Completado!', 'status-correct');
        logMessage(`🏆 SESIÓN COMPLETADA - ${this.state.validReps} válidas, ${this.state.invalidReps} fallidas`, 'success');

        if (this.callbacks.onSessionComplete) {
            this.callbacks.onSessionComplete({
                total: this.state.repCount,
                valid: this.state.validReps,
                invalid: this.state.invalidReps,
                target: this.state.targetReps,
            });
        }
    }

    /**
     * Actualiza el estado visual
     * @param {string} text - Texto del estado
     * @param {string} className - Clase CSS
     */
    _updateStatus(text, className) {
        if (this.callbacks.onStatusUpdate) {
            this.callbacks.onStatusUpdate(text, className);
        }
    }

    /**
     * Obtiene el estado actual
     * @returns {Object} Estado completo
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Obtiene el conteo actual
     * @returns {number} Repeticiones contadas
     */
    getCount() {
        return this.state.repCount;
    }

    /**
     * Obtiene el ángulo actual
     * @returns {number} Ángulo en grados
     */
    getAngle() {
        return this.state.angle;
    }
}

// Instancia global
const squatCounter = new SquatCounter();