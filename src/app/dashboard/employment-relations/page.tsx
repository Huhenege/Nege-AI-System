'use client';

import React, { useState, useEffect } from 'react';
import { useFetchCollection, useFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { ERDocument, ERDocumentType } from './types';
import { PageHeader } from '@/components/patterns/page-layout';
import { Button } from '@/components/ui/button';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Activity, FileCode, TableIcon } from 'lucide-react';
import Link from 'next/link';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { DocumentPipeline } from './components/document-pipeline';
import { OrdersTab } from './components/orders-tab';
import { ERDashboard } from './components/er-dashboard';

export default function DocumentListPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    const documentsQuery = React.useMemo(() =>
        firestore ? query(collection(firestore, 'er_documents'), orderBy('createdAt', 'desc')) : null
        , [firestore]);

    const docTypesQuery = React.useMemo(() => firestore ? collection(firestore, 'er_process_document_types') : null, [firestore]);
    const templatesQuery = React.useMemo(() => firestore ? collection(firestore, 'er_templates') : null, [firestore]);

    const { data: documents, isLoading, refetch: refetchDocuments } = useFetchCollection<ERDocument>(documentsQuery);
    const { data: docTypes } = useFetchCollection<ERDocumentType>(docTypesQuery);
    const { data: templates } = useFetchCollection<{ id: string; isSystem?: boolean }>(templatesQuery);

    const docTypeMap = React.useMemo(() => {
        return docTypes?.reduce((acc, type) => ({ ...acc, [type.id]: type.name }), {} as Record<string, string>) || {};
    }, [docTypes]);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                refetchDocuments();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [refetchDocuments]);

    const filteredDocuments = React.useMemo(() => {
        if (!documents) return [];
        return documents.filter(doc => {
            const matchesSearch =
                (doc.documentNumber?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (doc.metadata?.employeeName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (docTypeMap[doc.documentTypeId]?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (doc.id.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
            const matchesType = typeFilter === 'all' || doc.documentTypeId === typeFilter;

            return matchesSearch && matchesStatus && matchesType;
        });
    }, [documents, searchQuery, statusFilter, typeFilter, docTypeMap]);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pb-32">
                <PageHeader
                    title="Процесс удирдлага"
                    description="Гэрээ, тушаал, албан бичиг баримтын нэгдсэн систем"
                    showBackButton={true}
                    hideBreadcrumbs={true}
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard"
                    actions={
                        <div className="flex items-center gap-2">
                            <Button variant="outline" asChild className="bg-white hover:bg-slate-50 shadow-sm">
                                <Link href="/dashboard/employment-relations/templates" title="Загварын удирдлага">
                                    <FileCode className="h-4 w-4 mr-2" />
                                    Загварууд
                                </Link>
                            </Button>
                            <AddActionButton
                                label="Шинэ документ"
                                description="Шинэ процесс/баримт үүсгэх"
                                href="/dashboard/employment-relations/create"
                            />
                        </div>
                    }
                />

                {/* Dashboard | хөдөлмөрийн харилцаа */}
                <ERDashboard
                    documents={documents ?? null}
                    docTypes={docTypes ?? null}
                    templates={templates ?? null}
                    isLoading={isLoading}
                />

                <Tabs defaultValue="er" className="space-y-6">
                    <VerticalTabMenu
                        orientation="horizontal"
                        items={[
                            { value: 'er', label: 'Процесс' },
                            { value: 'orders', label: 'Тушаал бүртгэл' },
                        ]}
                    />

                    <TabsContent value="er" className="space-y-4">
                        {/* Filters */}
                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            <div className="flex-1 w-full relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ажилтан, төрөл, кодоор хайх..."
                                    className="pl-9 w-full bg-white border shadow-sm h-11 rounded-xl"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-full md:w-[220px] bg-white border shadow-sm h-11 rounded-xl">
                                    <Activity className="h-4 w-4 mr-2 text-muted-foreground opacity-70" />
                                    <SelectValue placeholder="Бүх төрөл" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Бүх төрөл</SelectItem>
                                    {docTypes?.map((type) => (
                                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Pipeline View */}
                        <DocumentPipeline
                            documents={filteredDocuments}
                            isLoading={isLoading}
                            docTypeMap={docTypeMap}
                        />
                    </TabsContent>

                    <TabsContent value="orders">
                        <OrdersTab 
                            documents={documents || []} 
                            docTypes={docTypes || []} 
                            isLoading={isLoading} 
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
