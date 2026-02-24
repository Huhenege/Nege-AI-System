'use client';

import React, { useState, useEffect } from 'react';
import { Star, Save, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ScorecardCriteria {
    id: string;
    name: string;
    description?: string;
    score: number; // 0-5
}

interface InterviewScorecardProps {
    candidateName: string;
    onSubmit: (scores: ScorecardCriteria[], notes: string) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

const DEFAULT_CRITERIA: ScorecardCriteria[] = [
    { id: 'technical', name: 'Мэргэжлийн ур чадвад', description: 'Тухайн албан тушаалд шаардагдах техник ур чадвар', score: 0 },
    { id: 'communication', name: 'Харилцааны ур чадвад', description: 'Өөрийгөө илэрхийлэх, сонсох чадвар', score: 0 },
    { id: 'culture', name: 'Соёлын нийцэл', description: 'Байгууллагын үнэт зүйлстэй нийцэх байдал', score: 0 },
    { id: 'experience', name: 'Туршлага', description: 'Өмнөх ажлын туршлага, хийсэн ажлууд', score: 0 },
];

export function InterviewScorecard({ candidateName, onSubmit, onCancel, isLoading: externalLoading }: InterviewScorecardProps) {
    const { firestore } = useFirebase();
    const [criteria, setCriteria] = useState<ScorecardCriteria[]>([]);
    const [notes, setNotes] = useState('');
    const [loadingCriteria, setLoadingCriteria] = useState(true);

    useEffect(() => {
        const fetchCriteria = async () => {
            if (!firestore) return;
            try {
                const docRef = doc(firestore, 'recruitment_settings', 'default');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().defaultCriteria) {
                    const fetchedCriteria = docSnap.data().defaultCriteria.map((c: any) => ({
                        ...c,
                        score: 0
                    }));
                    setCriteria(fetchedCriteria);
                } else {
                    setCriteria(DEFAULT_CRITERIA);
                }
            } catch (error) {
                console.error("Failed to fetch criteria:", error);
                setCriteria(DEFAULT_CRITERIA);
            } finally {
                setLoadingCriteria(false);
            }
        };

        fetchCriteria();
    }, [firestore]);

    const handleRate = (id: string, rating: number) => {
        setCriteria(prev => prev.map(c =>
            c.id === id ? { ...c, score: rating } : c
        ));
    };

    const calculateAverage = () => {
        const total = criteria.reduce((sum, c) => sum + c.score, 0);
        return (total / (criteria.length || 1)).toFixed(1);
    };

    const handleSubmit = () => {
        onSubmit(criteria, notes);
    };

    return (
        <Card className="border-dashed w-full max-w-full min-w-0 overflow-hidden">
            <CardHeader className="pb-3 text-center border-b px-4 pt-4">
                <CardTitle className="text-base font-bold text-slate-900">Ярилцлагын үнэлгээний хуудас</CardTitle>
                <p className="text-xs text-muted-foreground mt-1 truncate">{candidateName}</p>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 px-4 pb-4">
                {loadingCriteria ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <p className="text-xs text-muted-foreground">Үнэлгээний шалгууруудыг ачаалж байна...</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-6 min-w-0">
                            {criteria.map((criterion) => (
                                <div key={criterion.id} className="space-y-1.5 min-w-0">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center min-w-0">
                                        <Label className="text-sm font-medium shrink-0">{criterion.name}</Label>
                                        <div className="flex gap-1 shrink-0">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    className="focus:outline-none transition-transform hover:scale-110"
                                                    onClick={() => handleRate(criterion.id, star)}
                                                    type="button"
                                                >
                                                    <Star
                                                        className={cn(
                                                            "h-5 w-5 transition-colors",
                                                            star <= criterion.score
                                                                ? "fill-yellow-400 text-yellow-400"
                                                                : "text-slate-200 hover:text-slate-300"
                                                        )}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {criterion.description && (
                                        <p className="text-xs text-muted-foreground">{criterion.description}</p>
                                    )}
                                </div>
                            ))}
                            {criteria.length === 0 && (
                                <p className="text-sm text-center text-muted-foreground py-4">Үнэлгээний шалгуур тохируулаагүй байна.</p>
                            )}
                        </div>

                        <div className="space-y-4 pt-4 border-t min-w-0">
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center min-w-0">
                                <Label className="shrink-0">Нэмэлт тэмдэглэл</Label>
                                <span className="text-sm font-semibold text-blue-600 shrink-0">Дундаж: {calculateAverage()} / 5.0</span>
                            </div>
                            <Textarea
                                placeholder="Горилогчийн давуу болон сул тал, анхаарах зүйлс..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[100px] resize-none w-full min-w-0"
                            />
                        </div>
                    </>
                )}

                <div className="flex flex-col-reverse gap-2 pt-2 border-t sm:flex-row sm:justify-end min-w-0">
                    <Button variant="ghost" onClick={onCancel} size="sm" disabled={externalLoading || loadingCriteria} className="w-full sm:w-auto">Болих</Button>
                    <Button
                        onClick={handleSubmit}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 shadow-md gap-2 w-full sm:w-auto"
                        disabled={externalLoading || loadingCriteria || criteria.length === 0}
                    >
                        {externalLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Баталгаажуулах
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
