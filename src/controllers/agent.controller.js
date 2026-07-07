const pool = require('../config/db');

// Fetch all agents and calculate their ticket stats dynamically
const getAgents = async (req, res) => {
  try {
    const query = `
      SELECT 
        a.*,
        COUNT(t.id) AS total_tickets,
        COUNT(CASE WHEN t.status = 'Resolved' THEN 1 END) AS resolved_tickets,
        COUNT(CASE WHEN t.status IN ('Open', 'In Progress', 'Pending') THEN 1 END) AS open_tickets
      FROM agents a
      LEFT JOIN tickets t ON a.name = t.assigned_agent
      GROUP BY a.id
      ORDER BY a.name ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a new agent to the directory
const createAgent = async (req, res) => {
  try {
    const { name, role, region, phone, channel, email } = req.body;
    
    if (!name || !role) {
      return res.status(400).json({ error: 'Name and role are required.' });
    }

    const insertQuery = `
      INSERT INTO agents (name, role, region, phone, channel, email)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [name, role, region, phone, channel, email];
    
    const newAgent = await pool.query(insertQuery, values);
    res.status(201).json(newAgent.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Remove an agent from the directory
const deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM agents WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found.' });
    }
    
    res.json({ success: true, message: 'Agent removed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAgents, createAgent, deleteAgent };