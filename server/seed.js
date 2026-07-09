// Wipes and reseeds the demo dataset — mirrors the original prototype's seed() employees/roles,
// with the hierarchy correctly built via services/hierarchy.js (managerChain + AssignmentHistory).
require('dotenv').config();
const mongoose = require('mongoose');
const { mongoUri } = require('./config/env');

const User = require('./models/User');
const Dsr = require('./models/Dsr');
const Pipeline = require('./models/Pipeline');
const Order = require('./models/Order');
const Notification = require('./models/Notification');
const AssignmentHistory = require('./models/AssignmentHistory');
const Permission = require('./models/Permission');
const Account = require('./models/Account');
const AccountTx = require('./models/AccountTx');
const Cheque = require('./models/Cheque');
const Expense = require('./models/Expense');
const LedgerEntry = require('./models/LedgerEntry');
const PayrollRun = require('./models/PayrollRun');
const PayrollLine = require('./models/PayrollLine');
const Segment = require('./models/Segment');
const Product = require('./models/Product');
const { Counter, nextSeq } = require('./models/Counter');
const { postAccountTx } = require('./services/accounting');
const { processPayrollRun } = require('./services/payroll');

const { hashPassword } = require('./utils/password');
const { buildManagerChain, createInitialAssignment } = require('./services/hierarchy');
const { convertToPipeline, escalateToTL, tlApprove } = require('./services/workflow');
const { PIPE_STAGES } = require('./utils/constants');
const { ACCESS_DEFAULT, EDIT_ACCESS_DEFAULT, IMPORT_EXPORT_DEFAULT, CALL_STATUS } = require('./utils/constants');

const defUser = (name) => name.toLowerCase().replace(/[^a-z]/g, '');

async function createUser(data) {
  const managerChain = data.reportsTo ? await buildManagerChain(data.reportsTo) : [];
  const passwordHash = await hashPassword(defUser(data.name) + '@2026');
  const employeeId = 'DC' + (await nextSeq('employee'));
  const user = await User.create({
    ...data,
    employeeId,
    username: defUser(data.name),
    passwordHash,
    managerChain,
    active: true,
    compliance: {
      dob: '1992-04-12',
      nationality: 'India',
      passportNo: 'P' + data.name.slice(0, 3).toUpperCase() + '1234',
      passportExpiry: '2029-01-01',
      visaCompany: 'Digitalcoo Technologies LLC',
      visaExpiry: '2027-06-01',
      eid: '784-1992-XXXXXXX-1',
      eidIssue: '2024-01-01',
      eidExpiry: '2027-06-01',
      labourCardNo: 'LC-' + data.name.slice(0, 3).toUpperCase(),
      labourCardIssue: '2024-01-01',
      labourCardExpiry: '2027-06-01',
      insuranceIssue: '2026-01-01',
      insuranceExpiry: '2027-01-01',
      legalCaseStatus: 'No',
      legalCaseNote: '',
      abscondingMohre: 'No',
      abscondingMohreNote: '',
      abscondingGdrfa: 'No',
      abscondingGdrfaNote: '',
    },
  });
  await createInitialAssignment(user, null);
  return user;
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected:', mongoose.connection.name);

  console.log('Wiping demo collections...');
  await Promise.all([
    User.deleteMany({}),
    Dsr.deleteMany({}),
    Pipeline.deleteMany({}),
    Order.deleteMany({}),
    Notification.deleteMany({}),
    AssignmentHistory.deleteMany({}),
    Permission.deleteMany({}),
    Counter.deleteMany({}),
    Account.deleteMany({}),
    AccountTx.deleteMany({}),
    Cheque.deleteMany({}),
    Expense.deleteMany({}),
    LedgerEntry.deleteMany({}),
    PayrollRun.deleteMany({}),
    PayrollLine.deleteMany({}),
    Segment.deleteMany({}),
    Product.deleteMany({}),
  ]);

  console.log('Seeding permissions...');
  await Permission.create({
    _id: 'access',
    byRole: ACCESS_DEFAULT,
    editByRole: EDIT_ACCESS_DEFAULT,
    importExportByRole: IMPORT_EXPORT_DEFAULT,
    userOverrides: {},
  });

  console.log('Seeding users (top-down, so reportsTo always exists first)...');
  const admin = await createUser({ name: 'Admin', role: 'admin', desig: 'System Administrator', dept: 'Management', reportsTo: null, target: 0, salary: 0, join: '2025-01-01' });
  const amir = await createUser({ name: 'Amir Qadri', role: 'sales_head', desig: 'Sales Head', dept: 'e& Sales', reportsTo: null, target: 150000, salary: 20000, join: '2025-01-01' });
  const sana = await createUser({ name: 'Sana', role: 'teams_head', desig: 'Teams Head — Group 1', dept: 'e& Sales', reportsTo: amir._id, target: 75000, salary: 12000, join: '2025-02-01' });
  const joy = await createUser({ name: 'Joy', role: 'team_leader', desig: 'Team Leader — Team A', dept: 'e& Sales', reportsTo: sana._id, target: 25000, salary: 8000, join: '2025-06-01' });
  const maria = await createUser({ name: 'Maria', role: 'team_leader', desig: 'Team Leader — Team B', dept: 'e& Sales', reportsTo: sana._id, target: 30000, salary: 8500, join: '2025-03-01' });
  const rahul = await createUser({ name: 'Rahul', role: 'team_leader', desig: 'Team Leader — Team C', dept: 'e& Sales', reportsTo: sana._id, target: 20000, salary: 8000, join: '2026-01-20' });

  const hira = await createUser({ name: 'Hira', role: 'agent', desig: 'Sales Agent', dept: 'e& Sales', reportsTo: joy._id, target: 5000, salary: 4000, join: '2026-01-05' });
  const vani = await createUser({ name: 'Vani', role: 'agent', desig: 'Sales Agent', dept: 'e& Sales', reportsTo: joy._id, target: 5000, salary: 4000, join: '2026-01-15' });
  const naushad = await createUser({ name: 'Naushad', role: 'agent', desig: 'Sales Agent', dept: 'e& Sales', reportsTo: joy._id, target: 5000, salary: 4000, join: '2026-05-01' });
  const obina = await createUser({ name: 'Obina', role: 'agent', desig: 'Sales Agent', dept: 'e& Sales', reportsTo: joy._id, target: 5000, salary: 4000, join: '2026-02-01' });
  const ob = await createUser({ name: 'OB', role: 'agent', desig: 'Sales Agent', dept: 'e& Sales', reportsTo: maria._id, target: 7000, salary: 4500, join: '2025-11-10' });
  const samjith = await createUser({ name: 'Samjith', role: 'agent', desig: 'Sr. Sales Agent', dept: 'e& Sales', reportsTo: maria._id, target: 6000, salary: 5000, join: '2025-09-01' });
  const kiran = await createUser({ name: 'Kiran', role: 'agent', desig: 'Sales Agent', dept: 'e& Sales', reportsTo: rahul._id, target: 5000, salary: 4000, join: '2026-02-01' });

  await createUser({ name: 'Ansari', role: 'backoffice', desig: 'Back Office Executive', dept: 'Operations', reportsTo: amir._id, target: 0, salary: 5500, join: '2025-08-01' });
  await createUser({ name: 'ABC', role: 'accountant', desig: 'Accountant', dept: 'Finance', reportsTo: admin._id, target: 0, salary: 9000, join: '2025-05-01' });
  await createUser({ name: 'Fatima', role: 'hr', desig: 'HR Officer', dept: 'HR', reportsTo: admin._id, target: 0, salary: 8500, join: '2025-04-01' });

  console.log('Seeding DSR calling logs...');
  const agents = [hira, vani, ob, samjith, kiran, naushad, obina];
  const companies = ['PURE EARTH EQUIPMENT', 'LUTECH COMPOSITES', 'AL SAMIAH CARPETS', 'DARK REAL ESTATE', 'TRUSV AIR DUCT', 'PACKNEXA INDUSTRIES', 'MEAMAR BUILDING', 'SUNLUX ELECTROMECH', 'TECTONIC ELECTROMECH', 'SKY & SEA INTL', 'BRAVA TECHNO', 'LIVENDO PROPERTIES'];
  const remarksPool = ['Using etisalat already', 'He is busy, call later', 'Interested in 3 SIM cards', 'Wants data plan 30GB', 'Voicemail left', 'Asked to send proposal', 'Number not in use', 'Already with DU wireless'];
  const customers = ['Mr Ali', 'Anjlika', 'Usman', 'Eylan', 'Neha', 'Akbar'];

  const interestedDsrs = [];
  const total = 300;
  for (let i = 0; i < total; i += 1) {
    const agent = agents[i % agents.length];
    const status = CALL_STATUS[i % CALL_STATUS.length];
    const d = new Date(2026, 3 + (i % 4), 1 + (i % 27));
    const chain = agent.managerChain;
    const seq = await nextSeq('dsr');
    const dsrNo = 'DSR-' + String(seq).padStart(5, '0');
    const dsr = await Dsr.create({
      dsrNo,
      date: d.toISOString().slice(0, 10),
      agentId: agent._id,
      tlId: chain[0] || null,
      teamHeadId: chain[1] || null,
      salesHeadId: chain[2] || null,
      company: `${companies[i % companies.length]} ${i + 1}`,
      building: ['Abdul Razaq Ali', 'Bin Dasmal', 'Microbuilt', 'Advance Tech'][i % 4],
      contactNo: '9715' + String(20000000 + i * 131),
      customer: customers[i % customers.length],
      status,
      remarks: remarksPool[i % remarksPool.length],
      connected: ['No answer', 'Voicemail', 'Number not in use'].includes(status) ? 'NO' : 'YES',
      history: [{ userId: agent._id, text: `DSR created · status set to ${status}` }],
    });
    if (status === 'Interested') interestedDsrs.push(dsr);
  }

  console.log(`Seeding pipeline from ${interestedDsrs.length} interested DSRs...`);
  const products = [
    { cat: 'Business Internet', product: 'Business First Plus', price: 395 },
    { cat: 'Mobile', product: 'SOHO3', price: 150 },
    { cat: 'Business Internet', product: 'Business Extreme', price: 600 },
  ];
  const pipelines = [];
  for (let i = 0; i < interestedDsrs.length; i += 1) {
    const dsr = interestedDsrs[i];
    const agent = agents.find((a) => String(a._id) === String(dsr.agentId));
    const pr = products[i % products.length];
    const pipeline = await convertToPipeline(dsr._id, { cat: pr.cat, product: pr.product, price: pr.price, qty: 1 + (i % 4) }, agent);
    pipelines.push(pipeline);
  }

  console.log('Moving pipeline deals through stage/approval so the demo shows a realistic spread...');
  const tlByName = { Hira: joy, Vani: joy, Naushad: joy, Obina: joy, OB: maria, Samjith: maria, Kiran: rahul };
  const midStages = PIPE_STAGES.filter((s) => !s.startsWith('0%') && !s.startsWith('100%'));
  let orderCount = 0;
  for (let i = 0; i < pipelines.length; i += 1) {
    const pipeline = pipelines[i];
    const agent = agents.find((a) => String(a._id) === String(pipeline.agentId));
    const tl = tlByName[agent.name];
    if (i % 3 === 0) {
      // TL-approved -> order opened, deal well along (90% Closing).
      await Pipeline.updateOne({ _id: pipeline._id }, { stage: '90% - Closing' });
      await escalateToTL(pipeline._id, agent);
      await tlApprove(pipeline._id, tl);
      orderCount += 1;
    } else if (i % 3 === 1) {
      // Sitting in the TL's approval queue.
      await escalateToTL(pipeline._id, agent);
      await Pipeline.updateOne({ _id: pipeline._id }, { stage: midStages[i % midStages.length] });
    } else {
      // Still being worked, no approval requested yet.
      await Pipeline.updateOne({ _id: pipeline._id }, { stage: midStages[i % midStages.length] });
    }
  }

  console.log('Activating half the orders with commission (for payroll commission demo)...');
  const allOrders = await Order.find().select('_id mrc');
  for (let i = 0; i < allOrders.length; i += 1) {
    if (i % 2 !== 0) continue;
    await Order.updateOne(
      { _id: allOrders[i]._id },
      { status: 'Activated', actDate: '2026-06-15', commission: Math.round(allOrders[i].mrc * 0.15) }
    );
  }

  console.log('Seeding chart of accounts...');
  const bank = await Account.create({ name: 'Main Bank Account - ADCB', type: 'Bank', opening: 50000, createdBy: admin._id });
  const cash = await Account.create({ name: 'Petty Cash', type: 'Cash', opening: 5000, createdBy: admin._id });

  console.log('Seeding sample expenses (each debits one account)...');
  const rentExpense = await Expense.create({
    category: 'Rent', amount: 18000, date: '2026-06-05', account: bank._id,
    note: 'Office Rent - Business Bay', createdBy: admin._id,
  });
  await postAccountTx({ account: bank._id, date: '2026-06-05', type: 'Expense', amount: -18000, note: 'Rent - Office Rent - Business Bay', refType: 'Expense', refId: rentExpense._id, createdBy: admin._id });

  const utilExpense = await Expense.create({
    category: 'Utilities', amount: 3200, date: '2026-06-10', account: bank._id,
    note: 'Telecom & Internet', createdBy: admin._id,
  });
  await postAccountTx({ account: bank._id, date: '2026-06-10', type: 'Expense', amount: -3200, note: 'Utilities - Telecom & Internet', refType: 'Expense', refId: utilExpense._id, createdBy: admin._id });

  console.log('Seeding employee ledger (advance) ahead of the payroll run...');
  await LedgerEntry.create({
    employee: vani._id, date: '2026-06-01', type: 'Advance', amount: 3000,
    remaining: 3000, status: 'Open', note: 'Advance for personal emergency', createdBy: admin._id,
  });

  console.log('Processing June 2026 payroll run (debits Main Bank Account)...');
  await processPayrollRun('2026-06', bank._id, admin._id);

  console.log('Seeding cheques (PDC)...');
  await Cheque.create({ no: '000123', date: '2026-06-01', dueDate: '2026-07-15', direction: 'Received', party: 'Livendo Properties', amount: 12000, account: bank._id, status: 'Pending', note: 'Advance payment for annual contract', createdBy: admin._id });
  await Cheque.create({ no: '000456', date: '2026-06-05', dueDate: '2026-07-01', direction: 'Issued', party: 'Business Bay Landlord', amount: 18000, account: bank._id, status: 'Deposited', note: 'July office rent', createdBy: admin._id });
  const clearedCheque = await Cheque.create({ no: '000789', date: '2026-05-01', dueDate: '2026-06-01', direction: 'Received', party: 'Sky & Sea Intl', amount: 9500, account: bank._id, status: 'Cleared', note: 'Order settlement', createdBy: admin._id });
  await postAccountTx({ account: bank._id, date: '2026-06-01', type: 'Cheque Clearance', amount: 9500, note: `Cheque ${clearedCheque.no} (${clearedCheque.party}) cleared`, refType: 'Cheque', refId: clearedCheque._id, createdBy: admin._id });
  await Cheque.create({ no: '000321', date: '2026-05-10', dueDate: '2026-06-10', direction: 'Issued', party: 'IT Vendor - Laptops', amount: 7200, account: cash._id, status: 'Bounced', note: 'Insufficient funds - follow up required', createdBy: admin._id });

  console.log('Seeding segments...');
  const telecomSegment = await Segment.create({ name: 'e& Telecom', description: 'Core e& Authorised Channel Partner business', active: true });

  console.log('Seeding product catalog...');
  const catalog = [
    { cat: 'Fixed', title: 'Business Pro New' },
    { cat: 'Fixed', title: 'Business Pro Mig' },
    { cat: 'Fixed', title: 'Business On New' },
    { cat: 'Fixed', title: 'Business On Mig' },
    { cat: 'Fixed', title: 'SOHO' },
    { cat: 'Fixed', title: 'BQS' },
    { cat: 'Fixed', title: 'Office Presence' },
    { cat: 'Fixed', title: 'Dell / PABX' },
    { cat: 'Fixed', title: 'Toll Free' },
    { cat: 'Fixed', title: 'Digital Internet' },
    { cat: 'Fixed', title: 'Digital Premium Internet' },
    { cat: 'Fixed', title: 'SIP Trunk' },
    { cat: 'Fixed', title: 'PRI' },
    { cat: 'Fixed', title: 'SD WAN' },
    { cat: 'Fixed', title: 'Business TV' },
    { cat: 'Fixed', title: 'Business Flat Plus' },
    { cat: 'Fixed', title: 'Business Super' },
    { cat: 'Fixed', title: 'Add Lines' },
    { cat: 'Fixed', title: 'Global MPLS' },
    { cat: 'Mobile', title: 'ATL Plans' },
    { cat: 'Mobile', title: 'BTL Plans' },
    { cat: 'Mobile', title: 'Data Sims' },
    { cat: 'Digital', title: 'UTAP' },
    { cat: 'Digital', title: 'Office 365' },
    { cat: 'Digital', title: 'Online Marketing' },
    { cat: 'Digital', title: 'VSAAS' },
    { cat: 'Digital', title: 'DGTX' },
    { cat: 'Digital', title: 'M2M' },
    { cat: 'Digital', title: 'SVT' },
    { cat: 'Digital', title: 'APP 360' },
    { cat: 'Digital', title: 'Social eCommerce' },
    { cat: 'Digital', title: 'Cloud' },
    { cat: 'Digital', title: 'SMS' },
  ];
  const basePriceByCat = { Fixed: 300, Mobile: 150, Digital: 200 };
  await Product.insertMany(
    catalog.map((p, i) => ({
      cat: p.cat,
      title: p.title,
      segmentId: telecomSegment._id,
      price: basePriceByCat[p.cat] + (i % 6) * 50,
      active: true,
    }))
  );

  console.log(`Seed complete: ${agents.length + 6 + 3} users, ${total} DSR records, ${pipelines.length} pipeline deals, ${orderCount} orders, ${catalog.length} products.`);
  console.log('\nDemo logins (password = username@2026):');
  console.log('  admin / admin@2026');
  console.log('  amirqadri / amirqadri@2026 (Sales Head)');
  console.log('  sana / sana@2026 (Teams Head)');
  console.log('  joy / joy@2026 (Team Leader)');
  console.log('  hira / hira@2026, vani / vani@2026 (Agents under Joy)');
  console.log('  ansari / ansari@2026 (Back Office)');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
