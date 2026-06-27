const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tickets.db');
const db = new sqlite3.Database(dbPath);

function initDb() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        assignee TEXT NOT NULL,
        reporter TEXT NOT NULL,
        date_created TEXT NOT NULL,
        date_updated TEXT NOT NULL
      )
    `);

    db.get("SELECT COUNT(*) as count FROM tickets", (err, row) => {
      if (err) {
        console.error("Error checking ticket count:", err);
        return;
      }

      if (row.count === 0) {
        const stmt = db.prepare(`
          INSERT INTO tickets (id, title, description, category, priority, status, assignee, reporter, date_created, date_updated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const defaultTickets = [
          [
            "IT-001",
            "Login page throwing 500 Error",
            "Users cannot log in via Google Auth. Returns a internal server error payload.",
            "Authentication",
            "Critical",
            "In Progress",
            "Alex Chen",
            "Jane Doe",
            "2026-06-25",
            "2026-06-26"
          ],
          [
            "IT-002",
            "VPN connection dropping frequently",
            "Remote employees reporting disconnection every 30 minutes on Cisco client.",
            "Infrastructure",
            "High",
            "Blocked",
            "Sarah Jenkins",
            "John Smith",
            "2026-06-26",
            "2026-06-27"
          ],
          [
            "IT-003",
            "Laptop provisioning for New Hires",
            "Setup MacBooks for July 1 intake (Engineering team).",
            "Hardware",
            "Medium",
            "Backlog",
            "Unassigned",
            "HR Ops",
            "2026-06-27",
            "2026-06-27"
          ],
          [
            "IT-004",
            "SSL Certificate renewal for API gateway",
            "Staging certificate expires in 5 days. Needs Let's Encrypt script run.",
            "Security",
            "High",
            "Done",
            "Alex Chen",
            "Automated Alert",
            "2026-06-22",
            "2026-06-24"
          ]
        ];

        defaultTickets.forEach(ticket => {
          stmt.run(ticket);
        });

        stmt.finalize(() => {
          console.log("Database seeded successfully with default tickets.");
        });
      }
    });
  });
}

module.exports = {
  db,
  initDb
};
