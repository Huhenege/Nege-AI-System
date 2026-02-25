'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { TableRow as TR } from '@/components/ui/table';
import {
    DataTable,
    DataTableHeader,
    DataTableColumn,
    DataTableBody,
    DataTableRow,
    DataTableCell,
    DataTableLoading,
    DataTableEmpty,
} from '@/components/patterns/data-table';
import { cn } from '@/lib/utils';
import {
    Survey,
    SurveyStatus,
    SURVEY_STATUS_LABELS,
    SURVEY_STATUS_COLORS,
    SURVEY_TYPE_LABELS,
} from '../types';

interface SurveyListProps {
    surveys: Survey[] | null;
    isLoading: boolean;
    filterStatus?: SurveyStatus | 'all';
}

function StatusBadge({ status }: { status: SurveyStatus }) {
    return (
        <Badge variant="secondary" className={cn('text-xs font-medium', SURVEY_STATUS_COLORS[status])}>
            {SURVEY_STATUS_LABELS[status]}
        </Badge>
    );
}

function formatDate(dateStr?: string) {
    if (!dateStr) return '—';
    try {
        return format(parseISO(dateStr), 'yyyy.MM.dd');
    } catch {
        return '—';
    }
}

export function SurveyList({ surveys, isLoading, filterStatus = 'all' }: SurveyListProps) {
    const router = useRouter();

    const filtered = React.useMemo(() => {
        if (!surveys) return [];
        if (filterStatus === 'all') return surveys;
        return surveys.filter(s => s.status === filterStatus);
    }, [surveys, filterStatus]);

    const sorted = React.useMemo(() => {
        return [...filtered].sort((a, b) => {
            const dateA = a.updatedAt || a.createdAt || '';
            const dateB = b.updatedAt || b.createdAt || '';
            return dateB.localeCompare(dateA);
        });
    }, [filtered]);

    return (
        <DataTable>
            <DataTableHeader>
                <TR>
                    <DataTableColumn>Нэр</DataTableColumn>
                    <DataTableColumn>Төрөл</DataTableColumn>
                    <DataTableColumn>Төлөв</DataTableColumn>
                    <DataTableColumn align="center">Асуулт</DataTableColumn>
                    <DataTableColumn align="center">Хариулт</DataTableColumn>
                    <DataTableColumn>Эхлэх</DataTableColumn>
                    <DataTableColumn>Дуусах</DataTableColumn>
                </TR>
            </DataTableHeader>

            {isLoading ? (
                <DataTableLoading columns={7} rows={4} />
            ) : sorted.length === 0 ? (
                <DataTableEmpty columns={7} message="Санал асуулга олдсонгүй" />
            ) : (
                <DataTableBody>
                    {sorted.map(survey => (
                        <DataTableRow
                            key={survey.id}
                            onClick={() => router.push(`/dashboard/survey/${survey.id}`)}
                        >
                            <DataTableCell>
                                <div>
                                    <div className="font-medium">{survey.title}</div>
                                    {survey.description && (
                                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                            {survey.description}
                                        </div>
                                    )}
                                </div>
                            </DataTableCell>
                            <DataTableCell>
                                <span className="text-sm text-muted-foreground">
                                    {SURVEY_TYPE_LABELS[survey.type]}
                                </span>
                            </DataTableCell>
                            <DataTableCell>
                                <StatusBadge status={survey.status} />
                            </DataTableCell>
                            <DataTableCell align="center">
                                <span className="text-sm font-medium">{survey.questionsCount}</span>
                            </DataTableCell>
                            <DataTableCell align="center">
                                <span className="text-sm font-medium">{survey.responsesCount}</span>
                            </DataTableCell>
                            <DataTableCell>
                                <span className="text-sm text-muted-foreground">
                                    {formatDate(survey.startDate)}
                                </span>
                            </DataTableCell>
                            <DataTableCell>
                                <span className="text-sm text-muted-foreground">
                                    {formatDate(survey.endDate)}
                                </span>
                            </DataTableCell>
                        </DataTableRow>
                    ))}
                </DataTableBody>
            )}
        </DataTable>
    );
}
