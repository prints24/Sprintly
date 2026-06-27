// Frontend app engine connecting to FastAPI backend database
const CONFIG = {
    priorities: ["Critical", "High", "Medium", "Low"],
    statuses: ["Backlog", "In Progress", "QA", "Blocked", "Done"],
    categories: ["Hardware", "Software/SaaS", "Infrastructure", "Authentication", "Security"],
    team: ["Alex Chen", "Sarah Jenkins", "Marcus Brody", "Unassigned"]
};

// State
let tickets = [];
let charts = {};
let currentSort = { column: 'id', direction: 'asc' };

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    fetchTickets();
    initDropdowns();
    setupEventListeners();
});

// Fetch Tickets from API
async function fetchTickets() {
    try {
        const response = await fetch("/api/tickets");
        if (!response.ok) throw new Error("Failed to fetch tickets");
        tickets = await response.json();
        renderAll();
    } catch (err) {
        console.error("Error fetching tickets:", err);
    }
}

// Calculate Resolution/Age Time in Days
function getResolutionTime(ticket) {
    const created = new Date(ticket.date_created);
    const end = ticket.status === "Done" ? new Date(ticket.date_updated) : new Date();
    
    created.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    
    const diffTime = Math.abs(end - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Setup Form and Filter Dropdowns
function initDropdowns() {
    const fillSelect = (selectId, items, includeAll = false, allText = "All") => {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = "";
        
        if (includeAll) {
            const option = document.createElement("option");
            option.value = "All";
            option.textContent = allText;
            select.appendChild(option);
        }
        
        items.forEach(item => {
            const option = document.createElement("option");
            option.value = item;
            option.textContent = item;
            select.appendChild(option);
        });
    };

    fillSelect("filter-category", CONFIG.categories, true, "All Categories");
    fillSelect("filter-priority", CONFIG.priorities, true, "All Priorities");
    fillSelect("filter-status", CONFIG.statuses, true, "All Statuses");
    fillSelect("filter-assignee", CONFIG.team, true, "All Assignees");

    fillSelect("form-category", CONFIG.categories);
    fillSelect("form-priority", CONFIG.priorities);
    fillSelect("form-status", CONFIG.statuses);
    fillSelect("form-assignee", CONFIG.team);
}

// Main Render Hub
function renderAll() {
    renderDashboard();
    renderKanban();
    renderTable();
}

// Tab Switching & Page Title Updates
function switchTab(tabId) {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
        if (item.getAttribute("data-tab") === tabId) {
            item.classList.add("active");
        }
    });

    document.querySelectorAll(".view-section").forEach(view => {
        view.classList.remove("active");
    });

    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) activeView.classList.add("active");

    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");

    if (tabId === "dashboard") {
        pageTitle.textContent = "Dashboard";
        pageSubtitle.textContent = "Real-time metrics and issue logs";
    } else if (tabId === "board") {
        pageTitle.textContent = "Kanban Board";
        pageSubtitle.textContent = "Drag & drop workflow management";
    } else if (tabId === "tickets") {
        pageTitle.textContent = "Tickets Log";
        pageSubtitle.textContent = "All tickets with advanced filters";
    }

    renderAll();
}

// Render Dashboard View
function renderDashboard() {
    const total = tickets.length;
    const active = tickets.filter(t => t.status !== "Done").length;
    const blocked = tickets.filter(t => t.status === "Blocked").length;
    const resolved = tickets.filter(t => t.status === "Done").length;

    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-active").textContent = active;
    document.getElementById("stat-blocked").textContent = blocked;
    document.getElementById("stat-resolved").textContent = resolved;

    const recentTickets = [...tickets]
        .sort((a, b) => new Date(b.date_created) - new Date(a.date_created))
        .slice(0, 5);

    const recentBody = document.getElementById("recent-tickets-body");
    recentBody.innerHTML = "";
    
    recentTickets.forEach(t => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.onclick = () => openTicketModal(t.id);
        tr.innerHTML = `
            <td><strong style="color:var(--accent-primary)">${t.id}</strong></td>
            <td>${t.title}</td>
            <td><span class="card-tag">${t.category}</span></td>
            <td><span class="badge badge-priority-${t.priority.toLowerCase()}">${t.priority}</span></td>
            <td><span class="badge badge-status-${t.status.replace(/\s+/g, '').toLowerCase()}">${t.status}</span></td>
            <td>
                <div class="card-assignee">
                    <img class="card-assignee-avatar" src="https://api.dicebear.com/7.x/initials/svg?seed=${t.assignee}" alt="Avatar">
                    <span>${t.assignee}</span>
                </div>
            </td>
        `;
        recentBody.appendChild(tr);
    });

    renderCharts();
}

function renderCharts() {
    const getChartOptions = () => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
            }
        }
    });

    if (charts.status) charts.status.destroy();
    if (charts.priority) charts.priority.destroy();

    const statusCounts = CONFIG.statuses.map(s => tickets.filter(t => t.status === s).length);
    const statusCtx = document.getElementById('chart-status').getContext('2d');
    charts.status = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: CONFIG.statuses,
            datasets: [{
                data: statusCounts,
                backgroundColor: [
                    '#64748b', // Backlog
                    '#3b82f6', // In Progress
                    '#06b6d4', // QA
                    '#ef4444', // Blocked
                    '#10b981'  // Done
                ],
                borderWidth: 2,
                borderColor: '#161f30'
            }]
        },
        options: getChartOptions()
    });

    const priorityCounts = CONFIG.priorities.map(p => tickets.filter(t => t.priority === p).length);
    const priorityCtx = document.getElementById('chart-priority').getContext('2d');
    charts.priority = new Chart(priorityCtx, {
        type: 'bar',
        data: {
            labels: CONFIG.priorities,
            datasets: [{
                label: 'Tickets',
                data: priorityCounts,
                backgroundColor: [
                    '#ef4444', // Critical
                    '#f59e0b', // High
                    '#3b82f6', // Medium
                    '#94a3b8'  // Low
                ],
                borderWidth: 0,
                borderRadius: 6
            }]
        },
        options: {
            ...getChartOptions(),
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: '#2e3c54' },
                    ticks: { color: '#94a3b8', stepSize: 1 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// Render Kanban Board View
function renderKanban() {
    const columns = {
        "Backlog": document.getElementById("cards-backlog"),
        "In Progress": document.getElementById("cards-inprogress"),
        "QA": document.getElementById("cards-qa"),
        "Blocked": document.getElementById("cards-blocked"),
        "Done": document.getElementById("cards-done")
    };

    Object.values(columns).forEach(col => col.innerHTML = "");

    tickets.forEach(t => {
        const colElement = columns[t.status];
        if (!colElement) return;

        const card = document.createElement("div");
        card.className = "kanban-card";
        card.draggable = true;
        card.setAttribute("data-id", t.id);
        card.ondragstart = (e) => {
            e.dataTransfer.setData("text/plain", t.id);
            card.style.opacity = "0.5";
        };
        card.ondragend = () => {
            card.style.opacity = "1";
        };
        card.onclick = () => openTicketModal(t.id);

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <span class="card-tag">${t.category}</span>
                <span class="badge badge-priority-${t.priority.toLowerCase()}" style="font-size: 9px; padding: 2px 6px;">${t.priority}</span>
            </div>
            <h4 class="card-title">${t.title}</h4>
            <div class="card-meta">
                <strong style="color:var(--accent-primary)">${t.id}</strong>
                <div class="card-assignee">
                    <img class="card-assignee-avatar" src="https://api.dicebear.com/7.x/initials/svg?seed=${t.assignee}" alt="Avatar">
                    <span>${t.assignee.split(" ")[0]}</span>
                </div>
            </div>
        `;

        colElement.appendChild(card);
    });

    document.getElementById("badge-backlog").textContent = tickets.filter(t => t.status === "Backlog").length;
    document.getElementById("badge-inprogress").textContent = tickets.filter(t => t.status === "In Progress").length;
    document.getElementById("badge-qa").textContent = tickets.filter(t => t.status === "QA").length;
    document.getElementById("badge-blocked").textContent = tickets.filter(t => t.status === "Blocked").length;
    document.getElementById("badge-done").textContent = tickets.filter(t => t.status === "Done").length;
}

// Drag & Drop event handlers
window.allowDrop = function(e) {
    e.preventDefault();
};

window.drop = async function(e) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const targetCol = e.currentTarget.closest(".kanban-column");
    if (!targetCol || !id) return;

    const newStatus = targetCol.getAttribute("data-status");
    const ticket = tickets.find(t => t.id === id);
    
    if (ticket && ticket.status !== newStatus) {
        const oldStatus = ticket.status;
        ticket.status = newStatus;
        
        try {
            const response = await fetch(`/api/tickets/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ticket)
            });
            if (!response.ok) throw new Error("Failed to update status");
            fetchTickets();
        } catch (err) {
            ticket.status = oldStatus;
            console.error(err);
        }
    }
};

// Render Table View (With Filter + Sort)
function renderTable() {
    const searchVal = document.getElementById("global-search").value.toLowerCase();
    const filterCat = document.getElementById("filter-category").value;
    const filterPrio = document.getElementById("filter-priority").value;
    const filterStat = document.getElementById("filter-status").value;
    const filterAss = document.getElementById("filter-assignee").value;

    let filtered = tickets.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchVal) || 
                              t.id.toLowerCase().includes(searchVal) || 
                              t.description.toLowerCase().includes(searchVal);
        const matchesCat = filterCat === "All" || t.category === filterCat;
        const matchesPrio = filterPrio === "All" || t.priority === filterPrio;
        const matchesStat = filterStat === "All" || t.status === filterStat;
        const matchesAss = filterAss === "All" || t.assignee === filterAss;
        return matchesSearch && matchesCat && matchesPrio && matchesStat && matchesAss;
    });

    filtered.sort((a, b) => {
        let valA = a[currentSort.column] || "";
        let valB = b[currentSort.column] || "";

        if (currentSort.column === "id") {
            const numA = parseInt(a.id.replace("IT-", ""));
            const numB = parseInt(b.id.replace("IT-", ""));
            return currentSort.direction === "asc" ? numA - numB : numB - numA;
        }

        if (currentSort.column === "resolution") {
            valA = getResolutionTime(a);
            valB = getResolutionTime(b);
        }

        if (currentSort.column === "created") {
            valA = new Date(a.date_created);
            valB = new Date(b.date_created);
        }

        if (typeof valA === "string") {
            return currentSort.direction === "asc" 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        } else {
            return currentSort.direction === "asc" ? valA - valB : valB - valA;
        }
    });

    const tbody = document.getElementById("tickets-table-body");
    tbody.innerHTML = "";

    filtered.forEach(t => {
        const resTime = getResolutionTime(t);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong style="color:var(--accent-primary)">${t.id}</strong></td>
            <td style="font-weight: 500;">${t.title}</td>
            <td><span class="card-tag">${t.category}</span></td>
            <td><span class="badge badge-priority-${t.priority.toLowerCase()}">${t.priority}</span></td>
            <td><span class="badge badge-status-${t.status.replace(/\s+/g, '').toLowerCase()}">${t.status}</span></td>
            <td>
                <div class="card-assignee">
                    <img class="card-assignee-avatar" src="https://api.dicebear.com/7.x/initials/svg?seed=${t.assignee}" alt="Avatar">
                    <span>${t.assignee}</span>
                </div>
            </td>
            <td>${t.reporter}</td>
            <td>${t.date_created}</td>
            <td style="font-weight:600">${resTime} ${resTime === 1 ? 'day' : 'days'}</td>
            <td>
                <button class="action-btn" onclick="openTicketModal('${t.id}')" title="Edit Ticket">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="action-btn" onclick="deleteTicket('${t.id}')" style="color:var(--danger)" title="Delete Ticket">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal Form Actions
function openTicketModal(ticketId = null) {
    const modal = document.getElementById("ticket-modal");
    const form = document.getElementById("ticket-form");
    const titleField = document.getElementById("modal-title");
    const createdGroup = document.getElementById("created-date-group");

    form.reset();

    if (ticketId) {
        const ticket = tickets.find(t => t.id === ticketId);
        if (!ticket) return;

        titleField.textContent = `Edit Ticket ${ticket.id}`;
        document.getElementById("ticket-id-field").value = ticket.id;
        document.getElementById("form-title").value = ticket.title;
        document.getElementById("form-description").value = ticket.description;
        document.getElementById("form-category").value = ticket.category;
        document.getElementById("form-priority").value = ticket.priority;
        document.getElementById("form-status").value = ticket.status;
        document.getElementById("form-assignee").value = ticket.assignee;
        document.getElementById("form-reporter").value = ticket.reporter;
        
        createdGroup.style.display = "block";
        document.getElementById("form-created").value = ticket.date_created;
    } else {
        titleField.textContent = "New Issue Incident";
        document.getElementById("ticket-id-field").value = "";
        createdGroup.style.display = "none";
    }

    modal.classList.add("active");
}

function closeTicketModal() {
    document.getElementById("ticket-modal").classList.remove("active");
}

// Delete Ticket Handler
window.deleteTicket = async function(id) {
    if (confirm(`Are you sure you want to delete ticket ${id}?`)) {
        try {
            const response = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Delete failed");
            fetchTickets();
        } catch (err) {
            console.error(err);
        }
    }
};

// Global Listeners setup
function setupEventListeners() {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");
            switchTab(tabId);
        });
    });

    document.getElementById("link-view-all").addEventListener("click", (e) => {
        e.preventDefault();
        switchTab("tickets");
    });

    document.getElementById("btn-new-ticket").addEventListener("click", () => {
        openTicketModal();
    });

    document.getElementById("btn-close-modal").addEventListener("click", closeTicketModal);
    document.getElementById("btn-cancel-modal").addEventListener("click", closeTicketModal);
    
    // Modal form save
    document.getElementById("ticket-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const id = document.getElementById("ticket-id-field").value;
        const ticketData = {
            title: document.getElementById("form-title").value.trim(),
            description: document.getElementById("form-description").value.trim(),
            category: document.getElementById("form-category").value,
            priority: document.getElementById("form-priority").value,
            status: document.getElementById("form-status").value,
            assignee: document.getElementById("form-assignee").value,
            reporter: document.getElementById("form-reporter").value.trim()
        };

        try {
            let response;
            if (id) {
                // Update
                response = await fetch(`/api/tickets/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(ticketData)
                });
            } else {
                // Create
                response = await fetch("/api/tickets", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(ticketData)
                });
            }

            if (!response.ok) throw new Error("Failed to save ticket");
            closeTicketModal();
            fetchTickets();
        } catch (err) {
            alert(err.message);
        }
    });

    document.getElementById("global-search").addEventListener("input", () => {
        const activeNav = document.querySelector(".nav-item.active");
        if (activeNav && activeNav.getAttribute("data-tab") !== "tickets") {
            switchTab("tickets");
        } else {
            renderTable();
        }
    });

    ["filter-category", "filter-priority", "filter-status", "filter-assignee"].forEach(filterId => {
        document.getElementById(filterId).addEventListener("change", renderTable);
    });

    document.querySelectorAll("#main-tickets-table th[data-sort]").forEach(th => {
        th.addEventListener("click", () => {
            const col = th.getAttribute("data-sort");
            if (currentSort.column === col) {
                currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
            } else {
                currentSort.column = col;
                currentSort.direction = "asc";
            }

            document.querySelectorAll("#main-tickets-table th i").forEach(i => {
                i.className = "fa-solid fa-sort";
            });
            const activeIcon = th.querySelector("i");
            activeIcon.className = currentSort.direction === "asc" 
                ? "fa-solid fa-sort-up" 
                : "fa-solid fa-sort-down";

            renderTable();
        });
    });
}
