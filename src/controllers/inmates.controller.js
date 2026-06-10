const inmatesService = require('../services/inmates.service');
const { NotFoundError, ValidationError } = require('../utils/errors');

async function getAllInmates(req, res, next) {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.zoneId) filters.zoneId = req.query.zoneId;
    const data = await inmatesService.getAll(filters);
    res.json(data);
  } catch (error) { next(error); }
}

async function getInmateById(req, res, next) {
  try {
    const inmate = await inmatesService.getById(req.params.id);
    if (!inmate) return next(new NotFoundError(`Reo con id "${req.params.id}" no encontrado.`));
    res.json(inmate);
  } catch (error) { next(error); }
}

async function createInmate(req, res, next) {
  try {
    const { name, identification, zoneId, deviceId } = req.body;
    if (!name || !identification) {
      return next(new ValidationError('Se requiere "name" e "identification".'));
    }
    const inmate = await inmatesService.create({ name, identification, zoneId, deviceId });
    res.status(201).json(inmate);
  } catch (error) {
    // Handle unique constraint violation on identification
    if (error.code === '23505') {
      return next(new ValidationError('Ya existe un reo con esa identificación.'));
    }
    next(error);
  }
}

async function updateInmate(req, res, next) {
  try {
    const updated = await inmatesService.update(req.params.id, req.body);
    if (!updated) return next(new NotFoundError(`Reo con id "${req.params.id}" no encontrado.`));
    res.json(updated);
  } catch (error) { next(error); }
}

async function deleteInmate(req, res, next) {
  try {
    const deleted = await inmatesService.remove(req.params.id);
    if (!deleted) return next(new NotFoundError(`Reo con id "${req.params.id}" no encontrado.`));
    res.status(204).end();
  } catch (error) { next(error); }
}

module.exports = { getAllInmates, getInmateById, createInmate, updateInmate, deleteInmate };
