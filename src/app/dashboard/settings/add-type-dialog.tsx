'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
  useFirebase,
  useMemoFirebase,
  useFetchCollection,
  tenantCollection,
  useTenantWrite,
} from '@/firebase';
import { Loader2, PlusCircle, Trash2, Pencil, Save, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const typeSchema = z.object({
  name: z.string().min(2, {
    message: 'Төрлийн нэр дор хаяж 2 тэмдэгттэй байх ёстой.',
  }),
});

type TypeFormValues = z.infer<typeof typeSchema>;

type DepartmentType = {
  id: string;
  name: string;
};

interface ManageTypesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InlineEditType({ type, onSave, onCancel }: { type: DepartmentType, onSave: (id: string, newName: string) => void, onCancel: () => void }) {
    const [name, setName] = React.useState(type.name);

    const handleSave = () => {
        if (name.trim().length >= 2) {
            onSave(type.id, name.trim());
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 flex-1"
                autoFocus
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={handleSave}>
                <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onCancel}>
                <X className="h-4 w-4" />
            </Button>
        </div>
    )
}


export function AddTypeDialog({ open, onOpenChange }: ManageTypesDialogProps) {
  const { firestore } = useFirebase();
  const { tDoc } = useTenantWrite();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [editingTypeId, setEditingTypeId] = React.useState<string | null>(null);

  const departmentTypesCollection = useMemoFirebase(
    ({firestore, companyPath}) => (firestore ? tenantCollection(firestore, companyPath, 'departmentTypes') : null),
    []
  );
  
  const { data: departmentTypes, isLoading } = useFetchCollection<DepartmentType>(departmentTypesCollection);

  const form = useForm<TypeFormValues>({
    resolver: zodResolver(typeSchema),
    defaultValues: {
      name: '',
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = (data: TypeFormValues) => {
    if (!departmentTypesCollection) return;

    addDocumentNonBlocking(departmentTypesCollection, data);

    toast({
      title: 'Амжилттай',
      description: `"${data.name}" төрөл амжилттай нэмэгдлээ.`,
    });

    form.reset();
    setShowAddForm(false);
  };
  
  const handleDelete = (typeId: string, typeName: string) => {
      if (!firestore) return;
      
      const docRef = tDoc('departmentTypes', typeId);
      deleteDocumentNonBlocking(docRef);

      toast({
          title: 'Амжилттай устгагдлаа',
          description: `"${typeName}" төрөл устгагдлаа.`,
          variant: 'destructive',
      });
  }

  const handleSaveEdit = (typeId: string, newName: string) => {
    if (!firestore) return;
    const docRef = tDoc('departmentTypes', typeId);
    updateDocumentNonBlocking(docRef, { name: newName });
    toast({
        title: 'Амжилттай шинэчлэгдлээ',
        description: 'Төрлийн нэр солигдлоо.',
    });
    setEditingTypeId(null);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
            setShowAddForm(false);
            setEditingTypeId(null);
        }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Бүтцийн төрлийн жагсаалт</DialogTitle>
        </DialogHeader>
        
        {!showAddForm && (
            <Button onClick={() => setShowAddForm(true)} className="w-full" variant="outline">
                <PlusCircle className="mr-2 h-4 w-4" />
                Нэмэх
            </Button>
        )}

        {showAddForm && (
          <div className="rounded-md border p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input placeholder="Шинэ төрлийн нэр..." {...field} autoFocus className="h-9"/>
                    </FormControl>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />
              <div className="flex gap-1">
                <Button type="submit" disabled={isSubmitting} size="sm">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Нэмэх'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)} disabled={isSubmitting} size="sm">
                  Цуцлах
                </Button>
              </div>
            </form>
          </Form>
          </div>
        )}

        <ScrollArea className="h-72 border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50">
                <TableRow>
                    <TableHead>Нэр</TableHead>
                    <TableHead className="w-[100px] text-right">Үйлдэл</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading && Array.from({length: 3}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                ))}
              {departmentTypes?.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium align-middle">
                    {editingTypeId === type.id ? (
                        <InlineEditType 
                            type={type}
                            onSave={handleSaveEdit}
                            onCancel={() => setEditingTypeId(null)}
                        />
                    ) : (
                        type.name
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingTypeId !== type.id && (
                        <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTypeId(type.id)}>
                                <Pencil className="h-4 w-4 text-blue-600" />
                                <span className="sr-only">Засах</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(type.id, type.name)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                                <span className="sr-only">Устгах</span>
                            </Button>
                        </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (!departmentTypes || departmentTypes.length === 0) && (
                <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center">
                        Бүртгэгдсэн төрөл байхгүй.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
