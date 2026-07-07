require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import our modular routes
const apiRoutes = require('./src/routes/api.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes prefix
app.use('/api', apiRoutes);

// Boot the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 UpEnergy CRM API running on http://localhost:${PORT}`);
  console.log(`📂 Architecture: Modular MVC Active`);
});