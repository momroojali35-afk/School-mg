import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, ScrollView, Alert, Platform, Image, SectionList,
  FlatList, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { useApp, Alumni, Student } from '@/context/AppContext';
import EmptyState from '@/components/EmptyState';

const CURRENT_STATUS_OPTIONS = ['Studying', 'Working', 'Self-Employed', 'Other'];

const BLANK: Omit<Alumni, 'id' | 'createdAt'> = {
  name: '', fatherName: '', mobileNumber: '', batch: '',
  passOutClass: '', rollNumber: '', admissionNo: '',
  dateOfBirth: '', address: '', achievements: '', currentStatus: '',
  photo: undefined,
};

// Map a Student → Alumni draft (no id/batch yet)
function studentToAlumniDraft(s: Student, passOutClass: string): Omit<Alumni, 'id' | 'batch'> {
  return {
    name: s.name,
    fatherName: s.fatherName ?? '',
    mobileNumber: s.mobileNumber ?? '',
    passOutClass,
    rollNumber: s.rollNumber ?? '',
    admissionNo: s.admissionNo,
    dateOfBirth: s.dateOfBirth ?? '',
    address: s.address,
    achievements: '',
    currentStatus: '',
    photo: s.photo,
  };
}

export default function AlumniScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alumni, students, classes, addAlumni, updateAlumni, deleteAlumni, bulkAddAlumni } = useApp();

  // ── list state ──
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('All');

  // ── single add/edit ──
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Alumni | null>(null);
  const [detailAlumni, setDetailAlumni] = useState<Alumni | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Alumni | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // ── bulk import state ──
  const [importStep, setImportStep] = useState<0 | 1 | 2>(0); // 0=closed 1=pick class+batch 2=confirm students
  const [importClass, setImportClass] = useState('');
  const [importBatch, setImportBatch] = useState('');
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);

  // Students in chosen class (active only)
  const classStudents = useMemo(() =>
    students.filter(s => s.class === importClass && (!s.status || s.status === 'active')),
    [students, importClass]);

  // All unique batches sorted descending
  const allBatches = useMemo(() => {
    const batches = Array.from(new Set(alumni.map(a => a.batch))).sort((a, b) => b.localeCompare(a));
    return ['All', ...batches];
  }, [alumni]);

  const filtered = useMemo(() => alumni.filter(a => {
    const matchBatch = batchFilter === 'All' || a.batch === batchFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || a.name.toLowerCase().includes(q) ||
      a.batch.toLowerCase().includes(q) || a.passOutClass.toLowerCase().includes(q) ||
      (a.admissionNo ?? '').toLowerCase().includes(q) || a.rollNumber.toLowerCase().includes(q);
    return matchBatch && matchSearch;
  }), [alumni, search, batchFilter]);

  const sections = useMemo(() => {
    const groups: Record<string, Alumni[]> = {};
    filtered.forEach(a => { if (!groups[a.batch]) groups[a.batch] = []; groups[a.batch].push(a); });
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([title, data]) => ({ title, data }));
  }, [filtered]);

  // ── helpers ──
  const openAdd = () => { setEditing(null); setForm({ ...BLANK }); setShowModal(true); };
  const openEdit = (a: Alumni) => {
    setEditing(a);
    setForm({
      name: a.name, fatherName: a.fatherName, mobileNumber: a.mobileNumber,
      batch: a.batch, passOutClass: a.passOutClass, rollNumber: a.rollNumber,
      admissionNo: a.admissionNo ?? '', dateOfBirth: a.dateOfBirth,
      address: a.address ?? '', achievements: a.achievements ?? '',
      currentStatus: a.currentStatus ?? '', photo: a.photo,
    });
    setShowModal(true);
  };

  const openImport = () => {
    setImportClass(''); setImportBatch('');
    setImportSelected(new Set()); setImportStep(1);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Validation', 'Name is required'); return; }
    if (!form.batch.trim()) { Alert.alert('Validation', 'Batch year is required (e.g. 2023-24)'); return; }
    if (!form.passOutClass.trim()) { Alert.alert('Validation', 'Pass-out class is required'); return; }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const data = {
      name: form.name.trim(), fatherName: form.fatherName.trim(),
      mobileNumber: form.mobileNumber.trim(), batch: form.batch.trim(),
      passOutClass: form.passOutClass.trim(), rollNumber: form.rollNumber.trim(),
      admissionNo: form.admissionNo.trim() || undefined,
      dateOfBirth: form.dateOfBirth.trim(), address: form.address.trim() || undefined,
      achievements: form.achievements.trim() || undefined,
      currentStatus: form.currentStatus || undefined, photo: form.photo,
    };
    if (editing) updateAlumni(editing.id, data);
    else addAlumni(data);
    setShowModal(false);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setForm(prev => ({ ...prev, photo: 'data:image/jpeg;base64,' + result.assets[0].base64 }));
    }
  };

  // Step 1 → Step 2: validate then show student list
  const proceedToStudentList = () => {
    if (!importClass) { Alert.alert('Select a class first'); return; }
    if (!importBatch.trim()) { Alert.alert('Enter batch year', 'e.g. 2023-24'); return; }
    if (classStudents.length === 0) {
      Alert.alert('No Students', `No active students found in ${importClass}.`); return;
    }
    // pre-select all
    setImportSelected(new Set(classStudents.map(s => s.id)));
    setImportStep(2);
  };

  const toggleImportStudent = (id: string) => {
    setImportSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkImport = async () => {
    const toImport = classStudents.filter(s => importSelected.has(s.id));
    if (toImport.length === 0) { Alert.alert('Select at least one student'); return; }
    setImportLoading(true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const records = toImport.map(s => studentToAlumniDraft(s, importClass));
      await bulkAddAlumni(records, importBatch.trim());
      setImportStep(0);
      Alert.alert('Import Complete', `${toImport.length} student${toImport.length !== 1 ? 's' : ''} added to alumni.`);
    } catch (e) {
      const message = e instanceof Error && e.message
        ? e.message.replace(/^POST \/api\/alumni\/bulk failed: \d+\s*—?\s*/, '')
        : 'Please try again.';
      Alert.alert('Import Failed', message);
    } finally {
      setImportLoading(false);
    }
  };

  const s = styles(colors);
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 80;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>

      {/* ── Top bar ── */}
      <View style={[s.topBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[s.searchRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            value={search} onChangeText={setSearch}
            placeholder="Search alumni…" placeholderTextColor={colors.mutedForeground}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={openImport} activeOpacity={0.8}
        >
          <Feather name="upload" size={17} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd} activeOpacity={0.8}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={s.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* ── Batch filter chips ── */}
      {allBatches.length > 1 && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={[s.chipBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
        >
          {allBatches.map(b => (
            <TouchableOpacity
              key={b}
              style={[s.chip, batchFilter === b && { backgroundColor: colors.primary }]}
              onPress={() => setBatchFilter(b)} activeOpacity={0.8}
            >
              <Text style={[s.chipText, { color: batchFilter === b ? '#fff' : colors.text }]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Stats banner ── */}
      <View style={[s.statsBanner, { backgroundColor: colors.secondary }]}>
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: colors.primary }]}>{alumni.length}</Text>
          <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Total</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: colors.border }]} />
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: colors.primary }]}>{allBatches.length - 1}</Text>
          <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Batches</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: colors.border }]} />
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: colors.primary }]}>{filtered.length}</Text>
          <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Showing</Text>
        </View>
      </View>

      {/* ── List ── */}
      {sections.length === 0 ? (
        <EmptyState
          icon="award" title="No Alumni Records"
          subtitle={search ? 'No alumni match your search' : 'Add individually or import a whole class'}
          onAction={search ? undefined : openImport}
          actionLabel="Import Class"
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={[s.sectionHeader, { backgroundColor: colors.background }]}>
              <View style={[s.batchBadge, { backgroundColor: colors.primary + '15' }]}>
                <Feather name="award" size={13} color={colors.primary} />
                <Text style={[s.batchBadgeText, { color: colors.primary }]}>Batch {section.title}</Text>
              </View>
              <Text style={[s.batchCount, { color: colors.mutedForeground }]}>
                {section.data.length} student{section.data.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          renderItem={({ item: a }) => (
            <TouchableOpacity
              style={[card.container, { backgroundColor: colors.card }]}
              onPress={() => setDetailAlumni(a)} activeOpacity={0.85}
            >
              <View style={card.row}>
                <View style={[card.avatar, { backgroundColor: colors.secondary }]}>
                  {a.photo
                    ? <Image source={{ uri: a.photo }} style={card.avatarImage} />
                    : <Text style={[card.avatarText, { color: colors.primary }]}>{a.name.charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[card.name, { color: colors.text }]}>{a.name}</Text>
                  <Text style={[card.sub, { color: colors.mutedForeground }]}>{a.passOutClass} · Roll {a.rollNumber || '—'}</Text>
                  {a.fatherName ? <Text style={[card.sub, { color: colors.mutedForeground }]}>S/O {a.fatherName}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {a.currentStatus ? (
                    <View style={[card.statusBadge, { backgroundColor: colors.info + '18' }]}>
                      <Text style={[card.statusText, { color: colors.info }]}>{a.currentStatus}</Text>
                    </View>
                  ) : null}
                  {a.mobileNumber ? <Text style={[card.mobile, { color: colors.mutedForeground }]}>{a.mobileNumber}</Text> : null}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ════════════════════════════════════════════════════════
          IMPORT CLASS MODAL — Step 1: Choose class + batch
         ════════════════════════════════════════════════════════ */}
      <Modal visible={importStep === 1} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={[m.sheet, { backgroundColor: colors.card }]}>
            <View style={[m.header, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[m.title, { color: colors.text }]}>Import Class as Alumni</Text>
                <Text style={[m.subtitle, { color: colors.mutedForeground }]}>All students from a class become alumni</Text>
              </View>
              <TouchableOpacity onPress={() => setImportStep(0)}>
                <Feather name="x" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              {/* Class selector */}
              <Text style={[inp.label, { color: colors.text }]}>Select Class *</Text>
              <TouchableOpacity
                style={[inp.input, { backgroundColor: colors.muted, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }]}
                onPress={() => setShowClassPicker(true)}
              >
                <Text style={{ color: importClass ? colors.text : colors.mutedForeground, fontSize: 14 }}>
                  {importClass || 'Choose a class…'}
                </Text>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>

              {/* Batch year */}
              <Text style={[inp.label, { color: colors.text }]}>Batch Year *</Text>
              <TextInput
                style={[inp.input, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border, marginBottom: 8 }]}
                value={importBatch} onChangeText={setImportBatch}
                placeholder="e.g. 2023-24" placeholderTextColor={colors.mutedForeground}
              />
              <Text style={[s.hint, { color: colors.mutedForeground }]}>
                This will be recorded as the graduation batch for all imported students.
              </Text>

              {/* Preview count */}
              {importClass ? (
                <View style={[s.previewBanner, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
                  <Feather name="users" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
                    {classStudents.length} active student{classStudents.length !== 1 ? 's' : ''} in {importClass}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={[m.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[m.footBtn, { borderColor: colors.border }]} onPress={() => setImportStep(0)}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.footBtn, { flex: 2, backgroundColor: colors.primary }]}
                onPress={proceedToStudentList} activeOpacity={0.8}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Next — Review Students</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Class picker */}
      <Modal visible={showClassPicker} animationType="fade" transparent>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setShowClassPicker(false)}>
          <View style={[m.pickerBox, { backgroundColor: colors.card }]}>
            <Text style={[m.pickerTitle, { color: colors.text, borderBottomColor: colors.border }]}>Select Class</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {classes.map(cls => (
                <TouchableOpacity
                  key={cls}
                  style={[m.pickerItem, { borderBottomColor: colors.border }, importClass === cls && { backgroundColor: colors.primary + '15' }]}
                  onPress={() => { setImportClass(cls); setShowClassPicker(false); }}
                >
                  <Text style={{ color: importClass === cls ? colors.primary : colors.text, fontWeight: importClass === cls ? '700' : '400' }}>
                    {cls}
                  </Text>
                  {importClass === cls && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          IMPORT CLASS MODAL — Step 2: Confirm / deselect students
         ════════════════════════════════════════════════════════ */}
      <Modal visible={importStep === 2} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={[m.sheet, { backgroundColor: colors.card }]}>
            <View style={[m.header, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[m.title, { color: colors.text }]}>Review Students</Text>
                <Text style={[m.subtitle, { color: colors.mutedForeground }]}>
                  {importClass} · Batch {importBatch} · {importSelected.size}/{classStudents.length} selected
                </Text>
              </View>
              <TouchableOpacity onPress={() => setImportStep(1)}>
                <Feather name="arrow-left" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Select all / none */}
            <View style={[s.selAllRow, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={[s.selAllBtn, { borderColor: colors.primary }]}
                onPress={() => setImportSelected(new Set(classStudents.map(s => s.id)))}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.selAllBtn, { borderColor: colors.border }]}
                onPress={() => setImportSelected(new Set())}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: '600' }}>Deselect All</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={classStudents}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item: st }) => {
                const checked = importSelected.has(st.id);
                return (
                  <TouchableOpacity
                    style={[s.studentRow, { borderBottomColor: colors.border }, checked && { backgroundColor: colors.primary + '08' }]}
                    onPress={() => toggleImportStudent(st.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.checkbox, { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : 'transparent' }]}>
                      {checked && <Feather name="check" size={12} color="#fff" />}
                    </View>
                    <View style={[s.stuAvatar, { backgroundColor: colors.secondary }]}>
                      {st.photo
                        ? <Image source={{ uri: st.photo }} style={s.stuAvatarImg} />
                        : <Text style={[s.stuAvatarTxt, { color: colors.primary }]}>{st.name.charAt(0).toUpperCase()}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.stuName, { color: colors.text }]}>{st.name}</Text>
                      <Text style={[s.stuSub, { color: colors.mutedForeground }]}>
                        Roll {st.rollNumber || '—'}{st.admissionNo ? ` · Adm ${st.admissionNo}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={[m.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[m.footBtn, { borderColor: colors.border }]} onPress={() => setImportStep(1)} disabled={importLoading}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.footBtn, { flex: 2, backgroundColor: importSelected.size === 0 ? colors.muted : colors.primary }]}
                onPress={handleBulkImport} activeOpacity={0.8}
                disabled={importLoading || importSelected.size === 0}
              >
                {importLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Feather name="upload" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700' }}>
                        Import {importSelected.size} Student{importSelected.size !== 1 ? 's' : ''}
                      </Text>
                    </>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════ Detail Modal ════ */}
      <Modal visible={!!detailAlumni} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={[m.sheet, { backgroundColor: colors.card }]}>
            {detailAlumni && <>
              <View style={[m.header, { borderBottomColor: colors.border }]}>
                <Text style={[m.title, { color: colors.text }]}>Alumni Details</Text>
                <TouchableOpacity onPress={() => setDetailAlumni(null)}>
                  <Feather name="x" size={24} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 20 }}>
                <View style={[detail.profileCard, { backgroundColor: colors.secondary }]}>
                  <View style={[detail.bigAvatar, { backgroundColor: colors.primary }]}>
                    {detailAlumni.photo
                      ? <Image source={{ uri: detailAlumni.photo }} style={detail.bigAvatarImage} />
                      : <Text style={detail.bigAvatarText}>{detailAlumni.name.charAt(0).toUpperCase()}</Text>}
                  </View>
                  <Text style={[detail.bigName, { color: colors.text }]}>{detailAlumni.name}</Text>
                  <View style={[detail.batchPill, { backgroundColor: colors.primary }]}>
                    <Text style={detail.batchPillText}>Batch {detailAlumni.batch}</Text>
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>{detailAlumni.passOutClass}</Text>
                  {detailAlumni.currentStatus
                    ? <Text style={{ color: colors.info, fontSize: 13, marginTop: 2 }}>{detailAlumni.currentStatus}</Text>
                    : null}
                </View>
                {[
                  { label: "Father's Name", value: detailAlumni.fatherName },
                  { label: 'Mobile', value: detailAlumni.mobileNumber },
                  { label: 'Roll Number', value: detailAlumni.rollNumber },
                  { label: 'Admission No', value: detailAlumni.admissionNo },
                  { label: 'Date of Birth', value: detailAlumni.dateOfBirth },
                  { label: 'Address', value: detailAlumni.address },
                ].filter(r => r.value).map(r => (
                  <View key={r.label} style={[detail.row, { borderBottomColor: colors.border }]}>
                    <Text style={[detail.rowLabel, { color: colors.mutedForeground }]}>{r.label}</Text>
                    <Text style={[detail.rowValue, { color: colors.text }]}>{r.value}</Text>
                  </View>
                ))}
                {detailAlumni.achievements ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={[m.sectionLabel, { color: colors.text }]}>Achievements</Text>
                    <View style={[detail.achieveBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{detailAlumni.achievements}</Text>
                    </View>
                  </View>
                ) : null}
              </ScrollView>
              <View style={[m.footer, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[m.footBtn, { borderColor: colors.destructive }]}
                  onPress={() => { setDetailAlumni(null); setConfirmDelete(detailAlumni); }}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                  <Text style={{ color: colors.destructive, fontWeight: '600' }}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[m.footBtn, { flex: 2, backgroundColor: colors.primary }]}
                  onPress={() => { setDetailAlumni(null); openEdit(detailAlumni); }}
                >
                  <Feather name="edit-2" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Edit</Text>
                </TouchableOpacity>
              </View>
            </>}
          </View>
        </View>
      </Modal>

      {/* ════ Confirm Delete ════ */}
      <Modal visible={!!confirmDelete} animationType="fade" transparent>
        <View style={m.overlay}>
          <View style={[m.confirmBox, { backgroundColor: colors.card }]}>
            <Text style={[m.confirmTitle, { color: colors.text }]}>Delete Alumni?</Text>
            <Text style={[m.confirmMsg, { color: colors.mutedForeground }]}>
              Remove {confirmDelete?.name} from alumni records? This cannot be undone.
            </Text>
            <View style={m.confirmBtns}>
              <TouchableOpacity style={[m.footBtn, { borderColor: colors.border }]} onPress={() => setConfirmDelete(null)}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.footBtn, { flex: 1, backgroundColor: colors.destructive }]}
                onPress={async () => {
                  if (!confirmDelete) return;
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  deleteAlumni(confirmDelete.id);
                  setConfirmDelete(null);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════ Add/Edit Modal ════ */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={[m.sheet, { backgroundColor: colors.card }]}>
            <View style={[m.header, { borderBottomColor: colors.border }]}>
              <Text style={[m.title, { color: colors.text }]}>{editing ? 'Edit Alumni' : 'Add Alumni'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <TouchableOpacity style={[m.photoUpload, { backgroundColor: colors.secondary }]} onPress={handlePickImage}>
                  {form.photo
                    ? <Image source={{ uri: form.photo }} style={m.photoImage} />
                    : <><Feather name="camera" size={24} color={colors.primary} /><Text style={[m.photoHint, { color: colors.primary }]}>Photo</Text></>}
                </TouchableOpacity>
              </View>
              {([
                { key: 'name', label: 'Full Name *', placeholder: 'Student full name' },
                { key: 'fatherName', label: "Father's Name", placeholder: "Father's name" },
                { key: 'mobileNumber', label: 'Mobile', placeholder: '10-digit number', keyboard: 'phone-pad' },
                { key: 'batch', label: 'Batch *', placeholder: 'e.g. 2023-24' },
                { key: 'passOutClass', label: 'Pass-out Class *', placeholder: 'e.g. Class 10' },
                { key: 'rollNumber', label: 'Roll Number', placeholder: 'e.g. 01' },
                { key: 'admissionNo', label: 'Admission No', placeholder: 'Admission number' },
                { key: 'dateOfBirth', label: 'Date of Birth', placeholder: 'YYYY-MM-DD' },
                { key: 'address', label: 'Address', placeholder: 'Home address' },
                { key: 'achievements', label: 'Achievements', placeholder: 'Awards, notable achievements…', multiline: true },
              ] as any[]).map(f => (
                <View key={f.key} style={{ marginBottom: 14 }}>
                  <Text style={[inp.label, { color: colors.text }]}>{f.label}</Text>
                  <TextInput
                    style={[inp.input, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border },
                      f.multiline && { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                    value={(form as any)[f.key]}
                    onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                    placeholder={f.placeholder} placeholderTextColor={colors.mutedForeground}
                    keyboardType={f.keyboard} multiline={f.multiline}
                  />
                </View>
              ))}
              <View style={{ marginBottom: 14 }}>
                <Text style={[inp.label, { color: colors.text }]}>Current Status</Text>
                <TouchableOpacity
                  style={[inp.input, { backgroundColor: colors.muted, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                  onPress={() => setShowStatusPicker(true)}
                >
                  <Text style={{ color: form.currentStatus ? colors.text : colors.mutedForeground }}>
                    {form.currentStatus || 'Select status…'}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={[m.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[m.footBtn, { borderColor: colors.border }]} onPress={() => setShowModal(false)}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.footBtn, { flex: 2, backgroundColor: colors.primary }]} onPress={handleSave}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{editing ? 'Save Changes' : 'Add Alumni'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status picker */}
      <Modal visible={showStatusPicker} animationType="fade" transparent>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={[m.pickerBox, { backgroundColor: colors.card }]}>
            <Text style={[m.pickerTitle, { color: colors.text, borderBottomColor: colors.border }]}>Current Status</Text>
            {['', ...CURRENT_STATUS_OPTIONS].map(opt => (
              <TouchableOpacity
                key={opt || '__none'}
                style={[m.pickerItem, { borderBottomColor: colors.border }, form.currentStatus === opt && { backgroundColor: colors.primary + '15' }]}
                onPress={() => { setForm(p => ({ ...p, currentStatus: opt })); setShowStatusPicker(false); }}
              >
                <Text style={{ color: opt === form.currentStatus ? colors.primary : colors.text, fontWeight: opt === form.currentStatus ? '700' : '400' }}>
                  {opt || 'None'}
                </Text>
                {form.currentStatus === opt && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = (c: ReturnType<typeof import('@/hooks/useColors').useColors>) => StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  chipBar: { borderBottomWidth: StyleSheet.hairlineWidth, maxHeight: 52 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#E2E8F0' },
  chipText: { fontSize: 13, fontWeight: '600' },
  statsBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 12, padding: 14,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 2, marginTop: 8,
  },
  batchBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  batchBadgeText: { fontSize: 13, fontWeight: '700' },
  batchCount: { fontSize: 12, fontWeight: '500' },
  hint: { fontSize: 12, lineHeight: 16, marginTop: 4, marginBottom: 16 },
  previewBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8,
  },
  selAllRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selAllBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  studentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  stuAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  stuAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  stuAvatarTxt: { fontSize: 16, fontWeight: '700' },
  stuName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  stuSub: { fontSize: 12 },
});

const card = StyleSheet.create({
  container: {
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { fontSize: 20, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  sub: { fontSize: 12, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  mobile: { fontSize: 11 },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', minHeight: '70%' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 20, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  footer: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
  },
  photoUpload: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden',
  },
  photoImage: { width: 80, height: 80, borderRadius: 40 },
  photoHint: { fontSize: 11, fontWeight: '600' },
  confirmBox: {
    margin: 32, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  confirmTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  confirmMsg: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  pickerBox: {
    margin: 32, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  pickerTitle: {
    fontSize: 16, fontWeight: '700', padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

const detail = StyleSheet.create({
  profileCard: { alignItems: 'center', borderRadius: 16, padding: 20, marginBottom: 16 },
  bigAvatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 10,
  },
  bigAvatarImage: { width: 80, height: 80, borderRadius: 40 },
  bigAvatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  bigName: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  batchPill: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  batchPillText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 13, fontWeight: '500', flex: 1 },
  rowValue: { fontSize: 13, fontWeight: '600', flex: 2, textAlign: 'right' },
  achieveBox: { borderRadius: 12, padding: 14, borderWidth: 1 },
});

const inp = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
});
