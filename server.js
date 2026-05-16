require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ── TICKETS ──────────────────────────────────────────────────

// GET all tickets (with optional filters)
app.get('/api/tickets', async (req, res) => {
  try {
    const { status, product, priority, q } = req.query;
    let where = [];
    let params = [];
    let i = 1;

    if (status && status !== 'All') { where.push(`status = $${i++}`); params.push(status); }
    if (product) { where.push(`product = $${i++}`); params.push(product); }
    if (priority) { where.push(`priority = $${i++}`); params.push(priority); }
    if (q) {
      where.push(`(LOWER(customer_name) LIKE $${i} OR LOWER(ticket_ref) LIKE $${i} OR LOWER(serial_number) LIKE $${i} OR LOWER(issue_type) LIKE $${i})`);
      params.push(`%${q.toLowerCase()}%`); i++;
    }

    const sql = `SELECT * FROM tickets ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single ticket with timeline
app.get('/api/tickets/:id', async (req, res) => {
  try {
    const ticket = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticket.rows.length) return res.status(404).json({ error: 'Not found' });
    const timeline = await pool.query('SELECT * FROM ticket_timeline WHERE ticket_id = $1 ORDER BY created_at ASC', [req.params.id]);
    res.json({ ...ticket.rows[0], timeline: timeline.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create ticket
app.post('/api/tickets', async (req, res) => {
  try {
    const {
      customer_name, customer_phone, customer_region, serial_number, product,
      issue_type, description, source, reporter_role, reported_by, assigned_agent, priority
    } = req.body;

    const countRes = await pool.query('SELECT COUNT(*) FROM tickets');
    const ref = 'TKT-' + String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');

    const result = await pool.query(
      `INSERT INTO tickets (ticket_ref, customer_name, customer_phone, customer_region, serial_number, product, issue_type, description, source, reporter_role, reported_by, assigned_agent, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [ref, customer_name, customer_phone, customer_region, serial_number, product, issue_type, description, source, reporter_role, reported_by, assigned_agent, priority || 'Medium']
    );

    const ticket = result.rows[0];
    await pool.query('INSERT INTO ticket_timeline (ticket_id, event_text) VALUES ($1, $2)', [ticket.id, `Ticket created via ${source}`]);
    res.status(201).json(ticket);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH update ticket status
app.patch('/api/tickets/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query('UPDATE tickets SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    await pool.query('INSERT INTO ticket_timeline (ticket_id, event_text) VALUES ($1, $2)', [req.params.id, `Status changed to "${status}"`]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH save resolution
app.patch('/api/tickets/:id/resolution', async (req, res) => {
  try {
    const { resolution } = req.body;
    const result = await pool.query(
      "UPDATE tickets SET resolution=$1, status='Resolved' WHERE id=$2 RETURNING *",
      [resolution, req.params.id]
    );
    await pool.query('INSERT INTO ticket_timeline (ticket_id, event_text) VALUES ($1, $2)', [req.params.id, `Resolution logged: "${resolution.substring(0, 80)}"`]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST add timeline note
app.post('/api/tickets/:id/note', async (req, res) => {
  try {
    const { text } = req.body;
    await pool.query('INSERT INTO ticket_timeline (ticket_id, event_text) VALUES ($1, $2)', [req.params.id, text]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AGENTS ───────────────────────────────────────────────────

app.get('/api/agents', async (req, res) => {
  try {
    const agents = await pool.query('SELECT * FROM agents ORDER BY created_at DESC');
    const tickets = await pool.query('SELECT assigned_agent, status FROM tickets');

    const enriched = agents.rows.map(a => {
      const mine = tickets.rows.filter(t => t.assigned_agent === a.name);
      const open = mine.filter(t => t.status !== 'Resolved').length;
      const resolved = mine.filter(t => t.status === 'Resolved').length;
      return { ...a, total_tickets: mine.length, open_tickets: open, resolved_tickets: resolved };
    });

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/agents', async (req, res) => {
  try {
    const { name, role, region, phone, channel, email } = req.body;
    const result = await pool.query(
      'INSERT INTO agents (name, role, region, phone, channel, email) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, role, region, phone, channel, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/agents/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM agents WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CARBON CREDITS ────────────────────────────────────────────

app.get('/api/carbon', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM carbon_credits ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/carbon', async (req, res) => {
  try {
    const { product, serial_number, region, credits_issued, status } = req.body;
    const countRes = await pool.query('SELECT COUNT(*) FROM carbon_credits');
    const ref = 'CC-' + String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
    const result = await pool.query(
      'INSERT INTO carbon_credits (cc_ref, product, serial_number, region, credits_issued, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [ref, product, serial_number, region, credits_issued, status || 'Pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/carbon/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query('UPDATE carbon_credits SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── STATS (dashboard) ─────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  try {
    const [total, open, inprog, pending, resolved, overdue, byProduct, byChannel, byPriority, byReporter] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM tickets'),
      pool.query("SELECT COUNT(*) FROM tickets WHERE status='Open'"),
      pool.query("SELECT COUNT(*) FROM tickets WHERE status='In Progress'"),
      pool.query("SELECT COUNT(*) FROM tickets WHERE status='Pending'"),
      pool.query("SELECT COUNT(*) FROM tickets WHERE status='Resolved'"),
      pool.query("SELECT COUNT(*) FROM tickets WHERE status != 'Resolved' AND created_at < NOW() - INTERVAL '7 days'"),
      pool.query("SELECT product, COUNT(*) as count FROM tickets GROUP BY product ORDER BY count DESC"),
      pool.query("SELECT source, COUNT(*) as count FROM tickets GROUP BY source ORDER BY count DESC"),
      pool.query("SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority"),
      pool.query("SELECT reporter_role, COUNT(*) as count FROM tickets GROUP BY reporter_role"),
    ]);

    const resolvedAvg = await pool.query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400)) as avg_days
      FROM tickets WHERE status='Resolved'
    `);

    res.json({
      total: parseInt(total.rows[0].count),
      open: parseInt(open.rows[0].count),
      in_progress: parseInt(inprog.rows[0].count),
      pending: parseInt(pending.rows[0].count),
      resolved: parseInt(resolved.rows[0].count),
      overdue: parseInt(overdue.rows[0].count),
      avg_resolution_days: resolvedAvg.rows[0].avg_days || 0,
      by_product: byProduct.rows,
      by_channel: byChannel.rows,
      by_priority: byPriority.rows,
      by_reporter: byReporter.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`UpEnergy CRM API running on http://localhost:${PORT}`));