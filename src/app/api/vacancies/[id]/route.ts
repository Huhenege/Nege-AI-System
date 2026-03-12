import { NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';

/**
 * GET /api/vacancies/[id]
 * Public endpoint for the job application page.
 * Returns vacancy data + recruitment stages without requiring authentication.
 * Searches all companies for the vacancy since the applicant doesn't know the companyId.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vacancyId } = await params;

    if (!vacancyId) {
      return NextResponse.json({ error: 'Vacancy ID is required' }, { status: 400 });
    }

    const db = getFirebaseAdminFirestore();

    const vacancySnaps = await db.collectionGroup('vacancies')
      .where('__name__', '==', vacancyId)
      .limit(5)
      .get();

    let vacancyData = null;
    let companyId = null;

    if (!vacancySnaps.empty) {
      for (const snap of vacancySnaps.docs) {
        if (snap.id === vacancyId) {
          vacancyData = { id: snap.id, ...snap.data() };
          const parts = snap.ref.path.split('/');
          if (parts[0] === 'companies') {
            companyId = parts[1];
          }
          break;
        }
      }
    }

    if (!vacancyData) {
      const topLevelSnap = await db.doc(`vacancies/${vacancyId}`).get();
      if (topLevelSnap.exists) {
        vacancyData = { id: topLevelSnap.id, ...topLevelSnap.data() };
      }
    }

    if (!vacancyData) {
      return NextResponse.json({ error: 'Vacancy not found' }, { status: 404 });
    }

    let stages = null;
    if (companyId) {
      const settingsSnap = await db.doc(`companies/${companyId}/recruitment_settings/default`).get();
      if (settingsSnap.exists && settingsSnap.data()?.defaultStages) {
        stages = settingsSnap.data()!.defaultStages;
      }
    }

    if (!stages) {
      const legacySnap = await db.doc('recruitment_settings/default').get();
      if (legacySnap.exists && legacySnap.data()?.defaultStages) {
        stages = legacySnap.data()!.defaultStages;
      }
    }

    return NextResponse.json({
      vacancy: vacancyData,
      stages,
      companyId,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    console.error('[vacancies/[id]] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
