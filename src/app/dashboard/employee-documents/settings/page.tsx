'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferenceTable, type ReferenceItem } from "@/components/ui/reference-table";
import { useCollection, useFirebase, useMemoFirebase, tenantCollection, useTenantWrite } from "@/firebase";
import { writeBatch } from "firebase/firestore";
import { PageHeader } from '@/components/patterns/page-layout';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { FileText, Settings as SettingsIcon, ClipboardCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type FieldDefinition = {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date';
};

type DocumentTypeReferenceItem = ReferenceItem & { name: string; fields?: FieldDefinition[] };

export default function DocumentsSettingsPage() {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [isCleaning, setIsCleaning] = React.useState(false);
    const documentTypesQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'er_document_types') : null, []);
    const { data: documentTypes, isLoading: loadingDocTypes } = useCollection<DocumentTypeReferenceItem>(documentTypesQuery);

    const cleanupSummary = React.useMemo(() => {
        const items = documentTypes || [];
        let affectedDocs = 0;
        let removedFields = 0;
        for (const dt of items) {
            const fields = (dt.fields || []) as FieldDefinition[];
            const seen = new Set<string>();
            let removedInDoc = 0;
            for (const f of fields) {
                const k = (f?.key || '').trim();
                if (!k) {
                    removedInDoc++;
                    continue;
                }
                if (seen.has(k)) {
                    removedInDoc++;
                    continue;
                }
                seen.add(k);
            }
            if (removedInDoc > 0) {
                affectedDocs++;
                removedFields += removedInDoc;
            }
        }
        return { affectedDocs, removedFields };
    }, [documentTypes]);

    const handleCleanupDuplicateFieldKeys = async () => {
        if (!firestore) return;
        if (!documentTypes || documentTypes.length === 0) return;
        setIsCleaning(true);
        try {
            const batch = writeBatch(firestore);
            let writeCount = 0;
            let affectedDocs = 0;
            let removedFields = 0;

            for (const dt of documentTypes) {
                const fields = (dt.fields || []) as FieldDefinition[];
                const seen = new Set<string>();
                const deduped: FieldDefinition[] = [];
                let removedInDoc = 0;

                for (const f of fields) {
                    const k = (f?.key || '').trim();
                    if (!k) { removedInDoc++; continue; }
                    if (seen.has(k)) { removedInDoc++; continue; }
                    seen.add(k);
                    deduped.push({ ...f, key: k });
                }

                if (removedInDoc > 0) {
                    affectedDocs++;
                    removedFields += removedInDoc;
                    batch.update(tDoc('er_document_types', dt.id), { fields: deduped });
                    writeCount++;
                }
            }

            if (writeCount === 0) {
                toast({ title: 'Цэвэрлэх зүйл олдсонгүй', description: 'Давхардсан key-тай талбар илрээгүй.' });
                return;
            }

            if (writeCount > 450) {
                throw new Error(`Batch update хэт их байна: ${writeCount}.`);
            }

            await batch.commit();
            toast({
                title: 'Амжилттай цэвэрлэлээ',
                description: `${affectedDocs} төрлөөс ${removedFields} давхардсан/хоосон key талбар устгалаа.`,
            });
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Алдаа', description: e?.message || 'Цэвэрлэхэд алдаа гарлаа.' });
        } finally {
            setIsCleaning(false);
        }
    };

    const docTypeColumns = [
        { key: 'name', header: 'Нэр' },
        {
            key: 'isMandatory',
            header: 'Заавал бүрдүүлэх',
            render: (val: any) => val === true ? (
                <Badge className="bg-indigo-600 text-white border-none text-[9px] font-bold uppercase tracking-tighter px-2 h-5">Шаардлагатай</Badge>
            ) : (
                <span className="text-slate-300 text-[9px] font-bold uppercase tracking-widest">Үгүй</span>
            )
        },
        { key: 'fields', header: 'Талбарууд' }
    ];

    return (
        <div className="py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PageHeader
                title="Ажилтны бичиг баримтын тохиргоо"
                description="Ажилтнаас цуглуулах бичиг баримтын төрөл болон шаардлагуудыг тохируулах"
                showBackButton={true}
                backHref="/dashboard/employee-documents"
                actions={
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                disabled={loadingDocTypes || isCleaning || cleanupSummary.affectedDocs === 0}
                                title={
                                    cleanupSummary.affectedDocs === 0
                                        ? 'Давхардсан талбар олдсонгүй'
                                        : `Цэвэрлэх: ${cleanupSummary.affectedDocs} баримтын төрөл`
                                }
                            >
                                <ClipboardCheck className="h-4 w-4 mr-2" />
                                Давхардсан key цэвэрлэх
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Давхардсан key-үүдийг цэвэрлэх үү?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {cleanupSummary.affectedDocs === 0 ? (
                                        <>Одоогоор давхардсан/хоосон key-тай талбар олдсонгүй.</>
                                    ) : (
                                        <>
                                            Нийт <b>{cleanupSummary.affectedDocs}</b> баримтын төрөл дээр
                                            <b> {cleanupSummary.removedFields}</b> давхардсан/хоосон key-тай талбар байна. “Тийм” дарвал
                                            давхардсан key-ууд автоматаар арилна (эхнийх нь үлдэнэ).
                                        </>
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isCleaning}>Болих</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleCleanupDuplicateFieldKeys}
                                    disabled={isCleaning || cleanupSummary.affectedDocs === 0}
                                >
                                    {isCleaning ? 'Цэвэрлэж байна...' : 'Тийм, цэвэрлэх'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                }
            />

            <Tabs defaultValue="types" className="space-y-6">
                <VerticalTabMenu
                    orientation="horizontal"
                    items={[{ value: "types", label: "Баримтын төрөл" }]}
                />

                <TabsContent value="types">
                    <Card className="border-none shadow-xl shadow-indigo-100/20 bg-white rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="px-8 pt-8 text-center md:text-left">
                            <CardTitle className="text-xl font-bold text-slate-800">Ажилтны бичиг баримтын төрөл</CardTitle>
                            <CardDescription>Ажилтнаас цуглуулах баримт бичгийн төрөл болон заавал бүрдүүлэх шаардлагуудыг энд тохируулна.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-8 pb-8">
                            <ReferenceTable
                                collectionName="er_document_types"
                                columns={docTypeColumns}
                                itemData={documentTypes}
                                isLoading={loadingDocTypes}
                                dialogTitle="Баримт бичгийн төрөл"
                                enableFieldDefs={true}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
