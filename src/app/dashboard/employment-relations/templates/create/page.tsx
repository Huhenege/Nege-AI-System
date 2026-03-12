'use client';

import React from 'react';
import { useFirebase, useFetchCollection, useTenantWrite } from '@/firebase';
import { ERDocumentType } from '../../types';
import { TemplateForm } from '../../components/template-form';
import { Loader2 } from 'lucide-react';

export default function CreateTemplatePage() {
    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();
    const docTypesQuery = React.useMemo(() => firestore ? tCollection('er_process_document_types') : null, [firestore, tCollection]);
    const { data: docTypes, isLoading } = useFetchCollection<ERDocumentType>(docTypesQuery);

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-100px)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-6 md:p-8 overflow-y-auto">
            <TemplateForm docTypes={docTypes || []} mode="create" />
        </div>
    );
}
