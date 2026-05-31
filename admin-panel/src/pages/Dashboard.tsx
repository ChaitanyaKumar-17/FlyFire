import { useState, useEffect } from 'react';
import { QrCode, ShieldCheck, AlertTriangle, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalDevices: 0,
    totalInspections: 0,
    activeInspectors: 0
  });
  const [recentInspections, setRecentInspections] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: userData } = await supabase.from('users').select('role, zone_id').eq('id', session.user.id).single();
      const isZonalAdmin = userData?.role === 'ROLE_ADMIN' && userData.zone_id;
      
      let devicesQuery = supabase.from('devices').select('*', { count: 'exact', head: true }).eq('is_active', true);
      let inspectionsQuery = supabase.from('inspections').select('*', { count: 'exact', head: true });
      let inspectorsQuery = supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'ROLE_USER').eq('is_enabled', true);
      let recentQuery = supabase.from('inspections').select(`
          id,
          status,
          created_at,
          devices!inner ( serial_number, zone_id, device_types ( name ) ),
          users ( full_name )
        `).order('created_at', { ascending: false }).limit(5);

      if (isZonalAdmin) {
        devicesQuery = devicesQuery.eq('zone_id', userData.zone_id);
        // inspections don't have zone_id directly, we filter via related device
        inspectionsQuery = supabase.from('inspections').select('*, devices!inner(zone_id)', { count: 'exact', head: true }).eq('devices.zone_id', userData.zone_id);
        inspectorsQuery = inspectorsQuery.eq('zone_id', userData.zone_id);
        recentQuery = recentQuery.eq('devices.zone_id', userData.zone_id);
      }

      const [{ count: devicesCount }, { count: inspectionsCount }, { count: inspectorsCount }, { data: recentInsps }] = await Promise.all([
        devicesQuery,
        inspectionsQuery,
        inspectorsQuery,
        recentQuery
      ]);

      setStats({
        totalDevices: devicesCount || 0,
        totalInspections: inspectionsCount || 0,
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
                  <td>{insp.devices?.device_types?.name || 'Unknown'}</td>
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
