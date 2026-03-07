'use client';

import * as React from 'react';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Download, MoreHorizontal, Check, X, Search, Filter } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useFirebase, useMemoFirebase, updateDocumentNonBlocking, tenantCollection } from '@/firebase';
import { query, orderBy, doc, collectionGroup, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { calculateDuration } from '@/lib/attendance';
import type { Employee } from '../employees/data';
import type { Department } from '../organization/types';
import { PageHeader } from '@/components/patterns/page-layout';
import { AttendanceDashboard } from './components/attendance-dashboard';
import { DateRange } from 'react-day-picker';

// --- Type Definitions ---
type AttendanceRecord = {
    id: string;
    employeeId: string;
    date: string;
    checkInTime: string;
    checkOutTime?: string;
    status: 'PRESENT' | 'LEFT' | 'LATE' | 'EARLY_DEPARTURE';
};

type TimeOffRequest = {
    id: string;
    employeeId: string;
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: 'Хүлээгдэж буй' | 'Зөвшөөрсөн' | 'Татгалзсан';
    createdAt: string;
};

const statusConfig: { [key: string]: { variant: 'default' | 'secondary' | 'destructive' | 'outline', className: string, label: string } } = {
    "Хүлээгдэж буй": { variant: 'secondary', className: 'bg-yellow-500/80 text-yellow-foreground', label: 'Хүлээгдэж буй' },
    "Зөвшөөрсөн": { variant: 'default', className: 'bg-green-500/80 text-green-foreground', label: 'Зөвшөөрсөн' },
    "Татгалзсан": { variant: 'destructive', className: '', label: 'Татгалзсан' },
};

// --- Export Utilities ---
function exportToCSV(data: any[], filename: string, headers: string[]) {
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => {
            const value = row[h] ?? '';
            // Escape commas and quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
}

// --- Attendance History Tab ---
function AttendanceRow({ record, employee }: { record: AttendanceRecord; employee?: Employee }) {
    return (
        <TableRow>
            <TableCell>
                <div className="flex items-center gap-3">
                    <Avatar className="hidden h-9 w-9 sm:flex">
                        <AvatarImage src={employee?.photoURL} alt="Avatar" />
                        <AvatarFallback>{employee?.firstName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="font-medium">{employee?.firstName} {employee?.lastName}</div>
                        <div className="text-xs text-muted-foreground">{employee?.employeeCode}</div>
                    </div>
                </div>
            </TableCell>
            <TableCell>{format(new Date(record.date), 'yyyy-MM-dd')}</TableCell>
            <TableCell>{format(new Date(record.checkInTime), 'HH:mm:ss')}</TableCell>
            <TableCell>{record.checkOutTime ? format(new Date(record.checkOutTime), 'HH:mm:ss') : '-'}</TableCell>
            <TableCell>
                <Badge variant={record.status === 'LATE' ? 'destructive' : 'outline'} className="text-xs">
                    {record.status === 'LATE' ? 'Хоцорсон' : record.status === 'EARLY_DEPARTURE' ? 'Эрт явсан' : 'Хэвийн'}
                </Badge>
            </TableCell>
            <TableCell className="text-right font-medium">{calculateDuration(record.checkInTime, record.checkOutTime)}</TableCell>
        </TableRow>
    );
}

function AttendanceTableSkeleton() {
    return Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
            <TableCell>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                </div>
            </TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
        </TableRow>
    ));
}

function AttendanceHistoryTab() {
    const { toast } = useToast();
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
        from: new Date(),
        to: new Date()
    });
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedDepartment, setSelectedDepartment] = React.useState<string>('all');

    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null, []);
    const departmentsQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'departments') : null, []);
    const { data: employees, isLoading: isLoadingEmployees, error: errorEmployees } = useCollection<Employee>(employeesQuery);
    const { data: departments, isLoading: isLoadingDepartments } = useCollection<Department>(departmentsQuery);

    const employeeMap = React.useMemo(() => {
        if (!employees) return new Map();
        return new Map(employees.map(e => [e.id, e]));
    }, [employees]);

    const attendanceQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? query(tenantCollection(firestore, companyPath, 'attendance'), orderBy('checkInTime', 'desc')) : null,
        []
    );
    const { data: attendanceRecords, isLoading: isLoadingAttendance, error: errorAttendance } = useCollection<AttendanceRecord>(attendanceQuery);

    const filteredRecords = React.useMemo(() => {
        if (!attendanceRecords) return [];
        
        return attendanceRecords.filter(record => {
            // Date filter
            if (dateRange?.from) {
                const recordDate = new Date(record.date);
                const fromDate = new Date(dateRange.from);
                fromDate.setHours(0, 0, 0, 0);
                
                if (dateRange.to) {
                    const toDate = new Date(dateRange.to);
                    toDate.setHours(23, 59, 59, 999);
                    if (recordDate < fromDate || recordDate > toDate) return false;
                } else {
                    if (format(recordDate, 'yyyy-MM-dd') !== format(fromDate, 'yyyy-MM-dd')) return false;
                }
            }

            // Department filter
            if (selectedDepartment !== 'all') {
                const employee = employeeMap.get(record.employeeId);
                if (!employee || employee.departmentId !== selectedDepartment) return false;
            }

            // Search filter
            if (searchQuery) {
                const employee = employeeMap.get(record.employeeId);
                if (!employee) return false;
                const searchLower = searchQuery.toLowerCase();
                const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
                const code = employee.employeeCode?.toLowerCase() || '';
                if (!fullName.includes(searchLower) && !code.includes(searchLower)) return false;
            }

            return true;
        });
    }, [attendanceRecords, dateRange, selectedDepartment, searchQuery, employeeMap]);

    const handleExport = () => {
        const exportData = filteredRecords.map(record => {
            const employee = employeeMap.get(record.employeeId);
            return {
                'Ажилтны код': employee?.employeeCode || '',
                'Овог': employee?.lastName || '',
                'Нэр': employee?.firstName || '',
                'Огноо': record.date,
                'Ирсэн цаг': format(new Date(record.checkInTime), 'HH:mm:ss'),
                'Явсан цаг': record.checkOutTime ? format(new Date(record.checkOutTime), 'HH:mm:ss') : '',
                'Нийт': calculateDuration(record.checkInTime, record.checkOutTime),
            };
        });

        exportToCSV(exportData, 'attendance_history', ['Ажилтны код', 'Овог', 'Нэр', 'Огноо', 'Ирсэн цаг', 'Явсан цаг', 'Нийт']);
        toast({ title: 'Экспорт амжилттай' });
    };

    const isLoading = isLoadingEmployees || isLoadingAttendance || isLoadingDepartments;
    const error = errorEmployees || errorAttendance;

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Цагийн бүртгэлийн түүх</CardTitle>
                        <CardDescription>Ажилтнуудын ирц, цагийн бүртгэлийг хянах.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant="outline" className={cn("w-full md:w-[280px] justify-start text-left font-normal", !dateRange?.from && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>{format(dateRange.from, "MM/dd")} - {format(dateRange.to, "MM/dd")}</>
                                        ) : (
                                            format(dateRange.from, "yyyy-MM-dd")
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
                                    selected={dateRange} 
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                        <Button size="sm" variant="outline" onClick={handleExport} disabled={filteredRecords.length === 0}>
                            <Download className="mr-2 h-4 w-4" />
                            CSV
                        </Button>
                    </div>
                </div>
                
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Ажилтан хайх..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                        <SelectTrigger className="w-full md:w-[200px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Хэлтэс" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Бүх хэлтэс</SelectItem>
                            {departments?.map(dept => (
                                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ажилтан</TableHead>
                            <TableHead>Огноо</TableHead>
                            <TableHead>Ирсэн цаг</TableHead>
                            <TableHead>Явсан цаг</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead className="text-right">Нийт</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && <AttendanceTableSkeleton />}
                        {!isLoading && filteredRecords.map((record) => (
                            <AttendanceRow key={record.id} record={record} employee={employeeMap.get(record.employeeId)} />
                        ))}
                        {!isLoading && filteredRecords.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Сонгосон шүүлтүүрт тохирох бүртгэл олдсонгүй.
                                </TableCell>
                            </TableRow>
                        )}
                        {error && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-destructive">
                                    Мэдээлэл ачаалахад алдаа гарлаа.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                {!isLoading && filteredRecords.length > 0 && (
                    <div className="mt-4 text-sm text-muted-foreground">
                        Нийт {filteredRecords.length} бүртгэл
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// --- Request Components ---
function RequestRowSkeleton() {
    return (
        <TableRow>
            <TableCell><Skeleton className="h-9 w-32" /></TableCell>
            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
            <TableCell><Skeleton className="h-5 w-40" /></TableCell>
            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
            <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
        </TableRow>
    );
}

function TimeOffRequestsTable() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
    const [searchQuery, setSearchQuery] = React.useState('');

    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null, []);
    const { data: employees } = useCollection<Employee>(employeesQuery);

    const requestsQuery = useMemoFirebase(({ firestore }) => firestore ? collectionGroup(firestore, 'timeOffRequests') : null, []);
    const { data: requests, isLoading } = useCollection<TimeOffRequest>(requestsQuery);

    const employeeMap = React.useMemo(() => new Map(employees?.map(e => [e.id, e])), [employees]);

    const requestsWithEmployeeData = React.useMemo(() => {
        if (!requests || !employees) return [];
        return requests.map(req => {
            const employee = employeeMap.get(req.employeeId);
            return {
                ...req,
                employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Тодорхойгүй',
                employeeAvatar: employee?.photoURL,
                employeeCode: employee?.employeeCode || ''
            };
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [requests, employees, employeeMap]);

    const filteredRequests = React.useMemo(() => {
        return requestsWithEmployeeData.filter(req => {
            if (statusFilter !== 'all' && req.status !== statusFilter) return false;
            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                if (!req.employeeName.toLowerCase().includes(searchLower) && 
                    !req.employeeCode.toLowerCase().includes(searchLower)) return false;
            }
            return true;
        });
    }, [requestsWithEmployeeData, statusFilter, searchQuery]);

    const handleUpdateStatus = (request: TimeOffRequest, status: 'Зөвшөөрсөн' | 'Татгалзсан') => {
        if (!firestore || !request.employeeId) return;
        const docRef = doc(firestore, `employees/${request.employeeId}/timeOffRequests`, request.id);
        updateDocumentNonBlocking(docRef, { status });
        toast({ title: status === 'Зөвшөөрсөн' ? 'Хүсэлт зөвшөөрөгдлөө' : 'Хүсэлт татгалзагдлаа' });
    };

    // Count by status
    const statusCounts = React.useMemo(() => {
        const counts = { pending: 0, approved: 0, rejected: 0 };
        requestsWithEmployeeData.forEach(req => {
            if (req.status === 'Хүлээгдэж буй') counts.pending++;
            else if (req.status === 'Зөвшөөрсөн') counts.approved++;
            else counts.rejected++;
        });
        return counts;
    }, [requestsWithEmployeeData]);

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Чөлөөний хүсэлтүүд</CardTitle>
                        <CardDescription>Ажилтнуудын ирүүлсэн бүх чөлөөний хүсэлт.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            Хүлээгдэж буй: {statusCounts.pending}
                        </Badge>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Зөвшөөрсөн: {statusCounts.approved}
                        </Badge>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Ажилтан хайх..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="Статус" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Бүгд</SelectItem>
                            <SelectItem value="Хүлээгдэж буй">Хүлээгдэж буй</SelectItem>
                            <SelectItem value="Зөвшөөрсөн">Зөвшөөрсөн</SelectItem>
                            <SelectItem value="Татгалзсан">Татгалзсан</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ажилтан</TableHead>
                            <TableHead>Төрөл</TableHead>
                            <TableHead>Хугацаа</TableHead>
                            <TableHead>Шалтгаан</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead className="text-right">Үйлдэл</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && Array.from({ length: 3 }).map((_, i) => <RequestRowSkeleton key={i} />)}
                        {!isLoading && filteredRequests.map(req => {
                            const status = statusConfig[req.status];
                            return (
                                <TableRow key={req.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="hidden h-9 w-9 sm:flex">
                                                <AvatarImage src={req.employeeAvatar} alt="Avatar" />
                                                <AvatarFallback>{req.employeeName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium">{req.employeeName}</div>
                                                <div className="text-xs text-muted-foreground">{req.employeeCode}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{req.type}</TableCell>
                                    <TableCell>
                                        <div>{format(new Date(req.startDate), 'MM/dd')} - {format(new Date(req.endDate), 'MM/dd')}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {Math.ceil((new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} өдөр
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                                    <TableCell><Badge variant={status.variant} className={status.className}>{status.label}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={req.status !== 'Хүлээгдэж буй'}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleUpdateStatus(req, 'Зөвшөөрсөн')}>
                                                    <Check className="mr-2 h-4 w-4 text-green-500" /> Зөвшөөрөх
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUpdateStatus(req, 'Татгалзсан')}>
                                                    <X className="mr-2 h-4 w-4 text-red-500" /> Татгалзах
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!isLoading && filteredRequests.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Чөлөөний хүсэлт олдсонгүй.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

// --- Main Page Component ---
export default function AttendanceAndRequestsPage() {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pb-32">
                {/* Header section */}
                <div className="bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-fuchsia-500/10 dark:from-violet-500/5 dark:via-purple-500/5 dark:to-fuchsia-500/5">
                    <div className="px-6 py-6 md:p-8">
                        <PageHeader
                            title="Цаг ба Ирц"
                            description="Ажилтнуудын ирцийн түүх болон холбогдох хүсэлтүүдийг удирдах."
                            showBackButton={true}
                            hideBreadcrumbs={true}
                            backButtonPlacement="inline"
                            backBehavior="history"
                            fallbackBackHref="/dashboard"
                        />
                        <div className="mt-6">
                            <AttendanceDashboard />
                        </div>
                    </div>
                </div>

                {/* Main content */}
                <div className="px-6 py-6 md:p-8 space-y-8">
                <Tabs defaultValue="history">
                    <VerticalTabMenu
                        orientation="horizontal"
                        items={[
                            { value: 'history', label: 'Ирцийн түүх' },
                            { value: 'requests', label: 'Чөлөөний хүсэлт' },
                        ]}
                    />
                    <TabsContent value="history" className="mt-6">
                        <AttendanceHistoryTab />
                    </TabsContent>
                    <TabsContent value="requests" className="mt-6">
                        <TimeOffRequestsTable />
                    </TabsContent>
                </Tabs>
                </div>
            </div>
        </div>
    );
}
