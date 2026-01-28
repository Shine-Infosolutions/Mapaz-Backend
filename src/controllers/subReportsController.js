const Booking = require('../models/Booking');
const Room = require('../models/Room');

// House Status Report
const getHouseStatus = async (req, res) => {
  try {
    const { date } = req.params;
    const reportDate = new Date(date);
    const nextDay = new Date(reportDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const rooms = await Room.find().populate('categoryId');
    const bookings = await Booking.find({
      $or: [
        { checkInDate: { $lte: reportDate }, checkOutDate: { $gt: reportDate } },
        { status: 'Checked In' }
      ]
    });

    const houseStatus = rooms.map(room => {
      const booking = bookings.find(b => b.roomNumber === room.roomNumber);
      return {
        roomNumber: room.roomNumber,
        roomType: room.categoryId?.name || 'Standard',
        status: booking ? 'Occupied' : 'Vacant',
        guestName: booking?.name || null,
        grcNo: booking?.grcNo || null,
        checkIn: booking?.checkInDate || null,
        checkOut: booking?.checkOutDate || null
      };
    });

    res.json({ houseStatus });
  } catch (error) {
    res.status(500).json({ message: 'Error generating house status', error: error.message });
  }
};

// MOP Wise Cashier Report
const getMOPWiseCashierReport = async (req, res) => {
  try {
    const { date } = req.params;
    const reportDate = new Date(date);
    const nextDay = new Date(reportDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const bookings = await Booking.find({
      createdAt: { $gte: reportDate, $lt: nextDay }
    });

    const mopReport = {};
    bookings.forEach(booking => {
      if (booking.advancePayments && booking.advancePayments.length > 0) {
        booking.advancePayments.forEach(payment => {
          const mode = payment.paymentMode || 'Cash';
          if (!mopReport[mode]) {
            mopReport[mode] = { count: 0, amount: 0 };
          }
          mopReport[mode].count += 1;
          mopReport[mode].amount += payment.amount || 0;
        });
      }
    });

    res.json({ mopReport });
  } catch (error) {
    res.status(500).json({ message: 'Error generating MOP report', error: error.message });
  }
};

// Revenue Analysis
const getRevenueAnalysis = async (req, res) => {
  try {
    const { date } = req.params;
    const reportDate = new Date(date);
    const nextDay = new Date(reportDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const bookings = await Booking.find({
      checkInDate: { $gte: reportDate, $lt: nextDay }
    });

    const revenueAnalysis = {
      roomRevenue: bookings.reduce((sum, b) => sum + (b.rate || 0), 0),
      totalBookings: bookings.length,
      averageRate: bookings.length > 0 ? bookings.reduce((sum, b) => sum + (b.rate || 0), 0) / bookings.length : 0,
      categoryWise: {}
    };

    res.json({ revenueAnalysis });
  } catch (error) {
    res.status(500).json({ message: 'Error generating revenue analysis', error: error.message });
  }
};

// In House Guest Due Balance
const getInHouseGuestDueBalance = async (req, res) => {
  try {
    const bookings = await Booking.find({
      status: 'Checked In',
      paymentStatus: { $in: ['Pending', 'Partial'] }
    });

    const dueBalances = bookings.map(booking => ({
      grcNo: booking.grcNo,
      guestName: booking.name,
      roomNumber: booking.roomNumber,
      totalAmount: booking.rate || 0,
      advancePaid: booking.advancePayments?.reduce((sum, p) => sum + p.amount, 0) || 0,
      dueAmount: (booking.rate || 0) - (booking.advancePayments?.reduce((sum, p) => sum + p.amount, 0) || 0)
    }));

    res.json({ dueBalances });
  } catch (error) {
    res.status(500).json({ message: 'Error generating due balance report', error: error.message });
  }
};

// 10 Days Forecast
const get10DaysForecast = async (req, res) => {
  try {
    const { date } = req.params;
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 10);

    const bookings = await Booking.find({
      $or: [
        { checkInDate: { $gte: startDate, $lt: endDate } },
        { checkOutDate: { $gte: startDate, $lt: endDate } }
      ]
    });

    const forecast = [];
    for (let i = 0; i < 10; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayBookings = bookings.filter(b => 
        new Date(b.checkInDate) >= currentDate && new Date(b.checkInDate) < nextDate
      );

      forecast.push({
        date: currentDate,
        bookings: dayBookings.length,
        revenue: dayBookings.reduce((sum, b) => sum + (b.rate || 0), 0)
      });
    }

    res.json({ forecast });
  } catch (error) {
    res.status(500).json({ message: 'Error generating forecast', error: error.message });
  }
};

module.exports = {
  getHouseStatus,
  getMOPWiseCashierReport,
  getRevenueAnalysis,
  getInHouseGuestDueBalance,
  get10DaysForecast
};