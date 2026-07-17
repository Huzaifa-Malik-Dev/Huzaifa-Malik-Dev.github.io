const mongoose = require('mongoose');
const { ROLES, ABSCONDING_STATUS, LEGAL_CASE_STATUS } = require('../utils/constants');

const complianceSchema = new mongoose.Schema(
  {
    dob: String,
    nationality: String,
    uid: String,
    passportNo: String,
    passportExpiry: String,
    visaCompany: String,
    visaFileNumber: String,
    visaIssue: String,
    visaExpiry: String,
    eid: String,
    eidIssue: String,
    eidExpiry: String,
    labourCardNo: String,
    labourCardIssue: String,
    labourCardExpiry: String,
    insuranceIssue: String,
    insuranceExpiry: String,
    legalCaseStatus: { type: String, enum: LEGAL_CASE_STATUS, default: 'No' },
    legalCaseNote: { type: String, default: '' },
    abscondingMohre: { type: String, enum: ABSCONDING_STATUS, default: 'No' },
    abscondingMohreNote: { type: String, default: '' },
    abscondingGdrfa: { type: String, enum: ABSCONDING_STATUS, default: 'No' },
    abscondingGdrfaNote: { type: String, default: '' },
  },
  { _id: false }
);

const docsSchema = new mongoose.Schema(
  {
    profilePic: String,
    passportImgF: String,
    passportImgB: String,
    visaImgF: String,
    visaImgB: String,
    eidImgF: String,
    eidImgB: String,
    labourCardImg: String,
    insuranceImgF: String,
    insuranceImgB: String,
    legalCaseDoc: String,
    abscondingMohreDoc: String,
    abscondingGdrfaDoc: String,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    arabicName: { type: String, default: '', trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, default: '', lowercase: true, trim: true },
    phone: { type: String, default: '' },
    passwordHash: { type: String, required: true },
    // Server-side session revocation: every JWT carries the tokenVersion it was issued at (see
    // utils/jwt.js), and middlewares/auth.js rejects any token whose version no longer matches.
    // Bumping this instantly invalidates every outstanding token for this user - which is what
    // logout, a self-service password change, and an admin password reset all rely on.
    //
    // MUST stay declared here: Mongoose silently drops writes to paths that aren't in the schema,
    // so without this field every one of those bumps is a no-op and none of them actually revoke
    // anything (a logged-out cookie keeps working).
    tokenVersion: { type: Number, default: 0 },
    role: { type: String, required: true, enum: Object.keys(ROLES) },
    desig: { type: String, default: '' },
    dept: { type: String, default: '' },
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Full ancestor chain (immediate manager -> ... -> Sales Head). Rebuilt on save via setManagerChain.
    managerChain: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    target: { type: Number, default: 0 },
    salary: { type: Number, default: 0 },
    // How Payroll pays this person: a flat salary, tiered commission on target achievement (see
    // CommissionTier), or both. Applies to any role, not just agents - a Team Leader/Teams Head
    // can be put on commission against their team's achievement (see services/payroll.js).
    payType: { type: String, enum: ['salary', 'commission', 'salary_commission'], default: 'salary' },
    join: { type: String, default: '' },
    // Lifecycle status — the single source of truth. `active` is kept in sync (Active -> true,
    // anything else -> false) so login gating and every existing `active: true` rollup filter
    // (misController, dashboardController target sums, etc.) keep working unchanged.
    status: { type: String, enum: ['Active', 'Inactive', 'Frozen', 'Absconding'], default: 'Active' },
    active: { type: Boolean, default: true },
    compliance: { type: complianceSchema, default: () => ({}) },
    docs: { type: docsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ managerChain: 1 });
userSchema.index({ reportsTo: 1 });

module.exports = mongoose.model('User', userSchema);
