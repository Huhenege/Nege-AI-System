'use client';

import * as React from 'react';
import { useDoc, useMemoFirebase, tenantDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { hexToHsl } from '@/lib/color-utils';

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

    const { data: branding } = useDoc<CompanyBranding>(brandingRef as any);

    React.useEffect(() => {
        if (!branding || !branding.themeMapping || !branding.brandColors) return;

        const { themeMapping, brandColors } = branding;
        const root = document.documentElement;

        // Helper to find hex by ID
        const getColorHex = (id: string | undefined) => {
            if (!id) return undefined;
            return brandColors.find(c => c.id === id)?.hex;
        };

        // Map and Apply - all theme slots
        const mappings: { slot: string; colorId: string | undefined }[] = [
            { slot: '--primary', colorId: themeMapping.primary },
            { slot: '--secondary', colorId: themeMapping.secondary },
            { slot: '--accent', colorId: themeMapping.accent },
            { slot: '--destructive', colorId: themeMapping.destructive },
            { slot: '--muted', colorId: themeMapping.muted },
        ];

        mappings.forEach(({ slot, colorId }) => {
            const hex = getColorHex(colorId);
            if (hex) {
                const hsl = hexToHsl(hex);
                if (hsl) {
                    root.style.setProperty(slot, hsl);
                }
            }
        });

    }, [branding]);

    return <>{children}</>;
}
