/**
 * Enumeraciones y constantes para el ciclo de vida de reportes.
 */

// ─── Niveles de Daño ─────────────────────────────────────────────────────────

const DAMAGE_LEVELS = {
  LEVE: 'leve',
  MODERADO: 'moderado',
  SEVERO: 'severo',
  CRITICO: 'critico',
};

const DAMAGE_LEVEL_VALUES = Object.values(DAMAGE_LEVELS);

const DAMAGE_LEVEL_LABELS = {
  [DAMAGE_LEVELS.LEVE]: 'Leve — Grietas superficiales, baches pequeños',
  [DAMAGE_LEVELS.MODERADO]: 'Moderado — Baches medianos, pavimento deteriorado',
  [DAMAGE_LEVELS.SEVERO]: 'Severo — Daño estructural, intransitable',
  [DAMAGE_LEVELS.CRITICO]: 'Crítico — Peligro para vehículos y peatones',
};

// ─── Estados de Reporte ──────────────────────────────────────────────────────

const REPORT_STATUSES = {
  PENDIENTE: 'pendiente',
  EN_REVISION: 'en_revision',
  EN_REPARACION: 'en_reparacion',
  SOLUCIONADO: 'solucionado',
  RECHAZADO: 'rechazado',
};

const REPORT_STATUS_VALUES = Object.values(REPORT_STATUSES);

/**
 * Transiciones de estado válidas.
 * Clave: estado actual → Valor: arreglo de estados destino permitidos.
 */
const VALID_TRANSITIONS = {
  [REPORT_STATUSES.PENDIENTE]: [
    REPORT_STATUSES.EN_REVISION,
    REPORT_STATUSES.RECHAZADO,
  ],
  [REPORT_STATUSES.EN_REVISION]: [
    REPORT_STATUSES.EN_REPARACION,
    REPORT_STATUSES.RECHAZADO,
  ],
  [REPORT_STATUSES.EN_REPARACION]: [
    REPORT_STATUSES.SOLUCIONADO,
  ],
  [REPORT_STATUSES.SOLUCIONADO]: [],   // Estado final
  [REPORT_STATUSES.RECHAZADO]: [],     // Estado final
};

/**
 * Verifica si una transición de estado es válida.
 *
 * @param {string} currentStatus — estado actual del reporte
 * @param {string} newStatus — estado destino deseado
 * @returns {boolean}
 */
function isValidTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(newStatus) : false;
}

module.exports = {
  DAMAGE_LEVELS,
  DAMAGE_LEVEL_VALUES,
  DAMAGE_LEVEL_LABELS,
  REPORT_STATUSES,
  REPORT_STATUS_VALUES,
  VALID_TRANSITIONS,
  isValidTransition,
};
