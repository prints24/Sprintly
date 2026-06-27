import React, { useState, useEffect, useRef } from 'react';

const API_BASE_URL = 'http://localhost:8000/api';

const CONFIG = {
  priorities: ["Critical", "High", "Medium", "Low"],
  statuses: ["Backlog", "In Progress", "QA", "Blocked", "Done"],
  categories: ["Hardware", "Software/SaaS", "Infrastructure", "Authentication", "Security"],
  team: ["Alex Chen", "Sarah Jenkins", "Marcus Brody", "Unassigned"]
};

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'board', 'tickets'
  const [searchVal, setSearchVal] = useState('');
  
  // Filters
  const [filterCat, setFilterCat] = useState('All');
  const [filterPrio, setFilterPrio] = useState('All');
  const [filterStat, setFilterStat] = useState('All');
  const [filterAss, setFilterAss] = useState('All');

  // Sorting
  const [currentSort, setCurrentSort] = useState({ column: 'id', direction: 'asc' });

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTicketId, setEditTicketId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState(CONFIG.categories[0]);
  const [formPriority, setFormPriority] = useState(CONFIG.priorities[2]);
  const [formStatus, setFormStatus] = useState(CONFIG.statuses[0]);
  const [formAssignee, setFormAssignee] = useState(CONFIG.team[3]);
  const [formReporter, setFormReporter] = useState('');
  const [formCreated, setFormCreated] = useState('');
  const [formIpAddress, setFormIpAddress] = useState('');

  // Loading/Prevent Double Click State
  const [isSaving, setIsSaving] = useState(false);

  // Custom Delete Confirm State
  const [deleteTicketId, setDeleteTicketId] = useState(null);

  // Chart refs
  const statusChartRef = useRef(null);
  const priorityChartRef = useRef(null);
  const statusCanvasRef = useRef(null);
  const priorityCanvasRef = useRef(null);

  // Fetch tickets
  const fetchTickets = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tickets`);
      if (!response.ok) throw new Error("Failed to fetch tickets");
      const data = await response.json();
      setTickets(data);
    } catch (err) {
      console.error("Error fetching tickets:", err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Update charts inside dashboard tab
  useEffect(() => {
    if (activeTab === 'dashboard' && tickets.length > 0 && statusCanvasRef.current && priorityCanvasRef.current) {
      // Destroy existing charts
      if (statusChartRef.current) statusChartRef.current.destroy();
      if (priorityChartRef.current) priorityChartRef.current.destroy();

      const statusCounts = CONFIG.statuses.map(s => tickets.filter(t => t.status === s).length);
      const priorityCounts = CONFIG.priorities.map(p => tickets.filter(t => t.priority === p).length);

      const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
          }
        }
      };

      const statusCtx = statusCanvasRef.current.getContext('2d');
      statusChartRef.current = new window.Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: CONFIG.statuses,
          datasets: [{
            data: statusCounts,
            backgroundColor: ['#64748b', '#3b82f6', '#06b6d4', '#ef4444', '#10b981'],
            borderWidth: 2,
            borderColor: '#161f30'
          }]
        },
        options: chartOptions
      });

      const priorityCtx = priorityCanvasRef.current.getContext('2d');
      priorityChartRef.current = new window.Chart(priorityCtx, {
        type: 'bar',
        data: {
          labels: CONFIG.priorities,
          datasets: [{
            label: 'Tickets',
            data: priorityCounts,
            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#94a3b8'],
            borderWidth: 0,
            borderRadius: 6
          }]
        },
        options: {
          ...chartOptions,
          plugins: { legend: { display: false } },
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
  }, [activeTab, tickets]);

  // Age Resolution calculator
  const getResolutionTime = (ticket) => {
    const created = new Date(ticket.date_created);
    const end = ticket.status === "Done" ? new Date(ticket.date_updated) : new Date();
    created.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(end - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Open Modal
  const openModal = (ticketId = null) => {
    if (ticketId) {
      const t = tickets.find(x => x.id === ticketId);
      if (t) {
        setEditTicketId(t.id);
        setFormTitle(t.title);
        setFormDescription(t.description);
        setFormCategory(t.category);
        setFormPriority(t.priority);
        setFormStatus(t.status);
        setFormAssignee(t.assignee);
        setFormReporter(t.reporter);
        setFormCreated(t.date_created);
        setFormIpAddress(t.ip_address || '');
      }
    } else {
      setEditTicketId(null);
      setFormTitle('');
      setFormDescription('');
      setFormCategory(CONFIG.categories[0]);
      setFormPriority(CONFIG.priorities[2]);
      setFormStatus(CONFIG.statuses[0]);
      setFormAssignee(CONFIG.team[3]); // Default to Unassigned
      setFormReporter('');
      setFormCreated('');
      setFormIpAddress('');
    }
    setIsSaving(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return; // Prevent duplicate submissions

    setIsSaving(true);
    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      category: formCategory,
      priority: formPriority,
      status: formStatus,
      assignee: formAssignee,
      reporter: formReporter.trim(),
      ip_address: formIpAddress
    };

    try {
      let response;
      if (editTicketId) {
        response = await fetch(`${API_BASE_URL}/tickets/${editTicketId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${API_BASE_URL}/tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) throw new Error("Failed to save ticket");
      closeModal();
      await fetchTickets();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm and Execute Delete Ticket (with Optimistic UI updates)
  const confirmDeleteTicket = async () => {
    if (!deleteTicketId) return;
    
    const targetId = deleteTicketId;
    const originalTickets = [...tickets];

    // Optimistically update frontend UI state instantly
    setTickets(tickets.filter(t => t.id !== targetId));
    setDeleteTicketId(null);

    try {
      const response = await fetch(`${API_BASE_URL}/tickets/${targetId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error("Delete failed");
      
      // Fetch latest list in background to ensure alignment with server state
      await fetchTickets();
    } catch (err) {
      console.error(err);
      alert("Failed to delete ticket: " + err.message);
      // Rollback to original state if delete failed
      setTickets(originalTickets);
    }
  };

  // Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const ticket = tickets.find(t => t.id === id);
    if (ticket && ticket.status !== targetStatus) {
      const oldStatus = ticket.status;
      setTickets(tickets.map(t => t.id === id ? { ...t, status: targetStatus } : t));

      try {
        const response = await fetch(`${API_BASE_URL}/tickets/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...ticket, status: targetStatus })
        });
        if (!response.ok) throw new Error("Failed to update status");
        fetchTickets();
      } catch (err) {
        setTickets(tickets.map(t => t.id === id ? { ...t, status: oldStatus } : t));
        console.error(err);
      }
    }
  };

  // Filtered & Sorted tickets list
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchVal.toLowerCase()) ||
                          t.id.toLowerCase().includes(searchVal.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchVal.toLowerCase());
    const matchesCat = filterCat === 'All' || t.category === filterCat;
    const matchesPrio = filterPrio === 'All' || t.priority === filterPrio;
    const matchesStat = filterStat === 'All' || t.status === filterStat;
    const matchesAss = filterAss === 'All' || t.assignee === filterAss;
    return matchesSearch && matchesCat && matchesPrio && matchesStat && matchesAss;
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    let valA = a[currentSort.column] || "";
    let valB = b[currentSort.column] || "";

    if (currentSort.column === "id") {
      const numA = parseInt(a.id.replace("IT-", ""), 10);
      const numB = parseInt(b.id.replace("IT-", ""), 10);
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

  const handleSort = (column) => {
    let direction = 'asc';
    if (currentSort.column === column && currentSort.direction === 'asc') {
      direction = 'desc';
    }
    setCurrentSort({ column, direction });
  };

  const getSortIcon = (column) => {
    if (currentSort.column !== column) return <i className="fa-solid fa-sort"></i>;
    return currentSort.direction === 'asc' 
      ? <i className="fa-solid fa-sort-up"></i>
      : <i className="fa-solid fa-sort-down"></i>;
  };

  // KPIs
  const totalCount = tickets.length;
  const activeCount = tickets.filter(t => t.status !== "Done").length;
  const blockedCount = tickets.filter(t => t.status === "Blocked").length;
  const resolvedCount = tickets.filter(t => t.status === "Done").length;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <i className="fa-solid fa-square-poll-vertical brand-icon"></i>
          <span className="brand-name">Sprintly</span>
        </div>
        
        <button className="btn btn-primary btn-new-ticket" onClick={() => openModal()}>
          <i className="fa-solid fa-plus"></i> New Ticket
        </button>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <i className="fa-solid fa-chart-pie"></i> Dashboard
          </button>
          <button 
            className={`nav-item ${activeTab === 'board' ? 'active' : ''}`}
            onClick={() => setActiveTab('board')}
          >
            <i className="fa-solid fa-table-columns"></i> Kanban Board
          </button>
          <button 
            className={`nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
            onClick={() => setActiveTab('tickets')}
          >
            <i className="fa-solid fa-list-check"></i> Tickets Log
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="theme-toggle">
            <i className="fa-solid fa-server"></i>
            <span>SQLite Connected (React)</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        <header className="app-header">
          <div className="header-left">
            <h1>{activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'board' ? 'Kanban Board' : 'Tickets Log'}</h1>
            <p className="text-secondary">
              {activeTab === 'dashboard' && 'Real-time metrics and issue logs'}
              {activeTab === 'board' && 'Drag & drop workflow management'}
              {activeTab === 'tickets' && 'All tickets with advanced filters'}
            </p>
          </div>
          <div className="header-right">
            <div className="search-bar">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input 
                type="text" 
                placeholder="Search tickets..." 
                value={searchVal}
                onChange={(e) => {
                  setSearchVal(e.target.value);
                  if (activeTab !== 'tickets') {
                    setActiveTab('tickets');
                  }
                }}
              />
            </div>
            <div className="user-profile">
              <img src="https://api.dicebear.com/7.x/bottts/svg?seed=SprintlyAdmin" alt="Avatar" className="avatar" />
              <div className="user-info">
                <span className="username">Admin</span>
                <span className="role">IT Operations</span>
              </div>
            </div>
          </div>
        </header>

        <div className="view-container">
          
          {/* DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <section className="view-section active">
              <div className="kpi-grid">
                <div className="kpi-card" onClick={() => setActiveTab('tickets')}>
                  <div className="kpi-icon total"><i className="fa-solid fa-ticket"></i></div>
                  <div className="kpi-info">
                    <span className="kpi-label">Total Tickets</span>
                    <h2 className="kpi-value">{totalCount}</h2>
                  </div>
                </div>
                <div className="kpi-card" onClick={() => { setActiveTab('tickets'); setFilterStat('In Progress'); }}>
                  <div className="kpi-icon active-bugs"><i className="fa-solid fa-bug"></i></div>
                  <div className="kpi-info">
                    <span className="kpi-label">Open Active</span>
                    <h2 className="kpi-value">{activeCount}</h2>
                  </div>
                </div>
                <div className="kpi-card" onClick={() => { setActiveTab('tickets'); setFilterStat('Blocked'); }}>
                  <div className="kpi-icon blocked"><i className="fa-solid fa-ban"></i></div>
                  <div className="kpi-info">
                    <span className="kpi-label">Blocked Issues</span>
                    <h2 className="kpi-value">{blockedCount}</h2>
                  </div>
                </div>
                <div className="kpi-card" onClick={() => { setActiveTab('tickets'); setFilterStat('Done'); }}>
                  <div className="kpi-icon resolved"><i className="fa-solid fa-circle-check"></i></div>
                  <div className="kpi-info">
                    <span className="kpi-label">Completed</span>
                    <h2 className="kpi-value">{resolvedCount}</h2>
                  </div>
                </div>
              </div>

              <div className="dashboard-charts">
                <div className="chart-container card">
                  <h3>Status Distribution</h3>
                  <div style={{ height: '200px', position: 'relative' }}>
                    <canvas ref={statusCanvasRef}></canvas>
                  </div>
                </div>
                <div className="chart-container card">
                  <h3>Priority Breakdown</h3>
                  <div style={{ height: '200px', position: 'relative' }}>
                    <canvas ref={priorityCanvasRef}></canvas>
                  </div>
                </div>
              </div>

              <div className="recent-activity card">
                <div className="card-header">
                  <h3>Recent Technical Incidents</h3>
                  <button className="view-all-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setActiveTab('tickets')}>View All</button>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ticket ID</th>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Reporter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...tickets]
                        .sort((a, b) => new Date(b.date_created) - new Date(a.date_created))
                        .slice(0, 5)
                        .map(t => (
                          <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => openModal(t.id)}>
                            <td><strong style={{ color: 'var(--accent-primary)' }}>{t.id}</strong></td>
                            <td>{t.title}</td>
                            <td><span className="card-tag">{t.category}</span></td>
                            <td><span className={`badge badge-priority-${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                            <td><span className={`badge badge-status-${t.status.replace(/\s+/g, '').toLowerCase()}`}>{t.status}</span></td>
                            <td>
                              <div><strong>{t.reporter}</strong></div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>IP: {t.ip_address || 'N/A'}</div>
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* KANBAN BOARD VIEW */}
          {activeTab === 'board' && (
            <section className="view-section active">
              <div className="kanban-board">
                {CONFIG.statuses.map(status => (
                  <div 
                    className="kanban-column" 
                    key={status}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, status)}
                  >
                    <div className="column-header">
                      <h3>{status} {status === 'Blocked' && '🛑'} {status === 'Done' && '✅'}</h3>
                      <span className="count-badge">
                        {tickets.filter(t => t.status === status).length}
                      </span>
                    </div>
                    <div className="kanban-cards">
                      {tickets
                        .filter(t => t.status === status)
                        .map(t => (
                          <div 
                            className="kanban-card" 
                            key={t.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                            onClick={() => openModal(t.id)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <span className="card-tag">{t.category}</span>
                              <span className={`badge badge-priority-${t.priority.toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>{t.priority}</span>
                            </div>
                            <h4 className="card-title">{t.title}</h4>
                            <div className="card-meta">
                              <strong style={{ color: 'var(--accent-primary)' }}>{t.id}</strong>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.reporter.split(" ")[0]}</div>
                                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{t.assignee !== 'Unassigned' ? `@${t.assignee.split(" ")[0]}` : 'Unassigned'}</div>
                              </div>
                            </div>
                          </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TICKETS LOG VIEW */}
          {activeTab === 'tickets' && (
            <section className="view-section active">
              <div className="filters-panel card">
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Category</label>
                    <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
                      <option value="All">All Categories</option>
                      {CONFIG.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Priority</label>
                    <select value={filterPrio} onChange={(e) => setFilterPrio(e.target.value)}>
                      <option value="All">All Priorities</option>
                      {CONFIG.priorities.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Status</label>
                    <select value={filterStat} onChange={(e) => setFilterStat(e.target.value)}>
                      <option value="All">All Statuses</option>
                      {CONFIG.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Assignee</label>
                    <select value={filterAss} onChange={(e) => setFilterAss(e.target.value)}>
                      <option value="All">All Assignees</option>
                      {CONFIG.team.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="tickets-table-container card">
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('id')}>Ticket ID {getSortIcon('id')}</th>
                        <th onClick={() => handleSort('title')}>Title {getSortIcon('title')}</th>
                        <th onClick={() => handleSort('category')}>Category {getSortIcon('category')}</th>
                        <th onClick={() => handleSort('priority')}>Priority {getSortIcon('priority')}</th>
                        <th onClick={() => handleSort('status')}>Status {getSortIcon('status')}</th>
                        <th onClick={() => handleSort('assignee')}>Assignee {getSortIcon('assignee')}</th>
                        <th onClick={() => handleSort('reporter')}>Reporter & IP {getSortIcon('reporter')}</th>
                        <th onClick={() => handleSort('created')}>Created {getSortIcon('created')}</th>
                        <th onClick={() => handleSort('resolution')}>Res. Time (Days) {getSortIcon('resolution')}</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTickets.map(t => {
                        const resTime = getResolutionTime(t);
                        return (
                          <tr key={t.id}>
                            <td><strong style={{ color: 'var(--accent-primary)' }}>{t.id}</strong></td>
                            <td style={{ fontWeight: 500 }}>{t.title}</td>
                            <td><span className="card-tag">{t.category}</span></td>
                            <td><span className={`badge badge-priority-${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                            <td><span className={`badge badge-status-${t.status.replace(/\s+/g, '').toLowerCase()}`}>{t.status}</span></td>
                            <td>
                              <div className="card-assignee">
                                <img className="card-assignee-avatar" src={`https://api.dicebear.com/7.x/initials/svg?seed=${t.assignee}`} alt="Avatar" />
                                <span>{t.assignee}</span>
                              </div>
                            </td>
                            <td>
                              <div><strong>{t.reporter}</strong></div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>IP: {t.ip_address || 'N/A'}</div>
                            </td>
                            <td>{t.date_created}</td>
                            <td style={{ fontWeight: 600 }}>{resTime} {resTime === 1 ? 'day' : 'days'}</td>
                            <td>
                              <button className="action-btn" onClick={() => openModal(t.id)} title="Edit Ticket">
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>
                              <button className="action-btn" onClick={() => setDeleteTicketId(t.id)} style={{ color: 'var(--danger)' }} title="Delete Ticket">
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

        </div>
      </main>

      {/* Modal Dialog Form */}
      {isModalOpen && (
        <div className="modal-overlay active">
          <div className="modal-content card">
            <div className="modal-header">
              <h2>{editTicketId ? `Triage Ticket ${editTicketId}` : 'Report Bug / Suggestion'}</h2>
              <button className="close-modal" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label>Issue Title <span className="required">*</span></label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g., VPN connection dropping frequently" 
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="form-group">
                <label>Description <span className="required">*</span></label>
                <textarea 
                  rows="4" 
                  required 
                  placeholder="Describe the bug, issue, or feature request details..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} disabled={isSaving}>
                    {CONFIG.categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select value={formPriority} onChange={(e) => setFormPriority(e.target.value)} disabled={isSaving}>
                    {CONFIG.priorities.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} disabled={isSaving}>
                    {CONFIG.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {/* ONLY SHOW ASSIGNEE TO ADMIN ON EDIT */}
                {editTicketId && (
                  <div className="form-group">
                    <label>Assignee</label>
                    <select value={formAssignee} onChange={(e) => setFormAssignee(e.target.value)} disabled={isSaving}>
                      {CONFIG.team.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Your Name (Reporter) <span className="required">*</span></label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g., John Smith"
                    value={formReporter}
                    onChange={(e) => setFormReporter(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                {editTicketId && (
                  <div className="form-group">
                    <label>Date Created</label>
                    <input type="date" value={formCreated} readOnly />
                  </div>
                )}
              </div>

              {/* IP ADDRESS AUDIT DETAIL (ADMIN VIEW) */}
              {editTicketId && formIpAddress && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Reporter IP Address (Audit Trail)</label>
                    <input 
                      type="text" 
                      value={formIpAddress} 
                      readOnly 
                      style={{ color: 'var(--text-secondary)', backgroundColor: 'rgba(255,255,255,0.01)' }} 
                    />
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={isSaving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Submitting...' : (editTicketId ? 'Save Changes' : 'Submit Ticket')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteTicketId && (
        <div className="modal-overlay active">
          <div className="modal-content card" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header" style={{ justifyContent: 'center', borderBottom: 'none', marginBottom: '8px' }}>
              <h2>Confirm Deletion</h2>
            </div>
            <p style={{ margin: '12px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Are you sure you want to delete ticket <strong>{deleteTicketId}</strong>? This action cannot be undone.
            </p>
            <div className="modal-footer" style={{ justifyContent: 'center', marginTop: '16px', borderTop: 'none', paddingTop: '0' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTicketId(null)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                style={{ backgroundColor: 'var(--danger)' }} 
                onClick={confirmDeleteTicket}
              >
                Delete Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
