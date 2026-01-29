const express = require("express");
const router = express.Router();
const {
  createBooking,
  getBookings,
  getBookingById,
  searchBooking,
  getAllPagination,
  deleteBooking,
  updateBooking
} = require("../controllers/banquetbookingController");
const { auth, authorize } = require('../middleware/auth');

// Create banquet booking (Fixed authorization for admin role)
router.post("/create", auth, authorize(['admin']), (req, res, next) => {
  console.log("=== BANQUET BOOKING CREATE REQUEST ===");
  console.log("User:", req.user);
  console.log("User Role:", req.user?.role);
  console.log("Request Body:", req.body);
  next();
}, createBooking);

// Get all banquet bookings (All roles)
router.get("/", auth, authorize(['ADMIN', 'GM', 'ACCOUNTS', 'STAFF', 'FRONT DESK']), getBookings);

// Get banquet bookings with pagination (All roles)
router.get("/pg", auth, authorize(['ADMIN', 'GM', 'ACCOUNTS', 'STAFF', 'FRONT DESK']), getAllPagination);

// Search banquet bookings (All roles)
router.get('/search', auth, authorize(['ADMIN', 'GM', 'ACCOUNTS', 'STAFF', 'FRONT DESK']), searchBooking);

// Get banquet booking by ID (All roles)
router.get("/get/:id", auth, authorize(['ADMIN', 'GM', 'ACCOUNTS', 'STAFF', 'FRONT DESK']), getBookingById);

// Delete banquet booking (Admin only)
router.delete("/delete/:id", auth, authorize('ADMIN'), deleteBooking);

// Update banquet booking (Front Desk, Staff, Admin, GM)
router.options("/update/:id", (req, res) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "PUT, OPTIONS");
  res.header("Access-Control-Allow-Headers", "authorization, content-type");
  res.sendStatus(204);
});
router.put("/update/:id", auth, authorize(['FRONT DESK', 'STAFF', 'ADMIN', 'GM']), updateBooking);

module.exports = router;
