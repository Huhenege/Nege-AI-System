// src/app/dashboard/widgets/use-dashboard-widgets.ts
'use client';

/**
 * useDashboardWidgets
 *
 * Widget-ийн дараалал болон нуусан жагсаалтыг Firestore-д хадгалдаг.
 * Зам: companies/{companyId}/employees/{userId}/dashboardWidgets/main
 *
 * Өмнө: localStorage → per-browser, хэрэглэгч хоорондоо хольцдог байсан.
 * Одоо: Firestore → per-user, per-company, device-independent.
 *
 * Fallback: Firestore ачаалахаас өмнө localStorage-г ашиглана (flash-гүй).
 * Шилжилт: localStorage-д хуучин state байвал нэг удаа Firestore-д migrate хийж,
 *           localStorage-г цэвэрлэнэ.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    Firestore,
} from 'firebase/firestore';
import { WidgetId, DEFAULT_ORDER, getAllWidgetIds, getWidgetConfig } from './catalog';
import type { SaaSModule } from '@/types/company';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardWidgetsState {
    order: WidgetId[];
    hidden: WidgetId[];
}

const DEFAULT_STATE: DashboardWidgetsState = {
    order: DEFAULT_ORDER,
    hidden: [],
};

const LEGACY_STORAGE_KEY = 'dashboard-widgets';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mergeWithNewWidgets(
    stored: DashboardWidgetsState,
    isModuleEnabled?: (m: SaaSModule) => boolean
): DashboardWidgetsState {
    const allIds = getAllWidgetIds();

    // Module-аар шүүх helper
    const isLocked = (id: WidgetId): boolean => {
        if (!isModuleEnabled) return false;
        const cfg = getWidgetConfig(id);
        if (!cfg?.module) return false;
        return !isModuleEnabled(cfg.module);
    };

    const knownIds = new Set([...stored.order, ...stored.hidden]);

    // Шинэ widget — locked биш, мэдэгдэхгүй байсан
    const newWidgets = allIds.filter(id => !knownIds.has(id) && !isLocked(id));

    // Аль хэдийн locked болсон widget-г order-аас хасна (hidden-д нэмэхгүй)
    const validOrder = stored.order.filter(id => allIds.includes(id) && !isLocked(id));
    const validHidden = stored.hidden.filter(id => allIds.includes(id));

    // Module идэвхжсэн боловч hidden-д хаягдсан widget-г хасна (харагдах болно)
    // Locked widget hidden-д орохгүй — module идэвхжүүлэхэд автоматаар order-д орно
    const finalHidden = validHidden.filter(id => !isLocked(id));

    // Module идэвхжсэн, хэрэглэгч нуусан, одоо locked биш → hidden-д хэвээр байна (хэрэглэгчийн сонголт)
    // Тиймээс finalHidden-г тэгж үлдээнэ

    return {
        order: newWidgets.length > 0 ? [...newWidgets, ...validOrder] : validOrder,
        hidden: finalHidden,
    };
}

function getDocRef(firestore: Firestore, companyPath: string, userId: string) {
    return doc(firestore, `${companyPath}/employees/${userId}/dashboardWidgets/main`);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseDashboardWidgetsOptions {
    firestore: Firestore | null;
    companyPath: string | null;
    userId: string | null;
    isModuleEnabled?: (m: SaaSModule) => boolean;
}

export function useDashboardWidgets(opts?: UseDashboardWidgetsOptions) {
    const { firestore = null, companyPath = null, userId = null, isModuleEnabled } = opts ?? {};

    const [state, setState] = useState<DashboardWidgetsState>(DEFAULT_STATE);
    const [isLoaded, setIsLoaded] = useState(false);

    // Firestore-д write дарааллах — ачаалах үед давхар write-с сэргийлэх
    const isMigratingRef = useRef(false);
    const isInitializedRef = useRef(false);
    // isModuleEnabled-г ref-д хадгалж dependency-с хасна (re-render loop-с сэргийлнэ)
    const isModuleEnabledRef = useRef(isModuleEnabled);
    useEffect(() => { isModuleEnabledRef.current = isModuleEnabled; }, [isModuleEnabled]);

    // ── Firestore-оос ачаалах + realtime sync ────────────────────────────────
    useEffect(() => {
        if (!firestore || !companyPath || !userId) {
            // Firestore бэлэн биш — legacy localStorage-с авна
            if (typeof window !== 'undefined') {
                try {
                    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
                    if (raw) {
                        const parsed = JSON.parse(raw) as DashboardWidgetsState;
                        setState(mergeWithNewWidgets(parsed, isModuleEnabledRef.current));
                    }
                } catch { /* ignore */ }
            }
            setIsLoaded(true);
            return;
        }

        const ref = getDocRef(firestore, companyPath, userId);

        const unsub = onSnapshot(ref, (snap) => {
            if (!snap.exists()) {
                // Firestore-д байхгүй — localStorage migration шалгана
                if (!isInitializedRef.current) {
                    isInitializedRef.current = true;
                    migrateLegacyState(firestore, companyPath, userId);
                }
                setIsLoaded(true);
                return;
            }

            const data = snap.data() as DashboardWidgetsState;
            const merged = mergeWithNewWidgets(data, isModuleEnabledRef.current);
            setState(merged);
            isInitializedRef.current = true;
            setIsLoaded(true);
        }, (err) => {
            console.error('[useDashboardWidgets] Firestore error:', err);
            setIsLoaded(true);
        });

        return () => unsub();
    }, [firestore, companyPath, userId]);

    // ── localStorage → Firestore migration ───────────────────────────────────
    const migrateLegacyState = useCallback(async (
        fs: Firestore,
        cp: string,
        uid: string
    ) => {
        if (isMigratingRef.current) return;
        isMigratingRef.current = true;

        try {
            const legacy = typeof window !== 'undefined'
                ? localStorage.getItem(LEGACY_STORAGE_KEY)
                : null;

            const initial = legacy
                ? mergeWithNewWidgets(JSON.parse(legacy) as DashboardWidgetsState, isModuleEnabledRef.current)
                : DEFAULT_STATE;

            const ref = getDocRef(fs, cp, uid);
            await setDoc(ref, initial, { merge: false });

            // Migration амжилттай — localStorage цэвэрлэнэ
            if (typeof window !== 'undefined') {
                localStorage.removeItem(LEGACY_STORAGE_KEY);
            }

            setState(initial);
        } catch (err) {
            console.error('[useDashboardWidgets] Migration failed:', err);
        } finally {
            isMigratingRef.current = false;
        }
    }, []);

    // ── Firestore-д write (debounced) ────────────────────────────────────────
    const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const persistState = useCallback((newState: DashboardWidgetsState) => {
        if (!firestore || !companyPath || !userId || !isInitializedRef.current) return;

        // 600ms debounce — DnD drag үед хэт олон write гарахаас сэргийлнэ
        if (writeTimer.current) clearTimeout(writeTimer.current);
        writeTimer.current = setTimeout(async () => {
            try {
                const ref = getDocRef(firestore, companyPath, userId);
                await setDoc(ref, newState, { merge: false });
            } catch (err) {
                console.error('[useDashboardWidgets] Write failed:', err);
            }
        }, 600);
    }, [firestore, companyPath, userId]);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (writeTimer.current) clearTimeout(writeTimer.current);
        };
    }, []);

    // ── Actions ───────────────────────────────────────────────────────────────

    const setOrder = useCallback((newOrder: WidgetId[]) => {
        setState(prev => {
            const next = { ...prev, order: newOrder };
            persistState(next);
            return next;
        });
    }, [persistState]);

    const hideWidget = useCallback((id: WidgetId) => {
        setState(prev => {
            if (prev.hidden.includes(id)) return prev;
            const next = {
                order: prev.order.filter(wid => wid !== id),
                hidden: [...prev.hidden, id],
            };
            persistState(next);
            return next;
        });
    }, [persistState]);

    const showWidget = useCallback((id: WidgetId, position?: 'start' | 'middle' | 'end') => {
        setState(prev => {
            if (prev.order.includes(id)) return prev;

            const newHidden = prev.hidden.filter(wid => wid !== id);
            let newOrder: WidgetId[];

            switch (position) {
                case 'start':
                    newOrder = [id, ...prev.order];
                    break;
                case 'middle': {
                    const mid = Math.floor(prev.order.length / 2);
                    newOrder = [...prev.order.slice(0, mid), id, ...prev.order.slice(mid)];
                    break;
                }
                default:
                    newOrder = [...prev.order, id];
            }

            const next = { order: newOrder, hidden: newHidden };
            persistState(next);
            return next;
        });
    }, [persistState]);

    const getAvailableWidgets = useCallback((): WidgetId[] => {
        return getAllWidgetIds().filter(id => !state.order.includes(id));
    }, [state.order]);

    const resetToDefault = useCallback(() => {
        const next = DEFAULT_STATE;
        setState(next);
        persistState(next);
    }, [persistState]);

    return {
        order: state.order,
        hidden: state.hidden,
        isLoaded,
        setOrder,
        hideWidget,
        showWidget,
        getAvailableWidgets,
        resetToDefault,
    };
}
