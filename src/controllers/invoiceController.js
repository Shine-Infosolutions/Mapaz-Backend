const Invoice = require('../models/Invoice');

// Preview next invoice number without incrementing counter
exports.getNextInvoiceNumber = async (req, res) => {
  try {
    const { bookingId } = req.query;
    
    // Check if this booking already has an invoice
    if (bookingId) {
      const existingInvoice = await Invoice.findOne({ bookingId });
      if (existingInvoice) {
        return res.json({ 
          success: true, 
          message: 'Invoice already exists for this booking',
          invoiceNumber: existingInvoice.invoiceNumber 
        });
      }
    }
    
    // Generate new invoice number in MPZ/MM/XXX format
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const sequence = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    const invoiceNumber = `MPZ/${month}/${sequence}`;
    
    res.json({ 
      success: true, 
      message: 'Invoice can be created',
      invoiceNumber: invoiceNumber
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};