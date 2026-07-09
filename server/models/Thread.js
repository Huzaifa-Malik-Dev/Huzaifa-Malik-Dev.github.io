const mongoose = require('mongoose');

// One shared conversation per dsrNo - the same reference number that follows a deal from
// DSR -> Pipeline -> Back Office, so the whole team (agent, TL, Teams Head, Sales Head,
// Back Office) has a single place to discuss and tag each other about it.
const messageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['msg', 'file'], default: 'msg' },
    text: { type: String, default: '' },
    fileName: { type: String, default: '' },
    filePath: { type: String, default: '' },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    ts: { type: Date, default: Date.now },
  },
  { _id: false }
);

const threadSchema = new mongoose.Schema(
  {
    dsrNo: { type: String, required: true, unique: true },
    messages: [messageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Thread', threadSchema);
