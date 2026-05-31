import { useState, useEffect } from 'react';
import { QrCode, ShieldCheck, AlertTriangle, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalDevices: 0,
    totalInspections: 0,
    overdue: 0, // Mocked for now until we have scheduled dates
    activeInspectors: 0
  });
  const [recentInspections, setRecentInspections] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch total devices
      const { count: devicesCount } = await supabase
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // 2. Fetch total inspections
      const { count: inspectionsCount } = await supabase
        .from('inspections')
        .select('*', { count: 'exact', head: true });

      // 3. Fetch active inspectors
      const { count: inspectorsCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'ROLE_USER')
        .eq('is_enabled', true);

      // 4. Fetch recent inspections (Join with devices and users)
      const { data: recentInsps } = await supabase
        .from('inspections')
        .select(`
          id,
          status,
          created_at,
          devices ( serial_number, device_type ),
          users ( full_name )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalDevices: devicesCount || 0,
        totalInspections: inspectionsCount || 0,
        overdue: 0,
        activeInspectors: inspectorsCount || 0
      });

      if (recentInsps) {
        setRecentInspections(recentInsps);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

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
            <div className="stat-value">{stats.totalDevices}</div>
            <div className="stat-label">Total Active Devices</div>
          </div>
        </div>
        
        <div className="card stat-card">
          <div className="stat-icon" style={{ color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalInspections}</div>
            <div className="stat-label">Total Inspections</div>
          </div>
        </div>
        
        <div className="card stat-card">
          <div className="stat-icon" style={{ color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.overdue}</div>
            <div className="stat-label">Overdue for Inspection</div>
          </div>
        </div>
        
        <div className="card stat-card">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeInspectors}</div>
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
              {recentInspections.map((insp) => (
                <tr key={insp.id}>
                  <td style={{ fontWeight: 500 }}>{insp.devices?.serial_number || 'Unknown'}</td>
                  <td>{insp.devices?.device_type || 'Unknown'}</td>
                  <td>{insp.users?.full_name || 'Unknown'}</td>
                  <td>{new Date(insp.created_at).toLocaleString()}</td>
                  <td>
                    {insp.status === 'PASS' ? (
                      <span className="badge badge-success">Passed</span>
                    ) : (
                      <span className="badge badge-danger">Failed</span>
                    )}
                  </td>
                </tr>
              ))}
              {recentInspections.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No recent inspections found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
