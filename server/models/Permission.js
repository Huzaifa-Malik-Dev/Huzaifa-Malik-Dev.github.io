const mongoose = require('mongoose');

// Singleton doc (_id: 'access') holding runtime-editable RBAC, seeded from ACCESS_DEFAULT /
// EDIT_ACCESS_DEFAULT. Admin can tighten/loosen per role or per individual user at runtime.
const permissionSchema = new mongoose.Schema({
  _id: { type: String, default: 'access' },
  byRole: { type: mongoose.Schema.Types.Mixed, default: {} }, // { role: [module,...] } — view access
  editByRole: { type: mongoose.Schema.Types.Mixed, default: {} }, // { role: [module,...] } — edit access
  importExportByRole: { type: mongoose.Schema.Types.Mixed, default: {} }, // { role: [module,...] } — bulk import/export access
  actionsByRole: { type: mongoose.Schema.Types.Mixed, default: {} }, // { role: [actionKey,...] } — fine-grained action access
  userOverrides: { type: mongoose.Schema.Types.Mixed, default: {} }, // { userId: { view:[...], edit:[...], importExport:[...], actions:[...] } }
});

module.exports = mongoose.model('Permission', permissionSchema);
