import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../../lib/auth-guard';
import type { CompanyStatus, CompanyPlan, SaaSModule, ModuleConfig } from '@/types/company';
import { getPlanDefinition } from '@/types/company';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const db = getFirebaseAdminFirestore();
  const snap = await db.collection('companies').doc(id).get();

  if (!snap.exists) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const employeesSnap = await db.collection(`companies/${id}/employees`).get();

  return NextResponse.json({
    company: { id: snap.id, ...snap.data() },
    employeeCount: employeesSnap.size,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json();
  const db = getFirebaseAdminFirestore();
  const companyRef = db.collection('companies').doc(id);
  const snap = await companyRef.get();

  if (!snap.exists) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.status) {
    const validStatuses: CompanyStatus[] = ['trial', 'active', 'suspended', 'cancelled'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (body.plan) {
    const validPlans: CompanyPlan[] = ['free', 'starter', 'pro', 'enterprise'];
    if (!validPlans.includes(body.plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    updates.plan = body.plan;
    const def = getPlanDefinition(body.plan);
    updates.limits = { ...def.limits };

    const modules: Partial<Record<SaaSModule, ModuleConfig>> = {};
    for (const m of def.modules) {
      modules[m] = { enabled: true, enabledAt: new Date().toISOString() };
    }
    updates.modules = modules;
  }

  if (body.toggleModule) {
    const { module, enabled } = body.toggleModule as { module: SaaSModule; enabled: boolean };
    const key = `modules.${module}`;
    updates[key] = {
      enabled,
      ...(enabled ? { enabledAt: new Date().toISOString() } : { disabledAt: new Date().toISOString() }),
    } satisfies ModuleConfig;
  }

  if (body.limits) {
    for (const [key, val] of Object.entries(body.limits)) {
      updates[`limits.${key}`] = val;
    }
  }

  if (body.name) updates.name = body.name;
  if (body.email) updates.email = body.email;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.domain !== undefined) updates.domain = body.domain;

  await companyRef.update(updates);

  const updatedSnap = await companyRef.get();
  return NextResponse.json({ company: { id: updatedSnap.id, ...updatedSnap.data() } });
}
