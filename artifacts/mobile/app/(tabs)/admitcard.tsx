import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, Platform, FlatList, ActivityIndicator, Image,
} from 'react-native';
import PDFSavedModal from '@/components/PDFSavedModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useApp, Student, Exam, getExamScheduleForClass, getExamSubjectsForClass } from '@/context/AppContext';
import { SCHOOL_INFO } from '@/constants/schoolInfo';
import { downloadHtmlAsPdf, downloadMultipleHtmlsAsPdf } from '@/utils/pdfExport';
import {
  documentLogoHtml,
  principalSignatureHtml,
} from '@/utils/documentBranding';
import type { DocumentBranding } from '@/context/AppContext';

// ─── API helpers (same pattern as AppContext) ──────────────────────────────────
const getApiBase = (): string => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : '';
};
async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}/api${path}`);
  if (!res.ok) throw new Error(`GET /api${path} failed: ${res.status}`);
  return res.json();
}
async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBase()}/api${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT /api${path} failed: ${res.status}`);
  return res.json();
}
async function apiDeleteReq<T = void>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}/api${path}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`DELETE /api${path} failed: ${res.status}`);
  if (res.status === 404 || res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const EMPTY_BRANDING: DocumentBranding = {
  logoDataUrl: null,
  signatureDataUrl: null,
  principalSignatureDataUrl: null,
  teacherSignatureDataUrl: null,
  examInChargeSignatureDataUrl: null,
};

function admitSignatureHtml(
  label: string,
  branding: DocumentBranding,
  color: string,
  kind: 'principal' | 'student',
): string {
  const signature = kind === 'principal'
    ? principalSignatureHtml(branding, 112, 34)
    : '';
  return `<div style="text-align:center;flex:1">
    <div style="height:46px;margin:0 10px 2px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1.5px solid ${color};overflow:hidden">
      ${signature}
    </div>
    <div style="font-size:11px;color:${color};font-weight:700;margin-top:6px">${label}</div>
  </div>`;
}

const ADMIT_SIGNATURES: Array<{
  label: string;
  kind: 'principal' | 'student';
}> = [
  { label: 'Principal / Head', kind: 'principal' },
  { label: "Student's Signature", kind: 'student' },
];

// ─── Types ─────────────────────────────────────────────────────────────────────
type Mode = 'individual' | 'class';
type Template = 'premium';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function calcAge(dob: string): number {
  if (!dob) return 0;
  const b = new Date(dob);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return Math.max(0, a);
}

function fmtDate(d: string): string {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

function getAcademicYear(): string {
  const y = new Date().getFullYear();
  return new Date().getMonth() >= 3 ? `${y}–${y + 1}` : `${y - 1}–${y}`;
}

function getAdmitNo(studentId: string, examId: string): string {
  const hash = Math.abs((studentId + examId).split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0));
  return `AC${hash.toString().padStart(8, '0').slice(0, 8)}`;
}

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#BE185D'];
function studentColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function buildSchedule(exam: Exam, className?: string) {
  const subjects = className ? getExamSubjectsForClass(exam, className) : exam.subjects;
  const configuredSchedule = className
    ? getExamScheduleForClass(exam, className)
    : exam.subjectSchedule;

  return subjects.map(subject => {
    const configured = configuredSchedule?.find(schedule => schedule.subject === subject);
    const legacyTime = configured?.time?.split(/\s+[–—-]\s+/) ?? [];
    return {
      subject,
      date: configured?.date || exam.date || '—',
      startTime: configured?.startTime || legacyTime[0] || '—',
      endTime: configured?.endTime || legacyTime[1] || '—',
      maxMarks: configured?.maxMarks ?? exam.maxMarks,
    };
  });
}

const INSTRUCTIONS = [
  'Bring this Admit Card to the examination hall. Entry is not permitted without it.',
  'Report at least 15 minutes before the scheduled examination time.',
  'Mobile phones, smartwatches, and electronic devices are strictly prohibited.',
  'Books, notes, or any written material are not allowed inside the hall.',
  'Use only blue or black ballpoint pen for answering.',
  'Write your Roll Number on the answer sheet before you begin.',
  'Candidates found using unfair means will be immediately disqualified.',
  'No candidate shall leave the examination hall before the first hour.',
];

// ─── HTML Template Builders ─────────────────────────────────────────────────────
function photoCircle(name: string, color: string, size = 88): string {
  const ini = getInitials(name);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};
    display:flex;align-items:center;justify-content:center;margin:0 auto 6px;
    border:3px solid rgba(255,255,255,0.5)">
    <span style="color:#fff;font-size:${Math.round(size * 0.33)}px;font-weight:900;font-family:Arial">${ini}</span>
  </div>`;
}

function scheduleRows(schedule: ReturnType<typeof buildSchedule>, evenBg: string): string {
  return schedule.map((s, i) => `
    <tr style="background:${i % 2 === 0 ? evenBg : '#fff'}">
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#1E293B;font-weight:600">${s.subject}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151">${fmtDate(s.date)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151">${s.startTime}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151">${s.endTime}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151;text-align:center">${s.maxMarks}</td>
    </tr>`).join('');
}

function infoRows(student: Student): string {
  return [
    ['Name', student.name],
    ["Father's Name", student.fatherName || '—'],
    ["Mother's Name", student.motherName || '—'],
    ['Class', student.class],
    ['Roll Number', student.rollNumber],
    ['Date of Birth', fmtDate(student.dateOfBirth)],
    ['Age', `${calcAge(student.dateOfBirth)} Years`],
    ['Contact', student.mobileNumber || '—'],
  ].map(([l, v]) => `
    <tr>
      <td style="padding:5px 8px;font-size:12px;color:#64748B;font-weight:600;width:130px;vertical-align:top">${l}</td>
      <td style="padding:5px 8px;font-size:12px;color:#0F172A;font-weight:700">: ${v}</td>
    </tr>`).join('');
}

function buildClassicHtml(student: Student, exam: Exam, branding: DocumentBranding = EMPTY_BRANDING, academicYear?: string): string {
  const schedule = buildSchedule(exam, student.class);
  const acYear = academicYear ?? getAcademicYear();
  const admitNo = getAdmitNo(student.id, exam.id);
  const color = studentColor(student.name);
  const qrData = encodeURIComponent(`${student.name}|Class:${student.class}|Roll:${student.rollNumber}|${exam.name}|${admitNo}`);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page{size:A4;margin:0}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,'Helvetica Neue',sans-serif;background:#e8edf4}
  .pg{width:210mm;min-height:297mm;background:#fff;margin:0 auto;padding-bottom:20mm}
</style></head><body><div class="pg">
  <div style="background:linear-gradient(135deg,#1e3a8a 0%,#2563EB 100%);padding:18px 24px;display:flex;align-items:center;gap:16px">
    <div style="width:64px;height:64px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:3px solid #F59E0B;overflow:hidden">
      ${branding.logoDataUrl ? documentLogoHtml(branding, 58, 58) : `<span style="color:#1e3a8a;font-size:20px;font-weight:900;font-family:Arial">${getInitials(SCHOOL_INFO.name)}</span>`}
    </div>
    <div style="flex:1">
      <div style="color:#fff;font-size:16px;font-weight:900;letter-spacing:0.5px;text-transform:uppercase">${SCHOOL_INFO.name}</div>
        <div style="color:rgba(255,255,255,0.82);font-size:11px;margin-top:3px">${SCHOOL_INFO.address}</div>
    </div>
    <div style="background:#F59E0B;color:#fff;padding:8px 16px;border-radius:8px;font-weight:900;font-size:13px;letter-spacing:1.5px;white-space:nowrap;text-align:center">ADMIT CARD</div>
  </div>
  <div style="height:4px;background:linear-gradient(90deg,#F59E0B,#EF4444,#F59E0B)"></div>
  <div style="background:#EFF6FF;border-bottom:2px solid #BFDBFE;padding:9px 24px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
    ${[['Examination',exam.name],['Class',exam.class],['Academic Year',acYear],['Admit No.',admitNo]]
      .map(([l,v])=>`<span style="font-size:12px"><span style="color:#64748B">${l}: </span><span style="color:#1e3a8a;font-weight:800">${v}</span></span>`).join('')}
  </div>
  <div style="margin:16px 24px;display:flex;gap:16px;border:1.5px solid #e2e8f0;border-radius:10px;padding:16px">
    <table style="flex:1;border-collapse:collapse">${infoRows(student)}</table>
    <div style="width:130px;flex-shrink:0;text-align:center;padding-top:4px">
      ${photoCircle(student.name, color)}
      <div style="font-size:10px;color:#94A3B8;margin-bottom:10px">Photograph</div>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&color=1e3a8a&bgcolor=EFF6FF&data=${qrData}" width="90" height="90" style="border:2px solid #BFDBFE;border-radius:6px;display:block;margin:0 auto" onerror="this.style.display='none'" alt="QR"/>
      <div style="font-size:9px;color:#94A3B8;margin-top:4px">Verification QR</div>
    </div>
  </div>
  <div style="margin:0 24px">
    <div style="font-size:12px;font-weight:800;color:#1e3a8a;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #BFDBFE;padding-bottom:4px">📅 Examination Schedule</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#1e3a8a">
        ${['Subject','Date','Start Time','End Time','Max Marks'].map(h=>`<th style="padding:9px 10px;color:#fff;font-size:12px;font-weight:700;text-align:left">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${scheduleRows(schedule, '#F8FAFF')}</tbody>
    </table>
  </div>
  <div style="margin:14px 24px;background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:8px;padding:12px 16px">
    <div style="font-size:12px;font-weight:800;color:#92400E;margin-bottom:8px">⚠️ Important Instructions</div>
    <ol style="padding-left:0;list-style:none">${INSTRUCTIONS.map((ins,n)=>`<li style="font-size:11px;color:#78350F;margin-bottom:4px;line-height:1.6">${n+1}. ${ins}</li>`).join('')}</ol>
  </div>
  <div style="margin:0 24px;display:flex;justify-content:space-between">
    ${ADMIT_SIGNATURES.map(s=>admitSignatureHtml(s.label, branding, '#1e3a8a', s.kind)).join('')}
  </div>
  <div style="margin:14px 24px 0;text-align:center;border-top:1px dashed #e2e8f0;padding-top:8px">
    <div style="font-size:10px;color:#94A3B8">Computer-generated document — any tampering renders this admit card invalid. | ${SCHOOL_INFO.name}</div>
  </div>
</div></body></html>`;
}

function buildModernHtml(student: Student, exam: Exam, branding: DocumentBranding = EMPTY_BRANDING, academicYear?: string): string {
  const schedule = buildSchedule(exam, student.class);
  const acYear = academicYear ?? getAcademicYear();
  const admitNo = getAdmitNo(student.id, exam.id);
  const color = studentColor(student.name);
  const qrData = encodeURIComponent(`${student.name}|Class:${student.class}|Roll:${student.rollNumber}|${exam.name}|${admitNo}`);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page{size:A4;margin:0}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9}
  .pg{width:210mm;min-height:297mm;background:#F8FAFF;margin:0 auto;padding-bottom:20mm}
  .card{background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
</style></head><body><div class="pg">
  <div style="background:linear-gradient(135deg,#6d28d9 0%,#2563EB 60%,#06B6D4 100%);padding:20px 24px;position:relative;overflow:hidden">
    <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.07)"></div>
    <div style="position:absolute;bottom:-20px;left:100px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.05)"></div>
    <div style="display:flex;align-items:center;gap:16px;position:relative">
      <div style="width:64px;height:64px;border-radius:18px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;backdrop-filter:blur(10px);overflow:hidden">
        ${branding.logoDataUrl ? documentLogoHtml(branding, 58, 58) : `<span style="color:#fff;font-size:22px;font-weight:900;font-family:Arial">${getInitials(SCHOOL_INFO.name)}</span>`}
      </div>
      <div style="flex:1">
        <div style="color:#fff;font-size:16px;font-weight:900;letter-spacing:0.3px">${SCHOOL_INFO.name}</div>
        <div style="color:rgba(255,255,255,0.75);font-size:11px;margin-top:2px">${SCHOOL_INFO.address}</div>
      </div>
      <div style="background:rgba(255,255,255,0.18);border:1.5px solid rgba(255,255,255,0.4);color:#fff;padding:8px 16px;border-radius:24px;font-weight:900;font-size:12px;letter-spacing:2px;backdrop-filter:blur(10px)">ADMIT CARD</div>
    </div>
  </div>
  <div style="padding:16px 24px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px">
    ${[['🎓 Examination',exam.name],['📚 Class',exam.class],['📅 Academic Year',acYear],['🔢 Admit No.',admitNo]]
      .map(([l,v])=>`<div class="card" style="padding:10px 14px"><div style="font-size:10px;color:#64748B;margin-bottom:4px">${l}</div><div style="font-size:13px;font-weight:800;color:#1E293B">${v}</div></div>`).join('')}
  </div>
  <div style="margin:0 24px;display:flex;gap:16px">
    <div class="card" style="flex:1;padding:16px">
      <div style="font-size:12px;font-weight:800;color:#6d28d9;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">Student Information</div>
      <table style="width:100%;border-collapse:collapse">${infoRows(student)}</table>
    </div>
    <div style="width:130px;flex-shrink:0">
      <div class="card" style="padding:14px;text-align:center">
        ${photoCircle(student.name, color)}
        <div style="font-size:10px;color:#94A3B8;margin-bottom:10px">Photograph</div>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&color=6d28d9&bgcolor=f8f5ff&data=${qrData}" width="90" height="90" style="border-radius:8px;border:2px solid #EDE9FE;display:block;margin:0 auto" onerror="this.style.display='none'" alt="QR"/>
        <div style="font-size:9px;color:#94A3B8;margin-top:4px">Verification QR</div>
      </div>
    </div>
  </div>
  <div style="margin:16px 24px">
    <div class="card" style="overflow:hidden">
      <div style="background:linear-gradient(135deg,#6d28d9,#2563EB);padding:10px 14px">
        <div style="color:#fff;font-size:12px;font-weight:800;letter-spacing:0.5px">📅 EXAMINATION SCHEDULE</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#F5F3FF">${['Subject','Date','Start Time','End Time','Max Marks'].map(h=>`<th style="padding:9px 12px;color:#6d28d9;font-size:11px;font-weight:800;text-align:left;border-bottom:2px solid #EDE9FE">${h}</th>`).join('')}</tr></thead>
        <tbody>${scheduleRows(schedule, '#FAFAFA')}</tbody>
      </table>
    </div>
  </div>
  <div style="margin:0 24px">
    <div class="card" style="padding:14px;background:linear-gradient(135deg,#FFFBEB,#FEF3C7)">
      <div style="font-size:12px;font-weight:800;color:#92400E;margin-bottom:8px">⚠️ Important Instructions</div>
      <ol style="padding-left:0;list-style:none">${INSTRUCTIONS.map((ins,n)=>`<li style="font-size:11px;color:#78350F;margin-bottom:4px;line-height:1.6">${n+1}. ${ins}</li>`).join('')}</ol>
    </div>
  </div>
  <div style="margin:16px 24px 0;display:flex;justify-content:space-between">
    ${ADMIT_SIGNATURES.map(s=>admitSignatureHtml(s.label, branding, '#6d28d9', s.kind)).join('')}
  </div>
  <div style="margin:12px 24px 0;text-align:center;border-top:1px dashed #DDD6FE;padding-top:8px">
    <div style="font-size:10px;color:#94A3B8">Computer-generated document — any tampering renders this admit card invalid. | ${SCHOOL_INFO.name}</div>
  </div>
</div></body></html>`;
}

function buildElegantHtml(student: Student, exam: Exam, branding: DocumentBranding = EMPTY_BRANDING, academicYear?: string): string {
  const schedule = buildSchedule(exam, student.class);
  const acYear = academicYear ?? getAcademicYear();
  const admitNo = getAdmitNo(student.id, exam.id);
  const color = studentColor(student.name);
  const qrData = encodeURIComponent(`${student.name}|Class:${student.class}|Roll:${student.rollNumber}|${exam.name}|${admitNo}`);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page{size:A4;margin:0}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Georgia,'Times New Roman',serif;background:#0f172a}
  .pg{width:210mm;min-height:297mm;background:#fff;margin:0 auto;padding-bottom:20mm}
</style></head><body><div class="pg">
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:22px 28px;position:relative">
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(245,158,11,0.04) 10px,rgba(245,158,11,0.04) 11px)"></div>
    <div style="border:1.5px solid rgba(245,158,11,0.4);border-radius:10px;padding:18px;position:relative">
      <div style="display:flex;align-items:center;gap:18px">
        <div style="width:68px;height:68px;border-radius:50%;background:rgba(245,158,11,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:2px solid #F59E0B;overflow:hidden">
          ${branding.logoDataUrl ? documentLogoHtml(branding, 62, 62) : `<span style="color:#F59E0B;font-size:22px;font-weight:900;font-family:Georgia">${getInitials(SCHOOL_INFO.name)}</span>`}
        </div>
        <div style="flex:1">
          <div style="color:#F59E0B;font-size:17px;font-weight:900;letter-spacing:1px;text-transform:uppercase;font-family:Georgia">${SCHOOL_INFO.name}</div>
          <div style="color:rgba(255,255,255,0.6);font-size:11px;margin-top:3px;font-family:Arial">${SCHOOL_INFO.address}</div>
        </div>
        <div style="border:2px solid #F59E0B;color:#F59E0B;padding:10px 18px;font-weight:900;font-size:13px;letter-spacing:2px;text-align:center;font-family:Georgia">ADMIT CARD</div>
      </div>
      <div style="height:1px;background:linear-gradient(90deg,transparent,#F59E0B,transparent);margin:14px 0"></div>
      <div style="display:flex;justify-content:center;gap:32px">
        ${[['Examination',exam.name],['Class',exam.class],['Year',acYear],['Admit No.',admitNo]]
          .map(([l,v])=>`<div style="text-align:center"><div style="font-size:10px;color:rgba(255,255,255,0.5);font-family:Arial;letter-spacing:0.5px">${l}</div><div style="font-size:13px;color:#F59E0B;font-weight:700;margin-top:2px;font-family:Arial">${v}</div></div>`).join('')}
      </div>
    </div>
  </div>
  <div style="margin:20px 28px;display:flex;gap:18px;border:1.5px solid #e2e8f0;border-radius:10px;padding:18px">
    <div style="flex:1">
      <div style="font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #F59E0B;padding-bottom:5px;margin-bottom:10px">Student Information</div>
      <table style="width:100%;border-collapse:collapse">${infoRows(student)}</table>
    </div>
    <div style="width:130px;flex-shrink:0;text-align:center;padding-top:4px">
      <div style="border:2px solid #0f172a;border-radius:8px;padding:10px;background:#F8FAFC">
        ${photoCircle(student.name, color)}
        <div style="font-size:10px;color:#94A3B8;margin-bottom:8px">Photograph</div>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&color=0f172a&bgcolor=F8FAFC&data=${qrData}" width="88" height="88" style="border-radius:4px;border:1px solid #e2e8f0;display:block;margin:0 auto" onerror="this.style.display='none'" alt="QR"/>
        <div style="font-size:9px;color:#94A3B8;margin-top:4px">Verification QR</div>
      </div>
    </div>
  </div>
  <div style="margin:0 28px">
    <div style="font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #F59E0B;padding-bottom:5px;margin-bottom:10px">Examination Schedule</div>
    <table style="width:100%;border-collapse:collapse;border:1.5px solid #e2e8f0">
      <thead><tr style="background:#0f172a">${['Subject','Date','Start Time','End Time','Max Marks'].map(h=>`<th style="padding:9px 10px;color:#F59E0B;font-size:12px;font-weight:700;text-align:left">${h}</th>`).join('')}</tr></thead>
      <tbody>${scheduleRows(schedule, '#F8FAFC')}</tbody>
    </table>
  </div>
  <div style="margin:16px 28px;background:#FFFBEB;border-left:4px solid #F59E0B;padding:12px 16px">
    <div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:8px;letter-spacing:0.3px">Important Instructions</div>
    <ol style="padding-left:0;list-style:none">${INSTRUCTIONS.map((ins,n)=>`<li style="font-size:11px;color:#78350F;margin-bottom:4px;line-height:1.6">${n+1}. ${ins}</li>`).join('')}</ol>
  </div>
  <div style="margin:0 28px;display:flex;justify-content:space-between">
    ${ADMIT_SIGNATURES.map(s=>admitSignatureHtml(s.label, branding, '#0f172a', s.kind)).join('')}
  </div>
  <div style="margin:14px 28px 0;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px">
    <div style="font-size:10px;color:#94A3B8;font-family:Arial">Computer-generated document — any tampering renders this admit card invalid. | ${SCHOOL_INFO.name}</div>
  </div>
</div></body></html>`;
}

function premiumCandidateDetails(student: Student): string {
  return [
    ['Father’s Name', student.fatherName || '—'],
    ['Mother’s Name', student.motherName || '—'],
    ['Date of Birth', fmtDate(student.dateOfBirth)],
    ['Roll Number', student.rollNumber || '—'],
    ['Age', `${calcAge(student.dateOfBirth)} Years`],
    ['Contact', student.mobileNumber || '—'],
  ].map(([label, value]) => `
    <div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid #EEF2F7;font-size:11px">
      <span style="color:#728198;width:92px">${label}</span>
      <strong style="color:#1D3557">${value}</strong>
    </div>`).join('');
}

function buildPremiumHtml(student: Student, exam: Exam, branding: DocumentBranding = EMPTY_BRANDING, academicYear?: string): string {
  const schedule = buildSchedule(exam, student.class);
  const acYear = academicYear ?? getAcademicYear();
  const admitNo = getAdmitNo(student.id, exam.id);
  const qrData = encodeURIComponent(`${student.name}|Class:${student.class}|Roll:${student.rollNumber}|${exam.name}|${admitNo}`);
  const logo = branding.logoDataUrl
    ? documentLogoHtml(branding, 62, 62)
    : `<span style="color:#102C55;font-size:18px;font-weight:800;font-family:Arial">DAK</span>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page{size:A4;margin:0}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#DFE7F1;color:#10213F}
  .pg{width:calc(210mm - 16mm);height:calc(297mm - 16mm);background:#fff;margin:8mm auto;position:relative;overflow:hidden;padding-bottom:7mm;box-sizing:border-box}
  .inner{position:absolute;inset:0;border:1px solid #D8C28B;pointer-events:none;z-index:10}
  .section{margin:0 40px 20px;border:1px solid #CBD7E5;border-radius:4px;overflow:hidden}
  @media print{body{background:#fff;margin:0;padding:0}.pg{border:0;overflow:hidden;page-break-after:always;break-after:page}.section{break-inside:avoid}}
</style></head><body><div class="pg"><div class="inner"></div>
  <header style="background:#102C55;color:#fff;padding:28px 40px 24px;position:relative">
    <div style="position:absolute;right:36px;top:26px;width:90px;height:90px;border:1px solid rgba(221,195,119,.4);border-radius:50%"></div>
    <div style="position:absolute;right:50px;top:40px;width:62px;height:62px;border:1px solid rgba(221,195,119,.25);border-radius:50%"></div>
    <div style="display:flex;align-items:center;gap:18px;position:relative">
      <div style="width:68px;height:68px;border:1px solid #D9BD70;border-radius:12px;background:#F8F1DF;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">${logo}</div>
      <div style="flex:1">
        <div style="font-size:10px;letter-spacing:2px;color:#D9BD70;font-weight:700;margin-bottom:6px">EXAMINATION DOCUMENT</div>
        <div style="font-size:18px;font-weight:800;letter-spacing:.25px">${SCHOOL_INFO.name}</div>
        <div style="font-size:10.5px;color:#C8D4E4;margin-top:6px">${SCHOOL_INFO.address}</div>
      </div>
    </div>
    <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:end;position:relative">
      <div><div style="font-size:11px;color:#C8D4E4;letter-spacing:1.4px">${exam.name} · ${acYear}</div><div style="font-size:29px;font-weight:800;margin-top:7px">ADMIT CARD</div></div>
    </div>
  </header>
  <div style="height:6px;background:#D9BD70"></div>
  <section style="margin:24px 40px 18px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
    ${[['CANDIDATE', student.name], ['CLASS / SECTION', student.class], ['ADMIT NUMBER', admitNo]].map(([label, value]) => `
      <div style="padding:12px 14px;border:1px solid #D8E1ED;background:#F6F9FC;border-radius:3px">
        <div style="font-size:9px;color:#728198;letter-spacing:1.2px;font-weight:700">${label}</div>
        <div style="margin-top:6px;font-size:14px;color:#102C55;font-weight:800">${value}</div>
      </div>`).join('')}
  </section>
  <section class="section">
    <div style="padding:11px 15px;background:#EDF3F9;border-bottom:1px solid #CBD7E5;display:flex;justify-content:space-between;align-items:center">
      <div style="color:#102C55;font-size:12px;font-weight:800;letter-spacing:1px">CANDIDATE DETAILS</div>
      <div style="font-size:9px;color:#728198;letter-spacing:1.1px">IDENTITY VERIFIED BY SCHOOL</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;padding:14px 16px;column-gap:32px">${premiumCandidateDetails(student)}</div>
  </section>
  <section class="section">
    <div style="padding:11px 15px;background:#102C55;color:#fff;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:12px;font-weight:800;letter-spacing:1px">EXAMINATION SCHEDULE</div>
      <div style="color:#D9BD70;font-size:9px;letter-spacing:1.1px">REPORT 15 MINUTES EARLY</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px">
      <thead><tr style="background:#F5F8FB">${['Subject','Date','Start','End','Marks'].map(h=>`<th style="text-align:left;padding:10px 12px;color:#5E6F87;font-size:9px;letter-spacing:.7px;text-transform:uppercase">${h}</th>`).join('')}</tr></thead>
      <tbody>${scheduleRows(schedule, '#F9FBFD')}</tbody>
    </table>
  </section>
  <section style="margin:0 40px 20px;padding:14px 16px;border-left:4px solid #D9BD70;background:#F8F5ED">
    <div style="color:#102C55;font-size:11px;font-weight:800;letter-spacing:.8px;margin-bottom:8px">CANDIDATE INSTRUCTIONS</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:24px">
      ${INSTRUCTIONS.slice(0, 4).map((ins, i) => `<div style="display:flex;gap:7px;color:#50627A;font-size:10.5px;line-height:1.55;margin-bottom:4px"><span style="color:#B18B35;font-weight:800">${String(i + 1).padStart(2, '0')}</span>${ins}</div>`).join('')}
    </div>
  </section>
  <footer style="padding:5px 40px 0;display:flex;align-items:end;gap:24px">
    <div style="width:82px;height:82px;border:1px solid #BFCDDD;border-radius:3px;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#102C55;font-size:9px;font-weight:800;letter-spacing:.5px;background:#F6F9FC">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=74x74&color=102c55&bgcolor=f6f9fc&data=${qrData}" width="72" height="72" alt="QR" onerror="this.style.display='none'" />
      <span style="font-size:8px">QR VERIFY</span>
    </div>
    <div style="flex:1;display:flex;gap:36px">${ADMIT_SIGNATURES.map(s => admitSignatureHtml(s.label, branding, '#102C55', s.kind)).join('')}</div>
  </footer>
  <div style="margin:22px 40px 0;padding:9px 0 18px;border-top:1px solid #D9BD70;display:flex;justify-content:space-between;color:#8290A3;font-size:9px">
    <span>Issued by the Examination Office · ${admitNo}</span><span>School seal &amp; signature required</span>
  </div>
</div></body></html>`;
}

function buildHtml(student: Student, exam: Exam, _template: Template, branding: DocumentBranding = EMPTY_BRANDING, academicYear?: string): string {
  return buildPremiumHtml(student, exam, branding, academicYear);
}

function buildBulkHtml(students: Student[], exam: Exam, template: Template, branding: DocumentBranding = EMPTY_BRANDING, academicYear?: string): string {
  return students.map((s, i) => {
    const html = buildHtml(s, exam, template, branding, academicYear);
    if (i < students.length - 1) {
      // Inject page-break between students
      return html.replace('</body>', '<div style="page-break-after:always"></div></body>');
    }
    return html;
  }).join('\n');
}

// ─── Template Preview Card ─────────────────────────────────────────────────────
const TEMPLATES: { id: Template; label: string; sub: string; grad: [string, string]; accent: string }[] = [
  { id: 'premium', label: 'Premium CBSE', sub: 'Formal, refined & photo-free', grad: ['#102C55', '#183D6D'], accent: '#D9BD70' },
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdmitCardScreen() {
  const insets = useSafeAreaInsets();
  const { students, exams, classes, documentBranding } = useApp();

  const [mode, setMode]                     = useState<Mode>('individual');
  const [selectedExam, setSelectedExam]     = useState<Exam | null>(null);
  const [selectedClass, setSelectedClass]   = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [template, setTemplate]             = useState<Template>('premium');
  const [search, setSearch]                 = useState('');
  const [loading, setLoading]               = useState(false);
  const [bulkSelected, setBulkSelected]     = useState<Set<string>>(new Set());
  const [showExamPicker, setShowExamPicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [pdfSaved, setPdfSaved] = useState<{ filename: string; fileUri: string } | null>(null);

  // ── Academic Session state ─────────────────────────────────────────────────
  const [academicSessions, setAcademicSessions] = useState<string[]>([getAcademicYear()]);
  const [selectedSession, setSelectedSession]   = useState<string>(getAcademicYear());
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [newSessionInput, setNewSessionInput]   = useState('');
  const [sessionSaving, setSessionSaving]       = useState(false);

  useEffect(() => {
    apiGet<{ sessions: string[]; activeSession: string }>('/settings/academic-sessions')
      .then(data => {
        setAcademicSessions(data.sessions);
        setSelectedSession(data.activeSession);
      })
      .catch(() => {});
  }, []);

  const handleSelectSession = useCallback(async (session: string) => {
    setSelectedSession(session);
    setShowSessionPicker(false);
    try {
      await apiPut('/settings/academic-sessions', { activeSession: session, adminId: 'admin' });
    } catch {}
  }, []);

  const handleAddSession = useCallback(async () => {
    const trimmed = newSessionInput.trim();
    if (!trimmed) return;
    if (academicSessions.includes(trimmed)) { setNewSessionInput(''); return; }
    setSessionSaving(true);
    try {
      const updated = await apiPut<{ sessions: string[]; activeSession: string }>(
        '/settings/academic-sessions',
        { sessions: [...academicSessions, trimmed], activeSession: trimmed, adminId: 'admin' },
      );
      setAcademicSessions(updated.sessions);
      setSelectedSession(updated.activeSession);
      setNewSessionInput('');
    } catch {}
    finally { setSessionSaving(false); }
  }, [newSessionInput, academicSessions]);

  const handleDeleteSession = useCallback(async (session: string) => {
    if (academicSessions.length <= 1) {
      Alert.alert('Cannot Delete', 'At least one academic session is required.');
      return;
    }
    setSessionSaving(true);
    try {
      const updated = await apiDeleteReq<{ sessions: string[]; activeSession: string }>(
        `/settings/academic-sessions/${encodeURIComponent(session)}?adminId=admin`,
      );
      if (updated) {
        setAcademicSessions(updated.sessions);
        if (selectedSession === session) setSelectedSession(updated.activeSession);
      }
    } catch {}
    finally { setSessionSaving(false); }
  }, [academicSessions, selectedSession]);

  const acYear = selectedSession;
  const botPad = insets.bottom + 80;

  // ── Derived data ─────────────────────────────────────────────────────────────
  const classOptions = useMemo(() => {
    const all = students.map(s => s.class).filter(Boolean);
    return Array.from(new Set(all)).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    let list = students;
    if (selectedClass) list = list.filter(s => s.class === selectedClass);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.class.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  }, [students, selectedClass, search]);

  const bulkList = useMemo(() => {
    if (!selectedClass) return [];
    return students
      .filter(s => s.class === selectedClass)
      .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  }, [students, selectedClass]);

  // ── Toggle bulk selection ─────────────────────────────────────────────────────
  const toggleBulk = useCallback((id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setBulkSelected(prev =>
      prev.size === bulkList.length
        ? new Set()
        : new Set(bulkList.map(s => s.id)),
    );
  }, [bulkList]);

  // ── Print helpers ─────────────────────────────────────────────────────────────
  const printStudent = useCallback(async (student: Student) => {
    if (!selectedExam) { Alert.alert('Select Exam', 'Please select an exam first.'); return; }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      const html = buildHtml(student, selectedExam, template, documentBranding, selectedSession);
      await Print.printAsync({ html });
    } catch (e: any) {
      if (!e?.message?.includes('cancelled')) Alert.alert('Error', e?.message ?? 'Print failed');
    } finally { setLoading(false); }
  }, [selectedExam, template, documentBranding, selectedSession]);

  const downloadStudent = useCallback(async (student: Student) => {
    if (!selectedExam) { Alert.alert('Select Exam', 'Please select an exam first.'); return; }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      const html = buildHtml(student, selectedExam, template, documentBranding, selectedSession);
      await downloadHtmlAsPdf(html, `Admit Card – ${student.name}`, '.pg', 'img[alt="QR"]', true, (fn, uri) => setPdfSaved({ filename: fn, fileUri: uri }));
    } catch (e: any) {
      if (!e?.message?.includes('cancelled')) Alert.alert('PDF Error', e?.message ?? 'Download failed');
    } finally { setLoading(false); }
  }, [selectedExam, template, documentBranding, selectedSession]);

  const bulkPrint = useCallback(async () => {
    if (!selectedExam) { Alert.alert('Select Exam', 'Please select an exam first.'); return; }
    const list = bulkList.filter(s => bulkSelected.size === 0 || bulkSelected.has(s.id));
    if (list.length === 0) { Alert.alert('No Students', 'No students found for this class.'); return; }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    try {
      const html = buildBulkHtml(list, selectedExam, template, documentBranding, selectedSession);
      await Print.printAsync({ html });
    } catch (e: any) {
      if (!e?.message?.includes('cancelled')) Alert.alert('Error', e?.message ?? 'Print failed');
    } finally { setLoading(false); }
  }, [selectedExam, template, bulkList, bulkSelected, documentBranding, selectedSession]);

  const bulkDownload = useCallback(async () => {
    if (!selectedExam) { Alert.alert('Select Exam', 'Please select an exam first.'); return; }
    const list = bulkList.filter(s => bulkSelected.size === 0 || bulkSelected.has(s.id));
    if (list.length === 0) { Alert.alert('No Students', 'No students found for this class.'); return; }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    try {
      // Build a separate complete HTML document per student so each is rendered
      // in its own iframe — eliminates blank pages caused by joining full documents.
      const htmlPages = list.map(s => buildHtml(s, selectedExam, template, documentBranding, selectedSession));
      await downloadMultipleHtmlsAsPdf(
        htmlPages,
        `Admit Cards – Class ${selectedClass}`,
        '.pg',
        true,
        (fn, uri) => setPdfSaved({ filename: fn, fileUri: uri }),
      );
    } catch (e: any) {
      if (!e?.message?.includes('cancelled')) Alert.alert('PDF Error', e?.message ?? 'Download failed');
    } finally { setLoading(false); }
  }, [selectedExam, template, bulkList, bulkSelected, selectedClass, documentBranding, selectedSession]);

  const openPreview = useCallback((student: Student) => {
    if (!selectedExam) { Alert.alert('Select Exam', 'Please select an exam first.'); return; }
    setPreviewStudent(student);
    setPreviewVisible(true);
  }, [selectedExam]);

  // ── Render helpers ────────────────────────────────────────────────────────────
  const currentTemplate = TEMPLATES.find(t => t.id === template)!;

  const renderStudentRow = useCallback(({ item }: { item: Student }) => {
    const isSelected = bulkSelected.has(item.id);
    const clr = studentColor(item.name);
    return (
      <TouchableOpacity
        style={[st.studentRow, isSelected && st.studentRowSelected]}
        activeOpacity={0.82}
        onPress={() => mode === 'class' ? toggleBulk(item.id) : openPreview(item)}
        onLongPress={() => mode === 'individual' && openPreview(item)}
      >
        {mode === 'class' && (
          <View style={[st.checkbox, isSelected && { backgroundColor: '#2563EB', borderColor: '#2563EB' }]}>
            {isSelected && <Feather name="check" size={13} color="#fff" />}
          </View>
        )}
        <View style={[st.rowAvatar, { backgroundColor: clr }]}>
          <Text style={st.rowAvatarTxt}>{getInitials(item.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.rowName}>{item.name}</Text>
          <Text style={st.rowMeta}>Class {item.class} • Roll {item.rollNumber}</Text>
        </View>
        {mode === 'individual' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={st.rowBtn} onPress={() => openPreview(item)} activeOpacity={0.8}>
              <Feather name="eye" size={14} color="#2563EB" />
            </TouchableOpacity>
            <TouchableOpacity style={st.rowBtn} onPress={() => printStudent(item)} activeOpacity={0.8}>
              <Feather name="printer" size={14} color="#10B981" />
            </TouchableOpacity>
            <TouchableOpacity style={[st.rowBtn, { backgroundColor: '#FEF3C7' }]} onPress={() => downloadStudent(item)} activeOpacity={0.8}>
              <Feather name="download" size={14} color="#D97706" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [mode, bulkSelected, toggleBulk, openPreview, printStudent, downloadStudent]);

  // ── Preview Modal ─────────────────────────────────────────────────────────────
  const renderPreviewModal = () => {
    if (!previewStudent || !selectedExam) return null;
    const schedule = buildSchedule(selectedExam, previewStudent.class);
    const admitNo  = getAdmitNo(previewStudent.id, selectedExam.id);
    const tmpl     = currentTemplate;
    return (
      <Modal visible={previewVisible} animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
          {/* Preview header */}
          <View style={[pm.header, { paddingTop: insets.top + 12, backgroundColor: '#102C55' }]}>
            <TouchableOpacity onPress={() => setPreviewVisible(false)} style={pm.backBtn}>
              <Feather name="x" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={pm.headerTitle}>Admit Card Preview</Text>
            <Text style={pm.headerSub}>{tmpl.label}</Text>
          </View>

          {/* Scrollable card */}
          <ScrollView
            style={{ flex: 1, backgroundColor: '#0f172a' }}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
          >
            {/* Card */}
            <View style={pm.card}>
              {/* Card header */}
              <View style={[pm.cardHeader, { backgroundColor: '#102C55' }]}>
                <View style={[pm.schoolLogo, { borderColor: tmpl.accent, overflow: 'hidden' }]}>
                  {documentBranding.logoDataUrl ? (
                    <Image source={{ uri: documentBranding.logoDataUrl }} style={pm.schoolLogoImage} resizeMode="contain" />
                  ) : (
                    <Text style={[pm.schoolLogoTxt, { color: '#102C55' }]}>DAK</Text>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[pm.schoolEyebrow, { color: '#D9BD70' }]}>EXAMINATION DOCUMENT</Text>
                  <Text style={pm.schoolName}>{SCHOOL_INFO.name}</Text>
                  <Text style={pm.schoolAddr}>{SCHOOL_INFO.address}</Text>
                </View>
                <View style={[pm.admitBadge, { borderColor: '#D9BD70' }]}>
                  <Text style={[pm.admitBadgeTxt, { color: '#D9BD70' }]}>ADMIT CARD</Text>
                </View>
              </View>

              {/* Accent bar */}
              <View style={[pm.accentBar, { backgroundColor: '#D9BD70' }]} />

              {/* Exam info chips */}
              <View style={pm.examBar}>
                {[['Examination', selectedExam.name], ['Class', selectedExam.class], ['Year', acYear], ['Admit No.', admitNo]].map(([l, v]) => (
                  <View key={l} style={pm.examChip}>
                    <Text style={pm.examChipLabel}>{l}</Text>
                    <Text style={pm.examChipValue}>{v}</Text>
                  </View>
                ))}
              </View>

              {/* Candidate details — deliberately photo-free */}
              <View style={pm.candidateDetails}>
                <View style={pm.candidateDetailsHeader}>
                  <Text style={pm.candidateDetailsTitle}>CANDIDATE DETAILS</Text>
                  <Text style={pm.candidateDetailsMeta}>IDENTITY VERIFIED BY SCHOOL</Text>
                </View>
                <View style={pm.detailsGrid}>
                  {[
                    ["Father’s Name", previewStudent.fatherName || '—'],
                    ["Mother’s Name", previewStudent.motherName || '—'],
                    ["Date of Birth", fmtDate(previewStudent.dateOfBirth)],
                    ["Roll Number", previewStudent.rollNumber || '—'],
                    ["Age", `${calcAge(previewStudent.dateOfBirth)} Years`],
                    ["Contact", previewStudent.mobileNumber || '—'],
                  ].map(([l, v]) => (
                    <View key={l} style={pm.detailCell}>
                      <Text style={pm.detailLabel}>{l}</Text>
                      <Text style={pm.detailValue}>{v}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Schedule */}
              <View style={pm.section}>
                <View style={[pm.sectionHeader, { backgroundColor: '#102C55' }]}>
                  <Text style={pm.sectionHeaderTxt}>📅 EXAMINATION SCHEDULE</Text>
                  <Text style={pm.scheduleNote}>REPORT 15 MINUTES EARLY</Text>
                </View>
                <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFF', padding: 8 }}>
                  {['Subject', 'Date', 'Start', 'End', 'Marks'].map((h, i) => (
                    <Text key={h} style={[pm.schedHead, i === 0 && { flex: 2 }]}>{h}</Text>
                  ))}
                </View>
                {schedule.map((row, i) => (
                  <View key={row.subject} style={[pm.schedRow, i % 2 === 1 && { backgroundColor: '#F8FAFF' }]}>
                    <Text style={[pm.schedCell, { flex: 2, fontWeight: '700' }]}>{row.subject}</Text>
                    <Text style={pm.schedCell}>{fmtDate(row.date)}</Text>
                    <Text style={pm.schedCell}>{row.startTime}</Text>
                    <Text style={pm.schedCell}>{row.endTime}</Text>
                    <Text style={pm.schedCell}>{row.maxMarks}</Text>
                  </View>
                ))}
              </View>

              {/* Instructions preview */}
              <View style={pm.instrSection}>
                <Text style={pm.instrTitle}>CANDIDATE INSTRUCTIONS</Text>
                <View style={pm.instrGrid}>
                {INSTRUCTIONS.slice(0, 4).map((ins, i) => (
                  <Text key={i} style={pm.instrItem}><Text style={pm.instrNumber}>{String(i + 1).padStart(2, '0')} </Text>{ins}</Text>
                ))}
                </View>
              </View>

              {/* Signatures */}
              <View style={pm.sigRow}>
                {[
                  { label: 'Principal', kind: 'principal' as const },
                  { label: 'Student', kind: 'student' as const },
                ].map(s => (
                  <View key={s.kind} style={pm.sigBox}>
                    <View style={[pm.sigLine, { borderTopColor: '#102C55' }]}>
                      {s.kind === 'principal' && (documentBranding.principalSignatureDataUrl || documentBranding.signatureDataUrl) && (
                        <Image source={{ uri: documentBranding.principalSignatureDataUrl || documentBranding.signatureDataUrl! }} style={pm.signatureImage} resizeMode="contain" />
                      )}
                    </View>
                    <Text style={[pm.sigTxt, { color: '#102C55' }]}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Action buttons */}
            <View style={pm.actions}>
              <TouchableOpacity style={pm.printBtn} onPress={() => { setPreviewVisible(false); setTimeout(() => printStudent(previewStudent), 200); }} activeOpacity={0.85}>
                <LinearGradient colors={tmpl.grad} style={pm.btnGrad}>
                  <Feather name="printer" size={18} color="#fff" />
                  <Text style={pm.btnTxt}>Print</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={pm.dlBtn} onPress={() => { setPreviewVisible(false); setTimeout(() => downloadStudent(previewStudent), 200); }} activeOpacity={0.85}>
                <LinearGradient colors={['#D97706', '#F59E0B']} style={pm.btnGrad}>
                  <Feather name="download" size={18} color="#fff" />
                  <Text style={pm.btnTxt}>Download PDF</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // ── Main screen ───────────────────────────────────────────────────────────────
  return (
    <View style={st.container}>
      <PDFSavedModal
        visible={!!pdfSaved}
        filename={pdfSaved?.filename ?? ''}
        fileUri={pdfSaved?.fileUri}
        onDismiss={() => setPdfSaved(null)}
      />
      {/* ── Page Header */}
      <LinearGradient colors={['#1e3a8a', '#2563EB']} style={[st.pageHeader, { paddingTop: insets.top + 12 }]}>
        <View style={st.phInner}>
          <View>
            <Text style={st.phTitle}>Admit Cards</Text>
            <Text style={st.phSub}>{students.length} students • {exams.length} exams • {acYear}</Text>
          </View>
          <View style={st.phBadge}>
            <Feather name="file-text" size={20} color="#fff" />
          </View>
        </View>

        {/* Mode tabs */}
        <View style={st.modeTabs}>
          {([['individual', 'person', 'Individual'], ['class', 'users', 'Class / Bulk']] as const).map(([m, icon, label]) => (
            <TouchableOpacity
              key={m}
              style={[st.modeTab, mode === m && st.modeTabActive]}
              onPress={() => { setMode(m); setBulkSelected(new Set()); }}
              activeOpacity={0.8}
            >
              <Feather name={icon as any} size={15} color={mode === m ? '#1e3a8a' : 'rgba(255,255,255,0.8)'} />
              <Text style={[st.modeTabTxt, mode === m && { color: '#1e3a8a' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: botPad }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={st.body}>

          {/* ── Filters ────────────────────────────────────────────────────────── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Filters</Text>
            <View style={st.filterRow}>
              {/* Exam selector */}
              <TouchableOpacity style={[st.picker, { flex: 3 }]} onPress={() => setShowExamPicker(true)} activeOpacity={0.85}>
                <Feather name="book-open" size={15} color={selectedExam ? '#2563EB' : '#94A3B8'} />
                <Text style={[st.pickerTxt, selectedExam && { color: '#0F172A' }]} numberOfLines={1}>
                  {selectedExam ? selectedExam.name : 'Select Exam…'}
                </Text>
                <Feather name="chevron-down" size={14} color="#94A3B8" />
              </TouchableOpacity>

              {/* Class selector */}
              <TouchableOpacity style={[st.picker, { flex: 2 }]} onPress={() => setShowClassPicker(true)} activeOpacity={0.85}>
                <Feather name="layers" size={15} color={selectedClass ? '#2563EB' : '#94A3B8'} />
                <Text style={[st.pickerTxt, selectedClass && { color: '#0F172A' }]}>
                  {selectedClass || 'Class…'}
                </Text>
                <Feather name="chevron-down" size={14} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Academic Session selector */}
            <TouchableOpacity style={[st.picker, st.sessionPicker]} onPress={() => setShowSessionPicker(true)} activeOpacity={0.85}>
              <Feather name="calendar" size={15} color="#7C3AED" />
              <View style={{ flex: 1 }}>
                <Text style={st.sessionPickerLabel}>Academic Session</Text>
                <Text style={st.sessionPickerValue}>{selectedSession}</Text>
              </View>
              <Feather name="chevron-down" size={14} color="#94A3B8" />
            </TouchableOpacity>

            {/* Selected exam info */}
            {selectedExam && (
              <View style={st.examInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={st.examInfoName}>{selectedExam.name}</Text>
                  <Text style={st.examInfoMeta}>Class {selectedExam.class} • {fmtDate(selectedExam.date)} • {selectedExam.subjects.length} subjects</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedExam(null)} style={st.clearBtn}>
                  <Feather name="x" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Template Picker ──────────────────────────────────────────────── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Design Template</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {TEMPLATES.map(tmpl => (
                <TouchableOpacity
                  key={tmpl.id}
                  style={[st.tmplCard, template === tmpl.id && st.tmplCardActive]}
                  onPress={() => setTemplate(tmpl.id)}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={tmpl.grad} style={st.tmplThumb}>
                    {/* Mini admit card preview */}
                    <View style={st.tmplMiniHeader} />
                    <View style={[st.tmplAccent, { backgroundColor: tmpl.accent }]} />
                    <View style={st.tmplMiniLines}>
                      <View style={st.tmplLine} />
                      <View style={[st.tmplLine, { width: '70%' }]} />
                      <View style={[st.tmplLine, { width: '85%', marginTop: 6 }]} />
                      <View style={[st.tmplLine, { width: '60%' }]} />
                    </View>
                    <View style={st.tmplMiniTable}>
                      {[0,1,2].map(i => <View key={i} style={[st.tmplTableRow, i === 0 && { backgroundColor: 'rgba(255,255,255,0.3)' }]} />)}
                    </View>
                  </LinearGradient>
                  <View style={st.tmplInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={st.tmplLabel}>{tmpl.label}</Text>
                      {template === tmpl.id && <Feather name="check-circle" size={14} color="#2563EB" />}
                    </View>
                    <Text style={st.tmplSub}>{tmpl.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── Individual Mode ──────────────────────────────────────────────── */}
          {mode === 'individual' && (
            <View style={st.section}>
              <View style={st.sectionRow}>
                <Text style={st.sectionTitle}>
                  Students {filteredStudents.length > 0 ? `(${filteredStudents.length})` : ''}
                </Text>
              </View>
              {/* Search */}
              <View style={st.searchBar}>
                <Feather name="search" size={16} color="#94A3B8" />
                <TextInput
                  style={st.searchInput}
                  placeholder="Search by name, roll no., class…"
                  placeholderTextColor="#94A3B8"
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={15} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {filteredStudents.length === 0 ? (
                <View style={st.empty}>
                  <Feather name="users" size={36} color="#CBD5E1" />
                  <Text style={st.emptyTxt}>
                    {students.length === 0 ? 'No students added yet.' : 'No students match your filters.'}
                  </Text>
                </View>
              ) : (
                filteredStudents.map(item => (
                  <React.Fragment key={item.id}>
                    {renderStudentRow({ item })}
                  </React.Fragment>
                ))
              )}
            </View>
          )}

          {/* ── Class Bulk Mode ──────────────────────────────────────────────── */}
          {mode === 'class' && (
            <View style={st.section}>
              {!selectedClass ? (
                <View style={st.empty}>
                  <Feather name="layers" size={36} color="#CBD5E1" />
                  <Text style={st.emptyTxt}>Select a class above to generate bulk admit cards.</Text>
                </View>
              ) : (
                <>
                  {/* Bulk action bar */}
                  <View style={st.bulkBar}>
                    <TouchableOpacity style={st.selectAllBtn} onPress={toggleAll} activeOpacity={0.8}>
                      <View style={[st.checkbox, bulkSelected.size === bulkList.length && bulkList.length > 0 && { backgroundColor: '#2563EB', borderColor: '#2563EB' }]}>
                        {bulkSelected.size === bulkList.length && bulkList.length > 0 && <Feather name="check" size={13} color="#fff" />}
                      </View>
                      <Text style={st.selectAllTxt}>
                        {bulkSelected.size === 0 ? 'Select All' : `${bulkSelected.size} / ${bulkList.length} selected`}
                      </Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity style={st.bulkPrintBtn} onPress={bulkPrint} activeOpacity={0.85}>
                      <Feather name="printer" size={15} color="#fff" />
                      <Text style={st.bulkBtnTxt}>Print All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={st.bulkDlBtn} onPress={bulkDownload} activeOpacity={0.85}>
                      <Feather name="download" size={15} color="#fff" />
                      <Text style={st.bulkBtnTxt}>PDF</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Student list */}
                  {bulkList.length === 0 ? (
                    <View style={st.empty}>
                      <Text style={st.emptyTxt}>No students in class {selectedClass}.</Text>
                    </View>
                  ) : (
                    bulkList.map(item => (
                      <React.Fragment key={item.id}>
                        {renderStudentRow({ item })}
                      </React.Fragment>
                    ))
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Loading Overlay ─────────────────────────────────────────────────── */}
      {loading && (
        <View style={st.loadingOverlay}>
          <View style={st.loadingBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={st.loadingTxt}>Generating PDF…</Text>
          </View>
        </View>
      )}

      {/* ── Exam Picker Modal ────────────────────────────────────────────────── */}
      <Modal visible={showExamPicker} transparent animationType="slide" onRequestClose={() => setShowExamPicker(false)}>
        <View style={mo.overlay}>
          <View style={mo.sheet}>
            <View style={mo.sheetHeader}>
              <Text style={mo.sheetTitle}>Select Exam</Text>
              <TouchableOpacity onPress={() => setShowExamPicker(false)}><Feather name="x" size={22} color="#64748B" /></TouchableOpacity>
            </View>
            <ScrollView style={mo.sheetScroll}>
              {exams.length === 0 ? (
                <Text style={mo.emptyTxt}>No exams created yet. Go to the Exams tab to create one.</Text>
              ) : (
                exams.map(exam => (
                  <TouchableOpacity
                    key={exam.id}
                    style={[mo.item, selectedExam?.id === exam.id && mo.itemActive]}
                    onPress={() => { setSelectedExam(exam); setShowExamPicker(false); if (!selectedClass && exam.class) setSelectedClass(exam.class); }}
                    activeOpacity={0.8}
                  >
                    <View style={mo.itemIcon}>
                      <Feather name="book-open" size={18} color={selectedExam?.id === exam.id ? '#fff' : '#2563EB'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[mo.itemName, selectedExam?.id === exam.id && { color: '#fff' }]}>{exam.name}</Text>
                      <Text style={[mo.itemMeta, selectedExam?.id === exam.id && { color: 'rgba(255,255,255,0.75)' }]}>
                        Class {exam.class} • {fmtDate(exam.date)} • {exam.subjects.length} subjects
                      </Text>
                    </View>
                    {selectedExam?.id === exam.id && <Feather name="check" size={18} color="#fff" />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Class Picker Modal ───────────────────────────────────────────────── */}
      <Modal visible={showClassPicker} transparent animationType="slide" onRequestClose={() => setShowClassPicker(false)}>
        <View style={mo.overlay}>
          <View style={mo.sheet}>
            <View style={mo.sheetHeader}>
              <Text style={mo.sheetTitle}>Select Class</Text>
              <TouchableOpacity onPress={() => setShowClassPicker(false)}><Feather name="x" size={22} color="#64748B" /></TouchableOpacity>
            </View>
            <ScrollView style={mo.sheetScroll}>
              <TouchableOpacity style={[mo.item, !selectedClass && mo.itemActive]} onPress={() => { setSelectedClass(''); setShowClassPicker(false); }} activeOpacity={0.8}>
                <Text style={[mo.itemName, !selectedClass && { color: '#fff' }]}>All Classes</Text>
                {!selectedClass && <Feather name="check" size={18} color="#fff" />}
              </TouchableOpacity>
              {classOptions.map(cls => (
                <TouchableOpacity
                  key={cls}
                  style={[mo.item, selectedClass === cls && mo.itemActive]}
                  onPress={() => { setSelectedClass(cls); setShowClassPicker(false); setBulkSelected(new Set()); }}
                  activeOpacity={0.8}
                >
                  <View style={mo.itemIcon}>
                    <Feather name="layers" size={18} color={selectedClass === cls ? '#fff' : '#2563EB'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[mo.itemName, selectedClass === cls && { color: '#fff' }]}>Class {cls}</Text>
                    <Text style={[mo.itemMeta, selectedClass === cls && { color: 'rgba(255,255,255,0.75)' }]}>
                      {students.filter(s => s.class === cls).length} students
                    </Text>
                  </View>
                  {selectedClass === cls && <Feather name="check" size={18} color="#fff" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Academic Session Picker Modal ──────────────────────────────────── */}
      <Modal visible={showSessionPicker} transparent animationType="slide" onRequestClose={() => setShowSessionPicker(false)}>
        <View style={mo.overlay}>
          <View style={mo.sheet}>
            <View style={mo.sheetHeader}>
              <Text style={mo.sheetTitle}>Academic Session</Text>
              <TouchableOpacity onPress={() => setShowSessionPicker(false)}><Feather name="x" size={22} color="#64748B" /></TouchableOpacity>
            </View>
            <ScrollView style={mo.sheetScroll} keyboardShouldPersistTaps="handled">
              {/* Add new session */}
              <View style={so.addRow}>
                <TextInput
                  style={so.addInput}
                  placeholder="e.g. 2025–2026"
                  placeholderTextColor="#94A3B8"
                  value={newSessionInput}
                  onChangeText={setNewSessionInput}
                  returnKeyType="done"
                  onSubmitEditing={handleAddSession}
                />
                <TouchableOpacity
                  style={[so.addBtn, (!newSessionInput.trim() || sessionSaving) && { opacity: 0.5 }]}
                  onPress={handleAddSession}
                  disabled={!newSessionInput.trim() || sessionSaving}
                  activeOpacity={0.8}
                >
                  {sessionSaving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Feather name="plus" size={18} color="#fff" />}
                </TouchableOpacity>
              </View>

              {/* Existing sessions */}
              {academicSessions.map(session => (
                <TouchableOpacity
                  key={session}
                  style={[mo.item, selectedSession === session && mo.itemActive]}
                  onPress={() => handleSelectSession(session)}
                  activeOpacity={0.8}
                >
                  <View style={[mo.itemIcon, selectedSession === session && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Feather name="calendar" size={18} color={selectedSession === session ? '#fff' : '#7C3AED'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[mo.itemName, selectedSession === session && { color: '#fff' }]}>{session}</Text>
                    {selectedSession === session && (
                      <Text style={[mo.itemMeta, { color: 'rgba(255,255,255,0.75)' }]}>Active session</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {selectedSession === session && <Feather name="check" size={18} color="#fff" />}
                    {academicSessions.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleDeleteSession(session)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[so.deleteBtn, selectedSession === session && { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                      >
                        <Feather name="trash-2" size={14} color={selectedSession === session ? '#fff' : '#EF4444'} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {renderPreviewModal()}

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },

  // Header
  pageHeader: { paddingHorizontal: 20, paddingBottom: 16 },
  phInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  phTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  phSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  phBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  modeTabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, padding: 4, gap: 4 },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10, borderRadius: 10 },
  modeTabActive: { backgroundColor: '#fff' },
  modeTabTxt: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

  // Body
  body: { padding: 16, gap: 20 },
  section: { gap: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },

  // Filters
  filterRow: { flexDirection: 'row', gap: 10 },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  pickerTxt: { flex: 1, fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  examInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BFDBFE', gap: 10 },
  examInfoName: { fontSize: 13, fontWeight: '700', color: '#1e3a8a' },
  examInfoMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  clearBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },

  // Template cards
  tmplCard: { width: 160, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  tmplCardActive: { borderColor: '#2563EB', shadowColor: '#2563EB', shadowOpacity: 0.18 },
  tmplThumb: { height: 110, padding: 10, overflow: 'hidden' },
  tmplMiniHeader: { height: 18, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, marginBottom: 5 },
  tmplAccent: { height: 2.5, borderRadius: 2, marginBottom: 8 },
  tmplMiniLines: { gap: 4 },
  tmplLine: { height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, width: '100%' },
  tmplMiniTable: { marginTop: 8, gap: 3 },
  tmplTableRow: { height: 7, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
  tmplInfo: { padding: 10, gap: 3 },
  tmplLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  tmplSub: { fontSize: 11, color: '#64748B' },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },

  // Student rows
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  studentRowSelected: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  rowAvatar: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowAvatarTxt: { fontSize: 14, fontWeight: '900', color: '#fff' },
  rowName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  rowBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },

  // Bulk bar
  bulkBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: '#e2e8f0' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllTxt: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  bulkPrintBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  bulkDlBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#D97706', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  bulkBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Empty
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  emptyTxt: { fontSize: 14, color: '#94A3B8', textAlign: 'center', maxWidth: 260 },

  // Loading overlay
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 99 },
  loadingBox: { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24 },
  loadingTxt: { fontSize: 15, fontWeight: '600', color: '#0F172A' },

  // Academic Session picker button (full-width row below exam+class pickers)
  sessionPicker:      { borderColor: '#EDE9FE', backgroundColor: '#FAFAFF', marginTop: 8 },
  sessionPickerLabel: { fontSize: 10, color: '#7C3AED', fontWeight: '700', letterSpacing: 0.5, marginBottom: 1 },
  sessionPickerValue: { fontSize: 14, color: '#1e1b4b', fontWeight: '800' },
});

// Preview modal styles
const pm = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { marginBottom: 10 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  cardHeader: { padding: 18, flexDirection: 'row', alignItems: 'center' },
  schoolLogo: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, flexShrink: 0 },
  schoolLogoImage: { width: 46, height: 46 },
  schoolLogoTxt: { fontSize: 16, fontWeight: '900' },
  schoolEyebrow: { fontSize: 8, fontWeight: '800', letterSpacing: 1.2, marginBottom: 3 },
  schoolName: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  schoolAddr: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  admitBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  admitBadgeTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  accentBar: { height: 3 },

  examBar: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8, backgroundColor: '#F8FAFF', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  examChip: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  examChipLabel: { fontSize: 9, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  examChipValue: { fontSize: 12, color: '#1e3a8a', fontWeight: '800' },

  candidateDetails: { margin: 14, borderWidth: 1, borderColor: '#CBD7E5', borderRadius: 4, overflow: 'hidden' },
  candidateDetailsHeader: { padding: 10, backgroundColor: '#EDF3F9', borderBottomWidth: 1, borderBottomColor: '#CBD7E5', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  candidateDetailsTitle: { color: '#102C55', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  candidateDetailsMeta: { color: '#728198', fontSize: 8, letterSpacing: 0.7 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, columnGap: 14 },
  detailCell: { width: '47%', flexDirection: 'row', gap: 7, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  detailLabel: { color: '#728198', fontSize: 10, width: 75 },
  detailValue: { color: '#1D3557', fontSize: 10, fontWeight: '700', flex: 1 },

  section: { borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  sectionHeader: { padding: 10, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderTxt: { fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  scheduleNote: { fontSize: 8, fontWeight: '700', color: '#D9BD70', letterSpacing: 0.6 },
  schedHead: { flex: 1, fontSize: 11, fontWeight: '700', color: '#374151', paddingHorizontal: 8 },
  schedRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  schedCell: { flex: 1, fontSize: 11, color: '#374151', padding: 8, paddingHorizontal: 8 },

  instrSection: { marginHorizontal: 14, padding: 12, backgroundColor: '#F8F5ED', borderLeftWidth: 4, borderLeftColor: '#D9BD70' },
  instrTitle: { fontSize: 11, fontWeight: '800', color: '#102C55', letterSpacing: 0.7, marginBottom: 8 },
  instrGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  instrItem: { width: '47%', fontSize: 10, color: '#50627A', marginBottom: 4, lineHeight: 15 },
  instrNumber: { color: '#B18B35', fontWeight: '800' },

  sigRow: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  sigBox: { flex: 1, alignItems: 'center' },
  sigLine: { width: '80%', height: 34, borderTopWidth: 1.5, marginBottom: 6, alignItems: 'center', justifyContent: 'flex-end' },
  signatureImage: { width: 100, height: 30, marginBottom: 1 },
  sigTxt: { fontSize: 10, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  printBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  dlBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  btnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  btnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

// Session modal add-row styles
const so = StyleSheet.create({
  addRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  addInput:  { flex: 1, height: 46, backgroundColor: '#F8FAFF', borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: '#0F172A', borderWidth: 1.5, borderColor: '#DDD6FE' },
  addBtn:    { width: 46, height: 46, borderRadius: 12, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
});

// Picker modal styles
const mo = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  sheetScroll: { padding: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1.5, borderColor: '#e2e8f0' },
  itemActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  itemIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  itemMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  emptyTxt: { textAlign: 'center', color: '#94A3B8', fontSize: 14, padding: 20, lineHeight: 22 },
});
