export type BirthdayPerson = {
  id: string;
  name: string;
  class: string;
  rollNumber: string;
  mobileNumber: string;
  dateOfBirth: string;
};

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
    rollNumber: String(record?.rollNumber ?? record?.roll_number ?? ''),
    mobileNumber: String(record?.mobileNumber ?? record?.mobile_number ?? ''),
    dateOfBirth: String(record?.dateOfBirth ?? record?.date_of_birth ?? ''),
  };
}