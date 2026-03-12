'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, PlusCircle, Trash2, Loader2, Search, ChevronRight, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  useFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useMemoFirebase,
  tenantCollection,
  tenantDoc,
} from '@/firebase';
import { useTenantWrite } from '@/hooks/use-tenant-write';
import { collection, doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';


export interface ReferenceItem {
  id: string;
  [key: string]: any;
}

interface ColumnDefinition {
  key: string;
  header: string;
  render?: (value: any, item: any) => React.ReactNode;
  forceFormInput?: boolean;
}

interface ReferenceTableProps {
  collectionName: string;
  columns: ColumnDefinition[];
  itemData: ReferenceItem[] | null;
  isLoading: boolean;
  dialogTitle: string;
  enableFieldDefs?: boolean;
  dialogComponent?: React.ComponentType<any>;
  hideAddButton?: boolean;
  onEdit?: (item: ReferenceItem) => void;
  maxVisibleItems?: number;
  compact?: boolean;
}

export function ReferenceTable({
  collectionName,
  columns,
  itemData,
  isLoading,
  dialogTitle,
  enableFieldDefs = false,
  dialogComponent: DialogComponent,
  hideAddButton = false,
  onEdit,
  maxVisibleItems = 5,
  compact = true,
}: ReferenceTableProps) {
  const [open, setOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<ReferenceItem | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showAllModal, setShowAllModal] = React.useState(false);

  const { firestore } = useFirebase();
  const { companyPath } = useTenantWrite();
  const collectionRef = useMemoFirebase(
    ({ companyPath }) => (firestore && collectionName ? tenantCollection(firestore, companyPath, collectionName) : null),
    [firestore, collectionName]
  );

  const handleAddNew = () => {
    setEditingItem(null);
    setOpen(true);
  };

  const handleEdit = (item: ReferenceItem) => {
    if (onEdit) {
      onEdit(item);
    } else {
      setEditingItem(item);
      setOpen(true);
    }
  };

  const handleDelete = (item: ReferenceItem) => {
    if (!firestore || !item.id) return;
    const docRef = tenantDoc(firestore, companyPath, collectionName, item.id);
    deleteDocumentNonBlocking(docRef);
  };

  // Filter items by search
  const filteredItems = React.useMemo(() => {
    if (!itemData) return [];
    if (!searchQuery.trim()) return itemData;
    const query = searchQuery.toLowerCase();
    return itemData.filter(item => 
      columns.some(col => {
        const value = item[col.key];
        return value && String(value).toLowerCase().includes(query);
      })
    );
  }, [itemData, searchQuery, columns]);

  // Items to display (limited or all)
  const displayItems = compact ? filteredItems.slice(0, maxVisibleItems) : filteredItems;
  const hasMore = filteredItems.length > maxVisibleItems;
  const totalCount = itemData?.length || 0;

  const TableContent = ({ items, inModal = false }: { items: ReferenceItem[]; inModal?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col, colIndex) => (
            <TableHead key={`${col.key}-${colIndex}`} className="text-xs">{col.header}</TableHead>
          ))}
          <TableHead className="w-[80px] text-right text-xs">Үйлдэл</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="group">
            {columns.map((col, colIndex) => (
              <TableCell key={`${col.key}-${colIndex}`} className="py-2 text-sm">
                {col.render ? col.render(item[col.key], item) : item[col.key]}
              </TableCell>
            ))}
            <TableCell className="text-right py-2">
              <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { handleEdit(item); if (inModal) setShowAllModal(false); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Та итгэлтэй байна уу?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Энэ үйлдлийг буцаах боломжгүй. Энэ нь "{item[columns[0].key]}"-г бүрмөсөн устгана.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(item)}>Устгах</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={columns.length + 1} className="h-16 text-center text-sm text-muted-foreground">
              {searchQuery ? 'Хайлтад тохирох илэрц олдсонгүй' : 'Бүртгэл байхгүй'}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <>
      {/* Header with search and add button */}
      <div className="flex items-center gap-2 mb-3">
        {totalCount > 5 && (
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Хайх..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
        {!hideAddButton && (
          <Button size="sm" onClick={handleAddNew} className={cn("h-8 shrink-0", totalCount <= 5 && "ml-auto")}>
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            Нэмэх
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <TableContent items={displayItems} />
        )}
      </div>

      {/* Show more button */}
      {!isLoading && hasMore && compact && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 h-8 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowAllModal(true)}
        >
          Бүгдийг харах ({filteredItems.length})
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      )}

      {/* View All Modal */}
      <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Нийт {totalCount} бүртгэл
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Хайх..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {!hideAddButton && (
              <Button size="sm" onClick={() => { handleAddNew(); setShowAllModal(false); }}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Нэмэх
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="rounded-lg border">
              <TableContent items={filteredItems} inModal />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit/Add Dialog */}
      {DialogComponent ? (
        <DialogComponent open={open} onOpenChange={setOpen} editingItem={editingItem} />
      ) : (
        <ReferenceItemDialog
          open={open}
          onOpenChange={setOpen}
          item={editingItem}
          columns={columns}
          collectionRef={collectionRef}
          dialogTitle={dialogTitle}
          enableFieldDefs={enableFieldDefs}
          collectionName={collectionName}
        />
      )}
    </>
  );
}

// --- Dialog Component ---
interface ReferenceItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ReferenceItem | null;
  columns: ColumnDefinition[];
  collectionRef: any;
  dialogTitle: string;
  enableFieldDefs?: boolean;
  collectionName: string;
}

function ReferenceItemDialog({
  open,
  onOpenChange,
  item,
  columns,
  collectionRef,
  dialogTitle,
  enableFieldDefs,
  collectionName,
}: ReferenceItemDialogProps) {
  const isEditMode = !!item;

  const formSchema = React.useMemo(() => {
    const shape: { [key: string]: any } = {};
    columns.forEach(col => {
      // Skip fields column and other render-only columns, but not isMandatory or forced ones
      if (col.key !== 'fields' && (!col.render || col.forceFormInput)) {
        shape[col.key] = z.string().min(1, `${col.header} хоосон байж болохгүй.`);
      }
    });
    if (enableFieldDefs) {
      shape.fields = z.array(z.object({
        key: z.string().min(1, 'Түлхүүр үг хоосон байж болохгүй.'),
        label: z.string().min(1, 'Нэр хоосон байж болохгүй.'),
        type: z.enum(['text', 'number', 'date']),
      })).superRefine((fields, ctx) => {
        const keys = (fields || []).map((f) => (f?.key || '').trim()).filter(Boolean);
        const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
        if (dupKeys.length > 0) {
          const uniqueDup = Array.from(new Set(dupKeys));
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Түлхүүр үг (key) давхардаж байна: ${uniqueDup.join(', ')}`,
          });
        }
      }).optional();
    }
    if (collectionName === 'timeOffRequestTypes') {
      shape.paid = z.boolean().default(false);
    }
    if (collectionName === 'er_document_types') {
      shape.isMandatory = z.boolean().default(false);
    }
    return z.object(shape);
  }, [columns, enableFieldDefs, collectionName]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "fields",
  });

  React.useEffect(() => {
    if (open) {
      const defaultValues: { [key: string]: any } = {};
      if (isEditMode && item) {
        columns.forEach(col => {
          if (!col.render || col.forceFormInput) {
            defaultValues[col.key] = item[col.key] || (col.key === 'fields' ? [] : '');
          }
        });
        if (collectionName === 'timeOffRequestTypes') {
          defaultValues.paid = item.paid || false;
        }
        if (collectionName === 'er_document_types') {
          defaultValues.isMandatory = item.isMandatory || false;
        }
      } else {
        columns.forEach(col => {
          if (!col.render || col.forceFormInput) {
            defaultValues[col.key] = col.key === 'fields' ? [] : '';
          }
        });
        if (collectionName === 'timeOffRequestTypes') {
          defaultValues.paid = false;
        }
        if (collectionName === 'er_document_types') {
          defaultValues.isMandatory = false;
        }
      }
      form.reset(defaultValues);
    }
  }, [open, item, isEditMode, columns, form, collectionName]);

  const { isSubmitting } = form.formState;
  const { firestore } = useFirebase();

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!firestore || !collectionRef) return;

    if (isEditMode && item) {
      const docRef = doc(firestore, collectionRef.path, item.id);
      updateDocumentNonBlocking(docRef, values);
    } else {
      addDocumentNonBlocking(collectionRef, values);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{isEditMode ? `Засах: ${dialogTitle}` : `Шинэ: ${dialogTitle}`}</DialogTitle>
              <DialogDescription>
                Мэдээллийг нэмэх эсвэл засах.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-auto max-h-[60vh] p-1">
              <div className="grid gap-4 py-4 pr-4">
                {columns.filter(c => !c.render || c.forceFormInput).map(col => (
                  <FormField
                    key={`field-${col.key}`}
                    control={form.control}
                    name={col.key}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{col.header}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}

                {collectionName === 'timeOffRequestTypes' && (
                  <FormField
                    control={form.control}
                    name="paid"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 transition-colors hover:bg-slate-50">
                        <div className="space-y-0.5">
                          <FormLabel className="font-bold text-xs uppercase tracking-widest text-slate-500">Цалинтай эсэх</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {collectionName === 'er_document_types' && (
                  <FormField
                    control={form.control}
                    name="isMandatory"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-[1.25rem] border border-indigo-100 bg-indigo-50/30 p-4 transition-all hover:bg-indigo-50/50">
                        <div className="space-y-0.5">
                          <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            Заавал бүрдүүлэх шаардлага (Шаардлагатай)
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-indigo-600"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {enableFieldDefs && (
                  <div>
                    <FormLabel>Нэмэлт талбарууд</FormLabel>
                    <div className="space-y-4 mt-2">
                      {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 items-end gap-2 rounded-md border p-4">
                          <FormField
                            control={form.control}
                            name={`fields.${index}.key`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Түлхүүр үг (key)</FormLabel>
                                <FormControl><Input placeholder="salasy" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`fields.${index}.label`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Нэр (label)</FormLabel>
                                <FormControl><Input placeholder="Цалингийн дүн" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`fields.${index}.type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Төрөл (type)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Төрөл" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="text">Текст</SelectItem>
                                    <SelectItem value="number">Тоо</SelectItem>
                                    <SelectItem value="date">Огноо</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => append({ key: '', label: '', type: 'text' })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Талбар нэмэх
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Цуцлах
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Хадгалах
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
