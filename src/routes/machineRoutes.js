const router = require('express').Router();
const controller = require('../controllers/machineController');
router.get('/', controller.listMachines);
router.get('/:machine_id', controller.getMachine);
module.exports = router;
