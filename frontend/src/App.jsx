import React, { useState, useEffect, useRef } from 'react';

// DIRECT GOOGLE SHEETS API CONNECTION (Serverless for GitHub Pages)
const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbzh8355iN0doc75eY8TFafDOCXDczVO_fEZvhPXnpSzO-ojGp0DbP7zVl7sfBOkAZo5/exec';

const CONFIG = {
  priorities: ["Critical", "High", "Medium", "Low"],
  statuses: ["Backlog", "In Progress", "QA", "Blocked", "Done"],
  categories: ["Hardware", "Software/SaaS", "Infrastructure", "Authentication", "Security"],
  team: ["Alex Chen", "Sarah Jenkins", "Marcus Brody", "Unassigned"]
};

// Generate persistent unique Device Fingerprint ID (acting as MAC Address check)
let cachedDeviceId = localStorage.getItem('sprintly_device_id');
if (!cachedDeviceId) {
  cachedDeviceId = 'DEV-' + Math.random().toString(36).substring(2, 11).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
  localStorage.setItem('sprintly_device_id', cachedDeviceId);
}

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'board', 'tickets'
  const [searchVal, setSearchVal] = useState('');
  
  // Client Identity States
  const [clientIp, setClientIp] = useState('127.0.0.1');
  const [deviceId] = useState(cachedDeviceId);
  const [username, setUsername] = useState(localStorage.getItem('sprintly_username') || '');
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(!localStorage.getItem('sprintly_username'));
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isOnlineDropdownOpen, setIsOnlineDropdownOpen] = useState(false);

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
  const [formCategory, setFormCategory] = useState(CONFIG.categories[1]);
  const [formPriority, setFormPriority] = useState(CONFIG.priorities[3]);
  const [formStatus, setFormStatus] = useState(CONFIG.statuses[0]);
  const [formAssignee, setFormAssignee] = useState(CONFIG.team[3]);
  const [formReporter, setFormReporter] = useState('');
  const [formCreated, setFormCreated] = useState('');
  const [formIpAddress, setFormIpAddress] = useState('');
  const [formAttachment, setFormAttachment] = useState('');

  // Image Upload State
  const [formImage, setFormImage] = useState(null);
  const [formImageName, setFormImageName] = useState('');

  // Loading/Prevent Double Click State
  const [isSaving, setIsSaving] = useState(false);

  // Custom Delete Confirm State
  const [deleteTicketId, setDeleteTicketId] = useState(null);

  // Read-only View Ticket State
  const [viewTicket, setViewTicket] = useState(null);

  // Chart refs
  const statusChartRef = useRef(null);
  const priorityChartRef = useRef(null);
  const statusCanvasRef = useRef(null);
  const priorityCanvasRef = useRef(null);

  // Fetch client IP address on load
  const loadClientIp = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      if (data && data.ip) {
        setClientIp(data.ip);
      }
    } catch (e) {
      console.warn("Could not retrieve public IP, defaulting to local:", e);
    }
  };

  // Fetch tickets directly from Google Sheets
  const fetchTickets = async () => {
    try {
      const response = await fetch(SHEET_API_URL);
      if (!response.ok) throw new Error("Failed to fetch tickets from Sheets");
      const data = await response.json();
      setTickets(data);
    } catch (err) {
      console.error("Error fetching tickets:", err);
    }
  };

  useEffect(() => {
    loadClientIp();
    fetchTickets();
  }, []);

  // Heartbeat & Presence Sync
  const sendHeartbeat = async () => {
    const storedUsername = localStorage.getItem('sprintly_username');
    if (!storedUsername) return;
    try {
      await fetch(SHEET_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'heartbeat',
          username: storedUsername,
          device_id: deviceId
        })
      });
      
      const res = await fetch(`${SHEET_API_URL}?action=get_presence`);
      if (res.ok) {
        const users = await res.json();
        setOnlineUsers(users);
      }
    } catch (e) {
      console.warn("Presence syncing failed:", e);
    }
  };

  useEffect(() => {
    if (username) {
      sendHeartbeat();
      const interval = setInterval(sendHeartbeat, 30000);
      return () => clearInterval(interval);
    }
  }, [username]);

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

  // Determine if a ticket can be edited or deleted by the current user
  const canModifyTicket = (t) => {
    if (!t || t.isOptimistic) return false;
    
    // 1. IP & MAC (Device ID) Verification
    const matchesIp = String(t.ip_address) === String(clientIp);
    const matchesMac = String(t.mac_address) === String(deviceId);
    
    if (!matchesIp || !matchesMac) return false;

    // 2. 10-Minute Time Window check
    try {
      const createdDate = new Date(t.date_created);
      const diffMs = new Date() - createdDate;
      const diffMins = diffMs / (1000 * 60);
      return diffMins <= 10;
    } catch (e) {
      return false;
    }
  };

  const getResolutionTime = (ticket) => {
    let created = new Date(ticket.date_created || ticket.date_updated || new Date());
    if (isNaN(created.getTime())) {
      created = new Date(ticket.date_updated || new Date());
    }
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
        setFormAttachment(t.attachment || '');
      }
    } else {
      setEditTicketId(null);
      setFormTitle('');
      setFormDescription('');
      setFormCategory(CONFIG.categories[1]);
      setFormPriority(CONFIG.priorities[3]);
      setFormStatus(CONFIG.statuses[0]);
      setFormAssignee(CONFIG.team[3]); // Default to Unassigned
      setFormReporter(username || '');
      setFormCreated(new Date().toISOString().split('T')[0]);
      setFormIpAddress('');
      setFormAttachment('');
    }
    setFormImage(null);
    setFormImageName('');
    setIsSaving(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Handle selected screenshot/image file
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormImage(reader.result); // Base64 data URI
        setFormImageName(file.name);
      };
      reader.readAsDataURL(file);
    } else {
      setFormImage(null);
      setFormImageName('');
    }
  };

  // Form Submit (direct to Apps Script using text/plain to avoid preflight CORS blocks)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    const todayISO = new Date().toISOString();

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      category: formCategory,
      priority: formPriority,
      status: formStatus,
      assignee: formAssignee,
      reporter: formReporter.trim(),
      ip_address: editTicketId ? formIpAddress : clientIp,
      mac_address: deviceId,
      image_data: formImage || '',
      image_name: formImageName || '',
      attachment: formAttachment || ''
    };

    const originalTickets = [...tickets];

    if (editTicketId) {
      // 1. OPTIMISTIC UPDATE (EDIT)
      const updatedTicket = {
        id: editTicketId,
        ...payload,
        is_edited: "true",
        date_created: formCreated || todayISO,
        date_updated: todayISO
      };

      setTickets(tickets.map(t => t.id === editTicketId ? updatedTicket : t));
      closeModal();

      try {
        const response = await fetch(SHEET_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'update',
            ticket: {
              ...updatedTicket,
              is_edited: "true",
              date_updated: todayISO.split('T')[0] // Format for sheet cell log
            }
          })
        });
        if (!response.ok) throw new Error("Failed to save changes");
        await fetchTickets(); // Sync final list
      } catch (err) {
        alert(err.message);
        setTickets(originalTickets); // Rollback
      } finally {
        setIsSaving(false);
      }
    } else {
      // 2. OPTIMISTIC CREATE
      let lastNum = 0;
      tickets.forEach(ticket => {
        if (ticket.id && ticket.id.startsWith("IT-")) {
          const num = parseInt(ticket.id.replace("IT-", ""), 10);
          if (num > lastNum) lastNum = num;
        }
      });
      const tempId = `IT-${String(lastNum + 1).padStart(3, '0')}`;
      
      let finalDateCreated = todayISO;
      if (formCreated) {
        try {
          const selected = new Date(formCreated);
          const now = new Date();
          selected.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
          finalDateCreated = selected.toISOString();
        } catch (e) {
          finalDateCreated = todayISO;
        }
      }

      const tempTicket = {
        id: tempId,
        ...payload,
        is_edited: "",
        date_created: finalDateCreated,
        date_updated: todayISO,
        isOptimistic: true
      };

      setTickets([...tickets, tempTicket]);
      closeModal();

      try {
        const response = await fetch(SHEET_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'create',
            ticket: {
              ...tempTicket,
              date_created: finalDateCreated,
              date_updated: todayISO
            }
          })
        });
        if (!response.ok) throw new Error("Failed to create ticket");
        const result = await response.json();
        
        const finalTicket = {
          ...tempTicket,
          id: result.ticket.id || tempId,
          attachment: result.attachment || ""
        };
        delete finalTicket.isOptimistic;

        // Swap out the temporary ticket for the actual one from server
        setTickets(prev => prev.map(t => t.id === tempId ? finalTicket : t));
      } catch (err) {
        alert(err.message);
        setTickets(originalTickets); // Rollback
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Confirm and Execute Delete Ticket
  const confirmDeleteTicket = async () => {
    if (!deleteTicketId) return;
    
    const targetId = deleteTicketId;
    const originalTickets = [...tickets];

    setTickets(tickets.filter(t => t.id !== targetId));
    setDeleteTicketId(null);

    try {
      const response = await fetch(SHEET_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'delete',
          id: targetId
        })
      });
      if (!response.ok) throw new Error("Delete failed");
      await fetchTickets();
    } catch (err) {
      console.error(err);
      alert("Failed to delete ticket: " + err.message);
      setTickets(originalTickets);
    }
  };

  // Drag & Drop (Disabled for other users' tickets)
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const ticket = tickets.find(t => t.id === id);
    if (ticket && ticket.status !== targetStatus) {
      const oldStatus = ticket.status;
      setTickets(tickets.map(t => t.id === id ? { ...t, status: targetStatus, is_edited: "true" } : t));

      try {
        const response = await fetch(SHEET_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'update',
            ticket: {
              ...ticket,
              status: targetStatus,
              is_edited: "true",
              date_updated: new Date().toISOString().split('T')[0]
            }
          })
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
    return matchesSearch && matchesCat && matchesPrio && matchesStat;
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
            <span>Google Sheets (Serverless)</span>
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
            {/* Online Presence Dropdown Indicator */}
            <div className="online-presence-container" style={{ position: 'relative', marginRight: '16px' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={() => setIsOnlineDropdownOpen(!isOnlineDropdownOpen)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '6px 12px', 
                  fontSize: '12px', 
                  height: '38px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>
                <span>Active ({onlineUsers.length || 1})</span>
                <i className="fa-solid fa-chevron-down" style={{ fontSize: '9px', opacity: 0.7 }}></i>
              </button>
              {isOnlineDropdownOpen && (
                <div className="dropdown-menu card" style={{ 
                  position: 'absolute', 
                  right: 0, 
                  top: '44px', 
                  width: '200px', 
                  zIndex: 100, 
                  padding: '12px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Online Users</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${username}`} alt="avatar" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                      <span style={{ fontWeight: 'bold' }}>{username || 'You'} (You)</span>
                    </li>
                    {onlineUsers.filter(u => u.device_id !== deviceId).map(u => (
                      <li key={u.device_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`} alt="avatar" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                        <span>{u.username}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="user-profile">
              <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${deviceId}`} alt="Avatar" className="avatar" />
              <div className="user-info">
                <span className="username" style={{ fontSize: '11px' }}>{username || 'Your Machine'}</span>
                <span className="role">{clientIp.substring(0, 15)}</span>
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
                          <tr key={t.id} style={{ cursor: 'pointer', opacity: t.isOptimistic ? 0.6 : 1 }} onClick={() => openModal(t.id)}>
                            <td>
                              <strong style={{ color: 'var(--accent-primary)' }}>{t.id}</strong>
                              {t.is_edited === "true" && <span className="edited-indicator" style={{ marginLeft: '4px', fontSize: '9px', color: 'var(--accent-primary)', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>Edited</span>}
                            </td>
                            <td>{t.title} {t.isOptimistic && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(Saving...)</span>}</td>
                            <td><span className="card-tag">{t.category}</span></td>
                            <td><span className={`badge badge-priority-${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                            <td><span className={`badge badge-status-${t.status.replace(/\s+/g, '').toLowerCase()}`}>{t.status}</span></td>
                            <td>
                              <div><strong>{t.reporter}</strong></div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>IP: {t.ip_address || 'N/A'}</div>
                              {t.attachment && (
                                <div style={{ marginTop: '4px' }} onClick={(e) => e.stopPropagation()}>
                                  <a href={t.attachment} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="fa-solid fa-image"></i> Attachment
                                  </a>
                                </div>
                              )}
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
                            draggable={!t.isOptimistic}
                            onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                            onClick={() => setViewTicket(t)}
                            style={{ opacity: t.isOptimistic ? 0.6 : 1, cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <span className="card-tag">{t.category}</span>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {t.is_edited === "true" && <span style={{ fontSize: '8px', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '3px', padding: '1px 3px' }}>Edited</span>}
                                <span className={`badge badge-priority-${t.priority.toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>{t.priority}</span>
                              </div>
                            </div>
                            <h4 className="card-title">{t.title} {t.isOptimistic && <span style={{ fontSize: '9px', fontStyle: 'italic' }}>(Saving...)</span>}</h4>
                            
                            {t.attachment && (
                              <div style={{ margin: '4px 0' }} onClick={(e) => e.stopPropagation()}>
                                <a href={t.attachment} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--accent-primary)' }}>
                                  <i className="fa-solid fa-paperclip"></i> View Screenshot
                                </a>
                              </div>
                            )}

                            <div className="card-meta">
                              <strong style={{ color: 'var(--accent-primary)' }}>{t.id}</strong>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.reporter.split(" ")[0]}</div>
                                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                  {!canModifyTicket(t) && <i className="fa-solid fa-lock" style={{ marginRight: '4px', fontSize: '8px' }}></i>}
                                </div>
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
                        <th onClick={() => handleSort('reporter')}>Reporter & IP {getSortIcon('reporter')}</th>
                        <th onClick={() => handleSort('created')}>Created {getSortIcon('created')}</th>
                        <th onClick={() => handleSort('resolution')}>Res. Time (Days) {getSortIcon('resolution')}</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTickets.map(t => {
                        const resTime = getResolutionTime(t);
                        const modifyAllowed = canModifyTicket(t);
                        return (
                          <tr key={t.id} style={{ opacity: t.isOptimistic ? 0.6 : 1 }}>
                            <td>
                              <strong style={{ color: 'var(--accent-primary)' }}>{t.id}</strong>
                              {t.is_edited === "true" && <span style={{ marginLeft: '4px', fontSize: '9px', color: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', padding: '1px 4px', borderRadius: '3px' }}>Edited</span>}
                            </td>
                            <td style={{ fontWeight: 500 }}>
                              {t.title} {t.isOptimistic && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Saving...)</span>}
                            </td>
                            <td><span className="card-tag">{t.category}</span></td>
                            <td><span className={`badge badge-priority-${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                            <td><span className={`badge badge-status-${t.status.replace(/\s+/g, '').toLowerCase()}`}>{t.status}</span></td>
                            <td>
                              <div><strong>{t.reporter}</strong></div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>IP: {t.ip_address || 'N/A'}</div>
                              {t.attachment && (
                                <div style={{ marginTop: '4px' }}>
                                  <a href={t.attachment} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="fa-solid fa-image"></i> Attachment
                                  </a>
                                </div>
                              )}
                            </td>
                            <td>{t.date_created ? t.date_created.split('T')[0] : (t.date_updated ? t.date_updated.split('T')[0] : 'N/A')}</td>
                            <td style={{ fontWeight: 600 }}>{resTime} {resTime === 1 ? 'day' : 'days'}</td>
                            <td>
                              {modifyAllowed ? (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button className="action-btn" onClick={() => openModal(t.id)} title="Edit Ticket">
                                    <i className="fa-solid fa-pen-to-square"></i>
                                  </button>
                                  <button className="action-btn" onClick={() => setDeleteTicketId(t.id)} style={{ color: 'var(--danger)' }} title="Delete Ticket">
                                    <i className="fa-solid fa-trash"></i>
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                                  <i className="fa-solid fa-lock" style={{ fontSize: '11px' }}></i>
                                  <span style={{ fontSize: '9px' }}>ReadOnly</span>
                                </div>
                              )}
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
                <div className="form-group">
                  <label>Date Created</label>
                  <input 
                    type="date" 
                    value={formCreated ? formCreated.split('T')[0] : ''} 
                    onChange={(e) => setFormCreated(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* OPTIONAL ATTACHMENT UPLOAD FIELD (CREATION ONLY) */}
              {!editTicketId && (
                <div className="form-group">
                  <label>Screenshot Attachment (Optional)</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    disabled={isSaving}
                    style={{ border: '1px dashed #2e3c54', padding: '8px', borderRadius: '4px', width: '100%', cursor: 'pointer' }}
                  />
                </div>
              )}

              {/* READ-ONLY ATTACHMENT LINK FOR ADMINISTRATIVE VIEW */}
              {editTicketId && formAttachment && (
                <div className="form-group">
                  <label>Attachment Screenshot</label>
                  <div style={{ marginTop: '6px' }}>
                    <a 
                      href={formAttachment} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 500 }}
                    >
                      <i className="fa-solid fa-up-right-from-square"></i> Open Google Drive Screenshot
                    </a>
                  </div>
                </div>
              )}

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

      {/* READ-ONLY TICKET DETAILS MODAL */}
      {viewTicket && (
        <div className="modal-overlay active">
          <div className="modal-content card" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h2>Ticket Details ({viewTicket.id})</h2>
              <button className="close-modal" onClick={() => setViewTicket(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0', textAlign: 'left' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Title</label>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>{viewTicket.title}</h3>
              </div>
              
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Description</label>
                <p style={{ margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '13px' }}>{viewTicket.description}</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Category</label>
                  <span className="card-tag" style={{ display: 'inline-block' }}>{viewTicket.category}</span>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Priority</label>
                  <span className={`badge badge-priority-${viewTicket.priority.toLowerCase()}`} style={{ display: 'inline-block' }}>{viewTicket.priority}</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Status</label>
                <span className={`badge badge-status-${viewTicket.status.replace(/\s+/g, '').toLowerCase()}`} style={{ display: 'inline-block' }}>{viewTicket.status}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Reporter</label>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{viewTicket.reporter}</span>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Created Date</label>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{viewTicket.date_created ? viewTicket.date_created.split('T')[0] : (viewTicket.date_updated ? viewTicket.date_updated.split('T')[0] : 'N/A')}</span>
                </div>
              </div>

              {viewTicket.attachment && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Attachment Screenshot</label>
                  <div style={{ marginTop: '6px' }}>
                    <a 
                      href={viewTicket.attachment} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 500 }}
                    >
                      <i className="fa-solid fa-up-right-from-square"></i> Open Google Drive Screenshot
                    </a>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #2e3c54', paddingTop: '16px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setViewTicket(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ONCE-ONLY USERNAME PROMPT MODAL */}
      {isUsernameModalOpen && (
        <div className="modal-overlay active" style={{ zIndex: 1000 }}>
          <div className="modal-content card" style={{ maxWidth: '400px', textAlign: 'center', padding: '24px' }}>
            <div className="modal-header" style={{ justifyContent: 'center', borderBottom: 'none', marginBottom: '8px' }}>
              <h2>Choose Your Username</h2>
            </div>
            <p style={{ margin: '12px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Welcome to Sprintly! Please enter your name to identify your session. This can only be set once.
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const inputName = e.target.usernameInput.value.trim();
              if (inputName) {
                localStorage.setItem('sprintly_username', inputName);
                setUsername(inputName);
                setIsUsernameModalOpen(false);
              }
            }}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <input 
                  type="text" 
                  name="usernameInput" 
                  required 
                  placeholder="e.g., Jane Doe" 
                  style={{ textAlign: 'center', fontSize: '16px', padding: '10px' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Get Started
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
