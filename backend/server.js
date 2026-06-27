const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbzh8355iN0doc75eY8TFafDOCXDczVO_fEZvhPXnpSzO-ojGp0DbP7zVl7sfBOkAZo5/exec";

// Endpoints

// GET all tickets
app.get('/api/tickets', async (req, res) => {
  try {
    const response = await fetch(SHEET_API_URL);
    if (!response.ok) {
      throw new Error(`Google Sheets returned status: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error reading from Google Sheets:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST create a ticket
app.post('/api/tickets', async (req, res) => {
  const { title, description, category, priority, status, assignee, reporter } = req.body;
  
  if (!title || !description || !category || !priority || !status || !assignee || !reporter) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const listResponse = await fetch(SHEET_API_URL);
    if (!listResponse.ok) {
      throw new Error(`Failed to read current ticket list: ${listResponse.status}`);
    }
    const tickets = await listResponse.json();

    let lastNum = 0;
    tickets.forEach(ticket => {
      if (ticket.id && ticket.id.startsWith("IT-")) {
        try {
          const num = parseInt(ticket.id.replace("IT-", ""), 10);
          if (num > lastNum) {
            lastNum = num;
          }
        } catch (e) {}
      }
    });

    const nextIdVal = lastNum + 1;
    const padded = String(nextIdVal).padStart(3, '0');
    const newId = `IT-${padded}`;
    const today = new Date().toISOString().split('T')[0];

    const newTicket = {
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
    };

    const createResponse = await fetch(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        ticket: newTicket
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Google Sheets write error: ${createResponse.status}`);
    }

    res.status(201).json(newTicket);
  } catch (err) {
    console.error("Error creating ticket in Google Sheets:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update a ticket
app.put('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, category, priority, status, assignee, reporter, date_created } = req.body;

  if (!title || !description || !category || !priority || !status || !assignee || !reporter) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const today = new Date().toISOString().split('T')[0];

  const updatedTicket = {
    id,
    title,
    description,
    category,
    priority,
    status,
    assignee,
    reporter,
    date_created: date_created || today,
    date_updated: today
  };

  try {
    const updateResponse = await fetch(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        ticket: updatedTicket
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`Google Sheets update error: ${updateResponse.status}`);
    }

    res.json(updatedTicket);
  } catch (err) {
    console.error("Error updating ticket in Google Sheets:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE a ticket
app.delete('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deleteResponse = await fetch(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        id: id
      })
    });

    if (!deleteResponse.ok) {
      throw new Error(`Google Sheets delete error: ${deleteResponse.status}`);
    }

    res.json({ status: "success", message: "Ticket deleted successfully from Sheets" });
  } catch (err) {
    console.error("Error deleting ticket in Google Sheets:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Sprintly Google Sheets Express Backend running on port ${PORT}`);
});
