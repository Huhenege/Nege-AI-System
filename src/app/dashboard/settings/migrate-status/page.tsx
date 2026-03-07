'use client';

import React, { useState } from 'react';
import { useFirebase, useTenantWrite } from '@/firebase';
import { getDocs, writeBatch, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

export default function CleanupCandidateEmployeesPage() {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const [running, setRunning] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [preview, setPreview] = useState<{ employeeId: string; name: string; candidateId?: string; applicationIds: string[] }[] | null>(null);
    const [result, setResult] = useState<{ deletedEmployees: number; clearedApplications: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadPreview = async () => {
        if (!firestore) return;
        setPreviewing(true);
        setError(null);
        setPreview(null);

        try {
            const empQuery = query(tCollection('employees'), where('status', '==', 'candidate'));
            const empSnap = await getDocs(empQuery);

            const items = await Promise.all(empSnap.docs.map(async (empDoc) => {
                const data = empDoc.data();
                const appQuery = query(tCollection('applications'), where('employeeId', '==', empDoc.id));
                const appSnap = await getDocs(appQuery);
                return {
                    employeeId: empDoc.id,
                    name: `${data.lastName || ''} ${data.firstName || ''}`.trim(),
                    candidateId: data.candidateId,
                    applicationIds: appSnap.docs.map(d => d.id),
                };
            }));

            setPreview(items);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setPreviewing(false);
        }
    };

    const runCleanup = async () => {
        if (!firestore || !preview) return;
        setRunning(true);
        setError(null);
        setResult(null);

        try {
            const batch = writeBatch(firestore);
            let deletedEmployees = 0;
            let clearedApplications = 0;

            for (const item of preview) {
                batch.delete(tDoc('employees', item.employeeId));
                deletedEmployees++;

                for (const appId of item.applicationIds) {
                    batch.update(tDoc('applications', appId), { employeeId: null });
                    clearedApplications++;
                }
            }

            if (deletedEmployees > 0) {
                await batch.commit();
            }

            setResult({ deletedEmployees, clearedApplications });
            setPreview(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Candidate Employee Cleanup</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Горилогч (candidate) статустай employee бичлэгүүдийг устгана. Горилогчийн мэдээлэл candidates collection-д хэвээр үлдэнэ.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                            <p className="font-medium">Анхааруулга</p>
                            <p>Энэ үйлдэл нь:</p>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                                <li><code>employees</code> collection-оос <code>status === &apos;candidate&apos;</code> бичлэгүүдийг устгана</li>
                                <li><code>applications</code> дахь <code>employeeId</code> reference-г цэвэрлэнэ</li>
                                <li><code>candidates</code> collection хөндөхгүй — хэвээр үлдэнэ</li>
                            </ul>
                        </div>
                    </div>

                    {!preview && !result && (
                        <Button onClick={loadPreview} disabled={previewing} variant="outline" className="gap-2">
                            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {previewing ? 'Шалгаж байна...' : 'Урьдчилан харах'}
                        </Button>
                    )}

                    {preview && preview.length === 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                            Candidate статустай employee бичлэг олдсонгүй. Цэвэрлэх зүйл алга.
                        </div>
                    )}

                    {preview && preview.length > 0 && (
                        <div className="space-y-3">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                                {preview.length} candidate employee олдлоо. Устгахад бэлэн.
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="text-left p-2 font-medium">Нэр</th>
                                            <th className="text-left p-2 font-medium">Employee ID</th>
                                            <th className="text-left p-2 font-medium">Candidate ID</th>
                                            <th className="text-left p-2 font-medium">Applications</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.map(item => (
                                            <tr key={item.employeeId} className="border-t">
                                                <td className="p-2">{item.name}</td>
                                                <td className="p-2 font-mono text-xs">{item.employeeId.slice(0, 10)}...</td>
                                                <td className="p-2 font-mono text-xs">{item.candidateId?.slice(0, 10) || '-'}...</td>
                                                <td className="p-2 text-center">{item.applicationIds.length}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <Button onClick={runCleanup} disabled={running} variant="destructive" className="gap-2">
                                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                {running ? 'Устгаж байна...' : `${preview.length} бичлэг устгах`}
                            </Button>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                            Алдаа: {error}
                        </div>
                    )}

                    {result && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                            Амжилттай! {result.deletedEmployees} employee устгагдлаа, {result.clearedApplications} application цэвэрлэгдлээ.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
