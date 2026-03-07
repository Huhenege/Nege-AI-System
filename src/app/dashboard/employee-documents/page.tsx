'use client';
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { AddActionButton } from '@/components/ui/add-action-button';
import {
  MoreHorizontal,
  File,
  Download,
  Trash2,
  Eye,
  Settings
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import type { Document } from './data';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const categoryIcons = {
  Policy: <File className="h-4 w-4 text-blue-500" />,
  Contract: <File className="h-4 w-4 text-green-500" />,
  Handbook: <File className="h-4 w-4 text-purple-500" />,
  Form: <File className="h-4 w-4 text-orange-500" />,
  'Хөдөлмөрийн гэрээ': <File className="h-4 w-4 text-green-500" />,
  'Дотоод журам': <File className="h-4 w-4 text-blue-500" />,
  'Ажилтны гарын авлага': <File className="h-4 w-4 text-purple-500" />,
  'Маягт': <File className="h-4 w-4 text-orange-500" />,
  'Бусад': <File className="h-4 w-4 text-gray-500" />,
};

function DocumentRow({ doc }: { doc: Document }) {
  const Icon = categoryIcons[doc.documentType] || categoryIcons['Бусад'];

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          href={`/dashboard/employee-documents/${doc.id}`}
          className="flex items-center gap-2 hover:text-primary transition-colors hover:underline"
        >
          {Icon}
          <span>{doc.title}</span>
        </Link>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Badge variant="secondary">{doc.documentType}</Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {format(new Date(doc.uploadDate), 'yyyy.MM.dd')}
      </TableCell>
      <TableCell className="text-right hidden md:table-cell">... KB</TableCell>
    </TableRow >
  );
}

export default function DocumentsPage() {
  const documentsQuery = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'documents') : null),
    []
  );
  const {
    data: documents,
    isLoading,
    error,
  } = useCollection<Document>(documentsQuery);

  return (
    <div className="py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Баримт бичиг</CardTitle>
            <CardDescription>
              Хүний нөөцийн чухал баримт бичгүүдийг аюулгүй хадгалж, удирдах.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ActionIconButton
              label="Тохиргоо"
              description="Баримтын тохиргоо"
              href="/dashboard/employee-documents/settings"
              icon={<Settings className="h-4 w-4" />}
              variant="outline"
              className="bg-white hover:bg-slate-50"
            />
            <AddActionButton
              label="Бичиг баримт байршуулах"
              description="Удахгүй нэмэгдэнэ"
              disabled
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Нэр</TableHead>
                <TableHead className="hidden sm:table-cell">Ангилал</TableHead>
                <TableHead className="hidden md:table-cell">
                  Сүүлд зассан
                </TableHead>
                <TableHead className="text-right hidden md:table-cell">Хэмжээ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                  </TableRow>
                ))}
              {error && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-destructive"
                  >
                    Алдаа гарлаа: {error.message}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                !error &&
                documents &&
                documents.map((doc) => <DocumentRow key={doc.id} doc={doc} />)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
