const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const Table = require('../models/Table');

// Get all restaurant tables
router.get('/tables', auth, authorize(['ADMIN', 'GM', 'ACCOUNTS', 'STAFF', 'FRONT DESK']), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { isActive: true };
    
    if (status) {
      filter.status = status;
    }
    
    const tables = await Table.find(filter).sort({ tableNumber: 1 });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new table
router.post('/tables', auth, authorize(['ADMIN', 'GM', 'FRONT DESK']), async (req, res) => {
  try {
    const table = new Table(req.body);
    await table.save();
    res.status(201).json(table);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update table
router.put('/tables/:id', auth, authorize(['ADMIN', 'GM', 'FRONT DESK']), async (req, res) => {
  try {
    const { id } = req.params;
    const table = await Table.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    res.json(table);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete table
router.delete('/tables/:id', auth, authorize(['ADMIN', 'GM']), async (req, res) => {
  try {
    const { id } = req.params;
    const table = await Table.findByIdAndDelete(id);
    
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    res.json({ message: 'Table deleted successfully', table });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update table status
router.patch('/tables/:id/status', auth, authorize(['ADMIN', 'GM', 'STAFF', 'FRONT DESK']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const table = await Table.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    res.json(table);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;