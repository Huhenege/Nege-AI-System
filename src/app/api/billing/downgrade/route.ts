import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { TenantClaims, CompanyPlan, SaaSModule, ModuleConfig } from '@/types/company';
import { getDynamicPlanDefinition, getDynamicPlanDefinitions } from '@/lib/pricing/get-pricing-plans';
import { checkRateLimit } from '@/lib/api/rate-limiter';
import { audit } from '@/lib/audit';

/**
 * POST /api/billing/downgrade
 * Хэрэглэгч зөвшөөрсний дараа downgrade гүйцэтгэнэ.
 * - excessEmployees > 0 бол блоклоно (хэрэглэгч эхлээд ажилтан хасах ёстой)
 * - Алдагдах модулиудыг disabled болгоно
 * - plan / limits шинэчлэгдэнэ
 * - Мөнгө буцаахгүй — зөвхөн plan доошилно
 *
 * Body: { targetPlan: CompanyPlan }
 */
export async function POST(request: NextRequest) {
    try {
        const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminAuth = getFirebaseAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);

        const rateLimited = await checkRateLimit(decoded.uid, '/api/billing/downgrade', 'billing');
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
        const companyRef = db.doc(`companies/${claims.companyId}`);
        const companyDoc = await companyRef.get();
        if (!companyDoc.exists) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

        const company = companyDoc.data()!;
        const currentPlan = company.plan as CompanyPlan;

        // Планы дараалал шалгах
        const allPlans = await getDynamicPlanDefinitions();
        const planOrder = allPlans.map(p => p.id);
        if (planOrder.indexOf(targetPlan) >= planOrder.indexOf(currentPlan)) {
            return NextResponse.json({ error: 'This is not a downgrade' }, { status: 400 });
        }

        // Ажилтны лимит шалгах — блоклогч нөхцөл
        const targetDef = await getDynamicPlanDefinition(targetPlan);
        const empSnap = await db.collection(`companies/${claims.companyId}/employees`)
            .where('role', '!=', 'super_admin')
            .count()
            .get();
        const currentEmployees = empSnap.data().count;

        if (currentEmployees > targetDef.limits.maxEmployees) {
            return NextResponse.json({
                error: `Ажилтны тоо хэтэрсэн байна. Эхлээд ${currentEmployees - targetDef.limits.maxEmployees} ажилтныг системээс гаргана уу.`,
                code: 'EMPLOYEE_LIMIT_EXCEEDED',
                current: currentEmployees,
                limit: targetDef.limits.maxEmployees,
            }, { status: 403 });
        }

        // Шинэ модулиуд тооцно
        const modules: Partial<Record<SaaSModule, ModuleConfig>> = {};
        const now = new Date();

        // Зөвхөн target plan-д байгаа модулиудыг enabled болгоно
        // Бусдыг disabled болгоно (disabledAt тэмдэглэнэ)
        const allModuleKeys = [
            ...new Set([
                ...Object.keys(company.modules || {}),
                ...targetDef.modules,
            ])
        ] as SaaSModule[];

        for (const mod of allModuleKeys) {
            if (targetDef.modules.includes(mod)) {
                modules[mod] = {
                    enabled: true,
                    enabledAt: (company.modules?.[mod] as ModuleConfig)?.enabledAt ?? now.toISOString(),
                };
            } else {
                modules[mod] = {
                    enabled: false,
                    disabledAt: now.toISOString(),
                };
            }
        }

        // Компани шинэчлэнэ
        await companyRef.update({
            plan: targetPlan,
            modules,
            limits: { ...targetDef.limits },
            'subscription.plan': targetPlan,
            'subscription.paymentStatus': 'none',
            updatedAt: now,
        });

        // Audit log
        audit(claims.companyId, { uid: decoded.uid, role: claims.role }, {
            action: 'update',
            resource: 'billing',
            resourceId: claims.companyId,
            description: `Багц доошилсон: ${currentPlan} → ${targetPlan}`,
            metadata: { currentPlan, targetPlan, currentEmployees },
        });

        return NextResponse.json({ success: true, plan: targetPlan });

    } catch (e: unknown) {
        console.error('[billing/downgrade]', e);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
