import React, { useMemo, useState } from 'react';
import {
  Alert, FlatList, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  Student, compareStudentRollNumbers, isGraduatedStudent, useApp,
} from '@/context/AppContext';

type Form = {
  name: string; fatherName: string; motherName: string; mobileNumber: string;
  class: string; section: string; admissionNo: string; rollNumber: string;
  dateOfBirth: string; address: string; annualFee: string;
  discountType: 'fixed' | 'percent'; discountValue: string;
};

const emptyForm: Form = {
  name: '', fatherName: '', motherName: '', mobileNumber: '', class: '',
  section: '', admissionNo: '', rollNumber: '', dateOfBirth: '', address: '',
  annualFee: '', discountType: 'fixed', discountValue: '',
};

function formFromStudent(student: Student): Form {
  return {
    name: student.name, fatherName: student.fatherName, motherName: student.motherName ?? '',
    mobileNumber: student.mobileNumber, class: student.class, section: student.section ?? '',
    admissionNo: student.admissionNo ?? '', rollNumber: student.rollNumber,
    dateOfBirth: student.dateOfBirth ?? '', address: student.address ?? '',
    annualFee: student.annualFee == null ? '' : String(student.annualFee),
    discountType: student.discountType ?? 'fixed',
    discountValue: student.discountValue == null ? '' : String(student.discountValue),
  };
}

export default function TeacherStudents() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { students, classes, updateStudent } = useApp();
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('All');
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter(student => !isGraduatedStudent(student))
      .filter(student => filterClass === 'All' || student.class === filterClass)
      .filter(student => !q || [student.name, student.class, student.rollNumber, student.admissionNo ?? '']
        .some(value => value.toLowerCase().includes(q)))
      .sort(compareStudentRollNumbers);
  }, [students, search, filterClass]);

  const openEdit = (student: Student) => {
    setEditing(student);
    setForm(formFromStudent(student));
  };

  const closeEdit = () => {
    if (saving) return;
    setEditing(null);
    setForm(emptyForm);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!form.name.trim() || !form.fatherName.trim() || !form.class.trim() || !form.rollNumber.trim()) {
      Alert.alert('Validation', 'Name, Father Name, Class and Roll Number are required.');
      return;
    }
    setSaving(true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updateStudent(editing.id, {
        name: form.name.trim(),
        fatherName: form.fatherName.trim(),
        motherName: form.motherName.trim(),
        mobileNumber: form.mobileNumber.trim(),
        class: form.class.trim(),
        section: form.section.trim() || undefined,
        admissionNo: form.admissionNo.trim() || undefined,
        rollNumber: form.rollNumber.trim(),
        dateOfBirth: form.dateOfBirth.trim(),
        address: form.address.trim() || undefined,
        annualFee: form.annualFee.trim() ? Number(form.annualFee) : undefined,
        discountType: form.annualFee.trim() ? form.discountType : undefined,
        discountValue: form.discountValue.trim() ? Number(form.discountValue) : undefined,
      });
      closeEdit();
      Alert.alert('Saved', 'Student details updated successfully.');
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Could not update student.');
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof Form, label: string, placeholder: string, keyboardType?: any) => (
    <View style={styles.field} key={key}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        value={form[key] as string}
        onChangeText={value => setForm(previous => ({ ...previous, [key]: value }))}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.text }]}
      />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 12 : insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Manage Students</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Correct student records</Text>
        </View>
      </View>
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, class, roll or admission no."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.search, { color: colors.text }]}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={{ backgroundColor: colors.card }}
      >
        {['All', ...classes].map(className => (
          <TouchableOpacity
            key={className}
            onPress={() => setFilterClass(className)}
            activeOpacity={0.8}
            style={[
              styles.filterChip,
              {
                backgroundColor: filterClass === className ? colors.primary : colors.muted,
                borderColor: filterClass === className ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={{ color: filterClass === className ? '#fff' : colors.mutedForeground, fontSize: 13, fontWeight: '600' }}>
              {className}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={visibleStudents}
        keyExtractor={student => student.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.mutedForeground }]}>No students found.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {item.class}{item.section ? ` · ${item.section}` : ''} · Roll {item.rollNumber}
              </Text>
              {item.admissionNo ? <Text style={[styles.meta, { color: colors.primary }]}>Adm {item.admissionNo}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => openEdit(item)} style={[styles.editButton, { backgroundColor: colors.primary + '15' }]}>
              <Feather name="edit-2" size={16} color={colors.primary} />
              <Text style={[styles.editText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={closeEdit}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Student</Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Correct the details and save</Text>
              </View>
              <TouchableOpacity onPress={closeEdit} disabled={saving}><Feather name="x" size={24} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              {field('name', 'Student Name *', 'Full name')}
              {field('fatherName', "Father's Name *", 'Father name')}
              {field('motherName', "Mother's Name", 'Mother name')}
              {field('mobileNumber', 'Mobile Number', '10-digit number', 'phone-pad')}
              {field('rollNumber', 'Roll Number *', 'Class roll number', 'number-pad')}
              {field('admissionNo', 'Admission Number', 'Admission number')}
              {field('dateOfBirth', 'Date of Birth', 'DD-MM-YYYY')}
              {field('address', 'Address', 'Residential address')}
              {field('class', 'Class *', 'Class name')}
              {field('section', 'Section', 'Section name')}
              {field('annualFee', 'Annual Fee', 'Amount', 'number-pad')}
              {field('discountValue', 'Discount', 'Amount or percentage', 'number-pad')}
            </ScrollView>
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity onPress={closeEdit} disabled={saving} style={[styles.cancel, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void saveEdit()} disabled={saving} style={[styles.save, { backgroundColor: colors.primary }]}>
                <Feather name="check" size={17} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backButton: { padding: 6 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderBottomWidth: 1 },
  search: { flex: 1, paddingVertical: 12, fontSize: 14 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    flexShrink: 0,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 4 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  editText: { fontSize: 13, fontWeight: '700' },
  empty: { textAlign: 'center', padding: 32 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '94%', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1 },
  modalTitle: { fontSize: 19, fontWeight: '800' },
  form: { padding: 18, paddingBottom: 32 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1 },
  cancel: { flex: 1, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  save: { flex: 1.5, flexDirection: 'row', gap: 7, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
});