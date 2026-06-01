import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react-native';

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: userData } = await supabase.from('users').select('role, zone_id').eq('id', session.user.id).single();
    if (userData) setUserRole(userData.role);

    let query = supabase
      .from('inspections')
      .select(`
        id,
        remark,
        inspected_at,
        devices!inner(serial_number, zone_id, device_types(name), zones(name))
      `)
      .order('inspected_at', { ascending: false });

    if (userData?.role === 'ROLE_SUPERADMIN') {
      // no filter, fetch all
    } else if (userData?.role === 'ROLE_ADMIN' && userData?.zone_id) {
      query = query.eq('devices.zone_id', userData.zone_id);
    } else {
      query = query.eq('inspector_id', session.user.id);
    }

    const { data } = await query;

    if (data) {
      setInspections(data);
    }
    setLoading(false);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.serial}>{item.devices?.serial_number}</Text>
        <Text style={styles.date}>
          {new Date(item.inspected_at).toLocaleDateString()} {new Date(item.inspected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <View style={styles.badgeRow}>
        <Text style={styles.badge}>{item.devices?.device_types?.name}</Text>
        <Text style={styles.badge}>{item.devices?.zones?.name}</Text>
      </View>
      <Text style={styles.remark}>{item.remark}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {userRole === 'ROLE_SUPERADMIN' ? 'All Inspections' : userRole === 'ROLE_ADMIN' ? 'Zone Inspections' : 'My Inspections'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={inspections}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {userRole === 'ROLE_USER' ? "You haven't performed any inspections yet." : "No inspection records found."}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  date: {
    fontSize: 12,
    color: '#6B7280',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '500',
    overflow: 'hidden',
  },
  remark: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 40,
    fontStyle: 'italic',
  },
});
