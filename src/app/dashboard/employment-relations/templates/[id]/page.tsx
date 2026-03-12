'use client';

import React from 'react';
import { useFirebase, useFetchCollection, useDoc, useTenantWrite } from '@/firebase';
import { ERDocumentType, ERTemplate } from '../../types';
import { TemplateForm } from '../../components/template-form';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function EditTemplatePage() {
    const { id } = useParams() as { id: string };
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();

    // Fetch document types
    const docTypesQuery = React.useMemo(() => firestore ? tCollection('er_process_document_types') : null, [firestore, tCollection]);
    const { data: docTypes, isLoading: isLoadingTypes } = useFetchCollection<ERDocumentType>(docTypesQuery);

    // Fetch template data
    const templateRef = React.useMemo(() =>
        firestore && id ? (tDoc('er_templates', id) as any) : null
        , [firestore, id, tDoc]);

    const { data: template, isLoading: isLoadingTemplate } = useDoc<ERTemplate>(templateRef);

    if (isLoadingTypes || isLoadingTemplate) {
        return (
            <div className="flex h-[calc(100vh-100px)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!template) {
        return (
            <div className="flex bg-slate-50/50 h-[calc(100vh-100px)] items-center justify-center">
                <p className="text-muted-foreground">Загвар олдсонгүй</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-6 md:p-8 overflow-y-auto">
            <TemplateForm
                docTypes={docTypes || []}
                mode="edit"
                initialData={template}
                templateId={id}
            />
        </div>
    );
}
