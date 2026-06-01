import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { History, Search } from 'lucide-react';

export default function Inspections() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInspections = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: userData } = await supabase.from('users').select('role, zone_id').eq('id', session.user.id).single();
      const isZonalAdmin = userData?.role === 'ROLE_ADMIN' && userData.zone_id;

      let query = supabase.from('inspections').select(`
        id,
        remark,
        inspected_at,
        devices!inner ( serial_number, zone_id, device_types ( name ) ),
        users ( full_name )
      `).order('inspected_at', { ascending: false });

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

  const filteredInspections = inspections.filter(insp => {
    const searchLower = searchQuery.toLowerCase();
    const serial = insp.devices?.serial_number?.toLowerCase() || '';
    const inspector = insp.users?.full_name?.toLowerCase() || '';
    const remark = insp.remark?.toLowerCase() || '';
    return serial.includes(searchLower) || inspector.includes(searchLower) || remark.includes(searchLower);
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
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="search-container" style={{ flex: 1, maxWidth: '400px' }}>
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search by serial, inspector, or remark..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                  <th>Inspector</th>
                  <th>Date & Time</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map((insp) => (
                  <tr key={insp.id}>
                    <td style={{ fontWeight: 500 }}>{insp.devices?.serial_number}</td>
                    <td>
                      <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#374151' }}>
                        {insp.devices?.device_types?.name}
                      </span>
                    </td>
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
                  </tr>
                ))}
                {filteredInspections.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                      <History size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
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
