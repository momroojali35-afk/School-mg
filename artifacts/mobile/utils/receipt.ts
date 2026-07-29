import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert, Linking } from 'react-native';
import { SCHOOL_INFO } from '@/constants/schoolInfo';
import { FeeRecord, SalaryRecord, Student, Teacher } from '@/context/AppContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const months = ['January','February','March','April','May','June','July',
    'August','September','October','November','December'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMonth(dateStr: string): string {
  const months = ['January','February','March','April','May','June','July',
    'August','September','October','November','December'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function toWords(num: number): string {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (num === 0) return 'Zero Rupees Only';
  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)]+' Hundred'+(n%100 ? ' '+convert(n%100) : '');
    if (n < 100000) return convert(Math.floor(n/1000))+' Thousand'+(n%1000 ? ' '+convert(n%1000) : '');
    if (n < 10000000) return convert(Math.floor(n/100000))+' Lakh'+(n%100000 ? ' '+convert(n%100000) : '');
    return convert(Math.floor(n/10000000))+' Crore'+(n%10000000 ? ' '+convert(n%10000000) : '');
  };
  return convert(Math.round(num)) + ' Rupees Only';
}

// ─── Fee Receipt HTML ─────────────────────────────────────────────────────────
function buildFeeReceiptHTML(record: FeeRecord, student?: Student): string {
  const receiptNo = record.receiptNumber ?? ('FR-'+new Date().getFullYear()+'-'+String(Math.abs(record.id.split('').reduce((a,c)=>a+c.charCodeAt(0),0))).slice(-6).padStart(6,'0'));
  const dateStr  = formatDate(record.date || new Date().toISOString().split('T')[0]);
  const monthStr = formatMonth(record.date || new Date().toISOString().split('T')[0]);
  const amtWords = toWords(record.amount);
  const fatherName = student?.fatherName ?? '—';
  const rollNo = student?.rollNumber ?? '—';
  const amtFmt = record.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:Arial,sans-serif; background:#fff; color:#1a1a2e; font-size:13px; }
.page { max-width:760px; margin:0 auto; padding:24px 20px; }

/* ── HEADER ── */
.hdr { display:flex; align-items:flex-start; gap:14px; border-bottom:3px solid #1565C0; padding-bottom:14px; margin-bottom:16px; }
.logo-ring { width:88px; height:88px; border-radius:50%; border:3px solid #1565C0; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#fff; }
.logo-disc { width:80px; height:80px; border-radius:50%; background:#1565C0; display:flex; align-items:center; justify-content:center; flex-direction:column; text-align:center; }
.logo-disc span { color:#fff; font-size:6.5px; font-weight:900; line-height:1.3; text-transform:uppercase; }
.logo-disc .est { font-size:8px; }
.school-info { flex:1; }
.sch-name { font-size:19px; font-weight:900; color:#1565C0; text-transform:uppercase; line-height:1.2; }
.sch-row { display:flex; align-items:center; gap:5px; margin-top:5px; font-size:11.5px; color:#333; }
.sch-icon { color:#1565C0; font-size:12px; width:16px; }
.rhs { flex-shrink:0; min-width:168px; }
.rhs-title { font-size:24px; font-weight:900; color:#1565C0; letter-spacing:1px; text-align:right; margin-bottom:10px; }
.tag-lbl { background:#1565C0; color:#fff; font-size:10px; font-weight:700; padding:4px 0; text-align:center; letter-spacing:1px; }
.tag-val { border:2px solid #1565C0; font-size:13px; font-weight:700; padding:5px; text-align:center; color:#E53935; }
.tag-val-date { border:2px solid #1565C0; border-top:none; font-size:12.5px; font-weight:600; padding:5px; text-align:center; color:#333; }
.tag-lbl2 { background:#1565C0; color:#fff; font-size:10px; font-weight:700; padding:4px 0; text-align:center; letter-spacing:1px; margin-top:8px; }

/* ── STUDENT CARD ── */
.stu-card { border:1.5px solid #c5cae9; border-radius:8px; display:flex; align-items:center; gap:14px; padding:14px 16px; margin-bottom:18px; }
.stu-avatar { width:78px; height:78px; border-radius:50%; background:linear-gradient(135deg,#90CAF9,#5C6BC0); flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:36px; }
.stu-fields { flex:1; }
.f-row { display:flex; font-size:12.5px; margin-bottom:5px; }
.f-lbl { font-weight:700; color:#333; width:126px; flex-shrink:0; }
.f-sep { margin:0 7px; color:#666; }
.f-val { color:#1a1a2e; }
.rupee-circle { width:58px; height:58px; border-radius:50%; border:2px solid #1565C0; display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:700; color:#1565C0; flex-shrink:0; }
.mo-box { flex-shrink:0; min-width:92px; }
.mo-lbl { background:#1565C0; color:#fff; font-size:10px; font-weight:700; padding:4px 0; text-align:center; letter-spacing:1px; }
.mo-val { border:2px solid #1565C0; border-top:none; font-size:12px; font-weight:600; padding:5px 8px; text-align:center; color:#333; }

/* ── FEE TABLE ── */
.fee-tbl { width:100%; border-collapse:collapse; margin-bottom:0; }
.fee-tbl .sec-hdr th { background:#1a237e; color:#fff; text-align:center; font-size:13px; font-weight:700; letter-spacing:2px; padding:10px; }
.fee-tbl .col-hdr th { background:#e8eaf6; color:#1a237e; font-size:12px; font-weight:700; padding:8px 12px; border:1px solid #c5cae9; }
.fee-tbl .col-hdr th:first-child { text-align:center; width:50px; }
.fee-tbl .col-hdr th:nth-child(3),
.fee-tbl .col-hdr th:nth-child(4) { text-align:right; width:130px; }
.fee-tbl td { border:1px solid #ddd; padding:9px 12px; font-size:12.5px; }
.fee-tbl td:first-child { text-align:center; color:#555; }
.fee-tbl td:nth-child(3),
.fee-tbl td:nth-child(4) { text-align:right; }
.foot-row td { border:1px solid #ddd; }
.words-cell { padding:9px 12px; }
.words-lbl { font-size:11px; color:#666; margin-bottom:3px; }
.words-val { font-weight:700; font-size:13px; color:#1a1a2e; }
.total-wrap { display:flex; height:100%; }
.total-lbl { background:#1a237e; color:#fff; font-size:11px; font-weight:700; padding:10px 12px; display:flex; align-items:center; letter-spacing:.5px; white-space:nowrap; }
.total-amt { background:#E8F5E9; color:#1B5E20; font-size:17px; font-weight:900; padding:10px 14px; border-left:none; display:flex; align-items:center; flex:1; justify-content:flex-end; }

/* ── BOTTOM BOXES ── */
.bottom { display:flex; gap:14px; margin-top:16px; }
.b-box { flex:1; border:1.5px solid #ddd; border-radius:8px; overflow:hidden; }
.b-hdr { display:flex; align-items:center; gap:8px; padding:9px 14px; }
.b-icon { font-size:18px; }
.b-title-green { color:#00796B; font-size:12px; font-weight:800; letter-spacing:.5px; }
.b-title-blue { color:#1565C0; font-size:12px; font-weight:800; letter-spacing:.5px; }
.b-body { padding:6px 14px 12px; }
.p-row { display:flex; font-size:11.5px; margin-bottom:5px; }
.p-lbl { font-weight:600; color:#555; width:108px; flex-shrink:0; }
.p-sep { margin:0 5px; color:#999; }
.p-val { color:#1a1a2e; }
.note { font-size:11px; color:#333; margin-bottom:4px; display:flex; gap:5px; }
.note-dot { color:#1565C0; flex-shrink:0; }

/* ── SIGNATURES ── */
.sig-row { display:flex; justify-content:space-between; align-items:flex-end; margin-top:30px; }
.sig-col { text-align:center; }
.sig-name { font-size:14px; font-style:italic; font-weight:700; color:#333; margin-bottom:2px; }
.sig-line { width:140px; border-top:1.5px solid #333; margin:0 auto 6px; }
.sig-lbl { font-size:10.5px; color:#555; margin-top:4px; }
.stamp-ring { width:88px; height:88px; border-radius:50%; border:2px dashed #1565C0; display:flex; align-items:center; justify-content:center; margin:0 auto; }
.stamp-inner { width:78px; height:78px; border-radius:50%; border:1.5px solid #1565C0; display:flex; align-items:center; justify-content:center; }
.stamp-txt { font-size:5.5px; font-weight:700; color:#1565C0; text-transform:uppercase; text-align:center; line-height:1.4; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="hdr">
    <div class="logo-ring">
      <div class="logo-disc">
        <span>DR.A.P.J</span>
        <span class="est">ESTD 2016</span>
        <span>ABDUL KALAM</span>
        <span>JATIYA</span>
        <span>VIDYALAYA</span>
      </div>
    </div>
    <div class="school-info">
      <div class="sch-name">${SCHOOL_INFO.name}</div>
      <div class="sch-row"><span class="sch-icon">📍</span><span>${SCHOOL_INFO.address}</span></div>
      <div class="sch-row"><span class="sch-icon">📞</span><span>Contact - ${SCHOOL_INFO.contact}</span></div>
      <div class="sch-row"><span class="sch-icon">✉</span><span>Email - ${SCHOOL_INFO.email}</span></div>
    </div>
    <div class="rhs">
      <div class="rhs-title">FEE RECEIPT</div>
      <div class="tag-lbl">RECEIPT NO.</div>
      <div class="tag-val">${receiptNo}</div>
      <div class="tag-lbl2">DATE</div>
      <div class="tag-val-date">${dateStr}</div>
    </div>
  </div>

  <!-- STUDENT CARD -->
  <div class="stu-card">
    <div class="stu-avatar">👤</div>
    <div class="stu-fields">
      <div class="f-row"><span class="f-lbl">Student Name</span><span class="f-sep">:</span><span class="f-val">${record.studentName}</span></div>
      <div class="f-row"><span class="f-lbl">Father's Name</span><span class="f-sep">:</span><span class="f-val">${fatherName}</span></div>
      <div class="f-row"><span class="f-lbl">Class &amp; Section</span><span class="f-sep">:</span><span class="f-val">${record.class}</span></div>
      <div class="f-row"><span class="f-lbl">Roll No.</span><span class="f-sep">:</span><span class="f-val">${rollNo}</span></div>
    </div>
    <div class="rupee-circle">₹</div>
    <div class="mo-box">
      <div class="mo-lbl">MONTH</div>
      <div class="mo-val">${monthStr}</div>
    </div>
  </div>

  <!-- FEE DETAILS TABLE -->
  <table class="fee-tbl">
    <tr class="sec-hdr"><th colspan="4">FEE DETAILS</th></tr>
    <tr class="col-hdr">
      <th>S.No.</th>
      <th style="text-align:left;">Particulars</th>
      <th>Due Amount (₹)</th>
      <th>Paid Amount (₹)</th>
    </tr>
    <tr>
      <td>1</td>
      <td>${record.description || record.feeTypeName || 'Fee'}</td>
      <td>${amtFmt}</td>
      <td>${amtFmt}</td>
    </tr>
    <tr class="foot-row">
      <td colspan="2" class="words-cell">
        <div class="words-lbl">Amount in Words:</div>
        <div class="words-val">${amtWords}</div>
      </td>
      <td colspan="2" style="padding:0;border:1px solid #ddd;">
        <div class="total-wrap">
          <div class="total-lbl">TOTAL AMOUNT PAID</div>
          <div class="total-amt">₹ ${amtFmt}</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- PAYMENT INFO + NOTES -->
  <div class="bottom">
    <div class="b-box">
      <div class="b-hdr">
        <span class="b-icon">💳</span>
        <span class="b-title-green">PAYMENT INFORMATION</span>
      </div>
      <div class="b-body">
        <div class="p-row"><span class="p-lbl">Payment Mode</span><span class="p-sep">:</span><span class="p-val">Cash</span></div>
        <div class="p-row"><span class="p-lbl">Payment Date</span><span class="p-sep">:</span><span class="p-val">${dateStr}</span></div>
        <div class="p-row"><span class="p-lbl">Received By</span><span class="p-sep">:</span><span class="p-val">${record.collectedBy ?? 'Admin'}</span></div>
      </div>
    </div>
    <div class="b-box">
      <div class="b-hdr">
        <span class="b-icon">🛡️</span>
        <span class="b-title-blue">IMPORTANT NOTES</span>
      </div>
      <div class="b-body">
        <div class="note"><span class="note-dot">•</span><span>This receipt is computer generated.</span></div>
        <div class="note"><span class="note-dot">•</span><span>Fees once paid will not be refunded.</span></div>
        <div class="note"><span class="note-dot">•</span><span>Please keep this receipt for future reference.</span></div>
        <div class="note"><span class="note-dot">•</span><span>For any queries, contact the school office.</span></div>
      </div>
    </div>
  </div>

  <!-- SIGNATURES -->
  <div class="sig-row">
    <div class="sig-col">
      <div class="sig-name">${record.collectedBy ?? 'Admin'}</div>
      <div class="sig-line"></div>
      <div class="sig-lbl">Receiver's Signature</div>
    </div>
    <div class="sig-col">
      <div class="stamp-ring">
        <div class="stamp-inner">
          <div class="stamp-txt">DR. A.P.J<br/>ABDUL KALAM<br/>JATIYA<br/>VIDYALAYA<br/>BUNDURA</div>
        </div>
      </div>
    </div>
    <div class="sig-col">
      <div class="sig-line"></div>
      <div class="sig-lbl">Authorised Signature<br/>(Principal)</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ─── Public: Print / Share fee receipt as PDF ─────────────────────────────────
export async function printFeeReceipt(record: FeeRecord, student?: Student) {
  const html = buildFeeReceiptHTML(record, student);
  await printOrShare(html, `FeeReceipt_${record.studentName.replace(/\s+/g,'_')}_${record.receiptNumber ?? record.id.slice(-6)}`);
}

// ─── Public: Share receipt via WhatsApp (text message) ───────────────────────
export async function shareReceiptWhatsApp(record: FeeRecord, student?: Student) {
  const receiptNo = record.receiptNumber ?? record.id.slice(-8).toUpperCase();
  const dateStr   = formatDate(record.date || new Date().toISOString().split('T')[0]);
  const monthStr  = formatMonth(record.date || new Date().toISOString().split('T')[0]);
  const amtWords  = toWords(record.amount);

  const text =
`🏫 *${SCHOOL_INFO.name}*
📍 ${SCHOOL_INFO.address}  |  📞 ${SCHOOL_INFO.contact}

🧾 *FEE RECEIPT*
━━━━━━━━━━━━━━━━━━━━
📋 Receipt No : *${receiptNo}*
📅 Date       : *${dateStr}*
━━━━━━━━━━━━━━━━━━━━

👤 *Student Details*
• Name    : ${record.studentName}
${student?.fatherName ? `• Father  : ${student.fatherName}` : ''}• Class   : ${record.class}
${student?.rollNumber  ? `• Roll No : ${student.rollNumber}` : ''}
💳 *Fee Details*
• Particulars : ${record.description || record.feeTypeName || 'Fee'}
• Month       : ${monthStr}
• Amount Paid : *₹${record.amount.toLocaleString('en-IN')}*
• In Words    : _${amtWords}_

✅ *Payment Received*
• Mode         : Cash
• Received By  : ${record.collectedBy ?? 'Admin'}
━━━━━━━━━━━━━━━━━━━━
_This is a computer generated receipt._
_${SCHOOL_INFO.email}_`;

  // https://wa.me works on all platforms — opens WhatsApp app on mobile,
  // web.whatsapp.com in browser, no manifest permissions required.
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      'Could not open WhatsApp',
      'Share the PDF receipt instead?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share PDF', onPress: () => printFeeReceipt(record, student) },
      ]
    );
  }
}

// ─── Salary slip (unchanged design) ──────────────────────────────────────────
export async function printSalarySlip(record: SalaryRecord, teacher?: Teacher) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 28px; color: #1a1a2e; background: #fff; }
  .header { text-align: center; border-bottom: 3px solid #1565C0; padding-bottom: 16px; margin-bottom: 24px; }
  .school-name { font-size: 22px; font-weight: 900; color: #1565C0; }
  .school-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
  .slip-title { font-size: 18px; font-weight: 700; color: #1565C0; margin-top: 12px; letter-spacing: 2px; text-transform: uppercase; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .info-box { background: #f0f4f8; border-radius: 10px; padding: 14px; }
  .info-box h3 { font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
  .info-label { color: #64748b; }
  .info-value { font-weight: 600; color: #1a1a2e; }
  .salary-section { background: linear-gradient(135deg, #1565C0 0%, #0D47A1 100%); border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 24px; }
  .salary-label { color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .salary-value { color: #fff; font-size: 40px; font-weight: 900; }
  .period { color: rgba(255,255,255,0.75); font-size: 13px; margin-top: 6px; }
  .status-badge { display: inline-block; background: #059669; color: #fff; font-size: 13px; font-weight: 700; padding: 6px 20px; border-radius: 20px; margin-top: 10px; }
  .breakdown { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
  .breakdown h3 { background: #f8fafc; padding: 12px 16px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  .breakdown-row { display: flex; justify-content: space-between; padding: 10px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  .breakdown-total { display: flex; justify-content: space-between; padding: 12px 16px; font-size: 14px; font-weight: 700; color: #1565C0; background: #eff6ff; }
  .footer { border-top: 1px dashed #e2e8f0; padding-top: 14px; text-align: center; font-size: 11px; color: #94a3b8; }
  .footer strong { color: #1565C0; }
</style>
</head>
<body>
<div class="header">
  <div class="school-name">${SCHOOL_INFO.name}</div>
  <div class="school-sub">${SCHOOL_INFO.address} | ${SCHOOL_INFO.contact}</div>
  <div class="slip-title">Salary Slip</div>
</div>
<div class="info-grid">
  <div class="info-box">
    <h3>Teacher Details</h3>
    <div class="info-row"><span class="info-label">Name</span><span class="info-value">${record.teacherName}</span></div>
    ${teacher ? `<div class="info-row"><span class="info-label">Subject</span><span class="info-value">${teacher.subject}</span></div>` : ''}
    ${teacher ? `<div class="info-row"><span class="info-label">Mobile</span><span class="info-value">${teacher.mobileNumber}</span></div>` : ''}
  </div>
  <div class="info-box">
    <h3>Pay Period</h3>
    <div class="info-row"><span class="info-label">Month</span><span class="info-value">${record.month} ${record.year}</span></div>
    <div class="info-row"><span class="info-label">Mode</span><span class="info-value">Cash / Bank Transfer</span></div>
    <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:#059669;font-weight:700">PAID</span></div>
  </div>
</div>
<div class="salary-section">
  <div class="salary-label">Net Salary Paid</div>
  <div class="salary-value">₹${record.amount.toLocaleString('en-IN')}</div>
  <div class="period">For: ${record.month} ${record.year}</div>
  <div class="status-badge">✓ PAID</div>
</div>
<div class="breakdown">
  <h3>Salary Breakdown</h3>
  <div class="breakdown-row"><span>Basic Salary</span><span>₹${Math.round(record.amount * 0.7).toLocaleString('en-IN')}</span></div>
  <div class="breakdown-row"><span>HRA</span><span>₹${Math.round(record.amount * 0.2).toLocaleString('en-IN')}</span></div>
  <div class="breakdown-row"><span>Other Allowances</span><span>₹${Math.round(record.amount * 0.1).toLocaleString('en-IN')}</span></div>
  <div class="breakdown-row"><span>Deductions</span><span>₹0</span></div>
  <div class="breakdown-total"><span>Net Payable</span><span>₹${record.amount.toLocaleString('en-IN')}</span></div>
</div>
<div class="footer">
  <p>This is a computer-generated salary slip. No signature required.</p>
  <p style="margin-top:4px"><strong>${SCHOOL_INFO.name}</strong> | ${SCHOOL_INFO.email}</p>
  <p style="margin-top:4px">Generated on: ${new Date().toLocaleString('en-IN')}</p>
</div>
</body>
</html>`;
  await printOrShare(html, `SalarySlip_${record.teacherName.replace(/\s+/g,'_')}_${record.month}_${record.year}`);
}

// ─── Internal: generate PDF and open share sheet / print dialog ───────────────
async function printOrShare(html: string, filename: string) {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
    return;
  }
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: filename, UTI: 'com.adobe.pdf' });
    } else {
      await Print.printAsync({ uri });
    }
  } catch {
    Alert.alert('Error', 'Could not generate receipt. Please try again.');
  }
}
