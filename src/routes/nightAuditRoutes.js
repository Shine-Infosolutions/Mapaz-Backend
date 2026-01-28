const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Booking = require('../models/Booking');
const Room = require('../models/Room');

// Generate night audit report for a specific date
router.get('/report/:date', auth, async (req, res) => {
  try {
    const { date } = req.params;
    const reportDate = new Date(date);
    const nextDay = new Date(reportDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get all bookings for the date
    const bookings = await Booking.find({
      $or: [
        { checkInDate: { $gte: reportDate, $lt: nextDay } },
        { checkOutDate: { $gte: reportDate, $lt: nextDay } },
        { 
          checkInDate: { $lt: reportDate },
          checkOutDate: { $gt: reportDate }
        }
      ]
    }).populate('categoryId');

    // Get restaurant orders for the date
    let restaurantOrders = [];
    try {
      const RestaurantOrder = require('../models/RestaurantOrder');
      restaurantOrders = await RestaurantOrder.find({
        createdAt: { $gte: reportDate, $lt: nextDay }
      });
    } catch (error) {
      console.warn('RestaurantOrder model not found');
    }

    // Get room service orders for the date
    let roomServiceOrders = [];
    try {
      const RoomService = require('../models/RoomService');
      roomServiceOrders = await RoomService.find({
        createdAt: { $gte: reportDate, $lt: nextDay }
      });
    } catch (error) {
      console.warn('RoomService model not found');
    }

    // Get all rooms
    const allRooms = await Room.find().populate('categoryId');

    // Calculate metrics
    const checkIns = bookings.filter(b => {
      const checkIn = new Date(b.checkInDate);
      return checkIn >= reportDate && checkIn < nextDay;
    });

    const checkOuts = bookings.filter(b => {
      const checkOut = new Date(b.checkOutDate);
      return checkOut >= reportDate && checkOut < nextDay;
    });

    const occupiedRooms = bookings.filter(b => 
      b.status === 'Checked In' || 
      (new Date(b.checkInDate) <= reportDate && new Date(b.checkOutDate) > reportDate)
    );

    // Revenue calculations
    const roomRevenue = bookings.reduce((sum, booking) => {
      if (booking.status === 'Checked In' || booking.status === 'Checked Out') {
        return sum + (booking.totalAmount || 0);
      }
      return sum;
    }, 0);

    const restaurantRevenue = restaurantOrders.reduce((sum, order) => 
      sum + (order.amount || 0), 0);

    const roomServiceRevenue = roomServiceOrders.reduce((sum, order) => 
      sum + (order.totalAmount || 0), 0);

    const totalRevenue = roomRevenue + restaurantRevenue + roomServiceRevenue;

    // Occupancy calculations
    const totalRooms = allRooms.length;
    const occupiedCount = occupiedRooms.length;
    const occupancyRate = totalRooms > 0 ? (occupiedCount / totalRooms) * 100 : 0;

    // Average Daily Rate
    const adr = occupiedCount > 0 ? roomRevenue / occupiedCount : 0;

    // Revenue Per Available Room
    const revpar = totalRooms > 0 ? roomRevenue / totalRooms : 0;

    const reportData = {
      date: reportDate.toISOString().split('T')[0],
      occupancy: {
        totalRooms,
        occupiedRooms: occupiedCount,
        vacantRooms: totalRooms - occupiedCount,
        occupancyRate: Math.round(occupancyRate * 100) / 100
      },
      guestActivity: {
        checkIns: checkIns.length,
        checkOuts: checkOuts.length,
        stayOvers: occupiedRooms.filter(b => 
          new Date(b.checkInDate) < reportDate && new Date(b.checkOutDate) > nextDay
        ).length
      },
      revenue: {
        roomRevenue: Math.round(roomRevenue * 100) / 100,
        restaurantRevenue: Math.round(restaurantRevenue * 100) / 100,
        roomServiceRevenue: Math.round(roomServiceRevenue * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        adr: Math.round(adr * 100) / 100,
        revpar: Math.round(revpar * 100) / 100
      },
      bookings: checkIns.map(b => ({
        grcNo: b.grcNo,
        name: b.name,
        roomNumber: b.roomNumber,
        checkInDate: b.checkInDate,
        totalAmount: b.totalAmount
      })),
      restaurantOrders: restaurantOrders.map(o => ({
        orderId: o._id.toString().slice(-6),
        customerName: o.customerName,
        tableNo: o.tableNo,
        amount: o.amount,
        createdAt: o.createdAt
      })),
      roomServiceOrders: roomServiceOrders.map(o => ({
        orderId: o._id.toString().slice(-6),
        roomNumber: o.roomNumber,
        guestName: o.guestName,
        totalAmount: o.totalAmount,
        status: o.status,
        createdAt: o.createdAt
      }))
    };

    res.json(reportData);
  } catch (error) {
    console.error('Error generating night audit report:', error);
    res.status(500).json({ message: 'Error generating report', error: error.message });
  }
});

module.exports = router;