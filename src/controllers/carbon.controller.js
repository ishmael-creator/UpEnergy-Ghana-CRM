const pool = require('../config/db');

// Fetch all carbon credit entries
const getCarbonEntries = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM carbon_credits ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Log a new carbon credit entry with an auto-generated Reference ID
const createCarbonEntry = async (req, res) => {
  try {
    const { product, serial_number, region, credits_issued, status } = req.body;
    
    if (!credits_issued) {
      return res.status(400).json({ error: 'Credits amount is required.' });
    }

    // Generate the sequential Carbon Credit ID (e.g., CC-26-001)
    const year = new Date().getFullYear().toString().slice(-2);
    const countRes = await pool.query(`SELECT COUNT(*) FROM carbon_credits WHERE cc_ref LIKE $1`, [`CC-${year}-%`]);
    const nextNum = (parseInt(countRes.rows[0].count) + 1).toString().padStart(3, '0');
    const cc_ref = `CC-${year}-${nextNum}`;

    const insertQuery = `
      INSERT INTO carbon_credits (cc_ref, product, serial_number, region, credits_issued, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [cc_ref, product, serial_number, region, credits_issued, status || 'Pending'];
    
    const newEntry = await pool.query(insertQuery, values);
    res.status(201).json(newEntry.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update the status of a carbon credit entry (e.g., mark as Verified)
const verifyCarbonEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await pool.query('UPDATE carbon_credits SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carbon entry not found.' });
    }
    
    res.json({ success: true, message: `Carbon entry marked as ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getCarbonEntries, createCarbonEntry, verifyCarbonEntry };