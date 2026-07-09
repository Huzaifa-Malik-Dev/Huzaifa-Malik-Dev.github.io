const mongoose = require('mongoose');

// Atomic sequence generator for human-readable IDs like DSR-00001.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

async function nextSeq(key) {
  const doc = await Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
}

module.exports = { Counter, nextSeq };
