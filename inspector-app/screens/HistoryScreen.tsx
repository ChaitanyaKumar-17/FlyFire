import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, ActivityIndicator, Modal, TextInput, ScrollView, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getCachedData, setCachedData } from '../lib/cache';
import { ArrowLeft, Calendar, MapPin, Tag, CheckCircle2, ClipboardList, ChevronDown, FilterX, User } from 'lucide-react-native';

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  
  const [selectedDeviceType, setSelectedDeviceType] = useState<string | null>(null);
  const [selectedInspector, setSelectedInspector] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [showDeviceFilter, setShowDeviceFilter] = useState(false);
  const [showInspectorFilter, setShowInspectorFilter] = useState(false);
  const [showZoneFilter, setShowZoneFilter] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory(true);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedData<any>('history');
      if (cached) {
        setUserRole(cached.userRole);
        setInspections(cached.inspections);
        setLoading(false);
        return;
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: userData } = await supabase.from('users').select('role, zone_id').eq('id', session.user.id).single();
    let newUserRole = '';
    
    if (userData) {
      newUserRole = userData.role;
      setUserRole(newUserRole);
    }

    let query = supabase
      .from('inspections')
      .select(`
        id,
        remark,
        inspected_at,
        devices!inner(serial_number, zone_id, device_types(name), zones(name)),
        users(full_name)
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
      setCachedData('history', {
        userRole: newUserRole,
        inspections: data
      });
    }
    setLoading(false);
  };

  const filteredInspections = useMemo(() => {
    return inspections.filter(item => {
      let match = true;
      if (selectedDeviceType && item.devices?.device_types?.name !== selectedDeviceType) {
        match = false;
      }
      if (selectedInspector && item.users?.full_name !== selectedInspector) {
        match = false;
      }
      if (selectedZone && item.devices?.zones?.name !== selectedZone) {
        match = false;
      }
      if (startDate) {
        const itemDate = new Date(item.inspected_at);
        const sDate = new Date(startDate);
        if (!isNaN(sDate.getTime()) && itemDate < sDate) match = false;
      }
      if (endDate) {
        const itemDate = new Date(item.inspected_at);
        const eDate = new Date(endDate);
        if (!isNaN(eDate.getTime())) {
          eDate.setHours(23, 59, 59, 999);
          if (itemDate > eDate) match = false;
        }
      }
      return match;
    });
  }, [inspections, selectedDeviceType, selectedInspector, selectedZone, startDate, endDate]);

  const uniqueDeviceTypes = Array.from(new Set(inspections.map(i => i.devices?.device_types?.name).filter(Boolean))) as string[];
  const uniqueInspectors = Array.from(new Set(inspections.map(i => i.users?.full_name).filter(Boolean))) as string[];
  const uniqueZones = Array.from(new Set(inspections.map(i => i.devices?.zones?.name).filter(Boolean))) as string[];

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
          {(userRole === 'ROLE_ADMIN' || userRole === 'ROLE_SUPERADMIN') && item.users?.full_name && (
            <View style={styles.badge}>
              <User size={12} color="#4F46E5" style={{ marginRight: 4 }} />
              <Text style={styles.badgeText}>{item.users?.full_name}</Text>
            </View>
          )}
        </View>

      <View style={styles.remarkContainer}>
        <Text style={styles.remarkLabel}>Inspector Findings</Text>
        <Text style={styles.remark}>{item.remark}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#1E3A8A" barStyle="light-content" />
      <SafeAreaView style={{ flex: 0, backgroundColor: '#1E3A8A' }} edges={['top']} />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
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
              {loading ? 'Loading records...' : `${filteredInspections.length} total records found`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity 
            style={[styles.filterChip, selectedDeviceType ? styles.filterChipActive : null]} 
            onPress={() => setShowDeviceFilter(true)}
          >
            <Tag size={14} color={selectedDeviceType ? "#FFFFFF" : "#6B7280"} />
            <Text style={[styles.filterChipText, selectedDeviceType ? styles.filterChipTextActive : null]}>
              {selectedDeviceType || 'All Device Types'}
            </Text>
            <ChevronDown size={14} color={selectedDeviceType ? "#FFFFFF" : "#6B7280"} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterChip, (startDate || endDate) ? styles.filterChipActive : null]} 
            onPress={() => setShowDateFilter(true)}
          >
            <Calendar size={14} color={(startDate || endDate) ? "#FFFFFF" : "#6B7280"} />
            <Text style={[styles.filterChipText, (startDate || endDate) ? styles.filterChipTextActive : null]}>
              {(startDate || endDate) ? `${startDate || 'Start'} to ${endDate || 'End'}` : 'All Dates'}
            </Text>
            <ChevronDown size={14} color={(startDate || endDate) ? "#FFFFFF" : "#6B7280"} />
          </TouchableOpacity>

          {(userRole === 'ROLE_ADMIN' || userRole === 'ROLE_SUPERADMIN') && (
            <TouchableOpacity 
              style={[styles.filterChip, selectedInspector ? styles.filterChipActive : null]} 
              onPress={() => setShowInspectorFilter(true)}
            >
              <User size={14} color={selectedInspector ? "#FFFFFF" : "#6B7280"} />
              <Text style={[styles.filterChipText, selectedInspector ? styles.filterChipTextActive : null]}>
                {selectedInspector || 'All Inspectors'}
              </Text>
              <ChevronDown size={14} color={selectedInspector ? "#FFFFFF" : "#6B7280"} />
            </TouchableOpacity>
          )}

          {userRole === 'ROLE_SUPERADMIN' && (
            <TouchableOpacity 
              style={[styles.filterChip, selectedZone ? styles.filterChipActive : null]} 
              onPress={() => setShowZoneFilter(true)}
            >
              <MapPin size={14} color={selectedZone ? "#FFFFFF" : "#6B7280"} />
              <Text style={[styles.filterChipText, selectedZone ? styles.filterChipTextActive : null]}>
                {selectedZone || 'All Zones'}
              </Text>
              <ChevronDown size={14} color={selectedZone ? "#FFFFFF" : "#6B7280"} />
            </TouchableOpacity>
          )}

          {(selectedDeviceType || selectedInspector || selectedZone || startDate || endDate) ? (
            <TouchableOpacity 
              style={styles.clearFilterButton} 
              onPress={() => { 
                setSelectedDeviceType(null); 
                setSelectedInspector(null);
                setSelectedZone(null);
                setStartDate(''); 
                setEndDate(''); 
              }}
            >
              <FilterX size={14} color="#EF4444" />
              <Text style={styles.clearFilterText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={filteredInspections}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} tintColor="#2563EB" />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {userRole === 'ROLE_USER' ? "You haven't performed any inspections yet." : "No inspection records found."}
            </Text>
          }
        />
      )}

      <Modal visible={showDeviceFilter} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Device Type</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity 
                style={[styles.modalItem, !selectedDeviceType && styles.modalItemActive]}
                onPress={() => { setSelectedDeviceType(null); setShowDeviceFilter(false); }}
              >
                <Text style={!selectedDeviceType ? styles.modalItemTextActive : styles.modalItemText}>All Device Types</Text>
              </TouchableOpacity>
              {uniqueDeviceTypes.map(type => (
                <TouchableOpacity 
                  key={type} 
                  style={[styles.modalItem, selectedDeviceType === type && styles.modalItemActive]}
                  onPress={() => { setSelectedDeviceType(type); setShowDeviceFilter(false); }}
                >
                  <Text style={selectedDeviceType === type ? styles.modalItemTextActive : styles.modalItemText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowDeviceFilter(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showInspectorFilter} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Inspector</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity 
                style={[styles.modalItem, !selectedInspector && styles.modalItemActive]}
                onPress={() => { setSelectedInspector(null); setShowInspectorFilter(false); }}
              >
                <Text style={!selectedInspector ? styles.modalItemTextActive : styles.modalItemText}>All Inspectors</Text>
              </TouchableOpacity>
              {uniqueInspectors.map(inspector => (
                <TouchableOpacity 
                  key={inspector} 
                  style={[styles.modalItem, selectedInspector === inspector && styles.modalItemActive]}
                  onPress={() => { setSelectedInspector(inspector); setShowInspectorFilter(false); }}
                >
                  <Text style={selectedInspector === inspector ? styles.modalItemTextActive : styles.modalItemText}>{inspector}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowInspectorFilter(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showZoneFilter} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Zone</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity 
                style={[styles.modalItem, !selectedZone && styles.modalItemActive]}
                onPress={() => { setSelectedZone(null); setShowZoneFilter(false); }}
              >
                <Text style={!selectedZone ? styles.modalItemTextActive : styles.modalItemText}>All Zones</Text>
              </TouchableOpacity>
              {uniqueZones.map(zone => (
                <TouchableOpacity 
                  key={zone} 
                  style={[styles.modalItem, selectedZone === zone && styles.modalItemActive]}
                  onPress={() => { setSelectedZone(zone); setShowZoneFilter(false); }}
                >
                  <Text style={selectedZone === zone ? styles.modalItemTextActive : styles.modalItemText}>{zone}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowZoneFilter(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDateFilter} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by Date</Text>
            <View style={styles.dateInputContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>Start Date</Text>
                <TextInput 
                  style={styles.dateInput} 
                  placeholder="YYYY-MM-DD" 
                  value={startDate} 
                  onChangeText={setStartDate} 
                />
              </View>
              <View style={{ width: 16 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>End Date</Text>
                <TextInput 
                  style={styles.dateInput} 
                  placeholder="YYYY-MM-DD" 
                  value={endDate} 
                  onChangeText={setEndDate} 
                />
              </View>
            </View>
            <View style={styles.presetDates}>
              <TouchableOpacity style={styles.presetButton} onPress={() => {
                const d = new Date(); d.setDate(d.getDate() - 7);
                setStartDate(d.toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
              }}>
                <Text style={styles.presetText}>Last 7 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetButton} onPress={() => {
                const d = new Date(); d.setDate(d.getDate() - 30);
                setStartDate(d.toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
              }}>
                <Text style={styles.presetText}>Last 30 Days</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 24, gap: 12 }}>
              <TouchableOpacity style={[styles.modalCloseButton, { flex: 1, backgroundColor: '#F3F4F6', marginTop: 0 }]} onPress={() => setShowDateFilter(false)}>
                <Text style={[styles.modalCloseText, { color: '#4B5563' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalCloseButton, { flex: 1, backgroundColor: '#1E3A8A', marginTop: 0 }]} onPress={() => setShowDateFilter(false)}>
                <Text style={[styles.modalCloseText, { color: '#FFFFFF' }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
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
    flexWrap: 'wrap',
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
  filterBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#1E3A8A',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalItemActive: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  modalItemText: {
    fontSize: 16,
    color: '#4B5563',
  },
  modalItemTextActive: {
    fontSize: 16,
    color: '#1E3A8A',
    fontWeight: 'bold',
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  dateInputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '500',
  },
  dateInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  presetDates: {
    flexDirection: 'row',
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
  },
  presetText: {
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '600',
  },
});
