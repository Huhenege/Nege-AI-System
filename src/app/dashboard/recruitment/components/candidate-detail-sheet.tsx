'use client';

import React, { useState } from 'react';
import { useFirebase, useTenantWrite } from '@/firebase';
import { addDoc, onSnapshot, query, where } from 'firebase/firestore';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { JobApplication, Interview, Scorecard } from '@/types/recruitment';
import { format } from 'date-fns';
import { Mail, MessageSquare, Phone, Calendar, Clock, Send, Star } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { InterviewScorecard, ScorecardCriteria } from './interview-scorecard';

interface CandidateDetailSheetProps {
    application: JobApplication;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const getTime = (date: any) => {
    if (!date) return 0;
    if (typeof date === 'string') return new Date(date).getTime();
    if (date.seconds) return date.seconds * 1000;
    return new Date(date).getTime();
};

export function CandidateDetailSheet({ application, open, onOpenChange }: CandidateDetailSheetProps) {
    const { toast } = useToast();
    const candidate = application.candidate;
    const [messageText, setMessageText] = useState('');
    const [showScorecard, setShowScorecard] = useState(false);
    const [scorecards, setScorecards] = useState<Scorecard[]>([]);

    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();

    React.useEffect(() => {
        if (!firestore || !application.id || !open) return;

        const scorecardsQuery = query(
            tCollection('scorecards'),
            where('applicationId', '==', application.id)
        );

        const unsubscribe = onSnapshot(scorecardsQuery, (snapshot) => {
            const scs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scorecard));
            scs.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
            setScorecards(scs);
        });

        return () => unsubscribe();
    }, [firestore, application.id, open]);

    const handleSendMessage = () => {
        console.log(`Sending message to ${candidate?.phone}: ${messageText}`);
        toast({
            title: 'Мессеж илгээгдлээ',
            description: `${candidate?.phone} дугаар руу амжилттай илгээлээ. (Mock)`,
        });
        setMessageText('');
    };

    const handleScorecardSubmit = async (scores: ScorecardCriteria[], notes: string) => {
        if (!firestore || !application || !candidate) return;

        try {
            const averageScore = scores.reduce((acc, curr) => acc + curr.score, 0) / scores.length;

            const cleanCriteria = scores.map(c => ({
                id: c.id,
                name: c.name,
                description: c.description || '',
                score: c.score
            }));

            await addDoc(tCollection('scorecards'), {
                applicationId: application.id,
                candidateId: candidate.id,
                stageId: application.currentStageId,
                interviewerId: 'current-user-id', // TODO: Get actual user ID
                criteria: cleanCriteria,
                notes,
                averageScore,
                createdAt: new Date().toISOString()
            });

            toast({
                title: 'Үнэлгээ амжилттай хадгалагдлаа',
                description: 'Ярилцлагын үр дүнг системд бүртгэлээ.',
            });
            setShowScorecard(false);
        } catch (error) {
            console.error("Error saving scorecard:", error);
            toast({
                title: 'Алдаа гарлаа',
                description: 'Үнэлгээг хадгалж чадсангүй.',
                variant: 'destructive'
            });
        }
    };

    if (!candidate) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-xl w-full flex flex-col h-full">
                <SheetHeader className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={candidate.resumeUrl} />
                            <AvatarFallback className="text-lg">{candidate.firstName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <SheetTitle className="text-xl">{candidate.lastName} {candidate.firstName}</SheetTitle>
                            <SheetDescription asChild>
                                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                    <Badge variant="outline">{application.status}</Badge>
                                    <span className="text-xs text-muted-foreground">{candidate.email}</span>
                                </div>
                            </SheetDescription>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-2 flex-1">
                            <Phone className="h-4 w-4" />
                            Залгах
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2 flex-1">
                            <Mail className="h-4 w-4" />
                            Имэйл
                        </Button>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-hidden mt-6">
                    <Tabs defaultValue="activity" className="h-full flex flex-col">
                        <VerticalTabMenu
                            orientation="horizontal"
                            className="border-b pb-2"
                            items={[
                                { value: 'activity', label: 'Үйл явц' },
                                { value: 'info', label: 'Мэдээлэл' },
                                { value: 'communication', label: 'Харилцаа' },
                            ]}
                        />

                        <ScrollArea className="flex-1 p-4">
                            <TabsContent value="activity" className="space-y-4 m-0">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-muted-foreground">Түүх</h3>

                                    {/* Mock Timeline */}
                                    <div className="border-l-2 pl-4 space-y-6 ml-2">
                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-white" />
                                            <div>
                                                <p className="text-sm font-medium">Анкет илгээсэн</p>
                                                <p className="text-xs text-muted-foreground">2 өдрийн өмнө</p>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-slate-300 ring-4 ring-white" />
                                            <div>
                                                <p className="text-sm font-medium">Анкет шүүлт</p>
                                                <p className="text-xs text-muted-foreground">Одоогийн шат</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    <h3 className="text-sm font-medium text-muted-foreground">Ярилцлагын үнэлгээ</h3>

                                    {showScorecard ? (
                                        <InterviewScorecard
                                            candidateName={candidate.firstName || ''}
                                            onSubmit={handleScorecardSubmit}
                                            onCancel={() => setShowScorecard(false)}
                                        />
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="p-4 bg-muted/40 rounded-lg space-y-3">
                                                <p className="text-sm text-center text-muted-foreground mb-2">Ярилцлагын үнэлгээ өгөх</p>
                                                <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => setShowScorecard(true)}>
                                                    <Star className="h-4 w-4" />
                                                    Үнэлгээний хуудас бөглөх
                                                </Button>
                                            </div>

                                            {scorecards.length > 0 && (
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground px-1">Өмнөх үнэлгээнүүд ({scorecards.length})</h4>
                                                    <div className="space-y-2">
                                                        {scorecards.map((sc) => (
                                                            <div key={sc.id} className="p-3 bg-white border rounded-lg shadow-sm">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Avatar className="h-6 w-6">
                                                                            <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700 font-bold">{sc.interviewerName?.charAt(0)}</AvatarFallback>
                                                                        </Avatar>
                                                                        <div>
                                                                            <p className="text-xs font-bold">{sc.interviewerName}</p>
                                                                            <p className="text-[10px] text-muted-foreground">{format(new Date(sc.createdAt), 'yyyy.MM.dd')}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded text-amber-700 border border-amber-100">
                                                                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                                                        <span className="text-xs font-bold">{sc.averageScore.toFixed(1)}</span>
                                                                    </div>
                                                                </div>
                                                                {sc.notes && (
                                                                    <p className="text-xs text-muted-foreground italic line-clamp-2">"{sc.notes}"</p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="info" className="m-0 space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Утас</p>
                                        <p>{candidate.phone}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Имэйл</p>
                                        <p>{candidate.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Эх сурвалж</p>
                                        <p>{candidate.source}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Resume</p>
                                        {candidate.resumeUrl ? (
                                            <a href={candidate.resumeUrl} target="_blank" className="text-blue-600 hover:underline truncate block">
                                                Үзэх
                                            </a>
                                        ) : (
                                            <span className="text-muted-foreground">None</span>
                                        )}
                                    </div>
                                </div>

                                {candidate.notes && (
                                    <div className="bg-muted p-3 rounded-md text-sm">
                                        <p className="font-medium text-xs text-muted-foreground mb-1">Cover Letter / Тэмдэглэл:</p>
                                        {candidate.notes}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="communication" className="m-0 space-y-4">
                                <div className="space-y-4">
                                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                        <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4" />
                                            Мессеж илгээх (SMS)
                                        </h3>
                                        <Textarea
                                            placeholder="Горилогчид илгээх мессежээ бичнэ үү..."
                                            className="min-h-[100px] mb-3 bg-white"
                                            value={messageText}
                                            onChange={(e) => setMessageText(e.target.value)}
                                        />
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-muted-foreground">{messageText.length} тэмдэгт</span>
                                            <Button size="sm" className="gap-2" onClick={handleSendMessage} disabled={!messageText}>
                                                <Send className="h-3 w-3" />
                                                Илгээх
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Өмнөх харилцаа</h4>
                                        <div className="text-center py-4 text-sm text-muted-foreground">
                                            Одоогоор харилцаа үүсээгүй байна.
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet>
    );
}
