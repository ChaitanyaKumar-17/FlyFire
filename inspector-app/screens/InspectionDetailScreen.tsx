import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';

type InspectionDetailRouteProp = RouteProp<RootStackParamList, 'InspectionDetail'>;

export default function InspectionDetailScreen() {
  const route = useRoute<InspectionDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { deviceId } = route.params;

  const [device, setDevice] = useState<any>(null);
  const [lastInspection, setLastInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDeviceDetails();
  }, [deviceId]);

  const fetchDeviceDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select(`
          id,
          serial_number,
          is_active,
          device_types!devices_device_type_id_fkey(name),
          zones!devices_zone_id_fkey(name)
        `)
        .eq('id', deviceId)
        .single();

      if (error) throw error;
      setDevice(data);

      if (data.is_active) {
        const { data: inspectionData } = await supabase
          .from('inspections')
          .select('inspected_at, remark')
          .eq('device_id', deviceId)
          .order('inspected_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (inspectionData) {
          setLastInspection(inspectionData);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to fetch device details. ' + error.message);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (remark.trim().length < 10) {
      Alert.alert('Validation Error', 'Inspection remark must be at least 10 characters long.');
      return;
    }

    if (!device?.is_active) {
      Alert.alert('Error', 'Cannot inspect a decommissioned device.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const { error } = await supabase.from('inspections').insert({
        device_id: device.id,
        inspector_id: session.user.id,
        remark: remark.trim()
      });

      if (error) throw error;

      Alert.alert('Success', 'Inspection recorded successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('Dashboard') }
      ]);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to submit inspection. ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Fetching device details...</Text>
      </View>
    );
  }

  if (!device) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inspection Detail</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Device Information</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Serial Number</Text>
              <Text style={styles.infoValue}>{device.serial_number}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{device.device_types?.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Zone</Text>
              <Text style={styles.infoValue}>{device.zones?.name}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.infoValue, { color: device.is_active ? '#10B981' : '#EF4444' }]}>
                {device.is_active ? 'Active' : 'Decommissioned'}
              </Text>
            </View>
          </View>

          {device.is_active && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Previous Inspection</Text>
              {lastInspection ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date</Text>
                    <Text style={styles.infoValue}>
                      {new Date(lastInspection.inspected_at).toLocaleDateString()} {new Date(lastInspection.inspected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[styles.infoRow, { borderBottomWidth: 0, flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <Text style={[styles.infoLabel, { marginBottom: 8 }]}>Remark</Text>
                    <Text style={[styles.infoValue, { fontWeight: '400', lineHeight: 20 }]}>{lastInspection.remark}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.noHistoryText}>No previous inspection history found.</Text>
              )}
            </View>
          )}

          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Log New Inspection</Text>
            <Text style={styles.label}>Inspection Remark</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Enter your physical inspection findings (minimum 10 characters)..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              value={remark}
              onChangeText={setRemark}
              editable={!submitting && device.is_active}
              textAlignVertical="top"
            />

            <TouchableOpacity 
              style={[styles.submitButton, (submitting || !device.is_active) && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={submitting || !device.is_active}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <CheckCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>Submit Inspection</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 16,
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
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  noHistoryText: {
    color: '#6B7280',
    fontSize: 14,
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    minHeight: 120,
    marginBottom: 20,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#A7F3D0',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
