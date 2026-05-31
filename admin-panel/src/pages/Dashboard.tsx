import { QrCode, ShieldCheck, AlertTriangle, Users } from 'lucide-react';

export default function Dashboard() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Overview of system status and activity</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon">
            <QrCode size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">1,248</div>
            <div className="stat-label">Total Devices</div>
          </div>
        </div>
        
        <div className="card stat-card">
          <div className="stat-icon" style={{ color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">1,105</div>
            <div className="stat-label">Recently Inspected</div>
          </div>
        </div>
        
        <div className="card stat-card">
          <div className="stat-icon" style={{ color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">143</div>
            <div className="stat-label">Overdue for Inspection</div>
          </div>
        </div>
        
        <div className="card stat-card">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">42</div>
            <div className="stat-label">Active Inspectors</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 600 }}>Recent Inspections</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Device Serial</th>
                <th>Type</th>
                <th>Inspector</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>SN-{10000 + i * 23}</td>
                  <td>Fire Extinguisher</td>
                  <td>John Inspector</td>
                  <td>Today, 10:{i}4 AM</td>
                  <td>
                    <span className="badge badge-success">Passed</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
