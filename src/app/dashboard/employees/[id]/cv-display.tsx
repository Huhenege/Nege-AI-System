'use client';

import React from 'react';
import { useDoc, useFirebase, useMemoFirebase, tenantDoc } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Printer, User, Phone, Mail, MapPin, Briefcase, GraduationCap, Languages, Award, Globe, History, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const CVSectionHeader = ({ title, icon: Icon }: { title: string; icon: React.ElementType }) => (
    <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100/50">
            <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">Мэдээлэл</h3>
            <h2 className="text-base font-bold text-slate-800 leading-none">{title}</h2>
        </div>
    </div>
);

const CVEntry = ({ title, subtitle, date, children }: { title: string; subtitle?: string; date?: string; children?: React.ReactNode }) => (
    <div className="relative pl-8 pb-8 group last:pb-0">
        <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-slate-100 border-2 border-slate-50 transition-colors group-hover:bg-indigo-500 group-hover:border-indigo-100" />
        <div className="absolute left-[5px] top-[18px] bottom-0 w-0.5 bg-slate-50 group-last:hidden" />

        <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
            <div>
                <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{title}</h4>
                {subtitle && <p className="text-xs font-semibold text-slate-500">{subtitle}</p>}
            </div>
            {date && (
                <div className="px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter">{date}</p>
                </div>
            )}
        </div>
        {children && <div className="mt-2 text-xs font-medium text-slate-500 leading-relaxed max-w-2xl">{children}</div>}
    </div>
);

const CVSkeleton = () => (
    <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-10 space-y-10">
            <div className="flex items-center gap-8">
                <Skeleton className="h-28 w-28 rounded-3xl" />
                <div className="space-y-4">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-6 w-40" />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-10">
                <div className="col-span-1 space-y-8">
                    <Skeleton className="h-40 w-full rounded-2xl" />
                    <Skeleton className="h-40 w-full rounded-2xl" />
                </div>
                <div className="col-span-2 space-y-8">
                    <Skeleton className="h-64 w-full rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
            </div>
        </CardContent>
    </Card>
);

export function CVDisplay({ employeeId }: { employeeId: string }) {
    const { firestore } = useFirebase();

    const employeeRef = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantDoc(firestore, companyPath, 'employees', employeeId) : null, [employeeId]);
    const questionnaireRef = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantDoc(firestore, companyPath, `employees/${employeeId}/questionnaire`, 'data') : null, [employeeId]);

    const { data: employee, isLoading: isLoadingEmployee } = useDoc(employeeRef);
    const { data: questionnaire, isLoading: isLoadingQuestionnaire } = useDoc(questionnaireRef);

    const isLoading = isLoadingEmployee || isLoadingQuestionnaire;

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) return <CVSkeleton />;

    if (!questionnaire) {
        return (
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="h-16 w-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 mb-6">
                        <History className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Анкет бүртгэгдээгүй</h3>
                    <p className="text-sm font-medium text-slate-400 max-w-xs">Энэ ажилтны анкетын мэдээлэл системд хараахан бүртгэгдээгүй байна.</p>
                </CardContent>
            </Card>
        );
    }

    const fullName = `${questionnaire.lastName || ''} ${questionnaire.firstName || ''}`;

    const formatDate = (date: any) => {
        if (!date) return '';
        try {
            if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString('mn-MN');
            return new Date(date).toLocaleDateString('mn-MN');
        } catch {
            return date.toString();
        }
    };

    const formatDateRange = (start: any, end: any, isCurrent?: boolean) => {
        if (!start) return '';
        const startDate = formatDate(start);
        const endDate = isCurrent ? 'Одоо' : (end ? formatDate(end) : 'Тодорхойгүй');
        return `${startDate} - ${endDate}`;
    }

    return (
        <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white print:shadow-none print:rounded-none">
            <CardHeader className="p-8 pb-4 flex flex-row justify-between items-center bg-slate-50/50 print:bg-transparent">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Curriculum Vitae</CardTitle>
                <Button variant="ghost" size="sm" onClick={handlePrint} className="rounded-xl h-10 px-4 font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-white shadow-none transition-all">
                    <Printer className="mr-2 h-4 w-4" />
                    PDF Хэвлэх
                </Button>
            </CardHeader>
            <CardContent className="p-10 lg:p-14 space-y-12">
                {/* Header Profile */}
                <div className="flex flex-col lg:flex-row items-center lg:items-end gap-10">
                    <div className="relative">
                        <div className="absolute -inset-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-[2.5rem] opacity-10 blur-xl" />
                        <Avatar className="h-40 w-40 rounded-[2.5rem] ring-8 ring-white shadow-2xl relative">
                            <AvatarImage src={employee?.photoURL} alt={fullName} className="object-cover" />
                            <AvatarFallback className="text-4xl font-black bg-indigo-50 text-indigo-500 uppercase">{questionnaire.firstName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg border-4 border-white">
                            <Sparkles className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="flex-1 text-center lg:text-left space-y-2">
                        <h1 className="text-4xl lg:text-5xl font-black text-slate-800 tracking-tight leading-none">{fullName}</h1>
                        <p className="text-lg lg:text-xl font-bold text-indigo-500/80">{employee?.jobTitle || 'Албан тушаал тодорхойгүй'}</p>
                        <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-4">
                            <span className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                                <Mail className="h-3.5 w-3.5" />
                                {questionnaire.personalEmail || employee?.email}
                            </span>
                            <span className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                                <Phone className="h-3.5 w-3.5" />
                                {questionnaire.personalPhone}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
                    {/* Left Sidebar Info */}
                    <div className="lg:col-span-4 space-y-10">
                        <div>
                            <CVSectionHeader title="Хувийн мэдээлэл" icon={User} />
                            <div className="space-y-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-100/50">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Регистрийн дугаар</p>
                                    <p className="text-sm font-bold text-slate-700 font-mono tracking-tight">{questionnaire.registrationNumber}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Төрсөн огноо</p>
                                    <p className="text-sm font-bold text-slate-700">{formatDate(questionnaire.birthDate)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Хүйс</p>
                                    <p className="text-sm font-bold text-slate-700">{questionnaire.gender === 'male' ? 'Эрэгтэй' : 'Эмэгтэй'}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <CVSectionHeader title="Хаяг байршил" icon={MapPin} />
                            <div className="space-y-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-100/50">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Оршин суугаа хаяг</p>
                                    <p className="text-xs font-semibold text-slate-600 leading-relaxed">{questionnaire.homeAddress}</p>
                                </div>
                            </div>
                        </div>

                        {questionnaire.languages && questionnaire.languages.length > 0 && (
                            <div>
                                <CVSectionHeader title="Хэлний мэдлэг" icon={Globe} />
                                <div className="space-y-3">
                                    {questionnaire.languages.map((lang: any, index: number) => (
                                        <div key={index} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm transition-transform hover:scale-[1.02]">
                                            <span className="text-xs font-bold text-slate-700">{lang.language}</span>
                                            <div className="flex gap-1">
                                                {['listening', 'speaking', 'reading', 'writing'].map((_, i) => (
                                                    <div key={i} className="h-1.5 w-4 rounded-full bg-indigo-500" />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Main Content */}
                    <div className="lg:col-span-8 space-y-12">
                        {questionnaire.experiences && questionnaire.experiences.length > 0 && (
                            <div>
                                <CVSectionHeader title="Ажлын туршлага" icon={Briefcase} />
                                <div className="space-y-2">
                                    {questionnaire.experiences.map((exp: any, index: number) => (
                                        <CVEntry
                                            key={index}
                                            title={exp.position}
                                            subtitle={exp.company}
                                            date={formatDateRange(exp.startDate, exp.endDate)}
                                        >
                                            <p>{exp.description}</p>
                                        </CVEntry>
                                    ))}
                                </div>
                            </div>
                        )}

                        {questionnaire.education && questionnaire.education.length > 0 && (
                            <div>
                                <CVSectionHeader title="Боловсрол" icon={GraduationCap} />
                                <div className="space-y-2">
                                    {questionnaire.education.map((edu: any, index: number) => (
                                        <CVEntry
                                            key={index}
                                            title={edu.degree || 'Боловсролын зэрэг'}
                                            subtitle={`${edu.school || edu.schoolCustom}${edu.country ? `, ${edu.country}` : ''}`}
                                            date={formatDateRange(edu.entryDate, edu.gradDate, edu.isCurrent)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {questionnaire.trainings && questionnaire.trainings.length > 0 && (
                            <div>
                                <CVSectionHeader title="Сургалт & Мэргэшил" icon={Award} />
                                <div className="space-y-2">
                                    {questionnaire.trainings.map((tr: any, index: number) => (
                                        <CVEntry
                                            key={index}
                                            title={tr.name}
                                            subtitle={tr.organization}
                                            date={formatDateRange(tr.startDate, tr.endDate)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

