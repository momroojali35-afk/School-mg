import React, { useState, useMemo, useRef } from 'react';
import ViewShot from 'react-native-view-shot';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ScrollView, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp, Student, FeeType, getStudentFeeInfo } from '@/context/AppContext';
import EmptyState from '@/components/EmptyState';
import { printFeeReceipt, shareReceiptWhatsApp } from '@/utils/receipt';
import { buildReminderMessage, sendReminderSMS, shareReminderImage } from '@/utils/reminder';
import ReminderCard from '@/components/ReminderCard';

type Tab = 'fees' | 'feeTypes' | 'expenses';
const EXPENSE_CATEGORIES = ['Supplies', 'Utilities', 'Salaries', 'Maintenance', 'Events', 'Other'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PAYMENT_METHODS = [
  { value: 'Cash', icon: 'dollar-sign' as const },
  { value: 'Online', icon: 'wifi' as const },
  { value: 'Card', icon: 'credit-card' as const },
  { value: 'Check', icon: 'file-text' as const },
];

export default function FinanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { students, feeRecords, addFeeRecord, deleteFeeRecord, feeTypes, addFeeType, updateFeeType, deleteFeeType, expenses, addExpense, deleteExpense } = useApp();

  const [tab, setTab] = useState<Tab>('fees');

  // ── Fee collection state ──
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectStudent, setCollectStudent] = useState<Student | null>(null);
  const [collectFeeTypeId, setCollectFeeTypeId] = useState('');
  const [collectAmount, setCollectAmount] = useState('');
  const [collectDesc, setCollectDesc] = useState('');
  const [collectDate, setCollectDate] = useState(new Date().toISOString().split('T')[0]);
  const [showFeeHistory, setShowFeeHistory] = useState<Student | null>(null);
  const [showFeeTypePicker, setShowFeeTypePicker] = useState(false);
  const [collectPaymentMethod, setCollectPaymentMethod] = useState('Cash');
  const [feeSearch, setFeeSearch] = useState('');
  const [feeClassFilter, setFeeClassFilter] = useState('All');

  // ── Fee Reminder state ──
  const viewShotRef = useRef<any>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderStudent, setReminderStudent] = useState<Student | null>(null);
  const [reminderMessage, setReminderMessage] = useState('');

  // ── Fee Type state ──
  const [showFeeTypeModal, setShowFeeTypeModal] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);
  const [ftForm, setFtForm] = useState({ name: '', amount: '', description: '' });

  // ── Expense state ──
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expForm, setExpForm] = useState({ description: '', amount: '', category: 'Supplies', date: new Date().toISOString().split('T')[0] });
  const [showCatPicker, setShowCatPicker] = useState(false);

  // ── Generic confirm modal ──
  const [confirmModal, setConfirmModal] = useState<{
    title: string; message: string; onConfirm: () => void;
  } | null>(null);

  // ── Post-collect receipt modal ──
  const [receiptModal, setReceiptModal] = useState<{ record: any; student: Student } | null>(null);

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthFees = useMemo(() => feeRecords.filter(f => f.date.startsWith(monthStr)).reduce((s, f) => s + f.amount, 0), [feeRecords, monthStr]);
  const monthExpenses = useMemo(() => expenses.filter(e => e.date.startsWith(monthStr)).reduce((s, e) => s + e.amount, 0), [expenses, monthStr]);
  const monthFeesByType = useMemo(() => {
    const map: Record<string, number> = {};
    feeRecords.filter(f => f.date.startsWith(monthStr)).forEach(f => {
      const key = f.feeTypeName ?? f.description ?? 'Other';
      map[key] = (map[key] ?? 0) + f.amount;
    });
    return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [feeRecords, monthStr]);

  const getStudentLastFee = (studentId: string) =>
    feeRecords.filter(f => f.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const getStudentTotal = (studentId: string) =>
    feeRecords.filter(f => f.studentId === studentId).reduce((s, f) => s + f.amount, 0);

  const uniqueClasses = useMemo(() => ['All', ...Array.from(new Set(students.map(s => s.class))).sort()], [students]);
  const filteredStudents = useMemo(() => students.filter(s => {
    const matchSearch = feeSearch === '' || s.name.toLowerCase().includes(feeSearch.toLowerCase());
    const matchClass = feeClassFilter === 'All' || s.class === feeClassFilter;
    return matchSearch && matchClass;
  }), [students, feeSearch, feeClassFilter]);

  // ── Collect fee handlers ──
  const openCollect = (student: Student) => {
    setCollectStudent(student);
    setCollectFeeTypeId('');
    setCollectAmount('');
    setCollectDesc(`Monthly Fee - ${MONTHS[now.getMonth()]} ${now.getFullYear()}`);
    setCollectDate(now.toISOString().split('T')[0]);
    setCollectPaymentMethod('Cash');
    setShowCollectModal(true);
  };
  const selectFeeType = (ft: FeeType) => {
    setCollectFeeTypeId(ft.id);
    setCollectAmount(ft.amount > 0 ? String(ft.amount) : '');
    setCollectDesc(ft.name);
    setShowFeeTypePicker(false);
  };
  const handleCollect = async () => {
    if (!collectFeeTypeId) { Alert.alert('Validation', 'Please select a fee type'); return; }
    if (!collectAmount || Number(collectAmount) <= 0) { Alert.alert('Validation', 'Enter a valid amount'); return; }
    if (!collectDesc.trim()) { Alert.alert('Validation', 'Enter a description'); return; }
    if (!collectStudent) return;

    const finalAmt = Number(collectAmount);

    const selectedFt = feeTypes.find(f => f.id === collectFeeTypeId);
    const isAnnualFee = selectedFt?.category === 'annual' ||
      (selectedFt?.name.toLowerCase().includes('annual fee') ?? false);

    // Overpayment check — only for Annual Fee
    if (isAnnualFee) {
      const fi = getStudentFeeInfo(collectStudent, feeRecords);
      if (fi.annualFee > 0 && finalAmt > fi.remaining) {
        Alert.alert('Overpayment', `Remaining balance is ₹${fi.remaining.toLocaleString('en-IN')}. You cannot collect more than the outstanding balance.`);
        return;
      }
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const feeTypeName = selectedFt?.name;
    const record = addFeeRecord({
      studentId: collectStudent.id,
      studentName: collectStudent.name,
      class: collectStudent.class,
      amount: finalAmt,
      date: collectDate || now.toISOString().split('T')[0],
      description: collectDesc.trim(),
      feeTypeId: collectFeeTypeId,
      feeTypeName: feeTypeName,
      collectedBy: 'Admin',
      paymentMethod: collectPaymentMethod,
      feeCategory: isAnnualFee ? 'annual' : 'additional',
    });
    setShowCollectModal(false);
    setReceiptModal({ record, student: collectStudent });
  };

  const confirmDeleteFee = (id: string, desc: string) => {
    setConfirmModal({
      title: 'Delete Fee Record',
      message: `Delete "${desc}"?`,
      onConfirm: async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        deleteFeeRecord(id);
      },
    });
  };

  // ── Fee type handlers ──
  const openAddFeeType = () => { setEditingFeeType(null); setFtForm({ name: '', amount: '', description: '' }); setShowFeeTypeModal(true); };
  const openEditFeeType = (ft: FeeType) => { setEditingFeeType(ft); setFtForm({ name: ft.name, amount: String(ft.amount), description: ft.description }); setShowFeeTypeModal(true); };
  const handleSaveFeeType = async () => {
    if (!ftForm.name.trim()) { Alert.alert('Validation', 'Enter a fee name'); return; }
    if (ftForm.amount && Number(ftForm.amount) < 0) { Alert.alert('Validation', 'Amount cannot be negative'); return; }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const data = { name: ftForm.name.trim(), amount: ftForm.amount ? Number(ftForm.amount) : 0, description: ftForm.description.trim() };
    if (editingFeeType) updateFeeType(editingFeeType.id, data); else addFeeType(data);
    setShowFeeTypeModal(false);
  };
  const confirmDeleteFeeType = (ft: FeeType) => {
    setConfirmModal({
      title: 'Delete Fee Type',
      message: `Delete "${ft.name}"?`,
      onConfirm: async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        deleteFeeType(ft.id);
      },
    });
  };

  // ── Expense handlers ──
  const handleAddExpense = async () => {
    if (!expForm.description.trim() || !expForm.amount || Number(expForm.amount) <= 0) { Alert.alert('Validation', 'Fill all fields'); return; }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addExpense({ description: expForm.description.trim(), amount: Number(expForm.amount), date: expForm.date || now.toISOString().split('T')[0], category: expForm.category });
    setExpForm({ description: '', amount: '', category: 'Supplies', date: now.toISOString().split('T')[0] });
    setShowExpenseModal(false);
  };
  const confirmDeleteExpense = (id: string, desc: string) => {
    setConfirmModal({
      title: 'Delete Expense',
      message: `Delete "${desc}"?`,
      onConfirm: async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        deleteExpense(id);
      },
    });
  };

  const s = styles(colors);
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 80;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Summary Strip */}
      <View style={[s.summary, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[s.sumCard, { backgroundColor: colors.success + '15' }]}>
          <Text style={[s.sumVal, { color: colors.success }]}>₹{monthFees.toLocaleString('en-IN')}</Text>
          <Text style={[s.sumLabel, { color: colors.success }]}>Fees This Month</Text>
        </View>
        <View style={[s.sumCard, { backgroundColor: colors.destructive + '15' }]}>
          <Text style={[s.sumVal, { color: colors.destructive }]}>₹{monthExpenses.toLocaleString('en-IN')}</Text>
          <Text style={[s.sumLabel, { color: colors.destructive }]}>Expenses</Text>
        </View>
        <View style={[s.sumCard, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[s.sumVal, { color: colors.primary }]}>₹{(monthFees - monthExpenses).toLocaleString('en-IN')}</Text>
          <Text style={[s.sumLabel, { color: colors.primary }]}>Net</Text>
        </View>
      </View>


      {/* Tabs */}
      <View style={[s.tabRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {([['fees','Fee Collection'],['feeTypes','Fee Types'],['expenses','Expenses']] as [Tab,string][]).map(([t, label]) => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && { borderBottomColor: colors.primary }]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Fee Collection Tab ── */}
      {tab === 'fees' && (
        <FlatList
          data={filteredStudents}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad, flexGrow: 1 }}
          ListHeaderComponent={() => (
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }}>
                <Feather name="search" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={{ flex: 1, color: colors.text, fontSize: 15 }}
                  placeholder="Search students..."
                  placeholderTextColor={colors.mutedForeground}
                  value={feeSearch}
                  onChangeText={setFeeSearch}
                />
                {feeSearch !== '' && (
                  <TouchableOpacity onPress={() => setFeeSearch('')}>
                    <Feather name="x" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {uniqueClasses.map(cls => (
                  <TouchableOpacity
                    key={cls}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: feeClassFilter === cls ? colors.primary : colors.muted, borderWidth: 1, borderColor: feeClassFilter === cls ? colors.primary : colors.border }}
                    onPress={() => setFeeClassFilter(cls)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: feeClassFilter === cls ? '#fff' : colors.mutedForeground }}>{cls}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="dollar-sign" title="No Students" subtitle={feeSearch || feeClassFilter !== 'All' ? 'No students match your filter' : 'Add students to manage fees'} />}
          renderItem={({ item: st }) => {
            const last = getStudentLastFee(st.id);
            const fi = getStudentFeeInfo(st, feeRecords);
            const STATUS_COLORS: Record<string, string> = { paid: colors.success, partial: colors.warning, pending: colors.destructive, 'no-fee': colors.mutedForeground };
            const STATUS_LABELS: Record<string, string> = { paid: 'Paid', partial: 'Partial', pending: 'Pending', 'no-fee': 'No Fee Set' };
            const statusColor = STATUS_COLORS[fi.status];
            const isPaid = fi.status === 'paid';
            return (
              <View style={[fc.card, { backgroundColor: colors.card }]}>
                <View style={fc.row}>
                  <View style={[fc.avatar, { backgroundColor: colors.secondary }]}>
                    <Text style={[fc.avatarText, { color: colors.primary }]}>{st.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[fc.name, { color: colors.text }]}>{st.name}</Text>
                    <Text style={[fc.sub, { color: colors.mutedForeground }]}>{st.class} • Roll {st.rollNumber}</Text>
                    {last && <Text style={[fc.sub, { color: colors.mutedForeground }]}>Last payment: {last.date}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[fc.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor }}>{STATUS_LABELS[fi.status]}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={[fc.remindBtn, { backgroundColor: '#FF980015', borderWidth: 1, borderColor: '#FF9800' }]}
                        onPress={() => { setReminderStudent(st); setReminderMessage(buildReminderMessage(st)); setShowReminderModal(true); }}
                        activeOpacity={0.8}
                      >
                        <Feather name="bell" size={12} color="#FF9800" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[fc.collectBtn, { backgroundColor: colors.primary }]}
                        onPress={() => openCollect(st)}
                        activeOpacity={0.8}
                      >
                        <Text style={[fc.collectText, { color: '#fff' }]}>
                          {isPaid ? '+ More' : '+ Collect'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                {/* Fee summary strip */}
                {fi.annualFee > 0 && (
                  <View style={[fc.feeStrip, { borderTopColor: colors.border, backgroundColor: colors.muted + '60' }]}>
                    {[
                      { label: 'Annual', value: `₹${fi.annualFee.toLocaleString('en-IN')}`, color: colors.text },
                      { label: 'Payable', value: `₹${fi.finalPayable.toLocaleString('en-IN')}`, color: colors.text },
                      { label: 'Paid', value: `₹${fi.totalPaid.toLocaleString('en-IN')}`, color: colors.success },
                      { label: 'Balance', value: `₹${fi.remaining.toLocaleString('en-IN')}`, color: fi.remaining > 0 ? colors.destructive : colors.success },
                    ].map(item => (
                      <View key={item.label} style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, color: colors.mutedForeground, fontWeight: '600', marginBottom: 2 }}>{item.label}</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: item.color }}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity style={[fc.histBtn, { borderTopColor: colors.border }]} onPress={() => setShowFeeHistory(st)} activeOpacity={0.8}>
                  <Feather name="clock" size={13} color={colors.mutedForeground} />
                  <Text style={[fc.histText, { color: colors.mutedForeground }]}>View payment history</Text>
                  <Feather name="chevron-right" size={13} color={colors.mutedForeground} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* ── Fee Types Tab ── */}
      {tab === 'feeTypes' && (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <TouchableOpacity style={[s.addBtn, { borderColor: colors.primary }]} onPress={openAddFeeType} activeOpacity={0.8}>
              <Feather name="plus" size={18} color={colors.primary} />
              <Text style={[s.addBtnText, { color: colors.primary }]}>Create Fee Type</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={feeTypes}
            keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 16, paddingBottom: botPad, flexGrow: 1 }}
            ListEmptyComponent={<EmptyState icon="tag" title="No Fee Types" subtitle="Create fee types like Monthly Fee, Exam Fee, etc." />}
            renderItem={({ item: ft }) => (
              <View style={[ftc.card, { backgroundColor: colors.card }]}>
                <View style={[ftc.icon, { backgroundColor: colors.primary + '15' }]}>
                  <Feather name="tag" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ftc.name, { color: colors.text }]}>{ft.name}</Text>
                  {ft.description ? <Text style={[ftc.desc, { color: colors.mutedForeground }]}>{ft.description}</Text> : null}
                </View>
                <Text style={[ftc.amount, { color: ft.amount > 0 ? colors.success : colors.mutedForeground }]}>{ft.amount > 0 ? `₹${ft.amount.toLocaleString('en-IN')}` : 'Variable'}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
                  <TouchableOpacity onPress={() => openEditFeeType(ft)} style={ftc.iconBtn}>
                    <Feather name="edit-2" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDeleteFeeType(ft)} style={ftc.iconBtn}>
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </>
      )}

      {/* ── Expenses Tab ── */}
      {tab === 'expenses' && (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <TouchableOpacity style={[s.addBtn, { borderColor: colors.destructive }]} onPress={() => setShowExpenseModal(true)} activeOpacity={0.8}>
              <Feather name="plus" size={18} color={colors.destructive} />
              <Text style={[s.addBtnText, { color: colors.destructive }]}>Add Expense</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={[...expenses].sort((a, b) => b.date.localeCompare(a.date))}
            keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 16, paddingBottom: botPad, flexGrow: 1 }}
            ListEmptyComponent={<EmptyState icon="trending-down" title="No Expenses" subtitle="Track school expenses here" />}
            renderItem={({ item: exp }) => (
              <View style={[ec.card, { backgroundColor: colors.card }]}>
                <View style={[ec.icon, { backgroundColor: colors.destructive + '15' }]}>
                  <Feather name="tag" size={18} color={colors.destructive} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ec.desc, { color: colors.text }]}>{exp.description}</Text>
                  <Text style={[ec.meta, { color: colors.mutedForeground }]}>{exp.category} • {exp.date}</Text>
                </View>
                <Text style={[ec.amount, { color: colors.destructive }]}>₹{exp.amount.toLocaleString('en-IN')}</Text>
                <TouchableOpacity onPress={() => confirmDeleteExpense(exp.id, exp.description)} style={{ padding: 6, marginLeft: 4 }}>
                  <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      )}

      {/* ════ Collect Fee Modal — Premium ════ */}
      <Modal visible={showCollectModal} animationType="slide" transparent>
        <View style={mo.overlay}>
          <View style={[mo.sheet, { backgroundColor: colors.background }]}>
            {/* Gradient header */}
            <View style={{ backgroundColor: colors.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' }}>Fee Collection</Text>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 }}>{collectStudent?.name ?? ''}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>{collectStudent?.class} • Roll {collectStudent?.rollNumber}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCollectModal(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="x" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
              {collectStudent && (() => {
                const fi = getStudentFeeInfo(collectStudent, feeRecords);
                if (fi.annualFee <= 0) return null;
                return (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[
                      { label: 'Payable', value: `₹${fi.finalPayable.toLocaleString('en-IN')}`, bg: 'rgba(255,255,255,0.15)' },
                      { label: 'Paid', value: `₹${fi.totalPaid.toLocaleString('en-IN')}`, bg: 'rgba(255,255,255,0.15)' },
                      { label: 'Balance Due', value: `₹${fi.remaining.toLocaleString('en-IN')}`, bg: fi.remaining > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)' },
                    ].map(item => (
                      <View key={item.label} style={{ flex: 1, backgroundColor: item.bg, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 }}>{item.label}</Text>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 3 }}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>

            <ScrollView style={{ flex: 1, padding: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Fee Type */}
              <Text style={[mo.label, { color: colors.text }]}>Fee Type *</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: collectFeeTypeId ? colors.primary + '60' : colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}
                onPress={() => setShowFeeTypePicker(true)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="tag" size={14} color={colors.primary} />
                  </View>
                  <Text style={{ color: collectFeeTypeId ? colors.text : colors.mutedForeground, fontSize: 15, fontWeight: collectFeeTypeId ? '600' : '400' }}>
                    {collectFeeTypeId ? feeTypes.find(f => f.id === collectFeeTypeId)?.name : 'Select a fee type...'}
                  </Text>
                </View>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>

              {/* Amount */}
              <Text style={[mo.label, { color: colors.text }]}>Amount (₹) *</Text>
              <View style={{ backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary, marginRight: 8 }}>₹</Text>
                <TextInput
                  style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: '700', paddingVertical: 14 }}
                  value={collectAmount}
                  onChangeText={setCollectAmount}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </View>

              {/* Description */}
              <Text style={[mo.label, { color: colors.text }]}>Description *</Text>
              <TextInput
                style={{ backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text, marginBottom: 16 }}
                value={collectDesc}
                onChangeText={setCollectDesc}
                placeholder="e.g. Monthly Fee July 2026"
                placeholderTextColor={colors.mutedForeground}
              />

              {/* Date */}
              <Text style={[mo.label, { color: colors.text }]}>Date</Text>
              <TextInput
                style={{ backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text, marginBottom: 16 }}
                value={collectDate}
                onChangeText={setCollectDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
              />

              {/* Payment Method */}
              <Text style={[mo.label, { color: colors.text }]}>Payment Method</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {PAYMENT_METHODS.map(pm => (
                  <TouchableOpacity
                    key={pm.value}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: collectPaymentMethod === pm.value ? colors.primary : colors.border, backgroundColor: collectPaymentMethod === pm.value ? colors.primary + '12' : colors.card, shadowColor: collectPaymentMethod === pm.value ? colors.primary : 'transparent', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: collectPaymentMethod === pm.value ? 2 : 0 }}
                    onPress={() => setCollectPaymentMethod(pm.value)}
                  >
                    <Feather name={pm.icon} size={14} color={collectPaymentMethod === pm.value ? colors.primary : colors.mutedForeground} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: collectPaymentMethod === pm.value ? colors.primary : colors.text }}>{pm.value}</Text>
                  </TouchableOpacity>
                ))}
              </View>

            </ScrollView>

            {/* Footer */}
            <View style={{ padding: 16, paddingBottom: 20, borderTopWidth: 1, borderTopColor: colors.border, gap: 10, backgroundColor: colors.card }}>
              {(() => {
                const amt = Number(collectAmount) || 0;
                return (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: collectFeeTypeId && amt > 0 ? colors.success : colors.muted, borderRadius: 16, paddingVertical: 16, shadowColor: colors.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: collectFeeTypeId && amt > 0 ? 0.3 : 0, shadowRadius: 12, elevation: collectFeeTypeId && amt > 0 ? 4 : 0 }}
                    onPress={handleCollect}
                    disabled={!collectFeeTypeId || amt <= 0}
                    activeOpacity={0.85}
                  >
                    <Feather name="check-circle" size={18} color={collectFeeTypeId && amt > 0 ? '#fff' : colors.mutedForeground} />
                    <Text style={{ color: collectFeeTypeId && amt > 0 ? '#fff' : colors.mutedForeground, fontSize: 16, fontWeight: '800' }}>
                      Collect ₹{amt > 0 ? amt.toLocaleString('en-IN') : '0'}
                    </Text>
                  </TouchableOpacity>
                );
              })()}
              <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 8 }} onPress={() => setShowCollectModal(false)}>
                <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════ Fee Type Picker Modal ════ */}
      <Modal visible={showFeeTypePicker} animationType="slide" transparent>
        <View style={mo.overlay}>
          <View style={[mo.sheet, { backgroundColor: colors.card, maxHeight: 420 }]}>
            <View style={[mo.header, { borderBottomColor: colors.border }]}>
              <Text style={[mo.title, { color: colors.text }]}>Select Fee Type</Text>
              <TouchableOpacity onPress={() => setShowFeeTypePicker(false)}><Feather name="x" size={24} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <ScrollView>
              {feeTypes.map(ft => (
                <TouchableOpacity key={ft.id} style={[picker.row, { borderBottomColor: colors.border }]} onPress={() => selectFeeType(ft)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[picker.name, { color: colors.text }]}>{ft.name}</Text>
                    {ft.description ? <Text style={[picker.desc, { color: colors.mutedForeground }]}>{ft.description}</Text> : null}
                  </View>
                  <Text style={[picker.amount, { color: ft.amount > 0 ? colors.success : colors.mutedForeground }]}>{ft.amount > 0 ? `₹${ft.amount.toLocaleString('en-IN')}` : 'Variable'}</Text>
                  {collectFeeTypeId === ft.id && <Feather name="check" size={18} color={colors.primary} style={{ marginLeft: 8 }} />}
                </TouchableOpacity>
              ))}
              {feeTypes.length === 0 && <Text style={{ color: colors.mutedForeground, textAlign: 'center', padding: 20 }}>No fee types created yet</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════ Fee History Modal ════ */}
      <Modal visible={!!showFeeHistory} animationType="slide" transparent>
        <View style={mo.overlay}>
          <View style={[mo.sheet, { backgroundColor: colors.card }]}>
            <View style={[mo.header, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[mo.title, { color: colors.text }]}>{showFeeHistory?.name}</Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Fee Payment History</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFeeHistory(null)}><Feather name="x" size={24} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            {showFeeHistory && (() => {
              const records = feeRecords.filter(f => f.studentId === showFeeHistory.id).sort((a, b) => b.date.localeCompare(a.date));
              const fi = getStudentFeeInfo(showFeeHistory, feeRecords);
              const STATUS_COLORS: Record<string, string> = { paid: colors.success, partial: colors.warning, pending: colors.destructive, 'no-fee': colors.mutedForeground };
              const STATUS_LABELS: Record<string, string> = { paid: 'Fully Paid', partial: 'Partial', pending: 'Pending', 'no-fee': 'No Fee Set' };
              return (
                <>
                  {fi.annualFee > 0 ? (
                    <View style={{ backgroundColor: colors.muted, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      {[
                        { label: 'Annual Fee', value: `₹${fi.annualFee.toLocaleString('en-IN')}`, color: colors.text },
                        { label: `Discount`, value: `− ₹${fi.discountAmount.toLocaleString('en-IN')}`, color: colors.warning },
                        { label: 'Final Payable', value: `₹${fi.finalPayable.toLocaleString('en-IN')}`, color: colors.text, bold: true },
                        { label: 'Total Paid', value: `₹${fi.totalPaid.toLocaleString('en-IN')}`, color: colors.success, bold: true },
                        { label: 'Balance', value: `₹${fi.remaining.toLocaleString('en-IN')}`, color: fi.remaining > 0 ? colors.destructive : colors.success, bold: true },
                      ].map(row => (
                        <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border + '60' }}>
                          <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{row.label}</Text>
                          <Text style={{ fontSize: 14, fontWeight: row.bold ? '700' : '500', color: row.color }}>{row.value}</Text>
                        </View>
                      ))}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 9 }}>
                        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Status</Text>
                        <View style={{ backgroundColor: STATUS_COLORS[fi.status] + '20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: STATUS_COLORS[fi.status] }}>{STATUS_LABELS[fi.status]}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                  <View style={[hist.totalRow, { backgroundColor: colors.success + '15', borderBottomColor: colors.border }]}>
                    <Text style={[hist.totalLabel, { color: colors.mutedForeground }]}>Total Collected</Text>
                    <Text style={[hist.totalVal, { color: colors.success }]}>₹{fi.totalPaid.toLocaleString('en-IN')}</Text>
                  </View>
                  )}
                  <ScrollView style={{ padding: 16 }} contentContainerStyle={{ paddingBottom: 20 }}>
                    {records.length === 0 && <Text style={{ color: colors.mutedForeground, textAlign: 'center', padding: 20 }}>No fee records found</Text>}
                    {records.map(f => (
                      <View key={f.id} style={[hist.row, { borderBottomColor: colors.border }]}>
                        <View style={[hist.icon, { backgroundColor: colors.success + '15' }]}>
                          <Feather name="check-circle" size={16} color={colors.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[hist.desc, { color: colors.text }]}>{f.description}</Text>
                          <Text style={[hist.meta, { color: colors.mutedForeground }]}>{f.date} • By {f.collectedBy}{f.paymentMethod ? ` • ${f.paymentMethod}` : ''}</Text>
                          {f.receiptNumber && <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>Receipt: {f.receiptNumber}</Text>}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[hist.amount, { color: colors.success }]}>₹{f.amount.toLocaleString('en-IN')}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <TouchableOpacity onPress={() => shareReceiptWhatsApp(f, showFeeHistory)}>
                              <FontAwesome5 name="whatsapp" size={20} color="#25D366" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => printFeeReceipt(f, showFeeHistory)}>
                              <Feather name="printer" size={15} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => confirmDeleteFee(f.id, f.description)}>
                              <Feather name="trash-2" size={15} color={colors.destructive} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ════ Fee Type Add/Edit Modal ════ */}
      <Modal visible={showFeeTypeModal} animationType="slide" transparent>
        <View style={mo.overlay}>
          <View style={[mo.sheet, { backgroundColor: colors.card }]}>
            <View style={[mo.header, { borderBottomColor: colors.border }]}>
              <Text style={[mo.title, { color: colors.text }]}>{editingFeeType ? 'Edit Fee Type' : 'Create Fee Type'}</Text>
              <TouchableOpacity onPress={() => setShowFeeTypeModal(false)}><Feather name="x" size={24} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              {([
                { key: 'name', label: 'Fee Name *', placeholder: 'e.g. Monthly Fee, Exam Fee' },
                { key: 'amount', label: 'Default Amount (₹)', placeholder: 'Optional – enter when collecting', keyboard: 'number-pad' as const },
                { key: 'description', label: 'Description', placeholder: 'Brief description (optional)' },
              ] as { key: keyof typeof ftForm; label: string; placeholder: string; keyboard?: any }[]).map(f => (
                <View key={f.key} style={{ marginBottom: 16 }}>
                  <Text style={[mo.label, { color: colors.text }]}>{f.label}</Text>
                  <TextInput style={[mo.input, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border }]} value={ftForm[f.key]} onChangeText={v => setFtForm(p => ({ ...p, [f.key]: v }))} placeholder={f.placeholder} placeholderTextColor={colors.mutedForeground} keyboardType={f.keyboard} />
                </View>
              ))}
            </ScrollView>
            <View style={[mo.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[mo.btn, { borderColor: colors.border }]} onPress={() => setShowFeeTypeModal(false)}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[mo.btn, { flex: 2, backgroundColor: colors.primary }]} onPress={handleSaveFeeType}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{editingFeeType ? 'Save Changes' : 'Create Fee Type'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════ Add Expense Modal ════ */}
      <Modal visible={showExpenseModal} animationType="slide" transparent>
        <View style={mo.overlay}>
          <View style={[mo.sheet, { backgroundColor: colors.card }]}>
            <View style={[mo.header, { borderBottomColor: colors.border }]}>
              <Text style={[mo.title, { color: colors.text }]}>Add Expense</Text>
              <TouchableOpacity onPress={() => setShowExpenseModal(false)}><Feather name="x" size={24} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              {([
                { key: 'description', label: 'Description *', placeholder: 'e.g. Electricity Bill' },
                { key: 'amount', label: 'Amount (₹) *', placeholder: 'Enter amount', keyboard: 'number-pad' as const },
                { key: 'date', label: 'Date', placeholder: 'YYYY-MM-DD' },
              ] as { key: keyof typeof expForm; label: string; placeholder: string; keyboard?: any }[]).map(f => (
                <View key={f.key} style={{ marginBottom: 16 }}>
                  <Text style={[mo.label, { color: colors.text }]}>{f.label}</Text>
                  <TextInput style={[mo.input, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border }]} value={expForm[f.key]} onChangeText={v => setExpForm(p => ({ ...p, [f.key]: v }))} placeholder={f.placeholder} placeholderTextColor={colors.mutedForeground} keyboardType={f.keyboard} />
                </View>
              ))}
              <View style={{ marginBottom: 16 }}>
                <Text style={[mo.label, { color: colors.text }]}>Category</Text>
                <TouchableOpacity style={[mo.input, { backgroundColor: colors.muted, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setShowCatPicker(true)}>
                  <Text style={{ color: colors.text }}>{expForm.category}</Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={[mo.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[mo.btn, { borderColor: colors.border }]} onPress={() => setShowExpenseModal(false)}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[mo.btn, { flex: 2, backgroundColor: colors.destructive }]} onPress={handleAddExpense}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Add Expense</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Picker */}
      <Modal visible={showCatPicker} animationType="slide" transparent>
        <View style={mo.overlay}>
          <View style={[mo.sheet, { backgroundColor: colors.card, maxHeight: 400 }]}>
            <View style={[mo.header, { borderBottomColor: colors.border }]}>
              <Text style={[mo.title, { color: colors.text }]}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCatPicker(false)}><Feather name="x" size={24} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            {EXPENSE_CATEGORIES.map(cat => (
              <TouchableOpacity key={cat} style={[picker.row, { borderBottomColor: colors.border }]} onPress={() => { setExpForm(p => ({ ...p, category: cat })); setShowCatPicker(false); }}>
                <Text style={[picker.name, { color: expForm.category === cat ? colors.primary : colors.text }]}>{cat}</Text>
                {expForm.category === cat && <Feather name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ════ Confirm Delete Modal ════ */}
      <Modal visible={!!confirmModal} animationType="fade" transparent>
        <View style={cd.overlay}>
          <View style={[cd.box, { backgroundColor: colors.card }]}>
            <View style={cd.iconWrap}>
              <Feather name="trash-2" size={28} color={colors.destructive} />
            </View>
            <Text style={[cd.title, { color: colors.text }]}>{confirmModal?.title}</Text>
            <Text style={[cd.message, { color: colors.mutedForeground }]}>{confirmModal?.message}</Text>
            <View style={cd.btnRow}>
              <TouchableOpacity
                style={[cd.btn, { borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => setConfirmModal(null)}
                activeOpacity={0.8}
              >
                <Text style={[cd.btnTxt, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cd.btn, { backgroundColor: colors.destructive }]}
                onPress={() => { confirmModal?.onConfirm(); setConfirmModal(null); }}
                activeOpacity={0.8}
              >
                <Feather name="trash-2" size={15} color="#fff" />
                <Text style={[cd.btnTxt, { color: '#fff' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════ Fee Reminder Modal ════ */}
      <Modal visible={showReminderModal} animationType="slide" transparent>
        <View style={mo.overlay}>
          <View style={[mo.sheet, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={[mo.header, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FF980020', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="bell" size={18} color="#FF9800" />
                </View>
                <View>
                  <Text style={[mo.title, { color: colors.text }]}>Send Fee Reminder</Text>
                  {reminderStudent && <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{reminderStudent.name} • {reminderStudent.class}</Text>}
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowReminderModal(false)}><Feather name="x" size={24} color={colors.mutedForeground} /></TouchableOpacity>
            </View>

            {/* Card preview */}
            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {reminderStudent && (
                <>
                  {!reminderStudent.mobileNumber && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.destructive + '12', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: colors.destructive + '40' }}>
                      <Feather name="alert-circle" size={14} color={colors.destructive} />
                      <Text style={{ fontSize: 12, color: colors.destructive, flex: 1 }}>No mobile number on record for this student.</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mutedForeground, letterSpacing: 0.6, marginBottom: 10 }}>REMINDER CARD PREVIEW</Text>
                  <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.95 }}>
                    <ReminderCard
                      studentName={reminderStudent.name}
                      studentClass={reminderStudent.class}
                      rollNumber={reminderStudent.rollNumber}
                      fatherName={reminderStudent.fatherName}
                      dueAmount={getStudentFeeInfo(reminderStudent, feeRecords).remaining}
                    />
                  </ViewShot>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>
                    This card will be shared as an image on WhatsApp
                  </Text>
                </>
              )}
            </ScrollView>

            {/* Action buttons */}
            <View style={[mo.footer, { borderTopColor: colors.border, flexDirection: 'column', gap: 10, alignItems: 'stretch' }]}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14 }}
                  onPress={async () => {
                    if (!reminderStudent || !viewShotRef.current) return;
                    try {
                      const uri: string = await viewShotRef.current.capture();
                      await shareReminderImage(uri, reminderStudent);
                    } catch {
                      Alert.alert('Error', 'Could not generate reminder card. Please try SMS.');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <FontAwesome5 name="whatsapp" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Share Image</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14 }}
                  onPress={async () => { if (reminderStudent) await sendReminderSMS(reminderStudent, reminderMessage); }}
                  activeOpacity={0.8}
                >
                  <Feather name="message-square" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>SMS</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => setShowReminderModal(false)} activeOpacity={0.8}>
                <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════ Receipt Prompt Modal ════ */}
      <Modal visible={!!receiptModal} animationType="fade" transparent>
        <View style={cd.overlay}>
          <View style={[cd.box, { backgroundColor: colors.card }]}>
            <View style={[cd.iconWrap, { backgroundColor: colors.success + '18' }]}>
              <Feather name="check-circle" size={28} color={colors.success} />
            </View>
            <Text style={[cd.title, { color: colors.text }]}>Fee Collected!</Text>
            <Text style={[cd.message, { color: colors.mutedForeground }]}>
              ₹{receiptModal?.record?.amount?.toLocaleString('en-IN')} collected.{'\n'}Send receipt to parent?
            </Text>
            <View style={[cd.btnRow, { flexDirection: 'column', gap: 10 }]}>
              <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                <TouchableOpacity
                  style={[cd.btn, { flex: 1, backgroundColor: '#25D366' }]}
                  onPress={() => {
                    if (receiptModal) shareReceiptWhatsApp(receiptModal.record, receiptModal.student);
                    setReceiptModal(null);
                  }}
                  activeOpacity={0.8}
                >
                  <FontAwesome5 name="whatsapp" size={20} color="#fff" />
                  <Text style={[cd.btnTxt, { color: '#fff' }]}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[cd.btn, { flex: 1, backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (receiptModal) printFeeReceipt(receiptModal.record, receiptModal.student);
                    setReceiptModal(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name="printer" size={15} color="#fff" />
                  <Text style={[cd.btnTxt, { color: '#fff' }]}>Print PDF</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[cd.btn, { width: '100%', borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => setReceiptModal(null)}
                activeOpacity={0.8}
              >
                <Text style={[cd.btnTxt, { color: colors.mutedForeground }]}>Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const fc = StyleSheet.create({
  card: { borderRadius: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  total: { fontSize: 16, fontWeight: '700' },
  collectBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  collectText: { fontSize: 12, fontWeight: '600' },
  remindBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 16 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  feeStrip: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1 },
  histBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  histText: { fontSize: 13, fontWeight: '500' },
});
const ftc = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  name: { fontSize: 15, fontWeight: '600' },
  desc: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700' },
  iconBtn: { padding: 6 },
});
const ec = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  desc: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700' },
});
const mo = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', minHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  stuBadge: { flexDirection: 'row', alignItems: 'center', padding: 14, marginHorizontal: 20, marginTop: 20, borderRadius: 14, gap: 12 },
  stuAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  footer: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 14 },
});
const picker = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  name: { fontSize: 15, fontWeight: '500' },
  desc: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
});
const hist = StyleSheet.create({
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  totalLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  totalVal: { fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  desc: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
});
const cd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  box: {
    width: '100%', maxWidth: 340, borderRadius: 20, padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  iconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 12, paddingVertical: 13,
  },
  btnTxt: { fontSize: 14, fontWeight: '700' },
});

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  summary: { flexDirection: 'row', padding: 16, gap: 10, borderBottomWidth: 1 },
  sumCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  sumVal: { fontSize: 16, fontWeight: '700' },
  sumLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, borderStyle: 'dashed' },
  addBtnText: { fontWeight: '600', fontSize: 14 },
});