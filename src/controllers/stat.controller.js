const pool = require('../config/db');

const getStats = async (req, res) => {
  try {
    // Run all our aggregations concurrently for maximum performance
    const [
      totalRes,
      resolvedRes,
      statusRes,
      avgRes,
      overdueRes,
      productRes,
      channelRes,
      priorityRes,
      reporterRes
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM tickets'),
      pool.query("SELECT COUNT(*) FROM tickets WHERE status = 'Resolved'"),
      pool.query("SELECT status, COUNT(*) FROM tickets WHERE status IN ('Open', 'In Progress', 'Pending') GROUP BY status"),
      // Calculate Average Resolution Time in days [cite: 1424]
      pool.query("SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as avg_days FROM tickets WHERE status = 'Resolved'"),
      // Overdue: Tickets older than 7 days that are not resolved (Standard SLA breach tracker)
      pool.query("SELECT COUNT(*) FROM tickets WHERE status != 'Resolved' AND created_at < NOW() - INTERVAL '7 days'"),
      pool.query("SELECT product, COUNT(*) FROM tickets GROUP BY product"),
      pool.query("SELECT source, COUNT(*) FROM tickets GROUP BY source"),
      pool.query("SELECT priority, COUNT(*) FROM tickets GROUP BY priority"),
      pool.query("SELECT reporter_role, COUNT(*) FROM tickets GROUP BY reporter_role")
    ]);

    // Parse out the individual open statuses
    let open = 0, in_progress = 0, pending = 0;
    statusRes.rows.forEach(row => {
      if (row.status === 'Open') open = parseInt(row.count);
      if (row.status === 'In Progress') in_progress = parseInt(row.count);
      if (row.status === 'Pending') pending = parseInt(row.count);
    });

    // Send the perfectly formatted payload to the frontend
    res.json({
      total: parseInt(totalRes.rows[0].count),
      resolved: parseInt(resolvedRes.rows[0].count),
      open,
      in_progress,
      pending,
      avg_resolution_days: avgRes.rows[0].avg_days ? Math.round(parseFloat(avgRes.rows[0].avg_days)) : 0,
      overdue: parseInt(overdueRes.rows[0].count),
      by_product: productRes.rows,
      by_channel: channelRes.rows,
      by_priority: priorityRes.rows,
      by_reporter: reporterRes.rows
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getStats };