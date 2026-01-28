const mongoose = require('mongoose');

const nightAuditReportSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true
  },
  occupancy: {
    totalRooms: { type: Number, required: true },
    occupiedRooms: { type: Number, required: true },
    vacantRooms: { type: Number, required: true },
    occupancyRate: { type: Number, required: true }
  },
  revenue: {
    roomRevenue: { type: Number, required: true },
    restaurantRevenue: { type: Number, required: true },
    totalRevenue: { type: Number, required: true },
    adr: { type: Number, required: true },
    revpar: { type: Number, required: true }
  },
  guestActivity: {
    checkIns: { type: Number, required: true },
    checkOuts: { type: Number, required: true },
    stayOvers: { type: Number, required: true }
  },
  bookings: [{
    grcNo: String,
    name: String,
    roomNumber: String,
    checkInDate: Date,
    totalAmount: Number
  }],
  restaurantOrders: [{
    orderId: String,
    customerName: String,
    tableNo: String,
    amount: Number,
    createdAt: Date
  }],
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('NightAuditReport', nightAuditReportSchema);