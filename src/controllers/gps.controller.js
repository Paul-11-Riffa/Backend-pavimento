const gpsService = require('../services/gps.service');
const { ValidationError } = require('../utils/errors');

async function recordPosition(req, res, next) {
  try {
    const { inmateId, lat, lng, accuracy } = req.body;

    if (!inmateId || lat === undefined || lng === undefined) {
      return next(new ValidationError('Se requiere "inmateId", "lat" y "lng".'));
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return next(new ValidationError('"lat" y "lng" deben ser números.'));
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return next(new ValidationError('Coordenadas fuera de rango.'));
    }

    const result = await gpsService.recordPosition(inmateId, lat, lng, accuracy);
    res.json(result);
  } catch (error) { next(error); }
}

async function getLatestPositions(req, res, next) {
  try {
    const positions = await gpsService.getLatestPositions();
    res.json(positions);
  } catch (error) { next(error); }
}

async function getHistory(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const history = await gpsService.getHistory(req.params.inmateId, limit);
    res.json(history);
  } catch (error) { next(error); }
}

module.exports = { recordPosition, getLatestPositions, getHistory };
