import { Alert, Linking, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { SCHOOL_INFO } from '@/constants/schoolInfo';
import { Student } from '@/context/AppContext';

// ─── Build reminder message ───────────────────────────────────────────────────
export function buildReminderMessage(student: Student, customNote?: string): string {
  return (
`🏫 *${SCHOOL_INFO.name}*
📍 ${SCHOOL_INFO.address}  |  📞 ${SCHOOL_INFO.contact}

Dear Parent/Guardian of *${student.name}*,

This is a *friendly fee reminder* from ${SCHOOL_INFO.name}.

━━━━━━━━━━━━━━━━━━━━
👤 *Student Details*
• Name   : ${student.name}
• Class  : ${student.class}
• Roll   : ${student.rollNumber || '—'}
━━━━━━━━━━━━━━━━━━━━

${customNote ? `📝 *Note:* ${customNote}\n\n` : ''}⚠️ Kindly clear the *pending school fees* at the earliest to avoid any inconvenience.

For queries or payment, please visit the school office or contact us at:
📞 *${SCHOOL_INFO.contact}*
✉ ${SCHOOL_INFO.email}

Thank you for your cooperation. 🙏

Regards,
*${SCHOOL_INFO.name}*`
  );
}

// ─── Send via WhatsApp ────────────────────────────────────────────────────────
export async function sendReminderWhatsApp(student: Student, message: string): Promise<void> {
  const phone = student.mobileNumber?.replace(/\D/g, '');
  if (!phone || phone.length < 7) {
    Alert.alert('No Mobile Number', `${student.name} does not have a mobile number on record.`);
    return;
  }
  // Prefer direct chat to the number; fallback to share (no recipient)
  const directUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
  const shareUrl  = `https://wa.me/?text=${encodeURIComponent(message)}`;
  try {
    const canDirect = await Linking.canOpenURL(directUrl);
    await Linking.openURL(canDirect ? directUrl : shareUrl);
  } catch {
    Alert.alert('WhatsApp Unavailable', 'Could not open WhatsApp. Please try SMS instead.');
  }
}

// ─── Send via SMS ─────────────────────────────────────────────────────────────
export async function sendReminderSMS(student: Student, message: string): Promise<void> {
  const phone = student.mobileNumber?.replace(/\D/g, '');
  if (!phone || phone.length < 7) {
    Alert.alert('No Mobile Number', `${student.name} does not have a mobile number on record.`);
    return;
  }
  // iOS uses & Android uses ?
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${phone}${separator}body=${encodeURIComponent(message)}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
    } else {
      // Web / unsupported — try without body
      await Linking.openURL(`sms:${phone}`);
    }
  } catch {
    Alert.alert('SMS Unavailable', 'Could not open the messaging app on this device.');
  }
}

// ─── Share reminder card image via native share sheet / WhatsApp ──────────────
export async function shareReminderImage(imageUri: string, student: Student): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // Web: try Web Share API with file, fall back to opening the image
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        try {
          const res = await fetch(imageUri);
          const blob = await res.blob();
          const file = new File(
            [blob],
            `FeeReminder_${student.name.replace(/\s+/g, '_')}.png`,
            { type: 'image/png' },
          );
          if ((navigator as any).canShare?.({ files: [file] })) {
            await (navigator as any).share({ files: [file], title: `Fee Reminder – ${student.name}` });
            return;
          }
        } catch {}
      }
      // Fallback: open image in a new tab so the user can save/share manually
      const win = window.open(imageUri, '_blank');
      if (!win) Alert.alert('Popup blocked', 'Please allow popups to view the reminder card image.');
    } else {
      // Native: open system share sheet (user picks WhatsApp, Messages, etc.)
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(imageUri, {
          mimeType: 'image/png',
          dialogTitle: `Fee Reminder – ${student.name}`,
          UTI: 'public.image',
        });
      } else {
        Alert.alert('Sharing unavailable', 'This device does not support file sharing. Please use SMS.');
      }
    }
  } catch {
    Alert.alert('Error', 'Could not share the reminder card. Please try SMS instead.');
  }
}
