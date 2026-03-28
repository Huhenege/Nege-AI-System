'use client';

import React from 'react';
import { ERDocument, DOCUMENT_STATUSES, DocumentStatus } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, Clock, CheckCircle2, Circle, Send, XCircle } from 'lucide-react';
import Link from 'next/link';
import { formatDateTime } from '../utils';

interface DocumentPipelineProps {
    documents: ERDocument[];
    isLoading: boolean;
    docTypeMap: Record<string, string>;
}

const COLUMNS: { status: DocumentStatus; label: string; icon: any; color: string; headerColor?: string }[] = [
    { status: 'DRAFT', label: 'Төлөвлөх', icon: Circle, color: 'text-slate-400' },
    { status: 'IN_REVIEW', label: 'Хянах', icon: Clock, color: 'text-amber-500' },
    { status: 'REVIEWED', label: 'Хянагдсан', icon: CheckCircle2, color: 'text-blue-500' },
    { status: 'SIGNED', label: 'Баталгаажсан', icon: FileText, color: 'text-emerald-600' },
    { status: 'SENT_TO_EMPLOYEE', label: 'Танилцуулах', icon: Send, color: 'text-amber-700' },
    { status: 'ACKNOWLEDGED', label: 'Танилцсан', icon: CheckCircle2, color: 'text-teal-700' },
    { status: 'REJECTED', label: 'Татгалзсан', icon: XCircle, color: 'text-rose-500', headerColor: 'text-rose-600' },
    { status: 'ARCHIVED', label: 'Архив', icon: FileText, color: 'text-slate-400', headerColor: 'text-slate-500' },
];

export function DocumentPipeline({ documents, isLoading, docTypeMap }: DocumentPipelineProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-4">
                        <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                        <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto pb-6 -mx-6 px-6">
            <div className="flex gap-4 flex-nowrap min-w-max items-start">
                {COLUMNS.map((column) => {
                    const columnDocs = documents.filter((doc) => {
                        if (column.status === 'SIGNED') {
                            // Backward-compat: some docs may still be APPROVED (legacy) and should appear here.
                            return doc.status === 'SIGNED' || doc.status === 'APPROVED';
                        }
                        return doc.status === column.status;
                    });
                    const Icon = column.icon;

                    return (
                        <div key={column.status} className="flex flex-col gap-3 min-w-[280px] shrink-0">
                            {/* Column Header */}
                            <div className="flex items-center justify-between px-2 py-1 shrink-0">
                                <div className="flex items-center gap-2">
                                    <Icon className={`h-4 w-4 ${column.color}`} />
                                    <h3 className={`font-bold text-sm whitespace-nowrap ${column.headerColor || 'text-slate-700'}`}>{column.label}</h3>
                                    <Badge variant="secondary" className="bg-slate-200/50 text-slate-600 border-none ml-1 text-[10px] h-5 px-1.5">
                                        {columnDocs.length}
                                    </Badge>
                                </div>
                            </div>

                            {/* Column Content */}
                            <div className={`flex flex-col gap-3 min-h-[calc(100vh-350px)] p-2 rounded-2xl border ${
                                column.status === 'REJECTED'
                                    ? 'bg-rose-50/40 border-rose-200/50'
                                    : column.status === 'ARCHIVED'
                                    ? 'bg-slate-50/60 border-slate-200/40 opacity-80'
                                    : 'bg-slate-100/40 border-slate-200/50'
                            }`}>
                                {columnDocs.map((doc) => (
                                    <Link key={doc.id} href={`/dashboard/employment-relations/${doc.id}`}>
                                        <Card className="hover:shadow-md transition-all border-none shadow-sm bg-white cursor-pointer group active:scale-[0.98]">
                                            <CardContent className="p-4 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-primary/5 transition-colors">
                                                        <FileText className="h-4 w-4 text-slate-500 group-hover:text-primary" />
                                                    </div>
                                                    <span className="text-[9px] font-mono text-muted-foreground opacity-50">
                                                        #{doc.id.slice(-6).toUpperCase()}
                                                    </span>
                                                </div>

                                                <div className="space-y-1">
                                                    <h4 className="font-bold text-[13px] text-slate-800 line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                                                        {doc.metadata?.templateName || docTypeMap[doc.documentTypeId] || 'Тодорхойгүй баримт'}
                                                    </h4>
                                                    {doc.documentNumber && (
                                                        <div className="inline-flex">
                                                            <Badge variant="secondary" className="font-mono text-[10px] h-5 px-2 bg-slate-100 text-slate-700 border-none">
                                                                {doc.documentNumber}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                                                    <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center border text-[10px] font-bold text-slate-600 shrink-0">
                                                        {doc.metadata?.employeeName?.charAt(0) || '?'}
                                                    </div>
                                                    <div className="flex flex-col overflow-hidden">
                                                        <span className="text-[11px] font-medium text-slate-700 truncate">
                                                            {doc.metadata?.employeeName || 'Тодорхойгүй'}
                                                        </span>
                                                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                                            <Calendar className="h-2.5 w-2.5" />
                                                            {formatDateTime(doc.createdAt)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}

                                {columnDocs.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400/40">
                                        <FileText className="h-8 w-8 mb-2" />
                                        <span className="text-[10px] font-medium">Хоосон байна</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
