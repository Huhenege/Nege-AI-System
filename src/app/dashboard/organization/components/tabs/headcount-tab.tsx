
'use client';

import React, { useState, useMemo } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronRight, ChevronDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { useCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import { collection } from 'firebase/firestore';

import { Department, Position } from '../../types';
import type { Employee } from '../../../employees/data';
import { EmptyState } from '@/components/organization/empty-state';

export const HeadcountTab = () => {
    const { firestore } = useFirebase();
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const [selectedDeptEmployees, setSelectedDeptEmployees] = useState<Employee[]>([]);
    const [isEmployeeListOpen, setIsEmployeeListOpen] = useState(false);
    const [selectedDeptName, setSelectedDeptName] = useState("");
    const [openRows, setOpenRows] = useState<Set<string>>(new Set());

    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positions') : null), [firestore]);
    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employees') : null), [firestore]);
    const departmentsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), [firestore]);

    const { data: positions, isLoading: isLoadingPos } = useCollection<Position>(positionsQuery);
    const { data: employees, isLoading: isLoadingEmp } = useCollection<Employee>(employeesQuery);
    const { data: departments, isLoading: isLoadingDepts } = useCollection<Department>(departmentsQuery);

    const { departmentsWithHeadcount, totalFilled } = useMemo(() => {
        if (!positions || !employees || !departments) {
            return { departmentsWithHeadcount: [], totalFilled: 0 };
        }

        const periodStart = date?.from ? startOfDay(date.from) : null;
        const periodEnd = date?.to ? endOfDay(date.to) : null;

        const employeeCountByPosition = new Map<string, number>();
        employees.forEach(emp => {
            if (!emp.positionId) return;
            const hireDate = new Date(emp.hireDate);
            const termDate = emp.terminationDate ? new Date(emp.terminationDate) : null;
            const isActiveInPeriod =
                (!periodStart || !termDate || termDate >= periodStart) &&
                (!periodEnd || hireDate <= periodEnd);

            if (isActiveInPeriod) {
                employeeCountByPosition.set(emp.positionId, (employeeCountByPosition.get(emp.positionId) || 0) + 1);
            }
        });

        const activePositions = positions.filter(p => {
            const createdAt = p.createdAt ? new Date(p.createdAt) : new Date(0);
            return p.isActive && (!periodEnd || createdAt <= periodEnd);
        });

        const departmentsData = departments.map(d => {
            const deptPositions = activePositions
                .filter(p => p.departmentId === d.id)
                .map(p => ({
                    ...p,
                    filled: employeeCountByPosition.get(p.id) || 0,
                }));

            const filled = deptPositions.reduce((sum, p) => sum + p.filled, 0);

            return {
                ...d,
                filled,
                positions: deptPositions,
            };
        });

        const totalFilled = departmentsData.reduce((sum, dept) => sum + (dept.filled || 0), 0);

        return {
            departmentsWithHeadcount: departmentsData,
            totalFilled,
        };
    }, [positions, employees, departments, date]);

    const handleShowEmployees = (departmentId: string) => {
        const dept = departments?.find(d => d.id === departmentId);
        if (!dept || !employees) return;

        const startDate = date?.from ? startOfDay(date.from) : null;
        const endDate = date?.to ? endOfDay(date.to) : null;

        const filteredEmployees = employees.filter(emp => {
            if (emp.departmentId !== departmentId) return false;

            const hireDate = new Date(emp.hireDate);
            const termDate = emp.terminationDate ? new Date(emp.terminationDate) : null;

            const isActiveInPeriod =
                (!startDate || !termDate || termDate >= startDate) &&
                (!endDate || hireDate <= endDate);

            return isActiveInPeriod;
        });

        setSelectedDeptEmployees(filteredEmployees);
        setSelectedDeptName(dept.name);
        setIsEmployeeListOpen(true);
    };

    const toggleRow = (id: string) => {
        setOpenRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const isLoading = isLoadingPos || isLoadingEmp || isLoadingDepts;

    return (
        <div className="space-y-6">
            <Dialog open={isEmployeeListOpen} onOpenChange={setIsEmployeeListOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedDeptName} хэлтсийн ажилтнууд</DialogTitle>
                        <DialogDescription>
                            {date?.from && date.to && `${format(date.from, "yyyy/MM/dd")} - ${format(date.to, "yyyy/MM/dd")} хооронд ажиллаж байсан.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ажилтан</TableHead>
                                    <TableHead>Албан тушаал</TableHead>
                                    <TableHead>Ажилд орсон</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedDeptEmployees.map(emp => (
                                    <TableRow key={emp.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={emp.photoURL} />
                                                    <AvatarFallback>{emp.firstName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{emp.jobTitle}</TableCell>
                                        <TableCell>{format(new Date(emp.hireDate), 'yyyy-MM-dd')}</TableCell>
                                    </TableRow>
                                ))}
                                {selectedDeptEmployees.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">Ажилтан олдсонгүй.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            <Card className="shadow-sm">
                <CardHeader className="pb-4 border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Хүн хүчний төлөвлөлт</CardTitle>
                            <CardDescription>Нэгжүүдийн албан тушаал бүрээрх ашиглалт.</CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-sm font-medium bg-muted/50 px-3 py-1.5 rounded-md border">
                                Нийт ажилтан: <span className="text-primary font-semibold ml-1">{totalFilled}</span>
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                            "w-[260px] justify-start text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date?.from ? (
                                            date.to ? (
                                                <>
                                                    {format(date.from, "LLL dd, y")} -{" "}
                                                    {format(date.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(date.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Огноо сонгох</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={date?.from}
                                        selected={date}
                                        onSelect={setDate}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="border-b bg-muted/40 px-6 py-3 flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="flex-1">Нэгж / Албан тушаал</div>
                        <div className="w-32 text-center">Дүүргэлт</div>
                        <div className="w-24 text-right">Үйлдэл</div>
                    </div>
                    <div className="divide-y">
                        {departmentsWithHeadcount.map(dept => (
                            <Collapsible
                                key={dept.id}
                                open={openRows.has(dept.id)}
                                onOpenChange={() => toggleRow(dept.id)}
                            >
                                <div className={cn(
                                    "flex items-center px-6 py-4 hover:bg-muted/50 transition-colors",
                                    openRows.has(dept.id) && "bg-muted/30"
                                )}>
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent mr-3">
                                            {openRows.has(dept.id) ? (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </Button>
                                    </CollapsibleTrigger>
                                    <div className="flex-1 font-medium flex items-center gap-2">
                                        {dept.name}
                                        <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                            {dept.filled} ажилтан
                                        </span>
                                    </div>
                                    <div className="w-32 flex justify-center">
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Users className="h-3.5 w-3.5" />
                                            {dept.filled}
                                        </div>
                                    </div>
                                    <div className="w-24 flex justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => handleShowEmployees(dept.id)}
                                        >
                                            Жагсаалт
                                        </Button>
                                    </div>
                                </div>
                                <CollapsibleContent>
                                    <div className="bg-muted/20 px-6 py-2 border-t border-b-0 space-y-1">
                                        {dept.positions.length > 0 ? (
                                            dept.positions.map(pos => (
                                                <div key={pos.id} className="flex items-center py-2 pl-9 text-sm">
                                                    <div className="flex-1 text-muted-foreground">{pos.title}</div>
                                                    <div className="w-32 flex justify-center">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-xs font-medium",
                                                            pos.filled > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {pos.filled}
                                                        </span>
                                                    </div>
                                                    <div className="w-24"></div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-2 pl-9 text-sm text-muted-foreground italic">Албан тушаал бүртгэгдээгүй.</div>
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        ))}
                        {departmentsWithHeadcount.length === 0 && (
                            <div className="p-8">
                                <EmptyState
                                    icon={Users}
                                    title="Мэдээлэл олдсонгүй"
                                    description="Хайлт, шүүлтэд тохирох нэгж эсвэл мэдээлэл байхгүй байна."
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
