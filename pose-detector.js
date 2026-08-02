// ============================================================
//  DETECTOR DE POSES - pose-detector.js
//  Gestiona MediaPipe Pose para detectar articulaciones
// ============================================================

/**
 * Configuración del detector de poses
 */
const POSE_CONFIG = {
    ANGLE_THRESHOLD_DOWN: 90,   // Ángulo para "bajada completa" (paralelo o más profundo)
    ANGLE_THRESHOLD_UP: 155,    // Ángulo para "de pie"
    MIN_REP_TIME: 600,          // Tiempo mínimo por repetición (ms)
    MAX_REP_TIME: 5000,         // Tiempo máximo por repetición (ms)
    CONFIDENCE_MIN: 0.5,        // Confianza mínima para detectar puntos
};

class PoseDetector {
    constructor() {
        this.detector = null;
        this.isLoaded = false;
        this.isProcessing = false;
    }

    /**
     * Inicializa el detector de MediaPipe
     * @returns {Promise<boolean>} true si se cargó correctamente
     */
    async init() {
        try {
            logMessage('⏳ Cargando MediaPipe Pose...', 'info');
            
            if (typeof PoseLandmarker === 'undefined') {
                throw new Error('MediaPipe Vision no está disponible. Verifica la conexión a internet.');
            }

            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm'
            );

            this.detector = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                    delegate: 'GPU'
                },
                runningMode: 'VIDEO',
                numPoses: 1,
                minPoseDetectionConfidence: 0.5,
                minPosePresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            this.isLoaded = true;
            logMessage('✅ MediaPipe Pose cargado correctamente', 'success');
            return true;
        } catch (error) {
            logMessage('❌ Error cargando MediaPipe: ' + error.message, 'error');
            console.error('Error detallado:', error);
            return false;
        }
    }

    /**
     * Detecta poses en un frame de video
     * @param {HTMLVideoElement} video - Elemento de video
     * @returns {Promise<Object|null>} Landmarks detectados o null
     */
    async detect(video) {
        if (!this.isLoaded || !this.detector || video.readyState < 2) {
            return null;
        }

        try {
            const result = await this.detector.detectForVideo(video, performance.now());
            
            if (result.landmarks && result.landmarks.length > 0) {
                return result.landmarks[0];
            }
            return null;
        } catch (error) {
            logMessage('⚠️ Error en detección: ' + error.message, 'warning');
            return null;
        }
    }

    /**
     * Obtiene un landmark específico con su visibilidad
     * @param {Array} landmarks - Array de landmarks
     * @param {number} index - Índice del landmark
     * @returns {Object|null} Punto con x, y, visibility
     */
    getLandmark(landmarks, index) {
        if (!landmarks || !landmarks[index]) return null;
        return {
            x: landmarks[index].x,
            y: landmarks[index].y,
            visibility: landmarks[index].visibility || 0.5
        };
    }

    /**
     * Calcula el ángulo entre tres puntos
     * @param {Object} p1 - Punto 1 (cadera)
     * @param {Object} p2 - Punto 2 (rodilla) - VÉRTICE
     * @param {Object} p3 - Punto 3 (tobillo)
     * @returns {number} Ángulo en grados
     */
    calculateAngle(p1, p2, p3) {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        
        if (mag1 === 0 || mag2 === 0) return 0;
        
        const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        return Math.acos(cosAngle) * 180 / Math.PI;
    }

    /**
     * Obtiene los puntos clave de la pierna derecha
     * @param {Array} landmarks - Array de landmarks
     * @returns {Object} Puntos de cadera, rodilla y tobillo
     */
    getRightLegPoints(landmarks) {
        return {
            hip: this.getLandmark(landmarks, 24),
            knee: this.getLandmark(landmarks, 26),
            ankle: this.getLandmark(landmarks, 28)
        };
    }

    /**
     * Obtiene los puntos clave de la pierna izquierda
     * @param {Array} landmarks - Array de landmarks
     * @returns {Object} Puntos de cadera, rodilla y tobillo
     */
    getLeftLegPoints(landmarks) {
        return {
            hip: this.getLandmark(landmarks, 23),
            knee: this.getLandmark(landmarks, 25),
            ankle: this.getLandmark(landmarks, 27)
        };
    }

    /**
     * Verifica si los puntos tienen suficiente confianza
     * @param {Array} points - Array de puntos
     * @param {number} threshold - Umbral de confianza
     * @returns {boolean}
     */
    hasGoodConfidence(points, threshold = POSE_CONFIG.CONFIDENCE_MIN) {
        return points.every(p => p && p.visibility >= threshold);
    }
}

// Instancia global
const poseDetector = new PoseDetector();