const reportsService = require('../services/reports.service');
const duplicateDetection = require('../services/duplicateDetection.service');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { isValidTransition, VALID_TRANSITIONS } = require('../constants/reportEnums');

/**
 * GET /api/reports
 * Devuelve reportes como un FeatureCollection GeoJSON.
 * Soporta filtros opcionales: bbox, status, damageLevel.
 */
async function getAllReports(req, res, next) {
  try {
    const filters = {};

    // Bounding box (parseado por middleware validateBBox)
    if (req.query.parsedBBox) {
      filters.bbox = req.query.parsedBBox;
    }

    // Filtros por atributos
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.damageLevel) {
      filters.damageLevel = req.query.damageLevel;
    }

    const featureCollection = await reportsService.getAll(filters);
    res.json(featureCollection);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/:id
 * Devuelve un Feature GeoJSON individual por su ID.
 */
async function getReportById(req, res, next) {
  try {
    const feature = await reportsService.getById(req.params.id);

    if (!feature) {
      return next(new NotFoundError(`Reporte con id "${req.params.id}" no encontrado.`));
    }

    res.json(feature);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reports
 * Crea un nuevo reporte o incrementa confirmaciones si es duplicado.
 *
 * Flujo:
 *  1. Buscar si existe un reporte con ≥80% de superposición
 *  2. Si existe → incrementar confirmaciones del existente
 *  3. Si no → crear nuevo reporte
 */
async function createReport(req, res, next) {
  try {
    const { geometry } = req.body;

    // Fase 5: Detección de duplicados
    const duplicateId = await duplicateDetection.findDuplicate(geometry);

    if (duplicateId) {
      // Incrementar confirmaciones del reporte existente
      const updatedFeature = await reportsService.incrementConfirmations(duplicateId);

      return res.status(200).json({
        ...updatedFeature,
        _meta: {
          merged: true,
          message: 'Se encontró un reporte existente en la misma zona. Se incrementó el contador de confirmaciones.',
        },
      });
    }

    // No hay duplicado — crear nuevo reporte
    const newFeature = await reportsService.create(req.body);
    res.status(201).json(newFeature);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/reports/:id
 * Actualiza parcialmente un reporte (estado, nivel de daño, descripción).
 * Valida transiciones de estado según la máquina de estados.
 */
async function updateReport(req, res, next) {
  try {
    const { id } = req.params;
    const { status, damageLevel, description } = req.body;

    // Si se está cambiando el estado, validar la transición
    if (status) {
      const current = await reportsService.getById(id);

      if (!current) {
        return next(new NotFoundError(`Reporte con id "${id}" no encontrado.`));
      }

      const currentStatus = current.properties.status;

      if (!isValidTransition(currentStatus, status)) {
        const allowed = VALID_TRANSITIONS[currentStatus];
        return next(
          new ValidationError(
            `No se puede cambiar de "${currentStatus}" a "${status}". Transiciones permitidas desde "${currentStatus}": ${allowed.length > 0 ? allowed.join(', ') : 'ninguna (estado final)'}.`
          )
        );
      }
    }

    const updatedFeature = await reportsService.update(id, {
      status,
      damageLevel,
      description,
    });

    if (!updatedFeature) {
      return next(new NotFoundError(`Reporte con id "${id}" no encontrado.`));
    }

    res.json(updatedFeature);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reports/:id/confirm
 * Incrementa manualmente el contador de confirmaciones de un reporte.
 */
async function confirmReport(req, res, next) {
  try {
    const updatedFeature = await reportsService.incrementConfirmations(req.params.id);

    if (!updatedFeature) {
      return next(new NotFoundError(`Reporte con id "${req.params.id}" no encontrado.`));
    }

    res.json(updatedFeature);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/reports/:id
 * Elimina un reporte por su ID.
 */
async function deleteReport(req, res, next) {
  try {
    const deleted = await reportsService.remove(req.params.id);

    if (!deleted) {
      return next(new NotFoundError(`Reporte con id "${req.params.id}" no encontrado.`));
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllReports,
  getReportById,
  createReport,
  updateReport,
  confirmReport,
  deleteReport,
};
