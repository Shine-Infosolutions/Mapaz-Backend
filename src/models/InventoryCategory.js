const mongoose = require('mongoose');

const inventoryCategorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true
  },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('InventoryCategory', inventoryCategorySchema);