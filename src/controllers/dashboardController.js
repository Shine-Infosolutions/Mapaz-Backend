const Booking = require('../models/Booking');
const RestaurantOrder = require('../models/RestaurantOrder');
const RoomService = require('../models/RoomService');
const Laundry = require('../models/Laundry');

exports.getDashboardStats = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    
    // Date range calculation
    let dateFilter = {};
    const now = new Date();
    
    switch (filter) {
      case 'today':
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        dateFilter = {
          createdAt: {
            $gte: todayStart,
            $lte: todayEnd
          }
        };
        break;
      case 'weekly':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        dateFilter = { createdAt: { $gte: weekStart } };
        break;
      case 'monthly':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1),
            $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
          }
        };
        break;
      case 'yearly':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), 0, 1),
            $lt: new Date(now.getFullYear() + 1, 0, 1)
          }
        };
        break;
      case 'range':
        if (startDate && endDate) {
          dateFilter = {
            createdAt: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          };
        }
        break;
    }

    // Base query - always exclude deleted bookings
    const baseQuery = { deleted: { $ne: true } };
    const filteredQuery = { ...baseQuery, ...dateFilter };

    console.log('Dashboard query:', filteredQuery);

    // Get all bookings count (not filtered by date)
    const totalBookingsCount = await Booking.countDocuments(baseQuery);
    console.log('Total bookings (all time):', totalBookingsCount);

    // Get filtered counts - use all-time for main stats
    const [filteredBookings, activeBookings, cancelledBookings, checkedOutBookings] = await Promise.all([
      Booking.countDocuments(filteredQuery),
      Booking.countDocuments({ ...baseQuery, status: 'Checked In' }), // All-time active
      Booking.countDocuments({ ...baseQuery, status: 'Cancelled' }), // All-time cancelled
      Booking.countDocuments({ ...baseQuery, status: 'Checked Out' }) // All-time checked out
    ]);

    // Calculate revenue from all bookings (not filtered by date)
    const revenueResult = await Booking.aggregate([
      { $match: baseQuery }, // All-time revenue
      { $group: { _id: null, total: { $sum: '$rate' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Payment counts from all bookings
    const [cashPayments, upiPayments, cardPayments] = await Promise.all([
      Booking.countDocuments({ ...baseQuery, paymentMode: 'Cash' }),
      Booking.countDocuments({ ...baseQuery, paymentMode: 'UPI' }),
      Booking.countDocuments({ ...baseQuery, paymentMode: { $in: ['Card', 'Online', 'Debit Card', 'Credit Card'] } })
    ]);

    // Count bookings with advance payments
    const advanceCashPayments = await Booking.countDocuments({ 
      ...baseQuery, 
      'advancePayments.paymentMode': { $regex: /cash/i } 
    });
    const advanceOnlinePayments = await Booking.countDocuments({ 
      ...baseQuery, 
      'advancePayments.paymentMode': { $regex: /upi|online|card/i } 
    });

    // Today's check-ins/check-outs
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const [todayCheckIns, todayCheckOuts] = await Promise.all([
      Booking.countDocuments({ 
        deleted: { $ne: true }, 
        status: 'Checked In', 
        actualCheckInTime: { $gte: todayStart, $lte: todayEnd }
      }),
      Booking.countDocuments({ 
        deleted: { $ne: true }, 
        status: 'Checked Out', 
        actualCheckOutTime: { $gte: todayStart, $lte: todayEnd }
      })
    ]);

    const stats = {
      totalBookings: totalBookingsCount, // All-time total
      activeBookings, // All-time active (Checked In)
      cancelledBookings, // All-time cancelled
      checkedOutBookings, // All-time checked out
      payments: {
        cash: cashPayments + advanceCashPayments,
        upi: upiPayments + cardPayments + advanceOnlinePayments,
        other: Math.max(0, totalBookingsCount - (cashPayments + upiPayments + cardPayments + advanceCashPayments + advanceOnlinePayments))
      },
      totalRevenue, // All-time revenue
      todayCheckIns,
      todayCheckOuts,
      restaurantOrders: 0, // Will be populated by separate API
      laundryOrders: 0 // Will be populated by separate API
    };

    console.log('Dashboard stats:', stats);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.downloadDashboardCSV = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    
    // Date range calculation (same as getDashboardStats)
    let dateFilter = {};
    const now = new Date();
    
    switch (filter) {
      case 'today':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          }
        };
        break;
      case 'weekly':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        dateFilter = { createdAt: { $gte: weekStart } };
        break;
      case 'monthly':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1),
            $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
          }
        };
        break;
      case 'yearly':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), 0, 1),
            $lt: new Date(now.getFullYear() + 1, 0, 1)
          }
        };
        break;
      case 'range':
        if (startDate && endDate) {
          dateFilter = {
            createdAt: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          };
        }
        break;
    }

    // Base queries
    const bookingQuery = { deleted: { $ne: true }, ...dateFilter };
    const restaurantQuery = { ...dateFilter };

    // Get all data
    const [
      totalBookings,
      activeBookings,
      cancelledBookings,
      cashPayments,
      onlinePayments,
      totalRevenue,
      restaurantOrders,
      laundryOrders
    ] = await Promise.all([
      Booking.countDocuments(bookingQuery),
      Booking.countDocuments({ ...bookingQuery, status: 'Checked In' }),
      Booking.countDocuments({ ...bookingQuery, status: 'Cancelled' }),
      Booking.countDocuments({ ...bookingQuery, paymentMode: /cash/i }),
      Booking.countDocuments({ ...bookingQuery, paymentMode: /upi|online|card/i }),
      Booking.aggregate([
        { $match: bookingQuery },
        { $group: { _id: null, total: { $sum: '$rate' } } }
      ]),
      RestaurantOrder.countDocuments(restaurantQuery),
      Laundry.countDocuments(bookingQuery)
    ]);

    // Create CSV data with individual metrics
    const csvData = [
      ['Metric', 'Count', 'Amount'],
      ['Total Bookings', totalBookings, `Rs.${totalRevenue[0]?.total || 0}`],
      ['Active Bookings', activeBookings, ''], 
      ['Cancelled Bookings', cancelledBookings, ''],
      ['Online Payments', onlinePayments, ''],
      ['Cash Payments', cashPayments, ''],
      ['Restaurant Orders', restaurantOrders, ''],
      ['Laundry Orders', laundryOrders, ''],
      ['', '', ''],
      ['SUMMARY', '', ''],
      ['Total Revenue', '', `Rs.${totalRevenue[0]?.total || 0}`],
      ['Total Orders (All Services)', totalBookings + restaurantOrders + laundryOrders, ''],
      ['Payment Breakdown:', '', ''],
      ['- Online Payments', onlinePayments, ''],
      ['- Cash Payments', cashPayments, '']
    ];

    // Convert to CSV string
    const csvString = csvData.map(row => 
      row.map(cell => `"${cell || ''}"`).join(',')
    ).join('\n');

    // Set headers for CSV download
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard-stats-${timestamp}.csv"`);
    
    res.send(csvString);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Individual CSV exports
exports.exportTotalBookings = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateFilter = getDateFilter(filter, startDate, endDate);
    const bookings = await Booking.find({ deleted: { $ne: true }, ...dateFilter })
      .populate('categoryId')
      .sort({ createdAt: -1 })
      .lean();
    
    const csvData = [[
      'Guest Name', 'Phone', 'GRC No', 'Invoice Number', 'Room Numbers', 'Check In', 'Check Out', 'Rate', 'Restaurant Charges', 'Room Service Charges', 'Laundry Charges', 'Payment Status', 'Status', 'Booking Date'
    ]];
    
    // Get all orders in bulk to optimize performance
    const bookingIds = bookings.map(b => b._id);
    const grcNos = bookings.map(b => b.grcNo).filter(Boolean);
    const roomNumbers = bookings.map(b => b.roomNumber).filter(Boolean);
    
    const [allRestaurantOrders, allRoomServiceOrders, allLaundryOrders] = await Promise.all([
      RestaurantOrder.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ],
        tableNo: { $exists: true, $ne: null, $ne: '' }
      }).lean(),
      RoomService.find({
        $or: [
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean(),
      Laundry.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean()
    ]);
    
    for (const b of bookings) {
      // Filter orders for this specific booking
      const restaurantOrders = allRestaurantOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const roomServiceOrders = allRoomServiceOrders.filter(order => 
        order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const laundryOrders = allLaundryOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      
      const restaurantAmount = restaurantOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
      const roomServiceAmount = roomServiceOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const laundryAmount = laundryOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      
      csvData.push([
        b.name || '',
        b.mobileNo || '',
        b.grcNo || '',
        b.invoiceNumber || '',
        b.roomNumber || '',
        formatDate(b.checkInDate),
        formatDate(b.checkOutDate),
        b.rate || 0,
        restaurantAmount || 0,
        roomServiceAmount || 0,
        laundryAmount || 0,
        b.paymentStatus || '',
        b.status || '',
        formatDate(b.createdAt)
      ]);
    }
    
    sendCSV(res, csvData, 'total-bookings-detailed');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.exportActiveBookings = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateFilter = getDateFilter(filter, startDate, endDate);
    const bookings = await Booking.find({ deleted: { $ne: true }, status: 'Checked In', ...dateFilter })
      .populate('categoryId')
      .sort({ createdAt: -1 })
      .lean();
    
    const csvData = [[
      'Guest Name', 'Phone', 'GRC No', 'Invoice Number', 'Room Numbers', 'Check In', 'Check Out', 'Rate', 'Restaurant Charges', 'Room Service Charges', 'Laundry Charges', 'Payment Status', 'Status', 'Booking Date'
    ]];
    
    // Get all orders in bulk to optimize performance
    const bookingIds = bookings.map(b => b._id);
    const grcNos = bookings.map(b => b.grcNo).filter(Boolean);
    const roomNumbers = bookings.map(b => b.roomNumber).filter(Boolean);
    
    const [allRestaurantOrders, allRoomServiceOrders, allLaundryOrders] = await Promise.all([
      RestaurantOrder.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ],
        tableNo: { $exists: true, $ne: null, $ne: '' }
      }).lean(),
      RoomService.find({
        $or: [
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean(),
      Laundry.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean()
    ]);
    
    for (const b of bookings) {
      // Filter orders for this specific booking
      const restaurantOrders = allRestaurantOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const roomServiceOrders = allRoomServiceOrders.filter(order => 
        order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const laundryOrders = allLaundryOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      
      const restaurantAmount = restaurantOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
      const roomServiceAmount = roomServiceOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const laundryAmount = laundryOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      
      csvData.push([
        b.name || '',
        b.mobileNo || '',
        b.grcNo || '',
        b.invoiceNumber || '',
        b.roomNumber || '',
        formatDate(b.checkInDate),
        formatDate(b.checkOutDate),
        b.rate || 0,
        restaurantAmount || 0,
        roomServiceAmount || 0,
        laundryAmount || 0,
        b.paymentStatus || '',
        b.status || '',
        formatDate(b.createdAt)
      ]);
    }
    
    sendCSV(res, csvData, 'active-bookings');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.exportCancelledBookings = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateFilter = getDateFilter(filter, startDate, endDate);
    const bookings = await Booking.find({ deleted: { $ne: true }, status: 'Cancelled', ...dateFilter })
      .populate('categoryId')
      .sort({ createdAt: -1 })
      .lean();
    
    const csvData = [[
      'Guest Name', 'Phone', 'GRC No', 'Invoice Number', 'Room Numbers', 'Check In', 'Check Out', 'Rate', 'Restaurant Charges', 'Room Service Charges', 'Laundry Charges', 'Payment Mode', 'Payment Status', 'Status', 'Booking Date'
    ]];
    
    // Get all orders in bulk to optimize performance
    const bookingIds = bookings.map(b => b._id);
    const grcNos = bookings.map(b => b.grcNo).filter(Boolean);
    const roomNumbers = bookings.map(b => b.roomNumber).filter(Boolean);
    
    const [allRestaurantOrders, allRoomServiceOrders, allLaundryOrders] = await Promise.all([
      RestaurantOrder.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ],
        tableNo: { $exists: true, $ne: null, $ne: '' }
      }).lean(),
      RoomService.find({
        $or: [
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean(),
      Laundry.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean()
    ]);
    
    for (const b of bookings) {
      // Filter orders for this specific booking
      const restaurantOrders = allRestaurantOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const roomServiceOrders = allRoomServiceOrders.filter(order => 
        order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const laundryOrders = allLaundryOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      
      const restaurantAmount = restaurantOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
      const roomServiceAmount = roomServiceOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const laundryAmount = laundryOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      
      csvData.push([
        b.name || '',
        b.mobileNo || '',
        b.grcNo || '',
        b.invoiceNumber || '',
        b.roomNumber || '',
        formatDate(b.checkInDate),
        formatDate(b.checkOutDate),
        b.rate || 0,
        restaurantAmount || 0,
        roomServiceAmount || 0,
        laundryAmount || 0,
        b.paymentMode || '',
        b.paymentStatus || '',
        b.status || '',
        formatDate(b.createdAt)
      ]);
    }
    
    sendCSV(res, csvData, 'cancelled-bookings');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.exportRevenue = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateFilter = getDateFilter(filter, startDate, endDate);
    const bookings = await Booking.find({ deleted: { $ne: true }, ...dateFilter })
      .populate('categoryId')
      .sort({ createdAt: -1 })
      .lean();
    
    const csvData = [[
      'Guest Name', 'Phone', 'GRC No', 'Invoice Number', 'Room Numbers', 'Check In', 'Check Out', 'Rate', 'Restaurant Charges', 'Room Service Charges', 'Laundry Charges', 'Payment Mode', 'Payment Status', 'Status', 'Booking Date'
    ]];
    
    // Get all orders in bulk to optimize performance
    const bookingIds = bookings.map(b => b._id);
    const grcNos = bookings.map(b => b.grcNo).filter(Boolean);
    const roomNumbers = bookings.map(b => b.roomNumber).filter(Boolean);
    
    const [allRestaurantOrders, allRoomServiceOrders, allLaundryOrders] = await Promise.all([
      RestaurantOrder.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ],
        tableNo: { $exists: true, $ne: null, $ne: '' }
      }).lean(),
      RoomService.find({
        $or: [
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean(),
      Laundry.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean()
    ]);
    
    for (const b of bookings) {
      // Filter orders for this specific booking
      const restaurantOrders = allRestaurantOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const roomServiceOrders = allRoomServiceOrders.filter(order => 
        order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const laundryOrders = allLaundryOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      
      const restaurantAmount = restaurantOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
      const roomServiceAmount = roomServiceOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const laundryAmount = laundryOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      
      csvData.push([
        b.name || '',
        b.mobileNo || '',
        b.grcNo || '',
        b.invoiceNumber || '',
        b.roomNumber || '',
        formatDate(b.checkInDate),
        formatDate(b.checkOutDate),
        b.rate || 0,
        restaurantAmount || 0,
        roomServiceAmount || 0,
        laundryAmount || 0,
        b.paymentMode || '',
        b.paymentStatus || '',
        b.status || '',
        formatDate(b.createdAt)
      ]);
    }
    
    sendCSV(res, csvData, 'revenue-report');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.exportOnlinePayments = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateFilter = getDateFilter(filter, startDate, endDate);
    const bookings = await Booking.find({ deleted: { $ne: true }, paymentMode: /upi|online|card/i, ...dateFilter })
      .populate('categoryId')
      .sort({ createdAt: -1 })
      .lean();
    
    const csvData = [[
      'Guest Name', 'Phone', 'GRC No', 'Invoice Number', 'Room Numbers', 'Check In', 'Check Out', 'Rate', 'Restaurant Charges', 'Room Service Charges', 'Laundry Charges', 'Payment Mode', 'Payment Status', 'Status', 'Booking Date'
    ]];
    
    // Get all orders in bulk to optimize performance
    const bookingIds = bookings.map(b => b._id);
    const grcNos = bookings.map(b => b.grcNo).filter(Boolean);
    const roomNumbers = bookings.map(b => b.roomNumber).filter(Boolean);
    
    const [allRestaurantOrders, allRoomServiceOrders, allLaundryOrders] = await Promise.all([
      RestaurantOrder.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ],
        tableNo: { $exists: true, $ne: null, $ne: '' }
      }).lean(),
      RoomService.find({
        $or: [
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean(),
      Laundry.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean()
    ]);
    
    for (const b of bookings) {
      // Filter orders for this specific booking
      const restaurantOrders = allRestaurantOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const roomServiceOrders = allRoomServiceOrders.filter(order => 
        order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const laundryOrders = allLaundryOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      
      const restaurantAmount = restaurantOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
      const roomServiceAmount = roomServiceOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const laundryAmount = laundryOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      
      csvData.push([
        b.name || '',
        b.mobileNo || '',
        b.grcNo || '',
        b.invoiceNumber || '',
        b.roomNumber || '',
        formatDate(b.checkInDate),
        formatDate(b.checkOutDate),
        b.rate || 0,
        restaurantAmount || 0,
        roomServiceAmount || 0,
        laundryAmount || 0,
        b.paymentMode || '',
        b.paymentStatus || '',
        b.status || '',
        formatDate(b.createdAt)
      ]);
    }
    
    sendCSV(res, csvData, 'online-payments');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.exportCashPayments = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateFilter = getDateFilter(filter, startDate, endDate);
    const bookings = await Booking.find({ deleted: { $ne: true }, paymentMode: /cash/i, ...dateFilter })
      .populate('categoryId')
      .sort({ createdAt: -1 })
      .lean();
    
    const csvData = [[
      'Guest Name', 'Phone', 'GRC No', 'Invoice Number', 'Room Numbers', 'Check In', 'Check Out', 'Rate', 'Restaurant Charges', 'Room Service Charges', 'Laundry Charges', 'Payment Mode', 'Payment Status', 'Status', 'Booking Date'
    ]];
    
    // Get all orders in bulk to optimize performance
    const bookingIds = bookings.map(b => b._id);
    const grcNos = bookings.map(b => b.grcNo).filter(Boolean);
    const roomNumbers = bookings.map(b => b.roomNumber).filter(Boolean);
    
    const [allRestaurantOrders, allRoomServiceOrders, allLaundryOrders] = await Promise.all([
      RestaurantOrder.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ],
        tableNo: { $exists: true, $ne: null, $ne: '' }
      }).lean(),
      RoomService.find({
        $or: [
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean(),
      Laundry.find({
        $or: [
          { grcNo: { $in: grcNos } },
          { roomNumber: { $in: roomNumbers } },
          { bookingId: { $in: bookingIds } }
        ]
      }).lean()
    ]);
    
    for (const b of bookings) {
      // Filter orders for this specific booking
      const restaurantOrders = allRestaurantOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const roomServiceOrders = allRoomServiceOrders.filter(order => 
        order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      const laundryOrders = allLaundryOrders.filter(order => 
        order.grcNo === b.grcNo || order.roomNumber === b.roomNumber || order.bookingId?.toString() === b._id.toString()
      );
      
      const restaurantAmount = restaurantOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
      const roomServiceAmount = roomServiceOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const laundryAmount = laundryOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      
      csvData.push([
        b.name || '',
        b.mobileNo || '',
        b.grcNo || '',
        b.invoiceNumber || '',
        b.roomNumber || '',
        formatDate(b.checkInDate),
        formatDate(b.checkOutDate),
        b.rate || 0,
        restaurantAmount || 0,
        roomServiceAmount || 0,
        laundryAmount || 0,
        b.paymentMode || '',
        b.paymentStatus || '',
        b.status || '',
        formatDate(b.createdAt)
      ]);
    }
    
    sendCSV(res, csvData, 'cash-payments');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.exportRestaurantOrders = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateFilter = getDateFilter(filter, startDate, endDate);
    const orders = await RestaurantOrder.find(dateFilter).select('customerName tableNo amount status createdAt');
    const csvData = [['Customer Name', 'Table No', 'Amount', 'Status', 'Order Date']];
    let totalAmount = 0;
    orders.forEach(o => {
      csvData.push([
        o.customerName, 
        o.tableNo, 
        o.amount, 
        o.status, 
        formatDate(o.createdAt)
      ]);
      totalAmount += (o.amount || 0);
    });
    // Add total row
    csvData.push(['', '', '', '', '']);
    csvData.push(['TOTAL RESTAURANT ORDERS:', orders.length, `Rs.${totalAmount}`, '', '']);
    sendCSV(res, csvData, 'restaurant-orders');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.exportLaundryOrders = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateFilter = getDateFilter(filter, startDate, endDate);
    const orders = await Laundry.find(dateFilter).select('roomNumber grcNo requestedByName laundryStatus serviceType totalAmount items createdAt invoiceNumber');
    const csvData = [['Invoice Number', 'Room Number', 'GRC No', 'Requested By', 'Status', 'Service Type', 'Total Amount', 'Items Count', 'Order Date']];
    let totalAmount = 0;
    let totalItems = 0;
    orders.forEach(o => {
      csvData.push([
        o.invoiceNumber || '',
        o.roomNumber || '', 
        o.grcNo || '', 
        o.requestedByName || '', 
        o.laundryStatus || '', 
        o.serviceType || '',
        o.totalAmount || 0,
        o.items?.length || 0,
        formatDate(o.createdAt)
      ]);
      totalAmount += (o.totalAmount || 0);
      totalItems += (o.items?.length || 0);
    });
    // Add total row
    csvData.push(['', '', '', '', '', '', '', '', '']);
    csvData.push(['TOTAL LAUNDRY ORDERS:', orders.length, '', '', '', '', `Rs.${totalAmount}`, totalItems, '']);
    sendCSV(res, csvData, 'laundry-orders');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper functions
function getDateFilter(filter, startDate, endDate) {
  let dateFilter = {};
  const now = new Date();
  
  switch (filter) {
    case 'today':
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      dateFilter = {
        createdAt: {
          $gte: todayStart,
          $lte: todayEnd
        }
      };
      break;
    case 'weekly':
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      dateFilter = { createdAt: { $gte: weekStart } };
      break;
    case 'monthly':
      dateFilter = {
        createdAt: {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
        }
      };
      break;
    case 'yearly':
      dateFilter = {
        createdAt: {
          $gte: new Date(now.getFullYear(), 0, 1),
          $lt: new Date(now.getFullYear() + 1, 0, 1)
        }
      };
      break;
    case 'range':
      if (startDate && endDate) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }
      break;
  }
  return dateFilter;
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString();
}

function sendCSV(res, csvData, filename) {
  const csvString = csvData.map(row => 
    row.map(cell => `"${cell || ''}"`).join(',')
  ).join('\n');
  const timestamp = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}-${timestamp}.csv"`);
  res.send(csvString);
}