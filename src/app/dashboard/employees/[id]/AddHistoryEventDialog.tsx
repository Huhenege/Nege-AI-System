'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Loader2, Upload, File, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useFirebase, addDocumentNonBlocking, useMemoFirebase, tenantCollection } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';

const historyEventSchema = z.object({
  eventType: z.string().min(1, 'Үйл явдлын төрлийг сонгоно уу.'),
  eventDate: z.date({
    required_error: 'Үйл явдлын огноог сонгоно уу.',
  }),
  notes: z.string().optional(),
});

type HistoryEventFormValues = z.infer<typeof historyEventSchema>;

const eventTypes = [
  'Ажилд авсан',
  'Туршилтын хугацаа эхэлсэн',
  'Үндсэн ажилтан болгосон',
  'Албан тушаал дэвшсэн',
  'Шилжүүлэн томилсон',
  'Урт хугацааны чөлөө',
  'Сахилгын шийтгэл',
  'Ажлаас чөлөөлсөн',
  'Эд хөрөнгө хариуцуулсан',
  'Бусад',
];

interface AddHistoryEventDialogProps {
  employeeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddHistoryEventDialog({
  employeeId,
  open,
  onOpenChange,
}: AddHistoryEventDialogProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const historyCollectionRef = useMemoFirebase(
    ({ firestore, companyPath }) =>
      firestore
        ? tenantCollection(firestore, companyPath, `employees/${employeeId}/employmentHistory`)
        : null,
    [employeeId]
  );

  const documentsCollectionRef = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'documents') : null),
    []
  );

  const form = useForm<HistoryEventFormValues>({
    resolver: zodResolver(historyEventSchema),
    defaultValues: {
      eventType: '',
      eventDate: new Date(),
      notes: '',
    },
  });

  const { isSubmitting } = form.formState;

  React.useEffect(() => {
    if (!open) {
      form.reset();
      setSelectedFile(null);
    }
  }, [open, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadDocument = async (): Promise<{ url: string, name: string } | null> => {
    if (!selectedFile) return null;
    setIsUploading(true);

    const storage = getStorage();
    const uniqueFileName = `${Date.now()}-${selectedFile.name}`;
    const storageRef = ref(storage, `employees/${employeeId}/history-documents/${uniqueFileName}`);

    try {
      await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(storageRef);
      return { url: downloadURL, name: selectedFile.name };
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        variant: "destructive",
        title: "Файл хуулахад алдаа гарлаа",
        description: (error as Error).message,
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (values: HistoryEventFormValues) => {
    if (!historyCollectionRef || !documentsCollectionRef) return;

    let documentUrl = '';
    let documentName = '';
    let documentId: string | undefined = undefined;

    if (selectedFile) {
      const uploadedFile = await uploadDocument();
      if (!uploadedFile) return; // Stop if upload fails

      documentUrl = uploadedFile.url;
      documentName = uploadedFile.name;

      // Create a corresponding entry in the main 'documents' collection
      const docResponse = await addDocumentNonBlocking(documentsCollectionRef, {
        title: documentName,
        description: `Ажилтны түүх: ${values.eventType}`,
        url: documentUrl,
        uploadDate: new Date().toISOString(),
        documentType: "Бусад", // Or derive from eventType
        metadata: {
          employeeId: employeeId,
          historyEventType: values.eventType,
        }
      });
      if (docResponse) {
        documentId = docResponse.id;
      }
    }

    await addDocumentNonBlocking(historyCollectionRef, {
      ...values,
      documentUrl: documentUrl,
      documentName: documentName,
      documentId: documentId,
      eventDate: values.eventDate.toISOString(),
      createdAt: new Date().toISOString(),
    });

    toast({
      title: 'Амжилттай хадгаллаа',
      description: 'Хөдөлмөрийн түүхэнд шинэ үйл явдал нэмэгдлээ.',
    });
    form.reset();
    setSelectedFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Шинэ үйл явдал нэмэх</DialogTitle>
              <DialogDescription>
                Ажилтны хөдөлмөрийн харилцааны түүхэнд шинэ тэмдэглэл нэмэх.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="eventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Үйл явдлын төрөл</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Төрөл сонгоно уу..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eventTypes.map((type, idx) => (
                          <SelectItem key={`${type}-${idx}`} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Огноо</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'yyyy-MM-dd')
                            ) : (
                              <span>Огноо сонгох</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date('1900-01-01')
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тэмдэглэл</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Нэмэлт тайлбар, шийдвэрийн дугаар гэх мэт..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Холбогдох баримт</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </FormControl>
                {!selectedFile && (
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    <Upload className="mr-2 h-4 w-4" />
                    Файл сонгох
                  </Button>
                )}
                {selectedFile && (
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <File className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">{selectedFile.name}</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="h-6 w-6">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </FormItem>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting || isUploading}
              >
                Цуцлах
              </Button>
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {(isSubmitting || isUploading) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Хадгалах
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
