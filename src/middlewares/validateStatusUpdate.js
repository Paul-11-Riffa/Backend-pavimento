const { ValidationError } = require('../utils/errors');
const {
  REPORT_STATUS_VALUES,
  DAMAGE_LEVEL_VALUES,
  VALID_TRANSITIONS,
  isValidTransition,
} = require('../constants/reportEnums');

/**
 * Middleware que valida actualizaciones parciales de un reporte (PATCH).
 *
 * Valida:
 *  1. Que el body tenga al menos un campo actualizable
 *  2. Si se envía "status": que sea un valor válido
 *     (la transición se valida en el controller, donde tenemos acceso al estado actual)
 *  3. Si se envía "damageLevel": que sea un valor válido
 */
function validateStatusUpdate(req, res, next) {
  const { status, damageLevel, description } = req.body;

  // Al menos un campo debe estar presente
  if (status === undefined && damageLevel === undefined && description === undefined) {
    return next(
      new ValidationError(
        'Debe enviar al menos un campo para actualizar: "status", "damageLevel", o "description".'
      )
    );
  }

  // Validar status si se envía
  if (status !== undefined) {
    if (!REPORT_STATUS_VALUES.includes(status)) {
      return next(
        new ValidationError(
          `Estado "${status}" no válido. Estados permitidos: ${REPORT_STATUS_VALUES.join(', ')}.`
        )
      );
    }
  }

  // Validar damageLevel si se envía
  if (damageLevel !== undefined) {
    if (!DAMAGE_LEVEL_VALUES.includes(damageLevel)) {
      return next(
        new ValidationError(
          `Nivel de daño "${damageLevel}" no válido. Niveles permitidos: ${DAMAGE_LEVEL_VALUES.join(', ')}.`
        )
      );
    }
  }

  // Validar description si se envía
  if (description !== undefined && typeof description !== 'string') {
    return next(
      new ValidationError('"description" debe ser una cadena de texto.')
    );
  }

  next();
}

module.exports = validateStatusUpdate;
