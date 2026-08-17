const router = require('express').Router();
const controller = require('../controllers/sensorController');
router.get('/latest/:machine_id', controller.latest);
router.get('/history/:machine_id', controller.history);
module.exports = router;
