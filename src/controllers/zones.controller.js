const zonesService = require('../services/zones.service');
const streetValidator = require('../services/streetValidator.service');
const { NotFoundError, ValidationError } = require('../utils/errors');

async function getAllZones(req, res, next) {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    const data = await zonesService.getAll(filters);
    res.json(data);
  } catch (error) { next(error); }
}

async function getZoneById(req, res, next) {
  try {
    const zone = await zonesService.getById(req.params.id);
    if (!zone) return next(new NotFoundError(`Zona con id "${req.params.id}" no encontrada.`));
    res.json(zone);
  } catch (error) { next(error); }
}

async function createZone(req, res, next) {
  try {
    const { geometry, properties } = req.body;

    // Validar que no contenga calles
    const validation = await streetValidator.validateNoStreets(geometry);
    if (!validation.valid) {
      return res.status(400).json({
        error: {
          status: 400,
          message: validation.message,
          streets: validation.streets,
        },
      });
    }

    const feature = await zonesService.create(req.body);

    // Incluir advertencia si Overpass no estaba disponible
    const response = { ...feature };
    if (validation.warning) {
      response._meta = { warning: validation.warning };
    }

    res.status(201).json(response);
  } catch (error) { next(error); }
}

async function updateZone(req, res, next) {
  try {
    const updated = await zonesService.update(req.params.id, req.body);
    if (!updated) return next(new NotFoundError(`Zona con id "${req.params.id}" no encontrada.`));
    res.json(updated);
  } catch (error) { next(error); }
}

async function deleteZone(req, res, next) {
  try {
    const deleted = await zonesService.remove(req.params.id);
    if (!deleted) return next(new NotFoundError(`Zona con id "${req.params.id}" no encontrada.`));
    res.status(204).end();
  } catch (error) { next(error); }
}

async function validateZone(req, res, next) {
  try {
    const { geometry } = req.body;
    if (!geometry || geometry.type !== 'Polygon') {
      return next(new ValidationError('Se requiere una geometría tipo Polygon.'));
    }
    const result = await streetValidator.validateNoStreets(geometry);
    res.json(result);
  } catch (error) { next(error); }
}

module.exports = { getAllZones, getZoneById, createZone, updateZone, deleteZone, validateZone };
