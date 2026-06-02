import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Calendar, MapPin, Tag, CheckCircle2, ClipboardList } from 'lucide-react-native';

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
        <View style={styles.serialContainer}>
          <CheckCircle2 size={20} color="#10B981" />
          <Text style={styles.serial}>{item.devices?.serial_number}</Text>
        </View>
        <View style={styles.dateContainer}>
          <Calendar size={14} color="#6B7280" style={{ marginRight: 4 }} />
          <Text style={styles.date}>
            {new Date(item.inspected_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Tag size={12} color="#4F46E5" style={{ marginRight: 4 }} />
          <Text style={styles.badgeText}>{item.devices?.device_types?.name}</Text>
        </View>
        <View style={styles.badge}>
          <MapPin size={12} color="#4F46E5" style={{ marginRight: 4 }} />
          <Text style={styles.badgeText}>{item.devices?.zones?.name}</Text>
        </View>
      </View>

      <View style={styles.remarkContainer}>
        <Text style={styles.remarkLabel}>Inspector Findings</Text>
        <Text style={styles.remark}>{item.remark}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerIconWrapper}>
            <ClipboardList size={26} color="#1E3A8A" />
          </View>
          <View>
            <Text style={styles.headerTitle}>
              {userRole === 'ROLE_SUPERADMIN' ? 'All Inspections' : userRole === 'ROLE_ADMIN' ? 'Zone Inspections' : 'My Inspections'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {loading ? 'Loading records...' : `${inspections.length} total records found`}
            </Text>
          </View>
        </View>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#1E3A8A',
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(0,0,0,0.15)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
    }),
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#93C5FD',
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: { boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.06)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 4 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  serialContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serial: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginLeft: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  date: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '600',
  },
  remarkContainer: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  remarkLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  remark: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 40,
    fontSize: 16,
    fontWeight: '500',
  },
});
