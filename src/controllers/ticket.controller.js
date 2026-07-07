const pool = require('../config/db');
const { sendEmailAlert } = require('../services/email.service');

const getAllTickets = async (req, res) => {
  try {
    // 1. Extract query parameters sent by the frontend
    const { status, product, priority, q } = req.query;
    
    // 2. Start building the base SQL query
    let query = 'SELECT * FROM tickets WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    // 3. Dynamically append filters if they exist
    if (status && status !== 'All') {
      query += ` AND status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    if (product) {
      query += ` AND product = $${paramIndex}`;
      values.push(product);
      paramIndex++;
    }

    if (priority) {
      query += ` AND priority = $${paramIndex}`;
      values.push(priority);
      paramIndex++;
    }

    if (q) {
      // Search across ticket reference, customer name, and serial number
      query += ` AND (customer_name ILIKE $${paramIndex} OR ticket_ref ILIKE $${paramIndex} OR serial_number ILIKE $${paramIndex})`;
      values.push(`%${q}%`);
      paramIndex++;
    }

    // 4. Order by newest first
    query += ' ORDER BY created_at DESC';

    // 5. Execute the query
    const result = await pool.query(query, values);
    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const assessTicket = async (req, res) => {
  try {
    const { decision, notes } = req.body;
    const ticketId = req.params.id;

    if (!decision) return res.status(400).json({ error: 'Assessment decision is required' });

    let nextStatus = '';
    let timelineMessage = '';
    let triggerEmail = false;

    if (decision === 'Approved for Manager Review') {
      nextStatus = 'Manager Review';
      timelineMessage = `Stage 2 Completed: CX Approved. Notes: "${notes || 'None'}". Ownership transferred to Carbon Manager.`;
      triggerEmail = true;
    } else if (decision === 'Rejected') {
      nextStatus = 'Rejected';
      timelineMessage = `Stage 2 Completed: CX Rejected. Reason: "${notes || 'None'}".`;
    } else if (decision === 'More Information Required') {
      nextStatus = 'Pending Info';
      timelineMessage = `Stage 2 Paused: CX requested info. Requirements: "${notes || 'None'}".`;
    } else {
      return res.status(400).json({ error: 'Invalid assessment decision' });
    }

    const result = await pool.query('UPDATE tickets SET status = $1 WHERE id = $2 RETURNING *', [nextStatus, ticketId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Ticket not found' });
    
    const ticket = result.rows[0];
    await pool.query('INSERT INTO ticket_timeline (ticket_id, event_text) VALUES ($1, $2)', [ticketId, timelineMessage]);

    if (triggerEmail && process.env.MANAGER_EMAIL) {
      const emailHtml = `<h3>Manager Review Needed</h3><p>Ticket <strong>${ticket.ticket_ref}</strong> requires your approval.</p>`;
      await sendEmailAlert(process.env.MANAGER_EMAIL, `⚠️ Action Required: ${ticket.ticket_ref}`, emailHtml);
    }

    res.json({ success: true, message: `Status updated to ${nextStatus}.`, ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fixes the "Unexpected token '<'" error by providing the individual ticket data
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Fetch the main ticket details
    const ticketRes = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    
    const ticket = ticketRes.rows[0];
    
    // 2. Fetch the timeline history for this ticket so the detail panel populates correctly
    const timelineRes = await pool.query('SELECT * FROM ticket_timeline WHERE ticket_id = $1 ORDER BY created_at ASC', [id]);
    ticket.timeline = timelineRes.rows;
    
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Builds the Ticket Creation engine
const createTicket = async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_region, serial_number, product, issue_type, description, source, reporter_role, reported_by, assigned_agent, priority } = req.body;
    
    // 1. Determine the correct prefix based on the Operations Manual
    let prefix = 'TKT'; // Default for Data/Service issues
    if (issue_type === 'Replacement Request') {
        prefix = 'RPL'; // Section 8.0: RPL-26-001
    } else if (['Damaged Unit', 'Technical Malfunction', 'Stove Not Igniting'].includes(issue_type)) {
        prefix = 'RPR'; // Section 7.0: RPR-26-001
    }

    // 2. Generate the sequential Ticket ID (e.g., RPR-26-001)
    const year = new Date().getFullYear().toString().slice(-2);
    const countRes = await pool.query(`SELECT COUNT(*) FROM tickets WHERE ticket_ref LIKE $1`, [`%-${year}-%`]);
    const nextNum = (parseInt(countRes.rows[0].count) + 1).toString().padStart(3, '0');
    const ticket_ref = `${prefix}-${year}-${nextNum}`;
    
    // 3. Insert the new ticket into the database
    const insertQuery = `
      INSERT INTO tickets 
      (ticket_ref, customer_name, customer_phone, customer_region, serial_number, product, issue_type, description, source, reporter_role, reported_by, assigned_agent, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const values = [ticket_ref, customer_name, customer_phone, customer_region, serial_number, product, issue_type, description, source, reporter_role, reported_by, assigned_agent, priority];
    
    const newTicket = await pool.query(insertQuery, values);
    
    // 4. Log the initial timeline event
    await pool.query('INSERT INTO ticket_timeline (ticket_id, event_text) VALUES ($1, $2)', [newTicket.rows[0].id, 'Ticket successfully logged into CRM.']);
    
    res.status(201).json(newTicket.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Handles manual status updates
const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    await pool.query('UPDATE tickets SET status = $1 WHERE id = $2', [status, id]);
    
    // Log the change in the timeline
    await pool.query('INSERT INTO ticket_timeline (ticket_id, event_text) VALUES ($1, $2)', 
      [id, `Status manually updated to: ${status}`]);
      
    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Handles logging the final resolution and auto-closing the ticket
const saveResolution = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;
    
    if (!resolution) return res.status(400).json({ error: 'Resolution text is required.' });

    // Update the ticket to Resolved and save the resolution text
    await pool.query('UPDATE tickets SET resolution = $1, status = $2 WHERE id = $3', 
      [resolution, 'Resolved', id]);
      
    // Log it in the timeline
    await pool.query('INSERT INTO ticket_timeline (ticket_id, event_text) VALUES ($1, $2)', 
      [id, `Resolution logged and ticket closed: "${resolution}"`]);
      
    res.json({ success: true, message: 'Ticket resolved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Handles adding random updates or notes to a ticket's history
const addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    
    if (!text) return res.status(400).json({ error: 'Note text is required.' });

    await pool.query('INSERT INTO ticket_timeline (ticket_id, event_text) VALUES ($1, $2)', 
      [id, `Note added: ${text}`]);
      
    res.status(201).json({ success: true, message: 'Note added to timeline.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { assessTicket, getAllTickets, getTicketById, createTicket, updateTicketStatus, saveResolution, addNote };