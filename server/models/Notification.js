const mongoose = require('mongoose');

// Durable log — the source of truth for notifications. A push (future: socket/SSE) is only
// ever a speed optimization on top of this; the client always reconciles via GET /notifications?afterSeq=
// on load/reconnect, so nothing can be permanently missed.
const notificationSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true }, // monotonic, assigned via Counter — used for catch-up cursor
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    refType: { type: String, default: '' }, // 'dsr' | 'pipeline' | 'order' ...
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, seq: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
