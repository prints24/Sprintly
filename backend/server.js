const express = require('express');
const cors = require('cors');
const { db, initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

initDb();

app.get('/api/tickets', (req, res) => {
  db.all("SELECT * FROM tickets", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/tickets', (req, res) => {
  const { title, description, category, priority, status, assignee, reporter } = req.body;
  
  if (!title || !description || !category || !priority || !status || !assignee || !reporter) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.all("SELECT id FROM tickets", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    let lastNum = 0;
    rows.forEach(row => {
      try {
        const num = parseInt(row.id.replace("IT-", ""), 10);
        if (num > lastNum) {
          lastNum = num;
        }
      } catch (e) {}
    });

    const nextIdVal = lastNum + 1;
    const padded = String(nextIdVal).padStart(3, '0');
    const newId = `IT-${padded}`;
    const today = new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
      INSERT INTO tickets (id, title, description, category, priority, status, assignee, reporter, date_created, date_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      newId,
      title,
      description,
      category,
      priority,
      status,
      assignee,
      reporter,
      today,
      today
    ], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: newId,
        title,
        description,
        category,
        priority,
        status,
        assignee,
        reporter,
        date_created: today,
        date_updated: today
      });
    });
    stmt.finalize();
  });
});

app.put('/api/tickets/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, category, priority, status, assignee, reporter } = req.body;

  if (!title || !description || !category || !priority || !status || !assignee || !reporter) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const today = new Date().toISOString().split('T')[0];

  const stmt = db.prepare(`
    UPDATE tickets
    SET title = ?, description = ?, category = ?, priority = ?, status = ?, assignee = ?, reporter = ?, date_updated = ?
    WHERE id = ?
  `);

  stmt.run([
    title,
    description,
    category,
    priority,
    status,
    assignee,
    reporter,
    today,
    id
  ], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      id,
      title,
      description,
      category,
      priority,
      status,
      assignee,
      reporter,
      date_updated: today
    });
  });
  stmt.finalize();
});

app.delete('/api/tickets/:id', (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare("DELETE FROM tickets WHERE id = ?");
  stmt.run([id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ status: "success", message: "Ticket deleted successfully" });
  });
  stmt.finalize();
});

app.listen(PORT, () => {
  console.log(`Sprintly Express Backend running on port ${PORT}`);
});
