import { useState, useEffect } from 'react';
import { QrCode, ShieldCheck, Users, Map, UserCog } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCachedData, setCachedData, clearCache } from '../lib/cache';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalDevices: 0,
    totalInspections: 0,
    activeInspectors: 0,
    totalAdmins: 0,
    totalZones: 0
  });
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedData<any>('dashboard');
      if (cached) {
        setStats(cached.stats);
        setRecentInspections(cached.recentInspections);
        setUserName(cached.userName);
        setUserRole(cached.userRole);
        setLoading(false);
        return;
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: userData } = await supabase.from('users').select('role, zone_id, full_name').eq('id', session.user.id).single();
      const isZonalAdmin = userData?.role === 'ROLE_ADMIN' && userData.zone_id;
      if (userData?.full_name) {
        setUserName(userData.full_name);
      }
      if (userData?.role) {
        setUserRole(userData.role);
      }
      
      let devicesQuery = supabase.from('devices').select('*', { count: 'exact', head: true }).eq('is_active', true);
      let inspectionsQuery = supabase.from('inspections').select('*', { count: 'exact', head: true });
      let inspectorsQuery = supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'ROLE_USER').eq('is_enabled', true);
      let adminsQuery = supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'ROLE_ADMIN').eq('is_enabled', true);
      let zonesQuery = supabase.from('zones').select('*', { count: 'exact', head: true });
      let recentQuery = supabase.from('inspections').select(`
          id,
          remark,
          inspected_at,
          devices!inner ( serial_number, zone_id, device_types ( name ) ),
          users ( full_name )
        `).order('inspected_at', { ascending: false }).limit(5);

      if (isZonalAdmin) {
        devicesQuery = devicesQuery.eq('zone_id', userData.zone_id);
        // inspections don't have zone_id directly, we filter via related device
        inspectionsQuery = supabase.from('inspections').select('*, devices!inner(zone_id)', { count: 'exact', head: true }).eq('devices.zone_id', userData.zone_id);
        inspectorsQuery = inspectorsQuery.eq('zone_id', userData.zone_id);
        recentQuery = recentQuery.eq('devices.zone_id', userData.zone_id);
      }

      const [{ count: devicesCount }, { count: inspectionsCount }, { count: inspectorsCount }, { count: adminsCount }, { count: zonesCount }, { data: recentInsps }] = await Promise.all([
        devicesQuery,
        inspectionsQuery,
        inspectorsQuery,
        adminsQuery,
        zonesQuery,
        recentQuery
      ]);

      setStats({
        totalDevices: devicesCount || 0,
        totalInspections: inspectionsCount || 0,
        activeInspectors: inspectorsCount || 0,
        totalAdmins: adminsCount || 0,
        totalZones: zonesCount || 0
      });

      if (recentInsps) {
        setRecentInspections(recentInsps);
      }

      setCachedData('dashboard', {
        stats: {
          totalDevices: devicesCount || 0,
          totalInspections: inspectionsCount || 0,
          activeInspectors: inspectorsCount || 0,
          totalAdmins: adminsCount || 0,
          totalZones: zonesCount || 0
        },
        recentInspections: recentInsps || [],
        userName: userData?.full_name || '',
        userRole: userData?.role || ''
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {userName || 'Admin'}</h1>
          <p className="page-description">Overview of system status and activity</p>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading dashboard data...
        </div>
      ) : (
        <>
          <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon">
            <QrCode size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalDevices}</div>
            <div className="stat-label">Total Active Equipment</div>
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

        {userRole === 'ROLE_SUPERADMIN' && (
          <>
            <div className="card stat-card">
              <div className="stat-icon" style={{ color: 'var(--primary)', backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <UserCog size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalAdmins}</div>
                <div className="stat-label">Total Zonal Admins</div>
              </div>
            </div>

            <div className="card stat-card">
              <div className="stat-icon" style={{ color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                <Map size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalZones}</div>
                <div className="stat-label">Total Zones</div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 600 }}>Recent Inspections</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipment Serial</th>
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
                  <td>{new Date(insp.inspected_at).toLocaleString()}</td>
                  <td>
                    <span className="badge badge-success">Completed</span>
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
        </>
      )}
    </div>
  );
}
