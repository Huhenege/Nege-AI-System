'use client';

import * as React from 'react';
import { PageHeader } from '@/components/patterns/page-layout';
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
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { useCollection, useMemoFirebase, tenantCollection } from '@/firebase';
import type { Employee } from '../../employees/data';
import { Skeleton } from '@/components/ui/skeleton';

export default function CodeLogPage() {
  const employeesQuery = useMemoFirebase(
    ({firestore, companyPath}) => (firestore ? tenantCollection(firestore, companyPath, 'employees') : null),
    []
  );
  const { data: employees, isLoading, error } = useCollection<Employee>(employeesQuery);

  const sortedEmployees = React.useMemo(() => {
    if (!employees) return [];
    return [...employees].sort((a, b) => ((a.employeeCode || '') > (b.employeeCode || '') ? 1 : -1));
  }, [employees]);

  return (
    <div className="py-8">
      <div className="mb-4">
        <PageHeader
          title="Ажилтны кодын түүх"
          description="Системд үүсгэгдсэн бүх ажилтны код болон харгалзах ажилтны жагсаалт."
          showBackButton
          hideBreadcrumbs
          backButtonPlacement="inline"
          backBehavior="history"
          fallbackBackHref="/dashboard/settings/employee-code"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Бүртгэгдсэн кодууд</CardTitle>
          <CardDescription>
            Нийт {isLoading ? '...' : sortedEmployees.length} код бүртгэгдсэн байна.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Ажилтны код</TableHead>
                <TableHead>Ажилтны нэр</TableHead>
                <TableHead>Албан тушаал</TableHead>
                <TableHead className="hidden md:table-cell">Ажилд орсон огноо</TableHead>
                <TableHead className="w-[50px] text-right">
                  <span className="sr-only">Үйлдлүүд</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              {!isLoading && sortedEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-mono">{employee.employeeCode}</TableCell>
                  <TableCell className="font-medium">{employee.firstName} {employee.lastName}</TableCell>
                  <TableCell>{employee.jobTitle}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && sortedEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Ажилтны бүртгэл олдсонгүй.
                  </TableCell>
                </TableRow>
              )}
               {error && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-destructive">
                    Мэдээлэл ачаалахад алдаа гарлаа: {error.message}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
