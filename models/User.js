const mongoose = require('momgoose');
const userSchema = new mongoose.Schema({
  userDd: Number,
  firstName: String,
  warnings: { type: Number, default: 0 },
  spamActivity: [Number],
});

module.exports = mongoose.model('User', userSchema);