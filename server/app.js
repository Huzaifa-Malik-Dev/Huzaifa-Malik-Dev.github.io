const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

const { clientOrigin, nodeEnv, uploadDir } = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');

const authRoutes = require('./routes/auth');
const dsrRoutes = require('./routes/dsr');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/users');
const pipelineRoutes = require('./routes/pipeline');
const orderRoutes = require('./routes/orders');
const accountingRoutes = require('./routes/accounting');
const payrollRoutes = require('./routes/payroll');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const misRoutes = require('./routes/mis');
const aiRoutes = require('./routes/ai');
const threadRoutes = require('./routes/threads');
const productRoutes = require('./routes/products');
const segmentRoutes = require('./routes/segments');

const app = express();

app.use(helmet());
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
if (nodeEnv === 'development') app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(__dirname, uploadDir)));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/dsr', dsrRoutes);
app.use('/notifications', notificationRoutes);
app.use('/users', userRoutes);
app.use('/pipeline', pipelineRoutes);
app.use('/orders', orderRoutes);
app.use('/accounting', accountingRoutes);
app.use('/payroll', payrollRoutes);
app.use('/admin', adminRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/mis', misRoutes);
app.use('/ai', aiRoutes);
app.use('/threads', threadRoutes);
app.use('/products', productRoutes);
app.use('/segments', segmentRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
