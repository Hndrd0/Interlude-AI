const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true },
  value:     { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

// Keep updatedAt current on every update
settingsSchema.pre('findOneAndUpdate', function () {
  this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('Settings', settingsSchema);
