'use client';

import React from 'react';
import { useFirebase, useCollection, useTenantWrite } from '@/firebase';

import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/patterns/page-layout';
import { TemplatesTab } from '../components/templates-tab';
import type { ERDocumentType } from '../types';

export default function TemplatesManagementPage() {
  const { firestore } = useFirebase();
  const { tCollection } = useTenantWrite();

  const docTypesQuery = React.useMemo(
    () => (firestore ? tCollection('er_process_document_types') : null),
    [firestore, tCollection]
  );

  const { data: docTypes, isLoading } = useCollection<ERDocumentType>(docTypesQuery);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pb-32">
        <PageHeader
          title="Загварын удирдлага"
          description="Гэрээ, тушаал, албан бичиг баримтын загваруудыг удирдах"
          showBackButton={true}
          hideBreadcrumbs={true}
          backButtonPlacement="inline"
          backBehavior="history"
          fallbackBackHref="/dashboard/employment-relations"
        />

        <TemplatesTab docTypes={docTypes || []} />
      </div>
    </div>
  );
}

