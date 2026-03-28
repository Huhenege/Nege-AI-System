import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { TenantClaims, CompanyPlan, SaaSModule } from '@/types/company';
import { getDynamicPlanDefinition, getDynamicPlanDefinitions } from '@/lib/pricing/get-pricing-plans';
import { checkRateLimit } from '@/lib/api/rate-limiter';

/**
 * POST /api/billing/downgrade-check
 * Downgrade хийхээс өмнө impact тооцоолно:
 *   - Хэт их ажилтан байгаа эсэх
 *   - Алдагдах модулиуд
 *   - Хэтрэх лимитүүд
 *
 * Body: { targetPlan: CompanyPlan }
 * Response: { canDowngrade, impact: { lostModules, excessEmployees, ... } }
 */
export async function POST(request: NextRequest) {
    try {
        const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminAuth = getFirebaseAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);

        const rateLimited = await checkRateLimit(decoded.uid, '/api/billing/downgrade-check', 'billing');
        if (rateLimited) return rateLimited;

        const user = await adminAuth.getUser(decoded.uid);
        const claims = user.customClaims as TenantClaims | undefined;

        if (!claims?.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });
        if (claims.role !== 'company_super_admin' && claims.role !== 'admin' && claims.role !== 'super_admin') {
            return NextResponse.json({ error: 'Admin required' }, { status: 403 });
        }

        const body = await request.json() as { targetPlan: CompanyPlan };
        const { targetPlan } = body;

        const db = getFirebaseAdminFirestore();
        const companyDoc = await db.doc(`companies/${claims.companyId}`).get();
        if (!companyDoc.exists) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

        const company = companyDoc.data()!;
        const currentPlan = company.plan as CompanyPlan;

        // Планы дараалал
        const allPlans = await getDynamicPlanDefinitions();
        const planOrder = allPlans.map(p => p.id);
        const currentIdx = planOrder.indexOf(currentPlan);
        const targetIdx = planOrder.indexOf(targetPlan);

        if (targetIdx >= currentIdx) {
            return NextResponse.json({ error: 'This is not a downgrade' }, { status: 400 });
        }

        const targetDef = await getDynamicPlanDefinition(targetPlan);
        const currentDef = await getDynamicPlanDefinition(currentPlan);

        // 1. Алдагдах модулиуд
        const currentModules = currentDef.modules;
        const targetModules = targetDef.modules;
        const lostModules: SaaSModule[] = currentModules.filter(m => !targetModules.includes(m));

        // 2. Ажилтны хязгаар
        const empSnap = await db.collection(`companies/${claims.companyId}/employees`)
            .where('role', '!=', 'super_admin')
            .count()
            .get();
        const currentEmployees = empSnap.data().count;
        const excessEmployees = Math.max(0, currentEmployees - targetDef.limits.maxEmployees);

        // 3. Бусад лимит хэтэрсэн эсэх
        const limitWarnings: string[] = [];

        if ((company.limits?.maxProjects ?? 0) > targetDef.limits.maxProjects) {
            const projSnap = await db.collection(`companies/${claims.companyId}/projects`)
                .count().get();
            const projCount = projSnap.data().count;
            if (projCount > targetDef.limits.maxProjects) {
                limitWarnings.push(`Одоогийн ${projCount} төсөл байгаа бол ${targetDef.limits.maxProjects}-аас хэтэрнэ`);
            }
        }

        if ((company.limits?.maxDepartments ?? 0) > targetDef.limits.maxDepartments) {
            const deptSnap = await db.collection(`companies/${claims.companyId}/departments`)
                .count().get();
            const deptCount = deptSnap.data().count;
            if (deptCount > targetDef.limits.maxDepartments) {
                limitWarnings.push(`Одоогийн ${deptCount} нэгж байгаа бол ${targetDef.limits.maxDepartments}-аас хэтэрнэ`);
            }
        }

        const canDowngrade = excessEmployees === 0; // Хэт их ажилтан байвал downgrade блоклоно

        return NextResponse.json({
            canDowngrade,
            currentPlan,
            targetPlan,
            currentEmployees,
            maxEmployeesInTarget: targetDef.limits.maxEmployees,
            excessEmployees,
            lostModules,
            limitWarnings,
            targetPlanLabel: targetDef.nameMN,
            currentPlanLabel: currentDef.nameMN,
        });

    } catch (e: unknown) {
        console.error('[billing/downgrade-check]', e);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
