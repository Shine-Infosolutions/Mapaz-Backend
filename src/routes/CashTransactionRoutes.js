const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  getCashAtReception,
  addCashTransaction,
  getAllCashTransactions,
  generateCashTransactionsExcel
} = require('../controllers/cashTransactionController');

// 🧾 Get filtered cash summary (today, week, month, year, date, source)
router.get('/cash-at-reception', auth, authorize(['ADMIN','FRONT DESK','ACCOUNTS']), getCashAtReception);

// 📋 Get all cash transactions (unfiltered list)
router.get('/all-transactions',auth, authorize(['ADMIN','FRONT DESK','ACCOUNTS']), getAllCashTransactions);

// ➕ Add a new cash transaction
router.post('/add-transaction',auth, authorize(['ADMIN','FRONT DESK','ACCOUNTS']), addCashTransaction);

// 📊 Generate Excel report for cash transactions
router.get('/excel-report',auth, authorize(['ADMIN','FRONT DESK','ACCOUNTS']), generateCashTransactionsExcel);

module.exports = router;
