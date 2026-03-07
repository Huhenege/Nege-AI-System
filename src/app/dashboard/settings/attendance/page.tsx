'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  useFirebase,
  useMemoFirebase,
  useCollection,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  tenantCollection,
  useTenantWrite,
} from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Search,
  Smartphone,
  Navigation,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Dynamically import the Map component to avoid SSR issues with Leaflet
const AttendanceMap = dynamic(() => import('./attendance-map'), {
  loading: () => <Skeleton className="h-[300px] w-full rounded-lg" />,
  ssr: false
});

const locationSchema = z.object({
  name: z.string().min(1, 'Нэр хоосон байж болохгүй.'),
  latitude: z.coerce.number().min(-90, 'Өргөрөг -90-аас бага байж болохгүй.').max(90, 'Өргөрөг 90-ээс их байж болохгүй.'),
  longitude: z.coerce.number().min(-180, 'Уртраг -180-аас бага байж болохгүй.').max(180, 'Уртраг 180-аас их байж болохгүй.'),
  radius: z.coerce.number().min(1, 'Хүрээ 1-ээс бага байж болохгүй.'),
  isActive: z.boolean().default(true),
});

type LocationFormValues = z.infer<typeof locationSchema>;

interface AttendanceLocation extends LocationFormValues {
  id: string;
}

function LocationDialog({
  open,
  onOpenChange,
  initialData,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: AttendanceLocation | null;
  onSave: (data: LocationFormValues) => Promise<void>;
}) {
  const { toast } = useToast();
  const [addressQuery, setAddressQuery] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: initialData || {
      name: '',
      latitude: 47.9179,
      longitude: 106.9175,
      radius: 50,
      isActive: true,
    },
  });

  const { isSubmitting } = form.formState;
  const watchedFields = form.watch();

  React.useEffect(() => {
    if (open) {
      if (initialData) {
        form.reset(initialData);
      } else {
        form.reset({
          name: '',
          latitude: 47.9179,
          longitude: 106.9175,
          radius: 50,
          isActive: true,
        });
      }
      setAddressQuery('');
    }
  }, [open, initialData, form]);

  const handleLocationChange = (lat: number, lng: number) => {
    form.setValue('latitude', lat, { shouldDirty: true });
    form.setValue('longitude', lng, { shouldDirty: true });
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        handleLocationChange(lat, lng);
        toast({ title: "Байршил амжилттай авлаа." })
      }, (error) => {
        toast({ variant: 'destructive', title: "Байршил авахад алдаа гарлаа", description: error.message });
      });
    } else {
      toast({ variant: 'destructive', title: "Энэ хөтөч байршил дэмжихгүй байна." });
    }
  }

  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&limit=1`);
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        handleLocationChange(lat, lon);
        toast({ title: "Байршил олдлоо", description: data[0].display_name });
      } else {
        toast({ variant: "destructive", title: "Илэрц олдсонгүй", description: "Та хаягаа шалгаад дахин оролдоно уу." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Алдаа гарлаа", description: "Хайлт хийхэд алдаа гарлаа." });
    } finally {
      setIsSearching(false);
    }
  }

  const handleSubmit = async (data: LocationFormValues) => {
    await onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Байршил засах' : 'Шинэ байршил нэмэх'}</DialogTitle>
          <DialogDescription>
            Байгууллагын салбар эсвэл оффисын байршлыг цэгцтэй бүртгэнэ үү.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Байршлын нэр</FormLabel>
                    <FormControl><Input placeholder="Жишээ: Төв оффис, Сүхбаатар салбар..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="latitude" render={({ field }) => (
                    <FormItem><FormLabel>Өргөрөг (Lat)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="longitude" render={({ field }) => (
                    <FormItem><FormLabel>Уртраг (Lng)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="radius" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Хүрээ (метр)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex flex-col gap-3">
                  <FormLabel>Хаягаар хайх</FormLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Хаяг бичих..."
                      value={addressQuery}
                      onChange={(e) => setAddressQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchAddress(e))}
                    />
                    <Button type="button" variant="secondary" onClick={handleSearchAddress} disabled={isSearching}>
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} className="flex-1">
                    <Navigation className="mr-2 h-4 w-4" />
                    Миний байршил
                  </Button>
                </div>
              </div>

              <div className="h-[350px] rounded-lg border overflow-hidden relative">
                <AttendanceMap
                  latitude={Number(watchedFields.latitude)}
                  longitude={Number(watchedFields.longitude)}
                  radius={Number(watchedFields.radius)}
                  onLocationChange={handleLocationChange}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Цуцлах</Button>
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

export default function AttendanceSettingsPage() {
  const { firestore } = useFirebase();
  const { tDoc, tCollection } = useTenantWrite();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingLocation, setEditingLocation] = React.useState<AttendanceLocation | null>(null);

  const locationsQuery = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'attendanceLocations'), orderBy('name')) : null),
    []
  );

  const { data: locations, isLoading } = useCollection<AttendanceLocation>(locationsQuery);

  const handleAdd = () => {
    setEditingLocation(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (location: AttendanceLocation) => {
    setEditingLocation(location);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDocumentNonBlocking(tDoc('attendanceLocations', id));
      toast({ title: "Амжилттай устгагдлаа" });
    } catch (error) {
      toast({ title: "Устгахад алдаа гарлаа", variant: "destructive" });
    }
  };

  const handleSave = async (data: LocationFormValues) => {
    if (!firestore) return;
    try {
      if (editingLocation) {
        await updateDocumentNonBlocking(tDoc('attendanceLocations', editingLocation.id), data);
        toast({ title: "Амжилттай шинэчлэгдлээ" });
      } else {
        await addDocumentNonBlocking(tCollection('attendanceLocations'), data);
        toast({ title: "Шинэ байршил нэмэгдлээ" });
      }
    } catch (error) {
      toast({ title: "Хадгалахад алдаа гарлаа", variant: "destructive" });
    }
  };

  const handleToggleStatus = async (location: AttendanceLocation) => {
    if (!firestore) return;
    try {
      await updateDocumentNonBlocking(tDoc('attendanceLocations', location.id), {
        isActive: !location.isActive
      });
      toast({ title: location.isActive ? "Идэвхгүй болголоо" : "Идэвхтэй болголоо" });
    } catch (error) {
      toast({ title: "Төлөв өөрчлөхөд алдаа гарлаа", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-8 ">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Байршил</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Байгууллагын салбар, оффисуудын байршлын мэдээллийг удирдах.
          </p>
        </div>
        <Button onClick={handleAdd} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          Байршил нэмэх
        </Button>
      </div>

      <LocationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={editingLocation}
        onSave={handleSave}
      />

      <div className="grid grid-cols-1 gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
                <CardContent><Skeleton className="h-24 w-full" /></CardContent>
              </Card>
            ))
          ) : (
            locations?.map(loc => (
              <Card key={loc.id} className={cn("shadow-premium border-slate-200/60", !loc.isActive && 'opacity-60 bg-muted/30')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-base font-semibold">{loc.name}</CardTitle>
                    <Badge variant={loc.isActive ? "default" : "secondary"} className="w-fit text-[10px] px-1.5 py-0">
                      {loc.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(loc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Та итгэлтэй байна уу?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{loc.name}" байршлыг устгах гэж байна. Энэ үйлдлийг буцаах боломжгүй.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(loc.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Устгах</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-3 w-3" /> {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3" /> Хүрээ: {loc.radius} метр
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-2 text-xs h-8" onClick={() => handleToggleStatus(loc)}>
                      {loc.isActive ? "Идэвхгүй болгох" : "Идэвхтэй болгох"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          {!isLoading && locations?.length === 0 && (
            <div className="col-span-full border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground flex flex-col items-center gap-4">
              <MapPin className="h-12 w-12 opacity-20" />
              <div>Бүртгэлтэй байршил олдсонгүй. "Байршил нэмэх" товчийг дарж эхэлнэ үү.</div>
              <Button variant="outline" size="sm" onClick={handleAdd}>Байршил нэмэх</Button>
            </div>
          )}
        </div>

        <Card className="shadow-premium border-slate-200/60">
          <CardHeader>
            <CardTitle>Төхөөрөмжийн баталгаажуулалт</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertTitle>Анхаар!</AlertTitle>
              <AlertDescription>
                Төхөөрөмжийн баталгаажуулалт автоматаар идэвхтэй байдаг. Ажилтан анх удаа "Ирсэн" товчийг дарахад тухайн төхөөрөмж автоматаар системд бүртгэгдэнэ.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
