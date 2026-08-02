import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ScrollView, Platform, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import EmptyState from '@/components/EmptyState';

type ReportMode = 'daily' | 'monthly' | 'class' | 'student';

export default function AttendanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { attendanceRecords, students, classes } = useApp();

  const [mode, setMode] = useState<ReportMode>('daily');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterClass, setFilterClass] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'leave'>('all');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchStudent, setSearchStudent] = useState('');

  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const getFilteredRecords = () => {
    let records = attendanceRecords;

    if (mode === 'daily') {
      records = records.filter(r => r.date === filterDate);
      if (filterClass !== 'All') records = records.filter(r => r.class === filterClass);
      if (filterStatus !== 'all') records = records.filter(r => r.status === filterStatus);
    } else if (mode === 'monthly') {
      records = records.filter(r => r.date.startsWith(filterMonth));
      if (filterClass !== 'All') records = records.filter(r => r.class === filterClass);
    } else if (mode === 'class') {
      records = records.filter(r => r.class === filterClass);
      if (filterMonth) records = records.filter(r => r.date.startsWith(filterMonth));
    } else if (mode === 'student') {
      if (searchStudent) {
        records = records.filter(r => r.studentName.toLowerCase().includes(searchStudent.toLowerCase()));
      }
    }

    return records;
  };

  const records = getFilteredRecords();
  const total = records.length;
  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const leaveCount = records.filter(r => r.status === 'leave').length;

  const presentPct = total > 0 ? Math.round((presentCount / total) * 100) : 0;
  const absentPct = total > 0 ? Math.round((absentCount / total) * 100) : 0;
  const leavePct = total > 0 ? Math.round((leaveCount / total) * 100) : 0;

  const s = styles(colors);
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 80;

  const renderDailyReport = () => (
    <FlatList
      data={records}
      keyExtractor={i => i.id}
      contentContainerStyle={{ padding: 16, paddingBottom: botPad, flexGrow: 1 }}
      ListEmptyComponent={<EmptyState icon="calendar" title="No Records" subtitle="No attendance taken for this date." />}
      renderItem={({ item: r }) => (
        <View style={[c.card, { backgroundColor: colors.card, borderLeftColor: r.status === 'present' ? colors.success : r.status === 'absent' ? colors.destructive : colors.warning, borderLeftWidth: 4 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[c.name, { color: colors.text }]}>{r.studentName}</Text>
            <Text style={[c.sub, { color: colors.mutedForeground }]}>{r.class} • Taken by {r.takenBy}</Text>
          </View>
          <View style={[c.badge, { backgroundColor: r.status === 'present' ? colors.success + '20' : r.status === 'absent' ? colors.destructive + '20' : colors.warning + '20' }]}>
            <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'capitalize', color: r.status === 'present' ? colors.success : r.status === 'absent' ? colors.destructive : colors.warning }}>
              {r.status}
            </Text>
          </View>
        </View>
      )}
    />
  );

  const renderStudentWiseReport = () => {
    // Group records by student
    const studentStats: Record<string, { id: string; name: string; cls: string; present: number; absent: number; leave: number; total: number }> = {};
    records.forEach(r => {
      if (!studentStats[r.studentId]) {
        studentStats[r.studentId] = { id: r.studentId, name: r.studentName, cls: r.class, present: 0, absent: 0, leave: 0, total: 0 };
      }
      studentStats[r.studentId][r.status]++;
      studentStats[r.studentId].total++;
    });

    const data = Object.values(studentStats).sort((a, b) => a.name.localeCompare(b.name));

    return (
      <FlatList
        data={data}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: botPad, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState icon="users" title="No Students" subtitle="Adjust filters or search" />}
        renderItem={({ item: stat }) => {
          const pct = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0;
          return (
            <View style={[c.card, { backgroundColor: colors.card }]}>
              <View style={{ flex: 1 }}>
                <Text style={[c.name, { color: colors.text }]}>{stat.name}</Text>
                <Text style={[c.sub, { color: colors.mutedForeground }]}>{stat.cls} • {stat.total} Days Total</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: pct >= 75 ? colors.success : pct >= 50 ? colors.warning : colors.destructive }}>
                  {pct}%
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>P: {stat.present} | A: {stat.absent}</Text>
              </View>
            </View>
          );
        }}
      />
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Modes Segmented Control */}
      <View style={[s.segmentContainer, { backgroundColor: colors.card }]}>
        {(['daily', 'monthly', 'class', 'student'] as ReportMode[]).map(m => (
          <TouchableOpacity key={m} style={[s.segmentBtn, mode === m && { backgroundColor: colors.primary }]} onPress={() => setMode(m)} activeOpacity={0.8}>
            <Text style={[s.segmentText, { color: mode === m ? '#fff' : colors.text, textTransform: 'capitalize' }]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filters */}
      <View style={[s.filters, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {mode === 'daily' && (
          <View style={s.filterRow}>
            <View style={s.filterWrap}>
              <Text style={[s.filterLabel, { color: colors.mutedForeground }]}>Date</Text>
              <TextInput style={[s.filterInput, { backgroundColor: colors.muted, color: colors.text }]} value={filterDate} onChangeText={setFilterDate} placeholder="YYYY-MM-DD" />
            </View>
            <TouchableOpacity style={[s.filterWrap, s.pickerBtn, { backgroundColor: colors.muted }]} onPress={() => setShowClassPicker(true)}>
              <Text style={[s.filterLabel, { color: colors.mutedForeground }]}>Class</Text>
              <Text style={{ color: colors.text, fontWeight: '500' }}>{filterClass}</Text>
            </TouchableOpacity>
          </View>
        )}
        {mode === 'monthly' && (
          <View style={s.filterRow}>
            <View style={s.filterWrap}>
              <Text style={[s.filterLabel, { color: colors.mutedForeground }]}>Month</Text>
              <TextInput style={[s.filterInput, { backgroundColor: colors.muted, color: colors.text }]} value={filterMonth} onChangeText={setFilterMonth} placeholder="YYYY-MM" />
            </View>
            <TouchableOpacity style={[s.filterWrap, s.pickerBtn, { backgroundColor: colors.muted }]} onPress={() => setShowClassPicker(true)}>
              <Text style={[s.filterLabel, { color: colors.mutedForeground }]}>Class</Text>
              <Text style={{ color: colors.text, fontWeight: '500' }}>{filterClass}</Text>
            </TouchableOpacity>
          </View>
        )}
        {mode === 'class' && (
          <View style={s.filterRow}>
             <TouchableOpacity style={[s.filterWrap, s.pickerBtn, { backgroundColor: colors.muted }]} onPress={() => setShowClassPicker(true)}>
              <Text style={[s.filterLabel, { color: colors.mutedForeground }]}>Class</Text>
              <Text style={{ color: colors.text, fontWeight: '500' }}>{filterClass}</Text>
            </TouchableOpacity>
            <View style={s.filterWrap}>
              <Text style={[s.filterLabel, { color: colors.mutedForeground }]}>Month (Optional)</Text>
              <TextInput style={[s.filterInput, { backgroundColor: colors.muted, color: colors.text }]} value={filterMonth} onChangeText={setFilterMonth} placeholder="YYYY-MM" />
            </View>
          </View>
        )}
        {mode === 'student' && (
          <View style={s.filterRow}>
            <View style={s.filterWrap}>
              <Text style={[s.filterLabel, { color: colors.mutedForeground }]}>Student Name</Text>
              <TextInput style={[s.filterInput, { backgroundColor: colors.muted, color: colors.text }]} value={searchStudent} onChangeText={setSearchStudent} placeholder="Search..." />
            </View>
          </View>
        )}
      </View>

      {/* Summary Cards */}
      <View style={s.summaryCards}>
        {[
          { label: 'Total Records', val: total, color: colors.primary },
          { label: 'Present', val: `${presentPct}%`, count: presentCount, color: colors.success },
          { label: 'Absent', val: `${absentPct}%`, count: absentCount, color: colors.destructive },
          { label: 'Leave', val: `${leavePct}%`, count: leaveCount, color: colors.warning },
        ].map(st => (
          <View key={st.label} style={[s.sumCard, { backgroundColor: st.color + '15' }]}>
            <Text style={[s.sumVal, { color: st.color }]}>{st.val}</Text>
            <Text style={[s.sumLabel, { color: st.color }]}>{st.label}</Text>
            {st.count !== undefined && <Text style={[s.sumCount, { color: st.color }]}>({st.count})</Text>}
          </View>
        ))}
      </View>

      {mode === 'daily' ? renderDailyReport() : renderStudentWiseReport()}

      {/* Class Picker */}
      <Modal visible={showClassPicker} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={[m.sheet, { backgroundColor: colors.card, maxHeight: 400 }]}>
            <View style={[m.header, { borderBottomColor: colors.border }]}>
              <Text style={[m.title, { color: colors.text }]}>Select Class</Text>
              <TouchableOpacity onPress={() => setShowClassPicker(false)}><Feather name="x" size={24} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <ScrollView>
              {['All', ...classes].map(cls => (
                <TouchableOpacity key={cls} style={[m.option, { borderBottomColor: colors.border }]} onPress={() => { setFilterClass(cls); setShowClassPicker(false); }}>
                  <Text style={[m.optionText, { color: filterClass === cls ? colors.primary : colors.text }]}>{cls}</Text>
                  {filterClass === cls && <Feather name="check" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const c = StyleSheet.create({
  card: { padding: 16, borderRadius: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  name: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  sub: { fontSize: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  optionText: { fontSize: 15 },
});

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  segmentContainer: { flexDirection: 'row', margin: 16, borderRadius: 12, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentText: { fontSize: 13, fontWeight: '600' },
  filters: { padding: 16, borderBottomWidth: 1, paddingTop: 0 },
  filterRow: { flexDirection: 'row', gap: 12 },
  filterWrap: { flex: 1 },
  filterLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterInput: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, fontSize: 14 },
  pickerBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, justifyContent: 'center' },
  summaryCards: { flexDirection: 'row', padding: 16, gap: 10, flexWrap: 'wrap' },
  sumCard: { flex: 1, minWidth: '22%', borderRadius: 12, padding: 12, alignItems: 'center' },
  sumVal: { fontSize: 18, fontWeight: '700' },
  sumLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  sumCount: { fontSize: 10, marginTop: 2, opacity: 0.8 },
});