// src/app/dashboard/training/components/training-settings.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReferenceTable } from '@/components/ui/reference-table';

interface TrainingCategory {
    id: string;
    name: string;
    description?: string;
}

interface TrainingSettingsProps {
    categories: TrainingCategory[];
    isLoading: boolean;
}

export function TrainingSettings({ categories, isLoading }: TrainingSettingsProps) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Сургалтын ангилал</CardTitle>
                    <CardDescription>
                        Сургалтын санд ашиглагдах ангилалуудыг удирдах
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ReferenceTable
                        collectionName="training_categories"
                        columns={[
                            { key: 'name', header: 'Ангилалын нэр' },
                            { key: 'description', header: 'Тайлбар' },
                        ]}
                        itemData={categories}
                        isLoading={isLoading}
                        dialogTitle="Сургалтын ангилал"
                        maxVisibleItems={10}
                        compact={false}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
