import { NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { checkRateLimit, getCallerIdentifier } from '@/lib/api/rate-limiter';

/**
 * POST /api/vacancies/[id]/apply
 * Public endpoint for submitting a job application.
 * Creates candidate and application documents in the correct tenant-scoped collection.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vacancyId } = await params;
    const rateLimited = checkRateLimit(
      getCallerIdentifier(request),
      '/api/vacancies/apply',
      { limit: 5, windowSeconds: 300 }
    );
    if (rateLimited) return rateLimited;

    if (!vacancyId) {
      return NextResponse.json({ error: 'Vacancy ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { firstName, lastName, email, phone, resumeUrl, coverLetter, companyId } = body;

    if (!firstName || !lastName || !email || !phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getFirebaseAdminFirestore();

    let resolvedCompanyId = companyId;
    let vacancyData = null;

    if (resolvedCompanyId) {
      const vacSnap = await db.doc(`companies/${resolvedCompanyId}/vacancies/${vacancyId}`).get();
      if (vacSnap.exists) {
        vacancyData = { id: vacSnap.id, ...vacSnap.data() };
      }
    }

    if (!vacancyData) {
      const topSnap = await db.doc(`vacancies/${vacancyId}`).get();
      if (topSnap.exists) {
        vacancyData = { id: topSnap.id, ...topSnap.data() };
      }
    }

    if (!vacancyData) {
      return NextResponse.json({ error: 'Vacancy not found' }, { status: 404 });
    }

    const basePath = resolvedCompanyId ? `companies/${resolvedCompanyId}` : '';

    const candidateData = {
      firstName,
      lastName,
      email,
      phone,
      resumeUrl: resumeUrl || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'WEBSITE',
      notes: coverLetter || null,
    };

    const candidatesPath = basePath ? `${basePath}/candidates` : 'candidates';
    const candidateRef = await db.collection(candidatesPath).add(candidateData);

    let stages = null;
    if (resolvedCompanyId) {
      const settingsSnap = await db.doc(`companies/${resolvedCompanyId}/recruitment_settings/default`).get();
      if (settingsSnap.exists) {
        stages = settingsSnap.data()?.defaultStages;
      }
    }
    const firstStageId = stages?.[0]?.id || 'screening';

    const applicationData = {
      vacancyId,
      candidateId: candidateRef.id,
      currentStageId: firstStageId,
      status: 'ACTIVE',
      appliedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      candidate: { ...candidateData, id: candidateRef.id },
      vacancy: vacancyData,
    };

    const applicationsPath = basePath ? `${basePath}/applications` : 'applications';
    const applicationRef = await db.collection(applicationsPath).add(applicationData);

    return NextResponse.json({
      success: true,
      candidateId: candidateRef.id,
      applicationId: applicationRef.id,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    console.error('[vacancies/apply] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
