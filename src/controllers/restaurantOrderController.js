const RestaurantOrder = require('../models/RestaurantOrder.js');

// Create new restaurant order
exports.createOrder = async (req, res) => {
  try {
    const orderData = req.body;
    
    // Auto-update table status to 'occupied' when booking is created
    if (orderData.tableNo) {
      try {
        const Table = require('../models/Table');
        await Table.findOneAndUpdate(
          { tableNumber: orderData.tableNo },
          { status: 'occupied' },
          { new: true }
        );
        console.log(`Table ${orderData.tableNo} status updated to occupied`);
      } catch (tableError) {
        console.error('Error updating table status:', tableError);
      }
    }
    
    // Add booking timestamp
    orderData.bookedAt = new Date();
    
    // Try to link order to booking if tableNo matches a room number
    if (orderData.tableNo) {
      const Booking = require('../models/Booking');
      const booking = await Booking.findOne({
        roomNumber: { $regex: new RegExp(`(^|,)\\s*${orderData.tableNo}\\s*(,|$)`) },
        status: { $in: ['Booked', 'Checked In'] },
        isActive: true
      });
      
      if (booking) {
        orderData.bookingId = booking._id;
        orderData.grcNo = booking.grcNo;
        orderData.roomNumber = booking.roomNumber;
        orderData.guestName = booking.name;
        orderData.guestPhone = booking.mobileNo;
      }
    }
    
    const order = new RestaurantOrder(orderData);
    await order.save();
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await RestaurantOrder.find()
      .sort({ createdAt: -1 })
      .populate('items.itemId', 'name Price')
      .populate('bookingId', 'grcNo roomNumber guestName invoiceNumber')
      .maxTimeMS(5000)
      .lean()
      .exec();
    
    // Transform orders to match frontend expectations
    const transformedOrders = orders.map(order => ({
      ...order,
      allKotItems: order.items || [],
      kotCount: 1,
      priority: order.priority || 'normal'
    }));
    
    res.json(transformedOrders);
  } catch (error) {
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      res.status(408).json({ error: 'Database query timeout. Please try again.' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};
// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const order = await RestaurantOrder.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Auto-update table status when order is completed/cancelled/paid
    if (order.tableNo && ['completed', 'cancelled', 'paid'].includes(status)) {
      try {
        const Table = require('../models/Table');
        // Check if there are any other active orders for this table
        const activeOrders = await RestaurantOrder.find({
          tableNo: order.tableNo,
          status: { $nin: ['completed', 'cancelled', 'paid'] },
          _id: { $ne: id }
        });
        
        // If no other active orders, mark table as available
        if (activeOrders.length === 0) {
          await Table.findOneAndUpdate(
            { tableNumber: order.tableNo },
            { status: 'available' },
            { new: true }
          );
          console.log(`Table ${order.tableNo} status updated to available`);
        }
      } catch (tableError) {
        console.error('Error updating table status:', tableError);
      }
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update restaurant order
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const order = await RestaurantOrder.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Also update corresponding KOT if items were updated
    if (updateData.items) {
      try {
        const KOT = require('../models/KOT');
        const kot = await KOT.findOne({ orderId: id });
        if (kot) {
          const kotItems = updateData.items.map(item => ({
            itemName: item.itemName,
            quantity: item.quantity,
            specialInstructions: item.note || ''
          }));
          await KOT.findByIdAndUpdate(kot._id, { items: kotItems });
        }
      } catch (kotError) {
        console.error('Error updating KOT:', kotError);
      }
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Link existing restaurant orders to bookings
exports.linkOrdersToBookings = async (req, res) => {
  try {
    const Booking = require('../models/Booking');
    
    // Get all restaurant orders without booking links
    const unlinkedOrders = await RestaurantOrder.find({
      $or: [
        { bookingId: { $exists: false } },
        { bookingId: null },
        { grcNo: { $exists: false } },
        { grcNo: null }
      ]
    });
    
    let linkedCount = 0;
    
    for (const order of unlinkedOrders) {
      if (order.tableNo) {
        const booking = await Booking.findOne({
          roomNumber: { $regex: new RegExp(`(^|,)\\s*${order.tableNo}\\s*(,|$)`) },
          status: { $in: ['Booked', 'Checked In'] },
          isActive: true
        });
        
        if (booking) {
          await RestaurantOrder.findByIdAndUpdate(order._id, {
            bookingId: booking._id,
            grcNo: booking.grcNo,
            roomNumber: booking.roomNumber,
            guestName: booking.name,
            guestPhone: booking.mobileNo
          });
          linkedCount++;
        }
      }
    }
    
    res.json({
      success: true,
      message: `Linked ${linkedCount} restaurant orders to bookings`,
      linkedCount,
      totalUnlinked: unlinkedOrders.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete restaurant order
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await RestaurantOrder.findByIdAndDelete(id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Also delete corresponding KOT if it exists
    try {
      const KOT = require('../models/KOT');
      await KOT.deleteOne({ orderId: id });
    } catch (kotError) {
      console.error('Error deleting KOT:', kotError);
    }
    
    res.json({ message: 'Order deleted successfully', deletedOrder: order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Assign chef to order
exports.assignChef = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedChef, estimatedTime } = req.body;
    
    const order = await RestaurantOrder.findByIdAndUpdate(
      id,
      { 
        assignedChef,
        estimatedTime,
        status: 'confirmed'
      },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};