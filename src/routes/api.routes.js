const express = require('express');
const router = express.Router();

const { setupUsers, login } = require('../controllers/auth.controller');
const { 
  assessTicket, 
  getAllTickets, 
  getTicketById, 
  createTicket, 
  updateTicketStatus, 
  saveResolution, 
  addNote 
} = require('../controllers/ticket.controller');
const { getStats } = require('../controllers/stat.controller'); 
const { getAgents, createAgent, deleteAgent } = require('../controllers/agent.controller');
// Import the final carbon controller
const { getCarbonEntries, createCarbonEntry, verifyCarbonEntry } = require('../controllers/carbon.controller');

// Auth Routes
router.get('/setup-users', setupUsers);
router.post('/login', login);

// Ticket Routes
router.get('/tickets', getAllTickets);
router.post('/tickets', createTicket);
router.get('/tickets/:id', getTicketById);
router.patch('/tickets/:id/assessment', assessTicket);
router.patch('/tickets/:id/status', updateTicketStatus);
router.patch('/tickets/:id/resolution', saveResolution);
router.post('/tickets/:id/note', addNote);

// Stat Routes
router.get('/stats', getStats); 

// Agent Routes
router.get('/agents', getAgents);
router.post('/agents', createAgent);
router.delete('/agents/:id', deleteAgent);

// Carbon Routes
router.get('/carbon', getCarbonEntries);
router.post('/carbon', createCarbonEntry);
router.patch('/carbon/:id/status', verifyCarbonEntry);

module.exports = router;