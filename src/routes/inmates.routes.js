const { Router } = require('express');
const controller = require('../controllers/inmates.controller');

const router = Router();

router.get('/', controller.getAllInmates);
router.get('/:id', controller.getInmateById);
router.post('/', controller.createInmate);
router.patch('/:id', controller.updateInmate);
router.delete('/:id', controller.deleteInmate);

module.exports = router;
