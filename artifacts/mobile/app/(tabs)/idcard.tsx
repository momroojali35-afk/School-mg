/**
 * Student ID Card Generator
 * Vertical & Horizontal layouts · 3 premium templates · PDF export + in-app preview
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  Alert, Platform, ActivityIndicator, TextInput, Image, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useApp, Student } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { SCHOOL_INFO } from '@/constants/schoolInfo';
import { printHtml } from '@/utils/pdfExport';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Orientation = 'vertical' | 'horizontal';
type Template = 'royal' | 'midnight' | 'aurora';
type Mode = 'individual' | 'class';

// ─── Template Palettes ─────────────────────────────────────────────────────────
const TPL = {
  royal: {
    name: 'Royal Blue', primary: '#1e3a8a', secondary: '#3b82f6',
    accent: '#F59E0B', text: '#fff', sub: 'rgba(255,255,255,0.75)',
    bg: '#EFF6FF', cardBg: '#fff',
    uiBg: ['#1e3a8a', '#3b82f6'] as [string, string],
  },
  midnight: {
    name: 'Midnight', primary: '#0f172a', secondary: '#1e293b',
    accent: '#10B981', text: '#fff', sub: 'rgba(255,255,255,0.65)',
    bg: '#F0FDF4', cardBg: '#0f172a',
    uiBg: ['#0f172a', '#1e3a5f'] as [string, string],
  },
  aurora: {
    name: 'Aurora', primary: '#6d28d9', secondary: '#0891b2',
    accent: '#F472B6', text: '#fff', sub: 'rgba(255,255,255,0.75)',
    bg: '#FAF5FF', cardBg: '#fff',
    uiBg: ['#6d28d9', '#0891b2'] as [string, string],
  },
} as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}
function getAcademicYear() {
  const y = new Date().getFullYear();
  return new Date().getMonth() >= 3 ? `${y}–${y + 1}` : `${y - 1}–${y}`;
}
function fmtDob(d: string) {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

// ─── HTML Builders ─────────────────────────────────────────────────────────────
function photoEl(student: Student, size: number, border: string): string {
  if (student.photo) {
    return `<img src="${student.photo}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:3px solid ${border};display:block;" />`;
  }
  const ini = getInitials(student.name);
  const fs = Math.round(size * 0.34);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${border};display:flex;align-items:center;justify-content:center;border:3px solid rgba(255,255,255,0.5);flex-shrink:0;">
    <span style="color:#fff;font-size:${fs}px;font-weight:900;font-family:Arial,sans-serif;">${ini}</span>
  </div>`;
}

function qrEl(student: Student, size: number, color: string, bg: string): string {
  const data = encodeURIComponent(`${student.name}|Class:${student.class}|Roll:${student.rollNumber}|Adm:${student.admissionNo ?? 'N/A'}`);
  const col = color.replace('#', '');
  const bgCol = bg.replace('#', '');
  return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&color=${col}&bgcolor=${bgCol}&data=${data}" width="${size}" height="${size}" style="border-radius:4px;display:block;" onerror="this.style.display='none'" alt="QR"/>`;
}

function buildVerticalCard(student: Student, _tpl: typeof TPL[Template]): string {
  const acYear = getAcademicYear();
  const classSection = [student.class, student.section].filter(Boolean).join(' • ');
  const fields: [string, string][] = [
    ["Father's Name", student.fatherName ?? '—'],
    ["Mother's Name", student.motherName ?? '—'],
    ['Admi. No.', student.admissionNo ?? '—'],
    ['Class', classSection || '—'],
    ['Date of Birth', fmtDob(student.dateOfBirth)],
    ['Address', student.address ?? '—'],
    ['Contact No.', student.mobileNumber ?? '—'],
  ];
  const W = 204, H_HDR = 146, PHOTO = 72, PHOTO_OFFSET = 34, SPACE = 40;
  const CREST = 42, CORNER_W = 54, CORNER_H = 28;
  return `
  <div style="width:${W}px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.22);display:inline-flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid;position:relative;">
    <!-- Header -->
    <div style="background:#165C49;height:${H_HDR}px;position:relative;overflow:hidden;flex-shrink:0;">
      <!-- Lime left chevron -->
      <svg style="position:absolute;top:0;left:0;width:100%;height:100%;" viewBox="0 0 204 ${H_HDR}" preserveAspectRatio="none">
        <polygon points="0,0 51,0 31,${H_HDR} 0,${H_HDR}" fill="#C9E840"/>
        <polygon points="0,0 35,0 16,${H_HDR} 0,${H_HDR}" fill="#B0D020" opacity="0.65"/>
        <polygon points="133,0 204,0 204,68 163,${H_HDR} 123,${H_HDR} 160,54" fill="white" opacity="0.11"/>
      </svg>
      <!-- School crest -->
      <div style="position:absolute;top:18px;left:6px;width:${CREST}px;height:${CREST}px;border-radius:50%;background:white;border:2px solid #C9E840;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.25);z-index:10;">
        <svg width="30" height="30" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="21" fill="none" stroke="#165C49" stroke-width="1.5" stroke-dasharray="3 2"/>
          <circle cx="22" cy="22" r="17" fill="#165C49"/>
          <rect x="13" y="17" width="8" height="10" rx="1.5" fill="white" opacity="0.9"/>
          <rect x="23" y="17" width="8" height="10" rx="1.5" fill="white" opacity="0.9"/>
          <rect x="21" y="16" width="2" height="12" fill="#C9E840"/>
          <polygon points="22,8 23.5,12.5 28.5,12.5 24.5,15.2 26,19.5 22,16.8 18,19.5 19.5,15.2 15.5,12.5 20.5,12.5" fill="#C9E840"/>
        </svg>
      </div>
      <!-- School name + contact -->
      <div style="position:absolute;top:12px;left:53px;right:52px;z-index:10;">
        <div style="font-size:8.5px;font-weight:900;color:#F5E233;line-height:1.25;text-shadow:0 1px 3px rgba(0,0,0,0.5);">DR. APJ ABDUL KALAM</div>
        <div style="font-size:8.5px;font-weight:900;color:#F5E233;line-height:1.25;text-shadow:0 1px 3px rgba(0,0,0,0.5);">JATIYA VIDYALAYA</div>
        <div style="font-size:5px;color:rgba(255,255,255,0.9);margin-top:4px;line-height:1.6;">Bundura Ati, Assam</div>
        <div style="font-size:4.5px;color:rgba(255,255,255,0.85);line-height:1.6;">MOB: ${SCHOOL_INFO.contact}</div>
        <div style="font-size:4.5px;color:rgba(255,255,255,0.85);line-height:1.6;">Email: ${SCHOOL_INFO.email}</div>
      </div>
      <!-- Session badge -->
      <div style="position:absolute;top:12px;right:5px;z-index:20;text-align:center;">
        <div style="background:#F5E233;border-radius:5px;padding:1px 6px;font-size:5px;font-weight:800;color:#165C49;">Session:-</div>
        <div style="background:#F5E233;border-radius:5px;padding:2px 6px;font-size:6.5px;font-weight:900;color:#165C49;margin-top:1px;">${acYear}</div>
      </div>
      <!-- Photo ring -->
      <div style="position:absolute;bottom:-${PHOTO_OFFSET}px;left:50%;transform:translateX(-50%);z-index:30;width:${PHOTO}px;height:${PHOTO}px;border-radius:50%;background:linear-gradient(135deg,#165C49 0%,#C9E840 100%);padding:3px;box-shadow:0 4px 14px rgba(0,0,0,0.3);">
        <div style="width:100%;height:100%;border-radius:50%;border:2px solid white;overflow:hidden;background:#b8ccb8;display:flex;align-items:center;justify-content:center;">
          ${student.photo
            ? `<img src="${student.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
            : `<div style="width:100%;height:100%;background:#165C49;display:flex;align-items:center;justify-content:center;border-radius:50%;"><span style="color:#fff;font-size:${Math.round(PHOTO*0.28)}px;font-weight:900;font-family:Arial;">${getInitials(student.name)}</span></div>`}
        </div>
      </div>
    </div>
    <!-- Space for photo -->
    <div style="height:${SPACE}px;background:#fff;flex-shrink:0;"></div>
    <!-- Name banner -->
    <div style="background:#165C49;padding:6px 10px;text-align:center;flex-shrink:0;">
      <span style="font-size:9px;font-weight:800;color:#fff;letter-spacing:0.8px;">${student.name}</span>
    </div>
    <!-- Details -->
    <div style="padding:8px 10px 6px;background:#fff;flex:1;">
      ${fields.map(([l, v]) => `
      <div style="display:flex;margin-bottom:4px;align-items:flex-start;">
        <span style="font-size:6px;font-weight:700;color:#111;width:58px;flex-shrink:0;line-height:1.4;">${l}</span>
        <span style="font-size:6px;color:#111;margin-right:3px;flex-shrink:0;line-height:1.4;">:</span>
        <span style="font-size:6px;color:#111;line-height:1.4;">${v}</span>
      </div>`).join('')}
    </div>
    <!-- Bottom corner triangles -->
    <div style="position:relative;height:${CORNER_H}px;background:#fff;overflow:hidden;flex-shrink:0;">
      <svg style="position:absolute;bottom:0;left:0;" width="${CORNER_W}" height="${CORNER_H}" viewBox="0 0 ${CORNER_W} ${CORNER_H}">
        <polygon points="0,${CORNER_H} ${CORNER_W},${CORNER_H} 0,0" fill="#165C49"/>
      </svg>
      <svg style="position:absolute;bottom:0;left:0;" width="${Math.round(CORNER_W*0.68)}" height="${Math.round(CORNER_H*0.71)}" viewBox="0 0 ${Math.round(CORNER_W*0.68)} ${Math.round(CORNER_H*0.71)}">
        <polygon points="0,${Math.round(CORNER_H*0.71)} ${Math.round(CORNER_W*0.68)},${Math.round(CORNER_H*0.71)} 0,0" fill="#C9E840" opacity="0.8"/>
      </svg>
      <svg style="position:absolute;bottom:0;right:0;" width="${CORNER_W}" height="${CORNER_H}" viewBox="0 0 ${CORNER_W} ${CORNER_H}">
        <polygon points="${CORNER_W},${CORNER_H} 0,${CORNER_H} ${CORNER_W},0" fill="#165C49"/>
      </svg>
      <svg style="position:absolute;bottom:0;right:0;" width="${Math.round(CORNER_W*0.68)}" height="${Math.round(CORNER_H*0.71)}" viewBox="0 0 ${Math.round(CORNER_W*0.68)} ${Math.round(CORNER_H*0.71)}">
        <polygon points="${Math.round(CORNER_W*0.68)},${Math.round(CORNER_H*0.71)} 0,${Math.round(CORNER_H*0.71)} ${Math.round(CORNER_W*0.68)},0" fill="#C9E840" opacity="0.8"/>
      </svg>
    </div>
  </div>`;
}

function buildHorizontalCard(student: Student, _tpl: typeof TPL[Template]): string {
  const acYear = getAcademicYear();
  const classSection = [student.class, student.section].filter(Boolean).join(' • ');
  const fields: [string, string][] = [
    ['Name', student.name],
    ['Class/Section', classSection || '—'],
    ["Father's Name", student.fatherName ?? '—'],
    ["Mother's Name", student.motherName ?? '—'],
    ['Date of Birth', fmtDob(student.dateOfBirth)],
    ['Address', student.address ?? '—'],
    ['Mobile No.', student.mobileNumber ?? '—'],
  ];
  const stackColors = ['#7f1d1d','#c2410c','#ec4899','#fca5a5','#cbd5e1'];
  return `
  <div style="width:320px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.22);display:inline-flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid;">
    <!-- Header -->
    <div style="background:linear-gradient(90deg,#1e3a8a 0%,#2648c0 65%,#2d55d8 100%);position:relative;height:45px;overflow:hidden;display:flex;align-items:center;gap:8px;padding:0 8px;flex-shrink:0;">
      <svg style="position:absolute;right:0;top:0;width:100px;height:45px;" viewBox="0 0 100 45" preserveAspectRatio="none">
        <polygon points="28,0 100,0 100,45 6,45" fill="#ea580c" opacity="0.95"/>
        <polygon points="44,0 100,0 100,45 22,45" fill="#f97316" opacity="0.7"/>
        <polygon points="60,0 100,0 100,45 38,45" fill="#fb923c" opacity="0.5"/>
      </svg>
      <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:#F5C518;z-index:10;"></div>
      <div style="width:33px;height:33px;border-radius:50%;background:white;border:2px solid #F5C518;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 6px rgba(0,0,0,0.3);z-index:10;flex-shrink:0;">
        <svg width="24" height="24" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="21" fill="none" stroke="#1e3a8a" stroke-width="1.5" stroke-dasharray="3 2"/>
          <circle cx="22" cy="22" r="17" fill="#1e3a8a"/>
          <rect x="13" y="16" width="7" height="10" rx="1" fill="white" opacity="0.9"/>
          <rect x="24" y="16" width="7" height="10" rx="1" fill="white" opacity="0.9"/>
          <rect x="21.5" y="15" width="2" height="12" fill="#F5C518"/>
          <polygon points="22,8 23.3,12 27.7,12 24.2,14.4 25.5,18.5 22,16 18.5,18.5 19.8,14.4 16.3,12 20.7,12" fill="#F5C518"/>
        </svg>
      </div>
      <div style="z-index:10;">
        <div style="font-size:9px;font-weight:900;color:#fff;line-height:1.2;text-shadow:0 1px 3px rgba(0,0,0,0.4);">DR. APJ ABDUL KALAM JATIYA VIDYALAYA</div>
        <div style="font-size:6px;color:rgba(255,255,255,0.85);margin-top:2px;">Session : ${acYear}</div>
      </div>
    </div>
    <!-- Identity Card title -->
    <div style="text-align:center;padding:6px 0 4px;letter-spacing:4px;font-size:7px;font-weight:800;color:#1e293b;">IDENTITY CARD</div>
    <div style="height:1px;background:#e2e8f0;margin:0 10px 6px;"></div>
    <!-- Body -->
    <div style="display:flex;padding:0 10px 8px;gap:8px;align-items:flex-start;">
      <!-- Photo + Signature -->
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:5px;">
        <div style="width:58px;height:66px;border-radius:5px;border:2px solid #1e3a8a;overflow:hidden;background:#dbeafe;display:flex;align-items:center;justify-content:center;">
          ${student.photo
            ? `<img src="${student.photo}" style="width:100%;height:100%;object-fit:cover;"/>`
            : `<div style="width:100%;height:100%;background:#93c5fd;display:flex;align-items:center;justify-content:center;"><span style="font-size:16px;font-weight:900;color:#1e3a8a;font-family:Arial;">${getInitials(student.name)}</span></div>`}
        </div>
        <div style="border-top:1px solid #94a3b8;width:55px;padding-top:3px;text-align:center;">
          <span style="font-size:6px;font-style:italic;color:#1e3a8a;font-weight:700;">Signature</span>
        </div>
      </div>
      <!-- Details -->
      <div style="flex:1;padding-top:1px;">
        ${fields.map(([l, v]) => `
        <div style="display:flex;margin-bottom:4px;align-items:flex-start;">
          <span style="font-size:6px;font-weight:800;color:#b91c1c;width:60px;flex-shrink:0;line-height:1.4;">${l}</span>
          <span style="font-size:6px;color:#1e293b;margin-right:3px;flex-shrink:0;line-height:1.4;font-weight:700;">:</span>
          <span style="font-size:6px;color:#1e293b;line-height:1.4;">${v}</span>
        </div>`).join('')}
      </div>
      <!-- Stacked shapes -->
      <div style="width:30px;flex-shrink:0;position:relative;height:90px;overflow:visible;">
        ${stackColors.map((c, i) => `<div style="position:absolute;top:${i*8}px;left:0;width:24px;height:55px;background:${c};border-radius:3px;transform:rotate(20deg);transform-origin:top left;"></div>`).join('')}
      </div>
    </div>
    <!-- Bottom stripes -->
    <div style="height:5px;background:#db2777;flex-shrink:0;"></div>
    <div style="height:5px;background:#0284c7;flex-shrink:0;"></div>
  </div>`;
}

function buildHtml(students: Student[], orientation: Orientation, template: Template): string {
  const tpl = TPL[template];
  const isVert = orientation === 'vertical';
  const cardFn = isVert ? buildVerticalCard : buildHorizontalCard;
  const colGap = isVert ? 14 : 20;
  const rowGap = isVert ? 14 : 16;
  const cols = isVert ? 3 : 2;

  const cards = students.map(s => `
    <div style="display:inline-block;vertical-align:top;">
      ${cardFn(s, tpl)}
    </div>`).join(`<div style="display:inline-block;width:${colGap}px;"></div>`);

  // Break into rows of `cols` cards
  const rows: Student[][] = [];
  for (let i = 0; i < students.length; i += cols) rows.push(students.slice(i, i + cols));

  const rowsHtml = rows.map(row => `
    <div style="display:flex;gap:${colGap}px;margin-bottom:${rowGap}px;flex-wrap:nowrap;">
      ${row.map(s => `<div style="flex-shrink:0;">${cardFn(s, tpl)}</div>`).join('')}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page { size: A4; margin: 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, 'Helvetica Neue', sans-serif; background: #f1f5f9; }
  .page { background: #f1f5f9; }
  img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  div { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>
<div class="page">
  ${rowsHtml}
</div>
</body></html>`;
}

// ─── Native Card Preview Components ───────────────────────────────────────────
const SCREEN_W = Dimensions.get('window').width;

function NativeVerticalCard({ student, tpl }: { student: Student; tpl: typeof TPL[Template] }) {
  const classSection = [student.class, student.section].filter(Boolean).join(' · ');
  const acYear = getAcademicYear();
  return (
    <View style={[nvc.card, { shadowColor: tpl.primary }]}>
      {/* Header */}
      <LinearGradient colors={[tpl.primary, tpl.secondary]} style={nvc.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={[nvc.accentBar, { backgroundColor: tpl.accent }]} />
        <Text style={nvc.cardLabel}>STUDENT ID CARD</Text>
        <Text style={nvc.schoolName} numberOfLines={2}>{SCHOOL_INFO.name}</Text>
        <Text style={nvc.yearText}>{acYear}</Text>
      </LinearGradient>
      {/* Photo */}
      <View style={nvc.photoWrap}>
        <View style={[nvc.photoRing, { borderColor: tpl.primary }]}>
          {student.photo
            ? <Image source={{ uri: student.photo }} style={nvc.photoImg} />
            : <View style={[nvc.photoFallback, { backgroundColor: tpl.primary }]}>
                <Text style={nvc.photoInitials}>{getInitials(student.name)}</Text>
              </View>}
        </View>
      </View>
      {/* Details */}
      <View style={nvc.details}>
        <Text style={[nvc.studentName, { color: tpl.primary }]} numberOfLines={1}>{student.name}</Text>
        <View style={[nvc.divider, { backgroundColor: tpl.primary + '25' }]} />
        {[
          ['Class', classSection],
          ['Roll No', student.rollNumber],
          ['Adm No', student.admissionNo ?? '—'],
          ['DOB', fmtDob(student.dateOfBirth)],
          ["Father", student.fatherName],
        ].map(([l, v]) => (
          <View key={l} style={nvc.row}>
            <Text style={nvc.rowLabel}>{l}</Text>
            <Text style={nvc.rowValue} numberOfLines={1}>{v}</Text>
          </View>
        ))}
      </View>
      {/* Footer */}
      <LinearGradient colors={[tpl.primary, tpl.secondary]} style={nvc.footer} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <View style={[nvc.qrBox, { borderColor: tpl.accent + '60' }]}>
          <Feather name="grid" size={14} color={tpl.accent} />
        </View>
        <View>
          <Text style={[nvc.validLabel, { color: tpl.accent }]}>VALID UNTIL</Text>
          <Text style={nvc.validYear}>{acYear}</Text>
          <Text style={nvc.footerContact}>{SCHOOL_INFO.contact}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const nvc = StyleSheet.create({
  card: { width: 175, borderRadius: 14, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 8 },
  header: { padding: 10, alignItems: 'center' },
  accentBar: { height: 2, width: '80%', borderRadius: 2, marginBottom: 5 },
  cardLabel: { fontSize: 6.5, fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  schoolName: { fontSize: 7, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 10 },
  yearText: { fontSize: 6, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  photoWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6, backgroundColor: '#fff' },
  photoRing: { borderRadius: 30, borderWidth: 2, padding: 2 },
  photoImg: { width: 48, height: 48, borderRadius: 24 },
  photoFallback: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  photoInitials: { fontSize: 16, fontWeight: '900', color: '#fff' },
  details: { backgroundColor: '#fff', paddingHorizontal: 10, paddingBottom: 8 },
  studentName: { fontSize: 10, fontWeight: '900', textAlign: 'center', marginBottom: 5 },
  divider: { height: 1, marginBottom: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  rowLabel: { fontSize: 6.5, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
  rowValue: { fontSize: 7, color: '#0F172A', fontWeight: '800', maxWidth: 100, textAlign: 'right' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 7 },
  qrBox: { width: 26, height: 26, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  validLabel: { fontSize: 5.5, fontWeight: '800', letterSpacing: 0.8 },
  validYear: { fontSize: 7, color: '#fff', fontWeight: '700' },
  footerContact: { fontSize: 5.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
});

function NativeHorizontalCard({ student, tpl }: { student: Student; tpl: typeof TPL[Template] }) {
  const classSection = [student.class, student.section].filter(Boolean).join(' · ');
  const acYear = getAcademicYear();
  const ini = getInitials(SCHOOL_INFO.name);
  return (
    <View style={[nhc.card, { shadowColor: tpl.primary }]}>
      {/* Left strip */}
      <LinearGradient colors={[tpl.primary, tpl.secondary]} style={nhc.strip} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
        <View style={[nhc.stripBadge, { borderColor: tpl.accent }]}>
          <Text style={[nhc.stripIni, { color: tpl.accent }]}>{ini}</Text>
        </View>
        <Text style={[nhc.stripLabel, { color: tpl.accent }]}>{'ID\nCARD'}</Text>
        <View style={[nhc.stripDot, { backgroundColor: tpl.accent }]} />
      </LinearGradient>
      {/* Body */}
      <View style={nhc.body}>
        <Text style={[nhc.schoolName, { color: tpl.primary }]} numberOfLines={2}>{SCHOOL_INFO.name}</Text>
        <View style={[nhc.accentBar, { backgroundColor: tpl.accent }]} />
        <Text style={nhc.studentName} numberOfLines={1}>{student.name}</Text>
        {[
          ['Class', classSection],
          ['Roll', student.rollNumber],
          ['Adm No', student.admissionNo ?? '—'],
          ['Father', student.fatherName],
          ['DOB', fmtDob(student.dateOfBirth)],
        ].map(([l, v]) => (
          <View key={l} style={nhc.row}>
            <Text style={nhc.rowLabel}>{l}:</Text>
            <Text style={nhc.rowValue} numberOfLines={1}>{v}</Text>
          </View>
        ))}
        <View style={[nhc.validBadge, { backgroundColor: tpl.primary }]}>
          <Text style={[nhc.validText, { color: tpl.accent }]}>VALID {acYear}</Text>
        </View>
      </View>
      {/* Right panel */}
      <View style={[nhc.right, { backgroundColor: tpl.bg }]}>
        <View style={[nhc.photoRing, { borderColor: tpl.primary }]}>
          {student.photo
            ? <Image source={{ uri: student.photo }} style={nhc.photoImg} />
            : <View style={[nhc.photoFallback, { backgroundColor: tpl.primary }]}>
                <Text style={nhc.photoInitials}>{getInitials(student.name)}</Text>
              </View>}
        </View>
        <View style={[nhc.qrBox, { borderColor: tpl.primary + '40', backgroundColor: '#fff' }]}>
          <Feather name="grid" size={18} color={tpl.primary} />
        </View>
      </View>
    </View>
  );
}

const nhc = StyleSheet.create({
  card: { flexDirection: 'row', width: 310, height: 170, borderRadius: 14, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 8 },
  strip: { width: 48, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  stripBadge: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  stripIni: { fontSize: 10, fontWeight: '900' },
  stripLabel: { fontSize: 7, fontWeight: '900', textAlign: 'center', letterSpacing: 1, lineHeight: 10 },
  stripDot: { width: 6, height: 6, borderRadius: 3 },
  body: { flex: 1, backgroundColor: '#fff', padding: 10, justifyContent: 'space-between' },
  schoolName: { fontSize: 7, fontWeight: '800', lineHeight: 10, marginBottom: 3 },
  accentBar: { height: 1.5, borderRadius: 1, width: '60%', marginBottom: 4 },
  studentName: { fontSize: 11, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  row: { flexDirection: 'row', gap: 4, marginBottom: 1.5 },
  rowLabel: { fontSize: 6, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', flexShrink: 0 },
  rowValue: { fontSize: 6.5, color: '#1E293B', fontWeight: '800', flex: 1 },
  validBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  validText: { fontSize: 6, fontWeight: '800', letterSpacing: 0.5 },
  right: { width: 62, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 },
  photoRing: { borderRadius: 24, borderWidth: 2, padding: 2 },
  photoImg: { width: 40, height: 40, borderRadius: 20 },
  photoFallback: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  photoInitials: { fontSize: 13, fontWeight: '900', color: '#fff' },
  qrBox: { width: 32, height: 32, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

// ─── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({
  visible, onClose, students, orientation, template, onDownload, downloading,
}: {
  visible: boolean; onClose: () => void;
  students: Student[]; orientation: Orientation; template: Template;
  onDownload: () => void; downloading: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tpl = TPL[template];
  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const botPad = Platform.OS === 'web' ? 16 : insets.bottom;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        {/* Modal header */}
        <LinearGradient colors={tpl.uiBg} style={{ paddingTop: topPad + 8, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>Card Preview</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
              {students.length} card{students.length !== 1 ? 's' : ''} · {tpl.name} · {orientation}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onDownload}
            disabled={downloading}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, opacity: downloading ? 0.6 : 1 }}
          >
            {downloading ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="download" size={16} color="#fff" />}
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
              {downloading ? 'Saving…' : 'Download'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Cards */}
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 20, alignItems: 'center', paddingBottom: botPad + 20 }}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {/* Tip */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, width: '100%' }}>
            <Feather name="info" size={13} color="rgba(255,255,255,0.6)" />
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', flex: 1 }}>
              Swipe down to see all cards. Tap Download to save as PDF.
            </Text>
          </View>

          {students.map((student, i) => (
            <View key={student.id} style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>
                {i + 1} of {students.length}
              </Text>
              {orientation === 'vertical'
                ? <NativeVerticalCard student={student} tpl={tpl} />
                : <NativeHorizontalCard student={student} tpl={tpl} />}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function IdCardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { students, classes } = useApp();

  const [mode, setMode] = useState<Mode>('class');
  const [orientation, setOrientation] = useState<Orientation>('vertical');
  const [template, setTemplate] = useState<Template>('royal');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const topPad = Platform.OS === 'web' ? 16 : insets.top + 4;
  const botPad = Platform.OS === 'web' ? 24 : insets.bottom + 80;

  // Class list with student counts
  const classOptions = useMemo(() =>
    classes.map(c => ({
      name: c,
      count: students.filter(s => s.class === c && (s.status ?? 'active') === 'active').length,
    })), [classes, students]);

  // Students for individual mode with search
  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter(s =>
      (s.status ?? 'active') === 'active' &&
      (s.name.toLowerCase().includes(q) || s.rollNumber.includes(q) || (s.admissionNo ?? '').toLowerCase().includes(q))
    );
  }, [students, search]);

  const selectedStudent = useMemo(() =>
    students.find(s => s.id === selectedStudentId) ?? null, [students, selectedStudentId]);

  const targetStudents = useMemo(() => {
    if (mode === 'individual') return selectedStudent ? [selectedStudent] : [];
    if (!selectedClass) return [];
    return students.filter(s => s.class === selectedClass && (s.status ?? 'active') === 'active');
  }, [mode, selectedStudent, selectedClass, students]);

  const handleGenerate = useCallback(async () => {
    if (targetStudents.length === 0) {
      Alert.alert('No Students', mode === 'individual' ? 'Please select a student.' : 'Please select a class with active students.');
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true);
    try {
      const html = buildHtml(targetStudents, orientation, template);
      if (Platform.OS === 'web') {
        // On web: open in new tab → browser "Save as PDF" from print dialog
        await printHtml(html);
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
        } else {
          await Print.printAsync({ html });
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to generate ID cards');
    } finally {
      setGenerating(false);
    }
  }, [targetStudents, orientation, template, selectedClass, selectedStudent, mode]);

  const handlePreview = useCallback(async () => {
    if (targetStudents.length === 0) {
      Alert.alert('No Students', mode === 'individual' ? 'Please select a student.' : 'Please select a class with active students.');
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreviewVisible(true);
  }, [targetStudents, mode]);

  const s = styles(colors);
  const tpl = TPL[template];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <LinearGradient
        colors={tpl.uiBg}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: topPad }]}
      >
        <View style={s.headerIconWrap}>
          <Feather name="credit-card" size={22} color={tpl.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>ID Card Generator</Text>
          <Text style={s.headerSub}>
            {targetStudents.length > 0
              ? `${targetStudents.length} student${targetStudents.length > 1 ? 's' : ''} selected`
              : 'Select students to generate ID cards'}
          </Text>
        </View>
        {generating && <ActivityIndicator color="#fff" style={{ marginLeft: 8 }} />}
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: botPad }} showsVerticalScrollIndicator={false}>

        {/* ── Mode Selector ── */}
        <View style={[s.section, { backgroundColor: colors.card }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>GENERATE FOR</Text>
          <View style={[s.segRow, { backgroundColor: colors.muted }]}>
            {(['individual', 'class'] as Mode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[s.seg, mode === m && { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 3 }]}
                onPress={() => setMode(m)} activeOpacity={0.8}
              >
                <Feather name={m === 'individual' ? 'user' : 'users'} size={14} color={mode === m ? colors.primary : colors.mutedForeground} />
                <Text style={[s.segText, { color: mode === m ? colors.primary : colors.mutedForeground }]}>
                  {m === 'individual' ? 'Individual' : 'Whole Class'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Student / Class Selector ── */}
        {mode === 'class' ? (
          <View style={[s.section, { backgroundColor: colors.card }]}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>SELECT CLASS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {classOptions.length === 0
                ? <Text style={[s.emptyNote, { color: colors.mutedForeground }]}>No classes found.</Text>
                : classOptions.map(c => {
                    const active = selectedClass === c.name;
                    return (
                      <TouchableOpacity
                        key={c.name}
                        style={[s.classChip, {
                          backgroundColor: active ? tpl.primary : colors.muted,
                          borderColor: active ? tpl.primary : colors.border,
                        }]}
                        onPress={() => setSelectedClass(c.name)} activeOpacity={0.8}
                      >
                        <Text style={[s.classChipText, { color: active ? '#fff' : colors.text }]}>{c.name}</Text>
                        <Text style={[s.classChipCount, { color: active ? 'rgba(255,255,255,0.75)' : colors.mutedForeground }]}>{c.count} students</Text>
                      </TouchableOpacity>
                    );
                  })}
            </ScrollView>
          </View>
        ) : (
          <View style={[s.section, { backgroundColor: colors.card }]}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>SELECT STUDENT</Text>
            <View style={[s.searchRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="search" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[s.searchInput, { color: colors.text }]}
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, roll no, admission no…"
                placeholderTextColor={colors.mutedForeground}
              />
              {search ? <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={14} color={colors.mutedForeground} /></TouchableOpacity> : null}
            </View>
            <View style={{ maxHeight: 200 }}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {filteredStudents.length === 0
                  ? <Text style={[s.emptyNote, { color: colors.mutedForeground }]}>No active students found.</Text>
                  : filteredStudents.map(st => {
                      const active = selectedStudentId === st.id;
                      return (
                        <TouchableOpacity
                          key={st.id}
                          style={[s.studentRow, { borderBottomColor: colors.border, backgroundColor: active ? tpl.primary + '12' : 'transparent' }]}
                          onPress={() => setSelectedStudentId(st.id)} activeOpacity={0.8}
                        >
                          <View style={[s.studentAvatar, { backgroundColor: active ? tpl.primary : colors.muted }]}>
                            <Text style={[s.studentAvatarText, { color: active ? '#fff' : colors.mutedForeground }]}>
                              {getInitials(st.name)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.studentName, { color: colors.text }]}>{st.name}</Text>
                            <Text style={[s.studentMeta, { color: colors.mutedForeground }]}>
                              {st.class}{st.section ? ` · ${st.section}` : ''} · Roll {st.rollNumber}
                            </Text>
                          </View>
                          {active && <Feather name="check-circle" size={18} color={tpl.primary} />}
                        </TouchableOpacity>
                      );
                    })}
              </ScrollView>
            </View>
          </View>
        )}

        {/* ── Orientation ── */}
        <View style={[s.section, { backgroundColor: colors.card }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>CARD ORIENTATION</Text>
          <View style={s.orientRow}>
            {([
              { key: 'vertical',   label: 'Vertical',   icon: 'smartphone', desc: '3 per row · Portrait' },
              { key: 'horizontal', label: 'Horizontal',  icon: 'tablet',     desc: '2 per row · Landscape' },
            ] as { key: Orientation; label: string; icon: any; desc: string }[]).map(o => {
              const active = orientation === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  style={[s.orientCard, {
                    backgroundColor: active ? tpl.primary + '10' : colors.muted,
                    borderColor: active ? tpl.primary : colors.border,
                  }]}
                  onPress={() => setOrientation(o.key)} activeOpacity={0.8}
                >
                  <View style={[s.orientIcon, { backgroundColor: active ? tpl.primary : colors.border }]}>
                    <Feather name={o.icon} size={20} color={active ? '#fff' : colors.mutedForeground} />
                  </View>
                  <Text style={[s.orientLabel, { color: active ? tpl.primary : colors.text }]}>{o.label}</Text>
                  <Text style={[s.orientDesc, { color: colors.mutedForeground }]}>{o.desc}</Text>
                  {active && (
                    <View style={[s.orientCheck, { backgroundColor: tpl.primary }]}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Template Selector ── */}
        <View style={[s.section, { backgroundColor: colors.card }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>CARD DESIGN</Text>
          <View style={s.tplRow}>
            {(Object.entries(TPL) as [Template, typeof TPL[Template]][]).map(([key, t]) => {
              const active = template === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.tplCard, { borderColor: active ? t.primary : colors.border }]}
                  onPress={() => setTemplate(key)} activeOpacity={0.85}
                >
                  {/* Mini card preview */}
                  <LinearGradient colors={[t.primary, t.secondary]} style={s.tplPreview} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={[s.tplAccentBar, { backgroundColor: t.accent }]} />
                    <View style={[s.tplAvatar, { borderColor: t.accent }]}>
                      <Text style={{ fontSize: 8, color: t.accent, fontWeight: '900' }}>AB</Text>
                    </View>
                    <View style={{ alignItems: 'center', gap: 2, marginTop: 3 }}>
                      <View style={{ width: 36, height: 3, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 2 }} />
                      <View style={{ width: 24, height: 2, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1 }} />
                      <View style={{ width: 28, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
                    </View>
                    <View style={[s.tplFooter, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
                      <View style={{ width: 8, height: 8, backgroundColor: t.accent, borderRadius: 1 }} />
                      <View style={{ flex: 1, gap: 1, paddingLeft: 3 }}>
                        <View style={{ height: 1.5, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 1 }} />
                        <View style={{ height: 1.5, width: '60%', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
                      </View>
                    </View>
                  </LinearGradient>
                  <Text style={[s.tplName, { color: active ? t.primary : colors.text }]}>{t.name}</Text>
                  {active && (
                    <View style={[s.tplCheck, { backgroundColor: t.primary }]}>
                      <Feather name="check" size={9} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Summary + Actions ── */}
        <View style={[s.section, { backgroundColor: colors.card }]}>
          {targetStudents.length > 0 && (
            <View style={[s.summaryBox, { backgroundColor: tpl.primary + '0E', borderColor: tpl.primary + '30' }]}>
              <Feather name="info" size={14} color={tpl.primary} />
              <Text style={[s.summaryText, { color: tpl.primary }]}>
                {targetStudents.length} {orientation} ID card{targetStudents.length > 1 ? 's' : ''} · {TPL[template].name} design
              </Text>
            </View>
          )}

          {/* Preview button */}
          <TouchableOpacity
            style={[s.previewBtn, { borderColor: tpl.primary, opacity: targetStudents.length === 0 ? 0.45 : 1 }]}
            onPress={handlePreview}
            disabled={targetStudents.length === 0}
            activeOpacity={0.85}
          >
            <Feather name="eye" size={17} color={tpl.primary} />
            <Text style={[s.previewText, { color: tpl.primary }]}>Preview Cards</Text>
          </TouchableOpacity>

          {/* Download button */}
          <TouchableOpacity
            style={[s.generateBtn, { opacity: (generating || targetStudents.length === 0) ? 0.55 : 1 }]}
            onPress={handleGenerate}
            disabled={generating || targetStudents.length === 0}
            activeOpacity={0.85}
          >
            <LinearGradient colors={tpl.uiBg} style={s.generateGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {generating
                ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.generateText}>Generating…</Text></>
                : <><Feather name="download" size={18} color="#fff" /><Text style={s.generateText}>Download PDF</Text></>}
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Preview Modal ── */}
      <PreviewModal
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        students={targetStudents}
        orientation={orientation}
        template={template}
        onDownload={handleGenerate}
        downloading={generating}
      />

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  headerIconWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  section: { marginHorizontal: 14, marginTop: 12, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 },

  segRow: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  seg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  segText: { fontSize: 13, fontWeight: '700' },

  classChip: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, marginRight: 10, alignItems: 'center' },
  classChipText: { fontSize: 14, fontWeight: '800' },
  classChipCount: { fontSize: 11, marginTop: 2 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14 },

  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1 },
  studentAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { fontSize: 12, fontWeight: '800' },
  studentName: { fontSize: 14, fontWeight: '700' },
  studentMeta: { fontSize: 12, marginTop: 1 },
  emptyNote: { fontSize: 13, paddingVertical: 12 },

  orientRow: { flexDirection: 'row', gap: 12 },
  orientCard: { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 14, alignItems: 'center', gap: 6, position: 'relative' },
  orientIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  orientLabel: { fontSize: 14, fontWeight: '800' },
  orientDesc: { fontSize: 11, textAlign: 'center' },
  orientCheck: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  tplRow: { flexDirection: 'row', gap: 10 },
  tplCard: { flex: 1, borderRadius: 14, borderWidth: 2, overflow: 'hidden', position: 'relative', alignItems: 'center' },
  tplPreview: { width: '100%', aspectRatio: 0.63, padding: 8, alignItems: 'center' },
  tplAccentBar: { height: 3, width: '100%', borderRadius: 2, marginBottom: 6 },
  tplAvatar: { width: 26, height: 26, borderRadius: 13, border: 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  tplFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 5 },
  tplName: { fontSize: 11, fontWeight: '800', paddingVertical: 6 },
  tplCheck: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  summaryBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  summaryText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  previewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 2, paddingVertical: 13, marginBottom: 10 },
  previewText: { fontSize: 15, fontWeight: '800' },

  generateBtn: { borderRadius: 16, overflow: 'hidden' },
  generateGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  generateText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
