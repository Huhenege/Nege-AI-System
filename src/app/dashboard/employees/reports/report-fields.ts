import { Employee, Department } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface ReportField {
  key: string;
  label: string;
  group: string;
  getValue: (
    employee: Employee,
    questionnaire: Record<string, any> | null,
    departmentMap: Map<string, string>,
  ) => string | number;
}

export interface ReportFieldGroup {
  key: string;
  label: string;
  fields: ReportField[];
}

export interface ReportPreset {
  key: string;
  label: string;
  description: string;
  fieldKeys: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const LIFECYCLE_LABELS: Record<string, string> = {
  attraction: 'Татах',
  recruitment: 'Сонгон шалгаруулалт',
  onboarding: 'Чиглүүлэлт',
  development: 'Хөгжүүлэлт',
  retention: 'Тогтвортой байдал',
  offboarding: 'Чөлөөлөлт',
  alumni: 'Алумни',
};

const EDUCATION_RANK_ORDER = [
  'Доктор',
  'Магистр',
  'Бакалавр',
  'Дипломын',
  'Тусгай дунд',
  'Бүрэн дунд',
  'Суурь',
];

function formatDate(value: any): string {
  if (!value) return '';
  let d: Date;
  if (typeof value === 'string') {
    d = new Date(value);
  } else if (value instanceof Date) {
    d = value;
  } else if (typeof value === 'object' && 'seconds' in value) {
    d = new Date(value.seconds * 1000);
  } else {
    return '';
  }
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('mn-MN');
}

function calcAge(birthDate: any): number | null {
  if (!birthDate) return null;
  let d: Date;
  if (typeof birthDate === 'string') {
    d = new Date(birthDate);
  } else if (birthDate instanceof Date) {
    d = birthDate;
  } else if (typeof birthDate === 'object' && 'seconds' in birthDate) {
    d = new Date(birthDate.seconds * 1000);
  } else {
    return null;
  }
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

function getHighestEducation(eduList: any[]): any | null {
  if (!eduList || eduList.length === 0) return null;
  let best: any = null;
  let bestIdx = EDUCATION_RANK_ORDER.length;
  for (const edu of eduList) {
    const rank = edu.academicRank || '';
    const idx = EDUCATION_RANK_ORDER.indexOf(rank);
    if (idx !== -1 && idx < bestIdx) {
      bestIdx = idx;
      best = edu;
    }
  }
  return best || eduList[0];
}

function getGenderLabel(gender: string | undefined): string {
  if (gender === 'male') return 'Эрэгтэй';
  if (gender === 'female') return 'Эмэгтэй';
  return '';
}

// ─── Field definitions ──────────────────────────────────────────────────────

export const REPORT_FIELD_GROUPS: ReportFieldGroup[] = [
  {
    key: 'registration',
    label: 'Бүртгэл',
    fields: [
      {
        key: 'employeeCode',
        label: 'Ажилтны код',
        group: 'registration',
        getValue: (e) => e.employeeCode || '',
      },
      {
        key: 'lastName',
        label: 'Овог',
        group: 'registration',
        getValue: (e) => e.lastName || '',
      },
      {
        key: 'firstName',
        label: 'Нэр',
        group: 'registration',
        getValue: (e) => e.firstName || '',
      },
      {
        key: 'jobTitle',
        label: 'Албан тушаал',
        group: 'registration',
        getValue: (e) => e.jobTitle || '',
      },
      {
        key: 'department',
        label: 'Хэлтэс',
        group: 'registration',
        getValue: (e, _q, depts) => depts.get(e.departmentId ?? '') || '',
      },
      {
        key: 'email',
        label: 'И-мэйл',
        group: 'registration',
        getValue: (e) => e.email || '',
      },
      {
        key: 'phoneNumber',
        label: 'Утас',
        group: 'registration',
        getValue: (e) => e.phoneNumber || '',
      },
      {
        key: 'status',
        label: 'Төлөв',
        group: 'registration',
        getValue: (e) => e.status || '',
      },
      {
        key: 'hireDate',
        label: 'Ажилд орсон огноо',
        group: 'registration',
        getValue: (e) => formatDate(e.hireDate),
      },
      {
        key: 'terminationDate',
        label: 'Ажлаас гарсан огноо',
        group: 'registration',
        getValue: (e) => formatDate(e.terminationDate),
      },
      {
        key: 'lifecycleStage',
        label: 'Амьдралын мөчлөг',
        group: 'registration',
        getValue: (e) => LIFECYCLE_LABELS[e.lifecycleStage || ''] || '',
      },
      {
        key: 'questionnaireCompletion',
        label: 'Анкет бөглөлт %',
        group: 'registration',
        getValue: (e) => typeof e.questionnaireCompletion === 'number' ? e.questionnaireCompletion : '',
      },
    ],
  },
  {
    key: 'personal',
    label: 'Хувийн мэдээлэл',
    fields: [
      {
        key: 'registrationNumber',
        label: 'Регистрийн дугаар',
        group: 'personal',
        getValue: (_e, q) => q?.registrationNumber || '',
      },
      {
        key: 'birthDate',
        label: 'Төрсөн огноо',
        group: 'personal',
        getValue: (_e, q) => formatDate(q?.birthDate),
      },
      {
        key: 'age',
        label: 'Нас',
        group: 'personal',
        getValue: (_e, q) => calcAge(q?.birthDate) ?? '',
      },
      {
        key: 'gender',
        label: 'Хүйс',
        group: 'personal',
        getValue: (_e, q) => getGenderLabel(q?.gender),
      },
      {
        key: 'idCardNumber',
        label: 'ТТД',
        group: 'personal',
        getValue: (_e, q) => q?.idCardNumber || '',
      },
      {
        key: 'insuranceTypeCode',
        label: 'НД төрөл',
        group: 'personal',
        getValue: (_e, q) => q?.insuranceTypeCode || '',
      },
      {
        key: 'hasDisability',
        label: 'Хөгжлийн бэрхшээл',
        group: 'personal',
        getValue: (_e, q) => q?.hasDisability ? 'Тийм' : 'Үгүй',
      },
      {
        key: 'hasDriversLicense',
        label: 'Жолооны үнэмлэх',
        group: 'personal',
        getValue: (_e, q) => {
          if (!q?.hasDriversLicense) return 'Үгүй';
          const cats = q.driverLicenseCategories;
          return Array.isArray(cats) && cats.length > 0 ? `Тийм (${cats.join(', ')})` : 'Тийм';
        },
      },
    ],
  },
  {
    key: 'contact',
    label: 'Холбоо барих',
    fields: [
      {
        key: 'workPhone',
        label: 'Албан утас',
        group: 'contact',
        getValue: (_e, q) => q?.workPhone || '',
      },
      {
        key: 'personalPhone',
        label: 'Хувийн утас',
        group: 'contact',
        getValue: (_e, q) => q?.personalPhone || '',
      },
      {
        key: 'personalEmail',
        label: 'Хувийн и-мэйл',
        group: 'contact',
        getValue: (_e, q) => q?.personalEmail || '',
      },
      {
        key: 'homeAddress',
        label: 'Гэрийн хаяг',
        group: 'contact',
        getValue: (_e, q) => q?.homeAddress || '',
      },
      {
        key: 'temporaryAddress',
        label: 'Түр хаяг',
        group: 'contact',
        getValue: (_e, q) => q?.temporaryAddress || '',
      },
      {
        key: 'emergencyContact',
        label: 'Яаралтай холбоо барих',
        group: 'contact',
        getValue: (_e, q) => {
          const contacts = q?.emergencyContacts;
          if (!Array.isArray(contacts) || contacts.length === 0) return '';
          return contacts
            .map((c: any) => `${c.fullName || ''} (${c.relationship || ''}) ${c.phone || ''}`)
            .join('; ');
        },
      },
    ],
  },
  {
    key: 'education',
    label: 'Боловсрол',
    fields: [
      {
        key: 'highestDegree',
        label: 'Хамгийн өндөр зэрэг',
        group: 'education',
        getValue: (_e, q) => {
          const best = getHighestEducation(q?.education);
          return best?.academicRank || '';
        },
      },
      {
        key: 'highestDegreeMajor',
        label: 'Мэргэжил',
        group: 'education',
        getValue: (_e, q) => {
          const best = getHighestEducation(q?.education);
          return best?.degree || '';
        },
      },
      {
        key: 'highestDegreeSchool',
        label: 'Сургууль',
        group: 'education',
        getValue: (_e, q) => {
          const best = getHighestEducation(q?.education);
          return best?.school || best?.schoolCustom || '';
        },
      },
      {
        key: 'educationCount',
        label: 'Нийт боловсролын тоо',
        group: 'education',
        getValue: (_e, q) => {
          const edu = q?.education;
          return Array.isArray(edu) ? edu.length : 0;
        },
      },
    ],
  },
  {
    key: 'languages',
    label: 'Хэлний мэдлэг',
    fields: [
      {
        key: 'languageList',
        label: 'Гадаад хэлний жагсаалт',
        group: 'languages',
        getValue: (_e, q) => {
          const langs = q?.languages;
          if (!Array.isArray(langs) || langs.length === 0) return '';
          return langs.map((l: any) => l.language || '').filter(Boolean).join(', ');
        },
      },
      {
        key: 'languageCount',
        label: 'Хэлний тоо',
        group: 'languages',
        getValue: (_e, q) => {
          const langs = q?.languages;
          return Array.isArray(langs) ? langs.length : 0;
        },
      },
    ],
  },
  {
    key: 'family',
    label: 'Гэр бүл',
    fields: [
      {
        key: 'maritalStatus',
        label: 'Гэрлэлтийн байдал',
        group: 'family',
        getValue: (_e, q) => q?.maritalStatus || '',
      },
      {
        key: 'familyMemberCount',
        label: 'Гэр бүлийн гишүүдийн тоо',
        group: 'family',
        getValue: (_e, q) => {
          const members = q?.familyMembers;
          return Array.isArray(members) ? members.length : 0;
        },
      },
    ],
  },
  {
    key: 'experience',
    label: 'Ажлын туршлага',
    fields: [
      {
        key: 'experienceCount',
        label: 'Нийт туршлагын тоо',
        group: 'experience',
        getValue: (_e, q) => {
          const exp = q?.experiences;
          return Array.isArray(exp) ? exp.length : 0;
        },
      },
      {
        key: 'lastCompany',
        label: 'Сүүлийн ажлын газар',
        group: 'experience',
        getValue: (_e, q) => {
          const exp = q?.experiences;
          if (!Array.isArray(exp) || exp.length === 0) return '';
          // Last entry in the array is typically the most recent
          return exp[exp.length - 1]?.company || '';
        },
      },
      {
        key: 'lastPosition',
        label: 'Сүүлийн албан тушаал',
        group: 'experience',
        getValue: (_e, q) => {
          const exp = q?.experiences;
          if (!Array.isArray(exp) || exp.length === 0) return '';
          return exp[exp.length - 1]?.position || '';
        },
      },
    ],
  },
];

// Flat list of all fields for quick lookup
export const ALL_REPORT_FIELDS: ReportField[] = REPORT_FIELD_GROUPS.flatMap(
  (g) => g.fields,
);

export const FIELD_MAP: Map<string, ReportField> = new Map(
  ALL_REPORT_FIELDS.map((f) => [f.key, f]),
);

// ─── Presets ────────────────────────────────────────────────────────────────

export const REPORT_PRESETS: ReportPreset[] = [
  {
    key: 'basic',
    label: 'Үндсэн',
    description: 'Код, Нэр, Хэлтэс, Албан тушаал, Төлөв',
    fieldKeys: [
      'employeeCode',
      'lastName',
      'firstName',
      'department',
      'jobTitle',
      'status',
      'hireDate',
    ],
  },
  {
    key: 'full',
    label: 'Бүрэн',
    description: 'Бүх үндсэн + хувийн мэдээлэл',
    fieldKeys: [
      'employeeCode',
      'lastName',
      'firstName',
      'department',
      'jobTitle',
      'email',
      'phoneNumber',
      'status',
      'hireDate',
      'registrationNumber',
      'birthDate',
      'age',
      'gender',
      'highestDegree',
      'highestDegreeMajor',
      'maritalStatus',
    ],
  },
  {
    key: 'contact',
    label: 'Холбоо барих',
    description: 'Нэр, утас, и-мэйл, хаяг',
    fieldKeys: [
      'employeeCode',
      'lastName',
      'firstName',
      'department',
      'email',
      'phoneNumber',
      'personalPhone',
      'personalEmail',
      'homeAddress',
      'emergencyContact',
    ],
  },
  {
    key: 'education',
    label: 'Боловсрол',
    description: 'Нэр, зэрэг, мэргэжил, сургууль, хэл',
    fieldKeys: [
      'employeeCode',
      'lastName',
      'firstName',
      'department',
      'highestDegree',
      'highestDegreeMajor',
      'highestDegreeSchool',
      'educationCount',
      'languageList',
    ],
  },
];
