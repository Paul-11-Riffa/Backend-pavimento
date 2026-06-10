const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/errors');
const config = require('../config');

/**
 * Middleware para verificar JWT token
 */
module.exports = function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next(new UnauthorizedError('No token provided'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(new UnauthorizedError('Token error'));
  }

  const token = parts[1];

  // We should use an environment variable for the secret in production, 
  // but for the sake of the project, we'll use a fallback here if not set.
  const secret = process.env.JWT_SECRET || 'super-secret-geoguard-key';

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return next(new UnauthorizedError('Failed to authenticate token'));
    }

    // Guardar los datos del usuario en la request
    req.userId = decoded.id;
    req.userRole = decoded.role;
    req.username = decoded.username;
    next();
  });
};
