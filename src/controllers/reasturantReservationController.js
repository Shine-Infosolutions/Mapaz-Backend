const RestaurantReservation = require("../models/RestaurantReservation");

const generateReservationNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  
  // Find the highest reservation number for today
  const latestReservation = await RestaurantReservation.findOne({
    reservationNumber: { $regex: `^RES${dateStr}` }
  }).sort({ reservationNumber: -1 });
  
  let nextNumber = 1;
  if (latestReservation) {
    const lastNumber = parseInt(latestReservation.reservationNumber.slice(-3));
    nextNumber = lastNumber + 1;
  }
  
  return `RES${dateStr}${String(nextNumber).padStart(3, "0")}`;
};

exports.createReservation = async (req, res) => {
  try {
    const {
      guestName,
      phoneNumber,
      email,
      partySize,
      reservationDate,
      reservationTimeIn,
      reservationTimeOut,
      tableNo,
      specialRequests,
      advancePayment
    } = req.body;

    // Validate required fields
    if (!guestName || !phoneNumber || !partySize || !reservationDate || !reservationTimeIn || !reservationTimeOut) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: guestName, phoneNumber, partySize, reservationDate, reservationTimeIn, reservationTimeOut"
      });
    }

    // Generate reservation number
    const reservationNumber = await generateReservationNumber();
    const status = (advancePayment && advancePayment > 0) ? 'reserved' : 'enquiry';

    const reservation = new RestaurantReservation({
      reservationNumber,
      guestName,
      phoneNumber,
      email,
      partySize,
      reservationDate,
      reservationTimeIn,
      reservationTimeOut,
      tableNo,
      specialRequests,
      advancePayment: advancePayment || 0,
      status,
      createdBy: req.user?.id || req.user?._id,
    });

    await reservation.save();
    res.status(201).json(reservation);
  } catch (error) {
    console.error('Reservation creation error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Reservation date is required" });
    }

    const reservationDate = new Date(date);

    // Restaurant timing
    const openingHour = 10;  // 10 am
    const closingHour = 23;  // 11 pm
    const slotDuration = 60; // minutes (change to 30 if needed)

    // Generate all possible slots
    let slots = [];
    for (let hour = openingHour; hour < closingHour; hour++) {
      const start = `${String(hour).padStart(2, '0')}:00`;
      const end = `${String(hour + 1).padStart(2, '0')}:00`;

      slots.push({
        start,
        end
      });
    }

    // Fetch all bookings for that date
    const reservations = await RestaurantReservation.find({
      reservationDate: reservationDate
    });

    // Filter out booked slots
    const availableSlots = slots.filter(slot => {
      const isBooked = reservations.some(res =>
        res.reservationTimeIn < slot.end &&
        res.reservationTimeOut > slot.start
      );
      return !isBooked;
    });

    res.json({
      date,
      totalSlots: slots.length,
      availableSlotsCount: availableSlots.length,
      availableSlots
    });

  } catch (error) {
    console.error("Error getting available slots", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


exports.getAllReservations = async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filter.reservationDate = {
        $gte: startDate,
        $lt: endDate,
      };
    }
    const reservations = await RestaurantReservation.find(filter)
      .populate("createdBy", "username")
      .sort({ reservationDate: 1, reservationTime: 1 });
    res.json(reservations);
  } catch (error) {
    console.error("Error fetching reservations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getReservationById = async (req, res) => {
  try {
    const reservation = await RestaurantReservation.findById(req.params.id)
      .populate('createdBy', 'username');
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateReservation = async (req, res) => {
  try {
    const reservation = await RestaurantReservation.findByIdAndUpdate(
      req.params.id, req.body, { new: true }
    );
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    res.json(reservation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateReservationStatus = async (req, res) => {
  try {
    const { status, tableNo } = req.body;
    const updates = { status };
    if (tableNo) {
      updates.tableNo = tableNo;
      // Also update table status to reserved
      try {
        const Table = require('../models/Table');
        await Table.findOneAndUpdate(
          { tableNumber: tableNo },
          { status: 'reserved' },
          { new: true }
        );
      } catch (tableError) {
        console.error('Error updating table status:', tableError);
      }
    }
    
    const reservation = await RestaurantReservation.findByIdAndUpdate(
      req.params.id, updates, { new: true }
    );
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    res.json(reservation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Assign table to reservation
exports.assignTable = async (req, res) => {
  try {
    const { tableNo } = req.body;
    
    if (!tableNo) {
      return res.status(400).json({ error: 'Table number is required' });
    }
    
    // Update reservation with table assignment
    const reservation = await RestaurantReservation.findByIdAndUpdate(
      req.params.id,
      { tableNo, status: 'confirmed' },
      { new: true }
    );
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // Update table status to reserved
    try {
      const Table = require('../models/Table');
      await Table.findOneAndUpdate(
        { tableNumber: tableNo },
        { status: 'reserved' },
        { new: true }
      );
    } catch (tableError) {
      console.error('Error updating table status:', tableError);
    }
    
    res.json({ success: true, reservation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const { advancePayment } = req.body;
    const status = (advancePayment && advancePayment > 0) ? 'reserved' : 'enquiry';
    
    const reservation = await RestaurantReservation.findByIdAndUpdate(
      req.params.id,
      { advancePayment, status },
      { new: true }
    );
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    res.json(reservation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteReservation = async (req, res) => {
  try {
    const reservation = await RestaurantReservation.findByIdAndDelete(req.params.id);
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    res.json({ message: 'Reservation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
