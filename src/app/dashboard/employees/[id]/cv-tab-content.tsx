'use client';

import * as React from 'react';
import { useFirebase, useDoc, useMemoFirebase, tenantDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Printer, Download, User, Phone, Mail, MapPin, GraduationCap, Briefcase, Languages, Award, Users, Calendar, Car, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Employee } from '../data';
import { FullQuestionnaireValues } from '@/types/questionnaire';
import { INSURANCE_TYPES } from '@/data/insurance-types';

interface CVTabContentProps {
    employee: Employee;
}

const transformDates = (data: any) => {
    if (!data) return data;
    const transformedData = { ...data };
    const dateFields = ['birthDate', 'disabilityDate'];
    const arrayDateFields = ['entryDate', 'gradDate', 'startDate', 'endDate'];

    for (const field of dateFields) {
        if (transformedData[field] && typeof transformedData[field] === 'object' && 'seconds' in transformedData[field]) {
            transformedData[field] = transformedData[field].toDate();
        }
    }

    ['education', 'trainings', 'experiences'].forEach(arrayKey => {
        if (transformedData[arrayKey]) {
            transformedData[arrayKey] = transformedData[arrayKey].map((item: any) => {
                const newItem = { ...item };
                for (const field of arrayDateFields) {
                    if (newItem[field] && typeof newItem[field] === 'object' && 'seconds' in newItem[field]) {
                        newItem[field] = newItem[field].toDate();
                    }
                }
                return newItem;
            });
        }
    });

    return transformedData;
};

const formatDate = (date: any): string => {
    if (!date) return '-';
    try {
        if (typeof date === 'string') return date;
        if (date.seconds) return format(new Date(date.seconds * 1000), 'yyyy-MM-dd');
        if (date instanceof Date) return format(date, 'yyyy-MM-dd');
        return '-';
    } catch {
        return '-';
    }
};

const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
            <Icon className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{title}</h3>
        </div>
        {children}
    </div>
);

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex py-1">
        <span className="w-40 text-xs text-slate-500 shrink-0">{label}</span>
        <span className="text-xs text-slate-800 font-medium">{value || '-'}</span>
    </div>
);

export function CVTabContent({ employee }: CVTabContentProps) {
    const { firestore } = useFirebase();
    const printRef = React.useRef<HTMLDivElement>(null);

    const questionnaireDocRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && employee?.id ? tenantDoc(firestore, companyPath, `employees/${employee.id}/questionnaire`, 'data') : null),
        [employee?.id]
    );

    const { data: rawQuestionnaireData, isLoading } = useDoc<FullQuestionnaireValues>(questionnaireDocRef);
    const questionnaireData = React.useMemo(() => transformDates(rawQuestionnaireData), [rawQuestionnaireData]);

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const styles = `
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                .cv-container { max-width: 800px; margin: 0 auto; }
                .header { display: flex; gap: 24px; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
                .avatar { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #e2e8f0; }
                .avatar-fallback { width: 100px; height: 100px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 600; color: #64748b; }
                .header-info { flex: 1; }
                .name { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
                .job-title { font-size: 14px; color: #64748b; margin-bottom: 12px; }
                .contact-row { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: #475569; }
                .section { margin-bottom: 24px; }
                .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #3b82f6; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
                .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
                .info-row { display: flex; font-size: 12px; }
                .info-label { width: 140px; color: #64748b; flex-shrink: 0; }
                .info-value { color: #1e293b; font-weight: 500; }
                .experience-item, .education-item, .training-item { padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; }
                .item-title { font-weight: 600; font-size: 13px; color: #0f172a; }
                .item-subtitle { font-size: 12px; color: #64748b; }
                .item-date { font-size: 11px; color: #94a3b8; }
                .skills-grid { display: flex; flex-wrap: wrap; gap: 8px; }
                .skill-badge { background: #eff6ff; color: #3b82f6; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; }
                .language-item { display: flex; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
                .language-name { font-weight: 600; font-size: 12px; width: 100px; }
                .language-level { font-size: 11px; color: #64748b; }
                .family-item { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
                @media print { 
                    body { padding: 20px; } 
                    .section { page-break-inside: avoid; }
                }
            </style>
        `;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>CV - ${employee?.lastName} ${employee?.firstName}</title>
                ${styles}
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
            </div>
        );
    }

    const data = questionnaireData || {};
    const fullName = `${data.lastName || employee?.lastName || ''} ${data.firstName || employee?.firstName || ''}`.trim();
    const insuranceType = INSURANCE_TYPES.find(t => t.code === data.insuranceTypeCode);

    return (
        <div className="space-y-4">
            {/* Actions */}
            <div className="flex items-center justify-between bg-white rounded-xl border p-4">
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">Хувийн хэрэг (CV)</h3>
                    <p className="text-xs text-slate-500">Ажилтаны бүх мэдээллийг нэг хуудсанд харуулна</p>
                </div>
                <Button onClick={handlePrint} className="gap-2">
                    <Printer className="w-4 h-4" />
                    Хэвлэх
                </Button>
            </div>

            {/* CV Content */}
            <div className="bg-white rounded-xl border p-6 md:p-8" ref={printRef}>
                <div className="cv-container">
                    {/* Header */}
                    <div className="flex gap-6 mb-8 pb-6 border-b-2 border-slate-100">
                        <Avatar className="w-24 h-24 border-4 border-slate-100 shadow-lg">
                            <AvatarImage src={employee?.photoURL} alt={fullName} />
                            <AvatarFallback className="text-2xl bg-slate-100 text-slate-600">
                                {(data.firstName || employee?.firstName)?.charAt(0)}
                                {(data.lastName || employee?.lastName)?.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-slate-900 mb-1">{fullName || 'Нэр байхгүй'}</h1>
                            <p className="text-sm text-slate-500 mb-3">{employee?.jobTitle || 'Албан тушаал'}</p>
                            <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                                {(data.personalPhone || employee?.phoneNumber) && (
                                    <div className="flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                                        {data.personalPhone || employee?.phoneNumber}
                                    </div>
                                )}
                                {(data.personalEmail || employee?.email) && (
                                    <div className="flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                        {data.personalEmail || employee?.email}
                                    </div>
                                )}
                                {data.homeAddress && (
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                        {data.homeAddress}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Personal Info */}
                    <Section title="Хувийн мэдээлэл" icon={User}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                            <InfoRow label="Овог" value={data.lastName || employee?.lastName} />
                            <InfoRow label="Нэр" value={data.firstName || employee?.firstName} />
                            <InfoRow label="Регистрийн дугаар" value={data.registrationNumber} />
                            <InfoRow label="ТТД" value={data.idCardNumber} />
                            <InfoRow label="Төрсөн огноо" value={formatDate(data.birthDate)} />
                            <InfoRow label="Хүйс" value={data.gender === 'male' ? 'Эрэгтэй' : data.gender === 'female' ? 'Эмэгтэй' : '-'} />
                            {insuranceType && (
                                <div className="col-span-2">
                                    <InfoRow label="НДШТ төрөл" value={`${insuranceType.code} - ${insuranceType.name}`} />
                                </div>
                            )}
                        </div>
                        
                        {data.hasDisability && (
                            <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                                <p className="text-xs font-medium text-amber-800">
                                    Хөгжлийн бэрхшээлтэй: {data.disabilityPercentage}% • {formatDate(data.disabilityDate)}
                                </p>
                            </div>
                        )}
                        
                        {data.hasDriversLicense && data.driverLicenseCategories?.length > 0 && (
                            <div className="mt-3 flex items-center gap-2">
                                <Car className="w-4 h-4 text-slate-400" />
                                <span className="text-xs text-slate-500">Жолооны үнэмлэх:</span>
                                <div className="flex gap-1">
                                    {data.driverLicenseCategories.map((cat: string) => (
                                        <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Section>

                    {/* Contact Info */}
                    <Section title="Холбоо барих" icon={Phone}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                            <InfoRow label="Албан утас" value={data.workPhone} />
                            <InfoRow label="Хувийн утас" value={data.personalPhone || employee?.phoneNumber} />
                            <InfoRow label="Албан и-мэйл" value={data.workEmail || employee?.email} />
                            <InfoRow label="Хувийн и-мэйл" value={data.personalEmail} />
                            <div className="col-span-2">
                                <InfoRow label="Гэрийн хаяг" value={data.homeAddress} />
                            </div>
                            {data.temporaryAddress && (
                                <div className="col-span-2">
                                    <InfoRow label="Түр хаяг" value={data.temporaryAddress} />
                                </div>
                            )}
                        </div>
                        
                        {/* Emergency Contacts */}
                        {data.emergencyContacts?.length > 0 && (
                            <div className="mt-4">
                                <p className="text-xs font-semibold text-slate-600 mb-2">Яаралтай үед холбоо барих</p>
                                {data.emergencyContacts.map((contact: any, idx: number) => (
                                    <div key={idx} className="flex gap-4 text-xs py-1.5 border-b border-slate-100 last:border-0">
                                        <span className="font-medium text-slate-800">{contact.fullName}</span>
                                        <span className="text-slate-500">{contact.relationship}</span>
                                        <span className="text-slate-600">{contact.phone}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>

                    {/* Work Experience */}
                    {!data.experienceNotApplicable && data.experiences?.length > 0 && (
                        <Section title="Ажлын туршлага" icon={Briefcase}>
                            <div className="space-y-3">
                                {data.experiences.map((exp: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">{exp.position}</p>
                                                <p className="text-xs text-slate-600">{exp.company}</p>
                                            </div>
                                            <p className="text-[11px] text-slate-400">
                                                {formatDate(exp.startDate)} - {exp.endDate ? formatDate(exp.endDate) : 'Одоог хүртэл'}
                                            </p>
                                        </div>
                                        {exp.employmentType && (
                                            <Badge variant="outline" className="mt-2 text-[10px]">{exp.employmentType}</Badge>
                                        )}
                                        {exp.description && (
                                            <p className="text-xs text-slate-500 mt-2">{exp.description}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Education */}
                    {!data.educationNotApplicable && data.education?.length > 0 && (
                        <Section title="Боловсрол" icon={GraduationCap}>
                            <div className="space-y-3">
                                {data.education.map((edu: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">{edu.school}</p>
                                                <p className="text-xs text-slate-600">{edu.degree} {edu.academicRank && `• ${edu.academicRank}`}</p>
                                            </div>
                                            <p className="text-[11px] text-slate-400">
                                                {formatDate(edu.entryDate)} - {edu.isCurrent ? 'Одоог хүртэл' : formatDate(edu.gradDate)}
                                            </p>
                                        </div>
                                        {edu.country && (
                                            <Badge variant="outline" className="mt-2 text-[10px]">{edu.country}</Badge>
                                        )}
                                        {edu.diplomaNumber && (
                                            <p className="text-[11px] text-slate-400 mt-1">Дипломын дугаар: {edu.diplomaNumber}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Languages */}
                    {!data.languagesNotApplicable && data.languages?.length > 0 && (
                        <Section title="Гадаад хэлний мэдлэг" icon={Languages}>
                            <div className="space-y-2">
                                {data.languages.map((lang: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
                                        <span className="text-sm font-semibold text-slate-800 w-24">{lang.language}</span>
                                        <div className="flex gap-3 text-[11px] text-slate-500">
                                            <span>Сонсох: <strong>{lang.listening}</strong></span>
                                            <span>Унших: <strong>{lang.reading}</strong></span>
                                            <span>Ярих: <strong>{lang.speaking}</strong></span>
                                            <span>Бичих: <strong>{lang.writing}</strong></span>
                                        </div>
                                        {lang.testScore && (
                                            <Badge variant="secondary" className="text-[10px] ml-auto">{lang.testScore}</Badge>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Trainings */}
                    {!data.trainingsNotApplicable && data.trainings?.length > 0 && (
                        <Section title="Мэргэшлийн сургалт" icon={Award}>
                            <div className="space-y-3">
                                {data.trainings.map((training: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">{training.name}</p>
                                                <p className="text-xs text-slate-600">{training.organization}</p>
                                            </div>
                                            <p className="text-[11px] text-slate-400">
                                                {formatDate(training.startDate)} - {formatDate(training.endDate)}
                                            </p>
                                        </div>
                                        {training.certificateNumber && (
                                            <p className="text-[11px] text-slate-400 mt-1">Сертификат: {training.certificateNumber}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Family Members */}
                    {!data.familyMembersNotApplicable && data.familyMembers?.length > 0 && (
                        <Section title="Гэр бүлийн мэдээлэл" icon={Users}>
                            <div className="space-y-2">
                                {data.familyMembers.map((member: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
                                        <Badge variant="outline" className="text-[10px]">{member.relationship}</Badge>
                                        <span className="text-sm font-medium text-slate-800">
                                            {member.lastName} {member.firstName}
                                        </span>
                                        {member.phone && (
                                            <span className="text-xs text-slate-500 ml-auto">{member.phone}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Footer */}
                    <div className="mt-8 pt-4 border-t border-slate-200 text-center">
                        <p className="text-[10px] text-slate-400">
                            Хэвлэсэн огноо: {format(new Date(), 'yyyy-MM-dd HH:mm')} • {employee?.employeeCode}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
