import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

const API_URL =
  (import.meta.env.VITE_API_BASE || 'http://localhost:4000') + '/api';


  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchCalls();
  }, []);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/calls`);
      setCalls(response.data.calls || []);

      setLoading(false);
    } catch (err) {
      setError('Failed to fetch calls data. Make sure backend server is running on port 4000.');
      console.error('Error fetching calls:', err);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <div className="loading">Loading Calls...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Top Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-brand">
            <h2>📞 BolnaCall</h2>
          </div>
          <div className="navbar-center">
            <span className="nav-title">Calls Management System</span>
          </div>
          <div className="navbar-user">
            <div className="user-info">
              <div className="user-avatar">
                <span>{user?.email?.[0]?.toUpperCase() || 'U'}</span>
              </div>
              <div className="user-details">
                <p className="user-name">{user?.email || 'User'}</p>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              🚪
            </button>
          </div>
        </div>
      </nav>

  
      <div className="dashboard-main">
    
        <main className="content">
         
          <div className="page-header">
            <div className="header-left">
              <h1>Dashboard</h1>
              <p className="header-subtitle">Welcome to your calls management system</p>
            </div>
            <button onClick={fetchCalls} className="btn-primary">
              🔄 Refresh Data
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-box">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
              <button onClick={fetchCalls} className="btn-small">Retry</button>
            </div>
          )}

          {/* Stats Section */}
          <section className="stats-section">
            <h2 className="section-title">Quick Stats</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <div className="stat-icon">📊</div>
                  <span className="stat-label">Total Calls</span>
                </div>
                <div className="stat-value">{calls.length}</div>
                <div className="stat-footer">All time records</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <div className="stat-icon">✅</div>
                  <span className="stat-label">Status</span>
                </div>
                <div className="stat-value" style={{ color: '#10b981' }}>Active</div>
                <div className="stat-footer">System operational</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <div className="stat-icon">📱</div>
                  <span className="stat-label">With Contact</span>
                </div>
                <div className="stat-value">{calls.filter(c => c.Phone && c.Phone !== 'N/A').length}</div>
                <div className="stat-footer">Phone numbers</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <div className="stat-icon">📧</div>
                  <span className="stat-label">With Email</span>
                </div>
                <div className="stat-value">{calls.filter(c => c.Email && c.Email !== 'N/A').length}</div>
                <div className="stat-footer">Email addresses</div>
              </div>
            </div>
          </section>

          {/* Calls Table Section */}
          <section className="table-section">
            <div className="section-header">
              <h2 className="section-title">Recent Calls</h2>
              <span className="record-count">{calls.length} records</span>
            </div>

            {calls.length > 0 ? (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Best Time to Call</th>
                      <th>WhatsApp Status</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
<tbody>
  {calls.map((call, index) => (
    <tr key={call._id || index}>
      <td className="index-cell">{index + 1}</td>

      <td className="name-cell">
        <strong>{call.name || 'N/A'}</strong>
      </td>

      <td>
        {call.phone_number && call.phone_number !== 'N/A' ? (
          <a href={`tel:${call.phone_number}`} className="action-link phone-link">
            {call.phone_number}
          </a>
        ) : (
          <span className="na-text">—</span>
        )}
      </td>

      <td>
        {call.email && call.email !== 'N/A' ? (
          <a href={`mailto:${call.email}`} className="action-link email-link">
            {call.email}
          </a>
        ) : (
          <span className="na-text">—</span>
        )}
      </td>

      <td>
        {call.best_time_to_call && call.best_time_to_call !== 'N/A' ? (
          <span className="badge">{call.best_time_to_call}</span>
        ) : (
          <span className="na-text">—</span>
        )}
      </td>

      <td>
        {call.whatsapp_status === 'sent' ? (
          <span className="status-badge status-sent">✅ Sent</span>
        ) : call.whatsapp_status === 'failed' ? (
          <span className="status-badge status-failed">❌ Failed</span>
        ) : call.whatsapp_status === 'pending' ? (
          <span className="status-badge status-pending">⏳ Pending</span>
        ) : (
          <span className="status-badge status-unsent">⭕ Not Sent</span>
        )}
      </td>

      <td>
        {call.summary && call.summary !== 'N/A' ? (
          <div className="summary-text">
            {call.summary.length > 50
              ? `${call.summary.substring(0, 50)}...`
              : call.summary}
          </div>
        ) : (
          <span className="na-text">—</span>
        )}
      </td>
    </tr>
  ))}
</tbody>

                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>No calls found</p>
                <button onClick={fetchCalls} className="btn-secondary">Try Again</button>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;