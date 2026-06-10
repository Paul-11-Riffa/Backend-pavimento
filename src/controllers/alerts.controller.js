const alertsService = require('../services/alerts.service');
const { NotFoundError } = require('../utils/errors');

async function getAllAlerts(req, res, next) {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.inmateId) filters.inmateId = req.query.inmateId;
    const data = await alertsService.getAll(filters);
    res.json(data);
  } catch (error) { next(error); }
}

async function acknowledgeAlert(req, res, next) {
  try {
    const alert = await alertsService.acknowledge(req.params.id);
    if (!alert) return next(new NotFoundError(`Alerta con id "${req.params.id}" no encontrada.`));
    res.json(alert);
  } catch (error) { next(error); }
}

async function resolveAlert(req, res, next) {
  try {
    const alert = await alertsService.resolve(req.params.id);
    if (!alert) return next(new NotFoundError(`Alerta con id "${req.params.id}" no encontrada.`));
    res.json(alert);
  } catch (error) { next(error); }
}

async function getAlertStats(req, res, next) {
  try {
    const stats = await alertsService.getStats();
    res.json(stats);
  } catch (error) { next(error); }
}

module.exports = { getAllAlerts, acknowledgeAlert, resolveAlert, getAlertStats };
