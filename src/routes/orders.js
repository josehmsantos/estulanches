const router = require('express').Router();
const controller = require('../controllers/order-controller');
const asyncHandler = require('../async-handler');
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));
router.post('/', asyncHandler(controller.create));
router.patch('/:id/status', asyncHandler(controller.updateStatus));
module.exports = router;
