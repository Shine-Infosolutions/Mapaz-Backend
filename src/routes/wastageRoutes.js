const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Wastage = require('../models/Wastage');

// GET /api/wastage/stats - Get wastage statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    
    if (startDate && endDate) {
      dateFilter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await Wastage.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalWastage: { $sum: "$quantity" },
          totalCost: { $sum: "$estimatedCost" },
          totalRecords: { $sum: 1 }
        }
      }
    ]);

    res.json({ success: true, data: stats[0] || {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/wastage - Get all wastage records
router.get('/', auth, async (req, res) => {
  try {
    const { department, category, date, shift } = req.query;
    const filter = {};
    
    if (department) filter.department = department;
    if (category) filter.category = category;
    if (shift) filter.shift = shift;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filter.date = { $gte: startDate, $lt: endDate };
    }

    const wastage = await Wastage.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: wastage });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/wastage - Create new wastage record
router.post('/', auth, async (req, res) => {
  try {
    console.log('Creating wastage record:', req.body);
    const wastage = await Wastage.create(req.body);
    console.log('Wastage created successfully:', wastage);
    res.status(201).json({ success: true, data: wastage });
  } catch (error) {
    console.error('Error creating wastage:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/wastage/:id - Get wastage by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const wastage = await Wastage.findById(req.params.id);
    if (!wastage) {
      return res.status(404).json({ success: false, message: "Wastage record not found" });
    }
    res.json({ success: true, data: wastage });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/wastage/:id - Update wastage record
router.put('/:id', auth, async (req, res) => {
  try {
    const wastage = await Wastage.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!wastage) {
      return res.status(404).json({ success: false, message: "Wastage record not found" });
    }
    res.json({ success: true, data: wastage });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/wastage/:id - Delete wastage record
router.delete('/:id', auth, async (req, res) => {
  try {
    const wastage = await Wastage.findByIdAndDelete(req.params.id);
    if (!wastage) {
      return res.status(404).json({ success: false, message: "Wastage record not found" });
    }
    res.json({ success: true, message: "Wastage record deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;