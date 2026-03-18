'use client';

import * as React from 'react';
import { useFetchDoc, useMemoFirebase, tenantDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { hexToHsl, getContrastTextColor } from '@/lib/color-utils';

interface BrandColor {
    id: string;
    name: string;
    hex: string;
}

interface ThemeMapping {
    primary: string;
    secondary: string;
    accent: string;
    destructive?: string;
    muted?: string;
}

interface CompanyBranding {
    brandColors: BrandColor[];
    themeMapping: ThemeMapping;
}

export function CompanyThemeProvider({ children }: { children: React.ReactNode }) {
    const { firestore } = useFirebase();

    const brandingRef = useMemoFirebase(
        ({ companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'branding') : null),
        [firestore]
    );

    const { data: branding, refetch: refetchBranding } = useFetchDoc<CompanyBranding>(brandingRef as any);

    // Refetch branding when tab/window becomes visible (e.g. after saving on branding page)
    React.useEffect(() => {
        const onFocus = () => refetchBranding();
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('visibilitychange', onFocus);
            return () => document.removeEventListener('visibilitychange', onFocus);
        }
    }, [refetchBranding]);

    React.useEffect(() => {
        if (!branding || !branding.themeMapping || !branding.brandColors) return;

        const { themeMapping, brandColors } = branding;
        const root = document.documentElement;

        // Helper to find hex by ID
        const getColorHex = (id: string | undefined) => {
            if (!id) return undefined;
            return brandColors.find(c => c.id === id)?.hex;
        };

        // Map and Apply - all theme slots + foreground (contrast text) for readability
        const mappings: { slot: string; foregroundSlot: string; colorId: string | undefined }[] = [
            { slot: '--primary', foregroundSlot: '--primary-foreground', colorId: themeMapping.primary },
            { slot: '--secondary', foregroundSlot: '--secondary-foreground', colorId: themeMapping.secondary },
            { slot: '--accent', foregroundSlot: '--accent-foreground', colorId: themeMapping.accent },
            { slot: '--destructive', foregroundSlot: '--destructive-foreground', colorId: themeMapping.destructive },
            { slot: '--muted', foregroundSlot: '--muted-foreground', colorId: themeMapping.muted },
        ];

        mappings.forEach(({ slot, foregroundSlot, colorId }) => {
            const hex = getColorHex(colorId);
            if (hex) {
                const hsl = hexToHsl(hex);
                if (hsl) {
                    root.style.setProperty(slot, hsl);
                }
                const fgHex = getContrastTextColor(hex);
                const fgHsl = hexToHsl(fgHex);
                if (fgHsl) {
                    root.style.setProperty(foregroundSlot, fgHsl);
                }
            }
        });

    }, [branding]);

    return <>{children}</>;
}
