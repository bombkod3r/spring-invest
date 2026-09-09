const userModel = require('../models/userModel');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');
const { validateProfileUpdate } = require('../validators/authValidator');

const getMe = (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      firstName: req.user.first_name,
      lastName: req.user.last_name,
      username: req.user.username,
      role: req.user.role,
    },
  });
};

const updateMe = async (req, res, next) => {
  const { error, value } = validateProfileUpdate(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const user = await userModel.updateProfile(req.user.id, value);
    return res.json({ user: userModel.publicUser(user) });
  } catch (err) {
    return next(err);
  }
};

const getWallet = async (req, res, next) => {
  try {
    const wallet = await walletModel.ensureWallet(req.user.id);
    return res.json({ wallet });
  } catch (err) {
    return next(err);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const entries = await transactionModel.listForUser(req.user.id);
    return res.json({ transactions: entries });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getMe, updateMe, getWallet, getTransactions };
