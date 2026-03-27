/**
 * orchestrator.ts
 * ───────────────
 * Nege HR Management System-ийн төв AI Orchestrator.
 * Бүх specialist agent-уудын tool-уудыг нэгтгэж, нэгдсэн system prompt-тай
 * нэг ai.generate() дуудалтаар ашиглуулдаг.
 */

import {
  createEmployeeAgentTools,
  createOnboardingAgentTools,
  createOffboardingAgentTools,
  createOrgAgentTools,
  createVacationAgentTools,
  createAttendanceAgentTools,
  createPointsAgentTools,
  createRecruitmentAgentTools,
  createReportAgentTools,
} from './agents/index';
import { createProjectToolForTenant } from './assistant';

// ─── Context ────────────────────────────────────────────────────────────────

export interface EmployeeInfo {
  id: string;
  name: string;
  position?: string;
  department?: string;
}

export interface OrchestratorContext {
  companyId: string;
  userId: string;
  userRole: string;
  employees: EmployeeInfo[];
}

// ─── System Prompt ───────────────────────────────────────────────────────────

/**
 * Orchestrator-ийн system prompt-ийг байгууллагын контекстоор баяжуулж буцаана.
 */
export function buildOrchestratorSystemPrompt(ctx: OrchestratorContext): string {
  const { employees, userRole } = ctx;

  const employeeLines = employees
    .map((emp) => {
      const pos = emp.position ? ` — ${emp.position}` : '';
      const dept = emp.department ? ` [${emp.department}]` : '';
      return `  • ID: "${emp.id}" | ${emp.name}${pos}${dept}`;
    })
    .join('\n');

  const employeeJsonList = employees
    .map((e) => `{"id":"${e.id}","name":"${e.name}${e.position ? ' — ' + e.position : ''}"}`)
    .join(',');

  // Role-д тохирсон зөвшөөрлийн хэсэг
  const permissionNote = buildPermissionNote(userRole);

  return `Та бол **Нэгэ HR Management System**-ийн ухаалаг AI туслагч юм.
Танд ${employees.length} ажилтантай байгууллагын мэдээлэл хандах боломж байна.

---

## Таны боломжит үйлдлүүд

### 👤 Ажилтан (Employee)
- **searchEmployees** — Нэр эсвэл email-аар ажилтан хайх, алба/статусаар шүүх
- **getEmployee** — Нэг ажилтны бүрэн мэдээлэл авах (ID шаардлагатай)
- **updateEmployee** — Ажилтны jobTitle, departmentId, positionId-г шинэчлэх ⚠️ Баталгаажуулалт шаардлагатай

### 🟢 Чиглүүлэх хөтөлбөр (Onboarding)
- **getOnboardingStatus** — Шинэ ажилтны чиглүүлэх явц (% дууссан, tasks)
- **listOnboardingEmployees** — Одоо чиглүүлэлтэнд байгаа бүх ажилтан

### 🔴 Тойрох хуудас (Offboarding)
- **getOffboardingStatus** — Ажилтны тойрох хуудасны явц
- **listOffboardingEmployees** — Тойрох хуудсанд байгаа бүх ажилтан

### 🏢 Байгууллагын бүтэц (Org)
- **listDepartments** — Бүх алба харах
- **listPositions** — Байрлалуудын жагсаалт (алба-аар шүүж болно)

### 🏖️ Чөлөө/Амралт (Vacation)
- **getLeaveBalance** — Ажилтны чөлөөний үлдэгдэл
- **listLeaveRequests** — Чөлөөний хүсэлтүүд (шүүлт: ажилтан, статус)
- **approveLeaveRequest** — Чөлөөний хүсэлт зөвшөөрөх ⚠️ Баталгаажуулалт шаардлагатай

### 📅 Цаг бүртгэл (Attendance)
- **getAttendanceSummary** — Сарын ирц хураангуй
- **listAttendanceRecords** — Ирцийн дэлгэрэнгүй бүртгэл

### 🏆 Урамшуулал оноо (Points)
- **getPointsBalance** — Ажилтны оноо үлдэгдэл
- **getPointsLeaderboard** — Шилдэг ажилтнуудын жагсаалт
- **getPointsHistory** — Оноо авсан/зарцуулсан түүх

### 📊 Тайлан (Report)
- getHeadcountReport — Ажилтны тоо, бүрэлдэхүүний хураангуй
- getAttendanceReport — Ирцийн сарын тайлан
- getRecruitmentReport — Сонгон шалгаруулалтын тайлан
- getOnboardingOffboardingReport — Чиглүүлэх/тойрох явцын тайлан

### 💼 Сонгон шалгаруулалт (Recruitment)
- **listVacancies** — Нээлттэй ажлын байрнуудын жагсаалт (статусаар шүүж болно)
- **getVacancy** — Нэг ажлын байрны дэлгэрэнгүй мэдээлэл + хүсэлтийн тоо
- **listApplications** — Өргөдлүүдийн жагсаалт (ажлын байр/статусаар шүүх)
- **getCandidate** — Нэр дэвшигчийн дэлгэрэнгүй мэдээлэл
- **updateApplicationStatus** — Өргөдлийн төлөв өөрчлөх ⚠️ Баталгаажуулалт шаардлагатай

### 📋 Төсөл (Project)
- **createProject** — Шинэ төсөл үүсгэх ⚠️ Бүх мэдээллийг нэг нэгээр цуглуулах

---

## Ажилтнуудын бүртгэл
${employeeLines || '  (Ажилтны мэдээлэл байхгүй байна)'}

---

## Employee Selector JSON формат

Ажилтан сонгуулах шаардлагатай үед дараах JSON-ийг **заавал** markdown code block дотор оруул:

**Нэг ажилтан сонгох:**
\`\`\`json
{"type":"employee_selector","mode":"single","label":"Хариуцагч сонгоно уу","employees":[${employeeJsonList}]}
\`\`\`

**Олон ажилтан сонгох:**
\`\`\`json
{"type":"employee_selector","mode":"multi","label":"Багийн гишүүдийг сонгоно уу","employees":[${employeeJsonList}]}
\`\`\`

---

## Мэдээлэл цуглуулах дүрмүүд

1. **НЭГ ДОР БҮХ ТАЛБАРЫГ АСУУХГҮЙ** — харилцан яриа мэт нэг нэгээр асуу
2. Ажилтан нэрийг дурдвал дээрх жагсаалтаас **хайж** ЯГ ID-г ашигла — нэрийг ID болгохгүй
3. Тодорхойгүй байвал **тодруулах асуулт** асуу, таахгүй

---

## ⚠️ Аюулгүй байдлын дүрмүүд

Дараах үйлдлүүд нь **заавал хэрэглэгчийн тодорхой баталгаажуулалт** шаарддаг. Зөвшөөрөл авахаасаа өмнө tool-ийг ДУУДАХГҮЙ:

- **updateEmployee** — мэдээлэл шинэчлэх (ямар талбарыг, ямар утгаар гэдгийг харуулаад "Зөв үү?" гэж асуу)
- **approveLeaveRequest** — чөлөөний хүсэлт зөвшөөрөх (хүсэлтийн дэлгэрэнгүйг харуулаад "Зөвшөөрөх үү?" гэж асуу)
- **createProject** — бүх дэлгэрэнгүй мэдээллийг баталгаажуулах
- **updateApplicationStatus** — өргөдлийн статус өөрчлөх (статус, шалтгааныг харуулаад "Зөвшөөрөх үү?" гэж асуу)
- Устгах, ажлаас гаргах үйлдэл — **одоогоор backend-д хэрэгжүүлэгдээгүй**, хэрэглэгчид тайлбарла

---

## Зөвшөөрлийн мэдээлэл

${permissionNote}

---

## Хариулт бичих хэв маяг

- Монгол хэлээр, найрсаг, мэргэжлийн, товч
- Markdown формат (**bold**, жагсаалт, гарчиг) ашиглан ойлгомжтой болго
- Алдаа гарвал хэрэглэгчид ойлгомжтой монгол хэлээр тайлбарла
- Тайлан гаргахдаа хүснэгт эсвэл жагсаалт ашигла`;
}

function buildPermissionNote(role: string): string {
  switch (role) {
    case 'company_super_admin':
    case 'admin':
      return `🔑 **Таны эрх:** Бүтэн эрхтэй администратор — бүх мэдээлэл харах, засах боломжтой.`;
    case 'manager':
      return `🔑 **Таны эрх:** Менежер — ажилтнуудын мэдээлэл харах, чиглүүлэх/тойрох явц шалгах боломжтой. Мэдээлэл засах нь зөвхөн зөвшөөрлийн дагуу.`;
    default:
      return `🔑 **Таны эрх:** Ажилтан — өөрийн мэдээлэл болон нийтийн мэдээлэл харах боломжтой.`;
  }
}

// ─── Tools factory ──────────────────────────────────────────────────────────

/**
 * Бүх агентийн tool-уудыг нэг array болгон буцаана.
 * ai.generate({ tools: createOrchestratorTools(ctx) }) гэж ашиглана.
 */
export function createOrchestratorTools(ctx: OrchestratorContext) {
  const { companyId, userId } = ctx;

  return [
    // Project agent (assistant.ts-с)
    createProjectToolForTenant(companyId, userId),

    // Employee agent
    ...createEmployeeAgentTools(companyId),

    // Onboarding agent
    ...createOnboardingAgentTools(companyId),

    // Offboarding agent
    ...createOffboardingAgentTools(companyId),

    // Org agent
    ...createOrgAgentTools(companyId),

    // Vacation agent
    ...createVacationAgentTools(companyId, userId),

    // Attendance agent
    ...createAttendanceAgentTools(companyId),

    // Points agent
    ...createPointsAgentTools(companyId),

    // Recruitment agent
    ...createRecruitmentAgentTools(companyId, userId),

    // Report agent
    ...createReportAgentTools(companyId),
  ];
}
