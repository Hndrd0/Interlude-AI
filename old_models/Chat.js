const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user', 'assistant'], required: true },
  content:   { type: String, required: true },
  type:      { type: String, enum: ['text'], default: 'text' },
  timestamp: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema({
  title:     { type: String, default: 'New Chat' },
  messages:  [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Chat', chatSchema);
