const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');
const { loadPermissions } = require('./services/permissions');

async function start() {
  await connectDB();
  await loadPermissions();
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
