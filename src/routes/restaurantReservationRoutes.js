const express = require('express');
const restaurantReservationController = require('../controllers/reasturantReservationController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/create', auth, authorize('admin', 'staff', 'restaurant'), restaurantReservationController.createReservation);
router.get("/available-slots", auth, authorize('admin', 'staff', 'restaurant'), restaurantReservationController.getAvailableSlots);
router.get('/all', restaurantReservationController.getAllReservations);
router.get('/:id', restaurantReservationController.getReservationById);
router.put('/:id', auth, authorize('admin', 'staff', 'restaurant'), restaurantReservationController.updateReservation);
router.patch('/:id/status', auth, authorize('admin', 'staff', 'restaurant'), restaurantReservationController.updateReservationStatus);
router.patch('/:id/assign-table', auth, authorize('admin', 'staff', 'restaurant'), restaurantReservationController.assignTable);
router.patch('/:id/payment', auth, authorize('admin', 'staff', 'restaurant'), restaurantReservationController.updatePayment);
router.delete('/:id', auth, authorize('admin'), restaurantReservationController.deleteReservation);

module.exports = router;
