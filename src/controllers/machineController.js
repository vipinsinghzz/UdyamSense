const { pool } = require('../config/database');
async function listMachines(req, res, next) { try { const [data] = await pool.execute('SELECT id, machine_name, machine_code AS machine_id, location, created_at, updated_at FROM machines ORDER BY machine_code ASC'); res.json({ success: true, data }); } catch (error) { next(error); } }
async function getMachine(req, res, next) { try { const [data] = await pool.execute('SELECT id, machine_name, machine_code AS machine_id, location, created_at, updated_at FROM machines WHERE machine_code = ? LIMIT 1', [req.params.machine_id]); if (!data.length) return res.status(404).json({ success: false, error: 'Machine not found' }); res.json({ success: true, data: data[0] }); } catch (error) { next(error); } }
module.exports = { listMachines, getMachine };
