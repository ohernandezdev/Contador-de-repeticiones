// ============================================================
//  SISTEMA DE SONIDOS - sound.js
//  Genera sonidos usando Web Audio API sin archivos externos
// ============================================================

class SoundGenerator {
    constructor() {
        this.audioCtx = null;
        this.initialized = false;
    }

    /**
     * Inicializa el contexto de audio
     * @returns {boolean} true si se inicializó correctamente
     */
    init() {
        if (!this.initialized) {
            try {
                this.audioCtx = new(window.AudioContext || window.webkitAudioContext)();
                this.initialized = true;
                logMessage('🔊 Audio inicializado', 'success');
            } catch (e) {
                logMessage('⚠️ Audio no soportado: ' + e.message, 'warning');
            }
        }
        return this.initialized;
    }

    /**
     * Reproduce un tono simple
     * @param {number} frequency - Frecuencia en Hz
     * @param {number} duration - Duración en segundos
     * @param {string} type - Tipo de onda: 'sine', 'square', 'sawtooth', 'triangle'
     * @param {number} volume - Volumen (0-1)
     */
    playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (!this.init()) return;
        
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.type = type;
            osc.frequency.value = frequency;
            
            gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.start(this.audioCtx.currentTime);
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) {
            logMessage('⚠️ Error en sonido: ' + e.message, 'warning');
        }
    }

    /**
     * Sonido de repetición CORRECTA ✅ - Ascendente alegre
     */
    playCorrect() {
        this.playTone(880, 0.12, 'sine', 0.35);
        setTimeout(() => this.playTone(1108, 0.15, 'sine', 0.3), 120);
        setTimeout(() => this.playTone(1318, 0.20, 'sine', 0.3), 250);
        logMessage('🔊 ✅ CORRECTO', 'success');
    }

    /**
     * Sonido de repetición INCORRECTA ❌ - Descendente grave
     */
    playIncorrect() {
        this.playTone(400, 0.2, 'sawtooth', 0.2);
        setTimeout(() => this.playTone(300, 0.25, 'sawtooth', 0.2), 200);
        logMessage('🔊 ❌ INCORRECTO', 'warning');
    }

    /**
     * Sonido de INICIO de sesión 🚀 - Ascendente
     */
    playStart() {
        this.playTone(523, 0.1, 'sine', 0.25);
        setTimeout(() => this.playTone(659, 0.1, 'sine', 0.25), 100);
        setTimeout(() => this.playTone(783, 0.15, 'sine', 0.3), 200);
        logMessage('🔊 🚀 INICIO', 'info');
    }

    /**
     * Sonido de COMPLETADO 🏆 - Fanfarria
     */
    playComplete() {
        this.playTone(523, 0.1, 'sine', 0.25);
        setTimeout(() => this.playTone(659, 0.1, 'sine', 0.25), 120);
        setTimeout(() => this.playTone(783, 0.1, 'sine', 0.25), 240);
        setTimeout(() => this.playTone(1046, 0.3, 'sine', 0.35), 360);
        logMessage('🔊 🏆 COMPLETADO', 'success');
    }
}

// Instancia global para usar en toda la app
const sound = new SoundGenerator();