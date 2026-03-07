'use client';

import React, { useMemo, useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase, tenantCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, X, Users, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Employee } from '@/types';

interface EmployeeTargetCardProps {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
}

export function EmployeeTargetCard({ selectedIds, onChange, disabled }: EmployeeTargetCardProps) {
    const { firestore } = useFirebase();
    const [search, setSearch] = useState('');

    const employeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        [firestore]
    );
    const { data: employees, isLoading } = useCollection<Employee>(employeesQuery);

    const filteredEmployees = useMemo(() => {
        if (!employees) return [];
        if (!search.trim()) return employees;
        const q = search.toLowerCase();
        return employees.filter(emp =>
            emp.firstName?.toLowerCase().includes(q) ||
            emp.lastName?.toLowerCase().includes(q) ||
            emp.jobTitle?.toLowerCase().includes(q)
        );
    }, [employees, search]);

    const toggleEmployee = (empId: string) => {
        if (disabled) return;
        onChange(
            selectedIds.includes(empId)
                ? selectedIds.filter(id => id !== empId)
                : [...selectedIds, empId]
        );
    };

    const toggleAll = () => {
        if (disabled) return;
        const visibleIds = filteredEmployees.map(e => e.id);
        const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
        if (allSelected) {
            onChange(selectedIds.filter(id => !visibleIds.includes(id)));
        } else {
            const merged = new Set([...selectedIds, ...visibleIds]);
            onChange(Array.from(merged));
        }
    };

    const clearAll = () => {
        if (disabled) return;
        onChange([]);
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Хариулагчид
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Санал асуулгыг хариулах ажилтнуудыг сонгоно уу
                        </CardDescription>
                    </div>
                    {selectedIds.length > 0 && (
                        <Badge variant="secondary" className="text-xs gap-1">
                            <UserCheck className="h-3 w-3" />
                            {selectedIds.length} сонгогдсон
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Selected employees as removable badges */}
                {selectedIds.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                            {selectedIds.map(id => {
                                const emp = employees?.find(e => e.id === id);
                                if (!emp) return null;
                                return (
                                    <Badge
                                        key={id}
                                        variant="outline"
                                        className={cn(
                                            "text-xs gap-1 pr-1 transition-colors",
                                            !disabled && "cursor-pointer hover:bg-destructive/10 hover:border-destructive/30"
                                        )}
                                        onClick={() => toggleEmployee(id)}
                                    >
                                        <Avatar className="h-4 w-4">
                                            <AvatarImage src={(emp as any).photoURL} />
                                            <AvatarFallback className="text-[8px]">{emp.firstName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        {emp.lastName?.charAt(0)}. {emp.firstName}
                                        {!disabled && <X className="h-3 w-3 text-muted-foreground" />}
                                    </Badge>
                                );
                            })}
                        </div>
                        {!disabled && selectedIds.length > 2 && (
                            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground px-2" onClick={clearAll}>
                                Бүгдийг цуцлах
                            </Button>
                        )}
                    </div>
                )}

                {/* Search and list */}
                {!disabled && (
                    <>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Нэр, албан тушаалаар хайх..."
                                className="pl-8 h-9 text-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setSearch('')}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <ScrollArea className="h-[240px] rounded-lg border">
                            <div className="p-1">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <span className="text-xs text-muted-foreground">Уншиж байна...</span>
                                    </div>
                                ) : (
                                    <>
                                        <label className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-muted/50 cursor-pointer border-b mb-0.5">
                                            <Checkbox
                                                checked={
                                                    filteredEmployees.length > 0 &&
                                                    filteredEmployees.every(e => selectedIds.includes(e.id))
                                                }
                                                onCheckedChange={toggleAll}
                                            />
                                            <span className="text-xs font-medium text-muted-foreground">
                                                Бүгдийг сонгох ({filteredEmployees.length})
                                            </span>
                                        </label>

                                        {filteredEmployees.map(emp => {
                                            const isSelected = selectedIds.includes(emp.id);
                                            return (
                                                <label
                                                    key={emp.id}
                                                    className={cn(
                                                        "flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors",
                                                        isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleEmployee(emp.id)}
                                                    />
                                                    <Avatar className="h-7 w-7 flex-shrink-0">
                                                        <AvatarImage src={(emp as any).photoURL} />
                                                        <AvatarFallback className="text-[10px] bg-slate-100">
                                                            {emp.firstName?.charAt(0)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium truncate">
                                                            {emp.lastName?.charAt(0)}. {emp.firstName}
                                                        </div>
                                                        {emp.jobTitle && (
                                                            <div className="text-[11px] text-muted-foreground truncate">
                                                                {emp.jobTitle}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isSelected && (
                                                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                                    )}
                                                </label>
                                            );
                                        })}

                                        {filteredEmployees.length === 0 && (
                                            <div className="flex flex-col items-center py-8">
                                                <Search className="h-5 w-5 text-muted-foreground/30 mb-2" />
                                                <p className="text-xs text-muted-foreground">Илэрц олдсонгүй</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </ScrollArea>
                    </>
                )}

                {/* Empty state when disabled and no selections */}
                {disabled && selectedIds.length === 0 && (
                    <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground">
                            Бүх ажилтнууд хариулах боломжтой
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
