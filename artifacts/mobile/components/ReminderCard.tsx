import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SCHOOL_INFO } from '@/constants/schoolInfo';

interface Props {
  studentName: string;
  studentClass: string;
  rollNumber?: string;
  fatherName?: string;
  admissionNo?: string;
  dueAmount: number;
  date?: string;
  type?: 'fee' | 'exam' | 'attendance' | 'general';
  customNote?: string;
}

const TYPE_CONFIG = {
  fee:        { label: '⚠  FEE REMINDER',       accent: '#C62828', sub: '#EF5350' },
  exam:       { label: '📋  EXAM NOTICE',         accent: '#4527A0', sub: '#7E57C2' },
  attendance: { label: '📅  ATTENDANCE ALERT',    accent: '#C62828', sub: '#EF5350' },
  general:    { label: '📢  SCHOOL NOTICE',       accent: '#1565C0', sub: '#42A5F5' },
};

export default function ReminderCard({
  studentName,
  studentClass,
  rollNumber,
  fatherName,
  admissionNo,
  dueAmount,
  date,
  type = 'fee',
  customNote,
}: Props) {
  const displayDate = date ?? new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const cfg = TYPE_CONFIG[type];

  return (
    <View style={s.card}>

      {/* ══ HEADER ══ */}
      <View style={s.header}>
        {/* Decorative top stripe */}
        <View style={[s.topStripe, { backgroundColor: cfg.sub }]} />

        <View style={s.headerContent}>
          {/* Logo badge */}
          <View style={s.logoBadge}>
            <Text style={s.logoTop}>DR.</Text>
            <Text style={s.logoMiddle}>APJ</Text>
            <Text style={s.logoBottom}>AKJ</Text>
          </View>

          {/* School info */}
          <View style={s.schoolInfo}>
            <Text style={s.schoolName} numberOfLines={2}>{SCHOOL_INFO.name}</Text>
            <View style={s.schoolMeta}>
              <Text style={s.schoolMetaText}>📍 {SCHOOL_INFO.address}</Text>
              <Text style={s.schoolMetaText}>📞 {SCHOOL_INFO.contact}</Text>
            </View>
          </View>
        </View>

        {/* Date strip */}
        <View style={s.dateBadge}>
          <Text style={s.dateText}>{displayDate}</Text>
        </View>
      </View>

      {/* ══ TYPE BANNER ══ */}
      <View style={[s.banner, { backgroundColor: cfg.accent }]}>
        <Text style={s.bannerText}>{cfg.label}</Text>
        <View style={s.bannerDots}>
          {[0,1,2,3,4].map(i => <View key={i} style={s.dot} />)}
        </View>
      </View>

      {/* ══ BODY ══ */}
      <View style={s.body}>
        <Text style={s.salutation}>Dear Parent / Guardian,</Text>
        <Text style={s.bodyIntro}>
          This is an official communication from{' '}
          <Text style={s.bodyBold}>{SCHOOL_INFO.name}</Text> regarding your ward.
        </Text>

        {/* Student details box */}
        <View style={[s.studentBox, { borderLeftColor: cfg.accent }]}>
          <View style={[s.avatarRing, { borderColor: cfg.accent }]}>
            <View style={[s.avatar, { backgroundColor: cfg.accent }]}>
              <Text style={s.avatarText}>{studentName.charAt(0).toUpperCase()}</Text>
            </View>
          </View>
          <View style={s.studentDetails}>
            <Text style={s.studentName}>{studentName}</Text>
            <View style={s.studentMeta}>
              <View style={s.metaChip}>
                <Text style={s.metaChipText}>🏫 {studentClass}</Text>
              </View>
              {rollNumber ? (
                <View style={s.metaChip}>
                  <Text style={s.metaChipText}>📋 Roll {rollNumber}</Text>
                </View>
              ) : null}
            </View>
            {fatherName ? <Text style={s.fatherName}>S/O: {fatherName}</Text> : null}
            {admissionNo ? <Text style={s.fatherName}>Adm No: {admissionNo}</Text> : null}
          </View>
        </View>

        {/* Amount box — only for fee type */}
        {type === 'fee' && (
          <View style={s.amountSection}>
            <Text style={s.amountLabel}>OUTSTANDING DUES</Text>
            <View style={s.amountDivider} />
            {dueAmount > 0 ? (
              <>
                <Text style={s.amountCurrency}>₹</Text>
                <Text style={s.amountValue}>{dueAmount.toLocaleString('en-IN')}</Text>
                <Text style={s.amountNote}>Please clear at the earliest</Text>
              </>
            ) : (
              <Text style={s.amountVerify}>Kindly verify at the school office</Text>
            )}
          </View>
        )}

        {/* Custom note */}
        {customNote ? (
          <View style={s.noteBox}>
            <Text style={s.noteLabel}>📝 MESSAGE</Text>
            <Text style={s.noteText}>{customNote}</Text>
          </View>
        ) : null}

        {/* Notice text */}
        <View style={[s.noticeBox, { borderColor: cfg.accent + '40', backgroundColor: cfg.accent + '08' }]}>
          <Text style={[s.noticeText, { color: cfg.accent }]}>
            {type === 'fee'
              ? 'Please clear the pending school fees at the earliest to avoid any inconvenience.'
              : type === 'exam'
              ? 'Ensure your ward revises all subjects and carries their admit card on exam day.'
              : type === 'attendance'
              ? 'Regular attendance is critical. Please ensure your ward attends school regularly.'
              : 'Please contact the school office for more information.'}
          </Text>
        </View>
      </View>

      {/* ══ FOOTER ══ */}
      <View style={s.footer}>
        <View style={s.footerLeft}>
          <Text style={s.footerContactLabel}>CONTACT US</Text>
          <Text style={s.footerContact}>📞 {SCHOOL_INFO.contact}</Text>
          <Text style={s.footerContact}>✉ {SCHOOL_INFO.email}</Text>
        </View>
        <View style={[s.seal, { borderColor: cfg.accent }]}>
          <Text style={[s.sealLine1, { color: cfg.accent }]}>OFFICIAL</Text>
          <Text style={[s.sealLine2, { color: cfg.accent }]}>NOTICE</Text>
        </View>
      </View>

      {/* Bottom brand */}
      <View style={[s.brandBar, { backgroundColor: cfg.accent }]}>
        <Text style={s.brandText}>School Management System  ·  {SCHOOL_INFO.name}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },

  /* Header */
  header: { backgroundColor: '#0D1B4B', paddingBottom: 0 },
  topStripe: { height: 5 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 12 },
  logoBadge: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoTop:    { fontSize: 8,  fontWeight: '900', color: '#0D1B4B', lineHeight: 9 },
  logoMiddle: { fontSize: 16, fontWeight: '900', color: '#0D1B4B', lineHeight: 18 },
  logoBottom: { fontSize: 8,  fontWeight: '900', color: '#0D1B4B', lineHeight: 9 },
  schoolInfo: { flex: 1 },
  schoolName: { color: '#ffffff', fontSize: 12, fontWeight: '800', lineHeight: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  schoolMeta: { marginTop: 4, gap: 2 },
  schoolMetaText: { color: 'rgba(255,255,255,0.72)', fontSize: 9.5 },
  dateBadge: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 6, marginHorizontal: 16, marginBottom: 10, borderRadius: 6, alignSelf: 'flex-start' },
  dateText: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },

  /* Banner */
  banner: { paddingVertical: 11, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerText: { color: '#ffffff', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  bannerDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.4)' },

  /* Body */
  body: { backgroundColor: '#FAFBFF', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  salutation: { fontSize: 12, color: '#555', fontStyle: 'italic', marginBottom: 4 },
  bodyIntro: { fontSize: 11.5, color: '#444', lineHeight: 17, marginBottom: 14 },
  bodyBold: { fontWeight: '700', color: '#0D1B4B' },

  /* Student box */
  studentBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0F4FF', borderRadius: 12,
    padding: 12, marginBottom: 14,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  avatarRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  studentDetails: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '800', color: '#0D1B4B', marginBottom: 5 },
  studentMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 3 },
  metaChip: { backgroundColor: '#0D1B4B15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  metaChipText: { fontSize: 10, fontWeight: '700', color: '#0D1B4B' },
  fatherName: { fontSize: 10.5, color: '#666', marginTop: 2 },

  /* Amount */
  amountSection: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 14, borderWidth: 1.5, borderColor: '#FFB300', shadowColor: '#FF6F00', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  amountLabel: { fontSize: 10, fontWeight: '800', color: '#E65100', letterSpacing: 2.5, marginBottom: 6 },
  amountDivider: { width: 40, height: 1.5, backgroundColor: '#FFB300', marginBottom: 6 },
  amountCurrency: { fontSize: 16, fontWeight: '900', color: '#B71C1C', lineHeight: 20 },
  amountValue: { fontSize: 44, fontWeight: '900', color: '#B71C1C', lineHeight: 52 },
  amountNote: { fontSize: 10, color: '#B71C1C', fontStyle: 'italic', marginTop: 2 },
  amountVerify: { fontSize: 14, color: '#2E7D32', fontWeight: '700', fontStyle: 'italic' },

  /* Note box */
  noteBox: { backgroundColor: '#FFFDE7', borderRadius: 10, padding: 12, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#F9A825' },
  noteLabel: { fontSize: 9, fontWeight: '800', color: '#F57F17', letterSpacing: 1.5, marginBottom: 4 },
  noteText: { fontSize: 12, color: '#333', lineHeight: 17 },

  /* Notice */
  noticeBox: { borderRadius: 10, borderWidth: 1, padding: 10 },
  noticeText: { fontSize: 11, lineHeight: 16, textAlign: 'center', fontStyle: 'italic' },

  /* Footer */
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F7FF', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E0E4F0' },
  footerLeft: { gap: 2 },
  footerContactLabel: { fontSize: 8, fontWeight: '800', color: '#0D1B4B', letterSpacing: 1.5, marginBottom: 2 },
  footerContact: { fontSize: 10, color: '#444' },
  seal: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  sealLine1: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  sealLine2: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },

  /* Brand bar */
  brandBar: { paddingVertical: 5, alignItems: 'center' },
  brandText: { fontSize: 8, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },
});
