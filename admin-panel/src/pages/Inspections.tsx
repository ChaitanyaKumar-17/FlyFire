import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { History, Search, Trash2 } from 'lucide-react';

export default function Inspections() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userRole, setUserRole] = useState('');

  const fetchInspections = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: userData } = await supabase.from('users').select('role, zone_id').eq('id', session.user.id).single();
      if (userData) setUserRole(userData.role);
      const isZonalAdmin = userData?.role === 'ROLE_ADMIN' && userData.zone_id;

      let query = supabase.from('inspections').select(`
        id,
        remark,
        inspected_at,
        devices!inner ( serial_number, zone_id, device_types ( name ), zones ( name ) ),
        users ( full_name )
      `).order('inspected_at', { ascending: false });

      const { data: zonesData } = await supabase.from('zones').select('*').order('name');
      if (zonesData) setZones(zonesData);

      if (isZonalAdmin) {
        query = query.eq('devices.zone_id', userData.zone_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (data) {
        setInspections(data);
      }
    } catch (error) {
      console.error('Error fetching inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to permanently delete this inspection record?')) {
      try {
        const { error } = await supabase.from('inspections').delete().eq('id', id);
        if (error) throw error;
        fetchInspections(); // Refresh the list
      } catch (error: any) {
        alert('Error deleting inspection: ' + error.message);
      }
    }
  };

  const filteredInspections = inspections.filter(insp => {
    const searchLower = searchQuery.toLowerCase();
    const serial = insp.devices?.serial_number?.toLowerCase() || '';
    const inspector = insp.users?.full_name?.toLowerCase() || '';
    const remark = insp.remark?.toLowerCase() || '';
    
    const matchesSearch = serial.includes(searchLower) || inspector.includes(searchLower) || remark.includes(searchLower);
    const matchesZone = filterZone === 'all' || insp.devices?.zones?.name === filterZone;
    
    let matchesDate = true;
    if (startDate && endDate) {
      const inspDate = new Date(insp.inspected_at);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = inspDate >= start && inspDate <= end;
    }

    return matchesSearch && matchesZone && matchesDate;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inspection Audit Logs</h1>
          <p className="page-description">Complete history of all device safety checks</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
            <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              className="form-control" 
              style={{ paddingLeft: '3rem' }}
              placeholder="Search by serial, inspector, or remark..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="form-control" 
            style={{ width: 'auto', minWidth: '150px' }}
            value={filterZone} 
            onChange={(e) => setFilterZone(e.target.value)}
          >
            <option value="all">All Zones</option>
            {zones.map(z => (
              <option key={z.id} value={z.name}>{z.name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: 'auto' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span style={{ color: 'var(--text-secondary)' }}>to</span>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: 'auto' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading inspection history...
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device Serial</th>
                  <th>Type</th>
                  <th>Zone</th>
                  <th>Inspector</th>
                  <th>Date & Time</th>
                  <th>Remark</th>
                  {userRole === 'ROLE_SUPERADMIN' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map((insp) => (
                  <tr key={insp.id}>
                    <td style={{ fontWeight: 500 }}>{insp.devices?.serial_number}</td>
                    <td>
                      {insp.devices?.device_types?.name}
                    </td>
                    <td>{insp.devices?.zones?.name || 'Unassigned'}</td>
                    <td>{insp.users?.full_name}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{new Date(insp.inspected_at).toLocaleDateString()}</span>
                        <span style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                          {new Date(insp.inspected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                      <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={insp.remark}>
                        {insp.remark}
                      </p>
                    </td>
                    {userRole === 'ROLE_SUPERADMIN' && (
                      <td>
                        <button className="btn btn-ghost" title="Delete Inspection" onClick={() => handleDelete(insp.id)} style={{ color: 'var(--danger)' }}>
                          <Trash2 size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredInspections.length === 0 && (
                  <tr>
                    <td colSpan={userRole === 'ROLE_SUPERADMIN' ? 7 : 6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                      <History size={32} style={{ margin: '0 auto 1rem', opacity: 0.5, display: 'block' }} />
                      No inspection records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
