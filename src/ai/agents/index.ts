/**
 * Agents index — бүх specialist agent factory-уудыг re-export хийнэ.
 * orchestrator.ts энэ файлаас импортолно.
 */

export { createEmployeeAgentTools } from './employee-agent';
export { createOnboardingAgentTools } from './onboarding-agent';
export { createOffboardingAgentTools } from './offboarding-agent';
export { createOrgAgentTools } from './org-agent';
export { createVacationAgentTools } from './vacation-agent';
export { createAttendanceAgentTools } from './attendance-agent';
export { createPointsAgentTools } from './points-agent';
export { createRecruitmentAgentTools } from './recruitment-agent';
export { createReportAgentTools } from './report-agent';
