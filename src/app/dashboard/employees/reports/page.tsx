'use client';

import * as React from 'react';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
} from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase, tenantCollection } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Employee, Department } from '@/types';
import {
  REPORT_FIELD_GROUPS,
  REPORT_PRESETS,
  FIELD_MAP,
  type ReportField,
} from './report-fields';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ─── Component ──────────────────────────────────────────────────────────────

export default function EmployeeReportsPage() {
  // ── Data fetching ─────────────────────────────────────────────────────
  const { firestore } = useFirebase();

  const employeesQuery = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employees') : null),
    [],
  );
  const departmentsQuery = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null),
    [],
  );

  const { data: employees, isLoading: isLoadingEmployees } =
    useCollection<Employee>(employeesQuery);
  const { data: departments, isLoading: isLoadingDepartments } =
    useCollection<Department>(departmentsQuery);

  // Department id → name map
  const departmentMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (departments) {
      departments.forEach((d: any) => map.set(d.id, d.name));
    }
    return map;
  }, [departments]);

  // Questionnaire data per employee
  const [questionnaireMap, setQuestionnaireMap] = React.useState<
    Map<string, Record<string, any>>
  >(new Map());
  const [isLoadingQuestionnaire, setIsLoadingQuestionnaire] =
    React.useState(true);

  React.useEffect(() => {
    if (!firestore || !employees || employees.length === 0) {
      setQuestionnaireMap(new Map());
      setIsLoadingQuestionnaire(false);
      return;
    }

    let cancelled = false;
    setIsLoadingQuestionnaire(true);

    const fetchAll = async () => {
      const map = new Map<string, Record<string, any>>();
      const promises = employees.map(async (emp) => {
        try {
          const docRef = doc(
            firestore,
            'employees',
            emp.id,
            'questionnaire',
            'data',
          );
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            map.set(emp.id, snap.data());
          }
        } catch {
          // Skip
        }
      });
      await Promise.all(promises);
      if (!cancelled) {
        setQuestionnaireMap(map);
        setIsLoadingQuestionnaire(false);
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [firestore, employees]);

  // ── Field selection state ─────────────────────────────────────────────
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(
    () => new Set(REPORT_PRESETS[0].fieldKeys),
  );
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(
    new Set(),
  );
  const [isExporting, setIsExporting] = React.useState(false);

  const toggleField = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (groupKey: string) => {
    const group = REPORT_FIELD_GROUPS.find((g) => g.key === groupKey);
    if (!group) return;
    const allSelected = group.fields.every((f) => selectedKeys.has(f.key));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      group.fields.forEach((f) => {
        if (allSelected) next.delete(f.key);
        else next.add(f.key);
      });
      return next;
    });
  };

  const toggleCollapseGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const applyPreset = (fieldKeys: string[]) => {
    setSelectedKeys(new Set(fieldKeys));
  };

  // ── Computed: selected fields in order ────────────────────────────────
  const selectedFields = React.useMemo(() => {
    const result: ReportField[] = [];
    for (const group of REPORT_FIELD_GROUPS) {
      for (const field of group.fields) {
        if (selectedKeys.has(field.key)) result.push(field);
      }
    }
    return result;
  }, [selectedKeys]);

  // ── Computed: table rows ──────────────────────────────────────────────
  const tableRows = React.useMemo(() => {
    if (!employees) return [];
    return employees.map((emp) => {
      const q = questionnaireMap.get(emp.id) || null;
      const row: Record<string, string | number> = {};
      for (const field of selectedFields) {
        row[field.key] = field.getValue(emp, q, departmentMap);
      }
      return row;
    });
  }, [employees, questionnaireMap, departmentMap, selectedFields]);

  // ── Excel export ──────────────────────────────────────────────────────
  const exportToExcel = React.useCallback(async () => {
    if (selectedFields.length === 0 || tableRows.length === 0) return;
    setIsExporting(true);

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Ажилтнууд');

      // Header row
      worksheet.columns = selectedFields.map((f) => ({
        header: f.label,
        key: f.key,
        width: Math.max(f.label.length * 2, 14),
      }));

      // Style header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 28;

      // Data rows
      for (const row of tableRows) {
        worksheet.addRow(row);
      }

      // Auto-fit column width (approximate)
      for (const col of worksheet.columns) {
        let maxLen = (col.header as string)?.length || 10;
        col.eachCell?.({ includeEmpty: false }, (cell) => {
          const len = String(cell.value || '').length;
          if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(Math.max(maxLen * 1.3, 10), 60);
      }

      // Borders
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          if (rowNumber > 1) {
            cell.alignment = { vertical: 'middle', wrapText: true };
          }
        });
        // Zebra striping
        if (rowNumber > 1 && rowNumber % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          });
        }
      });

      const today = new Date().toISOString().split('T')[0];
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, `ажилтнуудын_тайлан_${today}.xlsx`);
    } catch (err) {
      console.error('Excel export error:', err);
    } finally {
      setIsExporting(false);
    }
  }, [selectedFields, tableRows]);

  // ── Loading state ─────────────────────────────────────────────────────
  const isLoading =
    isLoadingEmployees || isLoadingDepartments || isLoadingQuestionnaire;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        <PageHeader
          title="Ажилтнуудын тайлан"
          description="Бүртгэл, анкетын мэдээллээс дурын хүснэгтийн бүтэц үүсгэж Excel татах"
          showBackButton
          hideBreadcrumbs
          backButtonPlacement="inline"
          backBehavior="history"
          fallbackBackHref="/dashboard/employees"
        />

        {/* ── Toolbar: Presets + Export ─────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {REPORT_PRESETS.map((preset) => {
            const isActive =
              preset.fieldKeys.length === selectedKeys.size &&
              preset.fieldKeys.every((k) => selectedKeys.has(k));
            return (
              <Button
                key={preset.key}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => applyPreset(preset.fieldKeys)}
                title={preset.description}
              >
                {isActive && <Check className="h-3 w-3 mr-1" />}
                {preset.label}
              </Button>
            );
          })}
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground tabular-nums">
            {selectedFields.length} багана · {employees?.length ?? 0} ажилтан
          </span>
          <Button
            size="sm"
            onClick={exportToExcel}
            disabled={
              isLoading ||
              isExporting ||
              selectedFields.length === 0 ||
              !employees?.length
            }
            className="gap-1.5"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            Excel татах
          </Button>
        </div>

        {/* ── Main layout: Field picker + Table ────────────────────── */}
        <div className="flex gap-5 min-h-0 overflow-hidden">
          {/* ── Left: Field picker ──────────────────────────────── */}
          <Card className="w-64 shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <CardContent className="p-0">
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-foreground">
                  Баганы сонголт
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Тайланд орох талбаруудаа сонгоно уу
                </p>
              </div>
              <ScrollArea className="h-[calc(100vh-340px)]">
                <div className="p-2 space-y-0.5">
                  {REPORT_FIELD_GROUPS.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.key);
                    const selectedInGroup = group.fields.filter((f) =>
                      selectedKeys.has(f.key),
                    ).length;
                    const allSelected =
                      selectedInGroup === group.fields.length;
                    const someSelected =
                      selectedInGroup > 0 && !allSelected;

                    return (
                      <div key={group.key}>
                        {/* Group header */}
                        <div className="flex items-center gap-1.5 py-1.5 px-1 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer select-none">
                          <button
                            onClick={() => toggleCollapseGroup(group.key)}
                            className="p-0.5 text-muted-foreground"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                          <Checkbox
                            checked={
                              allSelected
                                ? true
                                : someSelected
                                  ? 'indeterminate'
                                  : false
                            }
                            onCheckedChange={() => toggleGroup(group.key)}
                            className="h-3.5 w-3.5"
                          />
                          <span
                            className="text-[11px] font-semibold text-foreground flex-1"
                            onClick={() => toggleCollapseGroup(group.key)}
                          >
                            {group.label}
                          </span>
                          {selectedInGroup > 0 && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {selectedInGroup}
                            </span>
                          )}
                        </div>

                        {/* Fields */}
                        {!isCollapsed && (
                          <div className="ml-5 space-y-0.5">
                            {group.fields.map((field) => (
                              <label
                                key={field.key}
                                className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                              >
                                <Checkbox
                                  checked={selectedKeys.has(field.key)}
                                  onCheckedChange={() =>
                                    toggleField(field.key)
                                  }
                                  className="h-3.5 w-3.5"
                                />
                                <span className="text-[11px] text-muted-foreground">
                                  {field.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* ── Right: Preview table ────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-x-auto">
            <Card className="min-w-max bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-8 w-full" />
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                ) : selectedFields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center min-w-[300px]">
                    <FileSpreadsheet className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Багана сонгоогүй байна
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Зүүн талаас тайланд орох талбаруудаа сонгоно уу
                    </p>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[calc(100vh-340px)]">
                    <table className="w-full text-[11px]">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 dark:bg-slate-800/70">
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap border-b border-slate-200 dark:border-slate-700 w-8 sticky left-0 bg-slate-50 dark:bg-slate-800/70 z-20">
                            №
                          </th>
                          {selectedFields.map((f) => (
                            <th
                              key={f.key}
                              className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap border-b border-slate-200 dark:border-slate-700"
                            >
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                          >
                            <td className="px-3 py-1.5 text-muted-foreground tabular-nums sticky left-0 bg-white dark:bg-slate-900 z-10">
                              {idx + 1}
                            </td>
                            {selectedFields.map((f) => (
                              <td
                                key={f.key}
                                className="px-3 py-1.5 text-foreground whitespace-nowrap"
                                title={String(row[f.key] ?? '')}
                              >
                                {row[f.key] !== undefined &&
                                row[f.key] !== null &&
                                row[f.key] !== ''
                                  ? String(row[f.key])
                                  : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
