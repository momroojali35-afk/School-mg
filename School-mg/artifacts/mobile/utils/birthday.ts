export type BirthdayPerson = {
  id: string;
  name: string;
  class: string;
  rollNumber: string;
  mobileNumber: string;
  dateOfBirth: string;
};

function normalizeDateOfBirth(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return '';

    // Keep date-only values in their original day/month order. Normalize
    // ISO timestamps to the date portion so birthday matching can parse them.
    const isoDate = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoDate) {
      return `${isoDate[1]}-${isoDate[2].padStart(2, '0')}-${isoDate[3].padStart(2, '0')}`;
    }
    return normalized;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-');
  }

  // Firebase/Firestore timestamps can arrive as plain serialized objects.
  if (typeof value === 'object') {
    const timestamp = value as { seconds?: number; _seconds?: number };
    const seconds = timestamp.seconds ?? timestamp._seconds;
    if (typeof seconds === 'number') {
      return normalizeDateOfBirth(new Date(seconds * 1000));
    }
  }

  return String(value).trim();
}

/**
 * Birthday data can come from either the mobile-shaped API response or the
 * database-shaped response. Keep this normalization limited to birthday
 * projections so alumni do not leak back into active student workflows.
 */
export function toBirthdayPerson(record: any, fallbackClass = 'Alumni'): BirthdayPerson {
  return {
    id: String(record?.id ?? record?.studentId ?? record?.student_id ?? ''),
    name: String(record?.name ?? record?.studentName ?? record?.student_name ?? ''),
    class: String(
      record?.class
      ?? record?.passOutClass
      ?? record?.pass_out_class
      ?? record?.batch
      ?? fallbackClass,
    ),
    rollNumber: String(record?.rollNumber ?? record?.roll_number ?? record?.rollNo ?? ''),
    mobileNumber: String(record?.mobileNumber ?? record?.mobile_number ?? record?.phone ?? ''),
    dateOfBirth: normalizeDateOfBirth(
      record?.dateOfBirth
      ?? record?.date_of_birth
      ?? record?.dob
      ?? record?.birthDate
      ?? record?.birth_date,
    ),
  };
}