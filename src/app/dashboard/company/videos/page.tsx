'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { PageHeader } from '@/components/patterns/page-layout';
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
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking, tenantDoc } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Loader2, Save, X, PlusCircle, Trash2, Upload, Film, CheckCircle2, AlertCircle, ChevronLeft, Video } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

const videoSchema = z.object({
    title: z.string().min(1, 'Гарчиг хоосон байж болохгүй.'),
    description: z.string().optional(),
    url: z.string().url('URL хаяг буруу байна.'),
});

const videosSchema = z.object({
    videos: z.array(videoSchema).optional(),
});

type VideosFormValues = z.infer<typeof videosSchema>;

function VideoFormSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
                <Card className="p-4 bg-muted/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-20 w-full" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="aspect-video w-full rounded-md" />
                            <div className="flex gap-2">
                                <Skeleton className="h-9 w-32" />
                                <Skeleton className="h-9 w-24" />
                            </div>
                        </div>
                    </div>
                </Card>
                <Skeleton className="h-9 w-36" />
            </CardContent>
        </Card>
    )
}


function EditVideosForm({ initialData }: { initialData: VideosFormValues }) {
    const router = useRouter();
    const { firestore, storage } = useFirebase();
    const { toast } = useToast();

    const [uploadingVideos, setUploadingVideos] = React.useState<{ [key: number]: number }>({});

    const companyProfileRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
        []
    );

    const form = useForm<VideosFormValues>({
        resolver: zodResolver(videosSchema),
        defaultValues: initialData,
    });

    React.useEffect(() => {
        form.reset(initialData);
    }, [initialData, form]);

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "videos",
    });

    const { isSubmitting } = form.formState;

    const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset progress for this index
        setUploadingVideos(prev => ({ ...prev, [index]: 0 }));

        const storageRef = ref(storage, `company-videos/${Date.now()}-${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadingVideos(prev => ({ ...prev, [index]: Math.round(progress) }));
            },
            (error) => {
                console.error("Видео байршуулахад алдаа гарлаа: ", error);
                toast({ variant: 'destructive', title: 'Алдаа', description: 'Видео байршуулахад алдаа гарлаа.' });
                setUploadingVideos(prev => {
                    const next = { ...prev };
                    delete next[index];
                    return next;
                });
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                form.setValue(`videos.${index}.url`, downloadURL, { shouldValidate: true });
                toast({ title: 'Видео амжилттай байршлаа.' });
                setUploadingVideos(prev => {
                    const next = { ...prev };
                    delete next[index];
                    return next;
                });
            }
        );
    };


    const handleSave = (values: VideosFormValues) => {
        if (!companyProfileRef) return;

        const finalValues = {
            videos: values.videos?.filter(v => v.url)
        };

        updateDocumentNonBlocking(companyProfileRef, finalValues);

        toast({
            title: 'Амжилттай хадгаллаа',
            description: 'Видео контент шинэчлэгдлээ.',
        });
        router.push('/dashboard/company');
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8 pb-32">
                {/* Header */}
                <div className="bg-white border-b sticky top-0 z-20 -mx-6 md:-mx-8 -mt-6 md:-mt-8 mb-6">
                    <div className="px-6 md:px-8 py-4">
                        <PageHeader
                            title="Видео контент"
                            description="Компанийн танилцуулга, соёлын видеонууд"
                            showBackButton
                            hideBreadcrumbs
                            backButtonPlacement="inline"
                            backBehavior="history"
                            fallbackBackHref="/dashboard/company"
                            actions={
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        type="button"
                                        onClick={() => router.push('/dashboard/company')}
                                        disabled={isSubmitting || Object.keys(uploadingVideos).length > 0}
                                    >
                                        Цуцлах
                                    </Button>
                                    <Button size="sm" type="submit" disabled={isSubmitting || Object.keys(uploadingVideos).length > 0}>
                                        {isSubmitting || Object.keys(uploadingVideos).length > 0 ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Save className="h-4 w-4 mr-2" />
                                        )}
                                        Хадгалах
                                    </Button>
                                </div>
                            }
                        />
                    </div>
                </div>
                <div className="bg-white rounded-xl border shadow-sm">
                    <div className="p-5 border-b bg-gradient-to-r from-slate-50 to-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-base">Видео контент</h3>
                                <p className="text-xs text-muted-foreground mt-1">Компанийн танилцуулга, соёлын видеонууд</p>
                            </div>
                            {fields.length > 0 && (
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="icon"
                                    className="h-9 w-9 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors"
                                    onClick={() => append({ title: '', description: '', url: '' })} 
                                    title="Видео нэмэх"
                                >
                                    <PlusCircle className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="p-6">
                        {fields.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center mb-4 shadow-sm">
                                    <Film className="h-8 w-8 text-blue-500" />
                                </div>
                                <p className="text-sm font-semibold text-slate-700 mb-1">Видео контент хоосон байна</p>
                                <p className="text-xs text-muted-foreground mb-6 max-w-sm">Компанийн танилцуулга, соёлын видеонуудыг нэмнэ үү</p>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="icon"
                                    className="h-10 w-10 rounded-full hover:bg-primary hover:text-primary-foreground transition-all hover:scale-105"
                                    onClick={() => append({ title: '', description: '', url: '' })} 
                                    title="Видео нэмэх"
                                >
                                    <PlusCircle className="h-5 w-5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {fields.map((field, index) => {
                                    const videoUrl = form.watch(`videos.${index}.url`);
                                    const isUploading = uploadingVideos[index] !== undefined;
                                    return (
                                        <div 
                                            key={field.id} 
                                            className="group relative border-2 rounded-xl p-6 bg-gradient-to-br from-white to-slate-50/50 hover:shadow-lg transition-all duration-200"
                                        >
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {/* Video Preview Section */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                                            <Film className="h-4 w-4 text-blue-600" />
                                                        </div>
                                                        <FormLabel className="text-sm font-semibold">Видео файл</FormLabel>
                                                    </div>
                                                    {videoUrl ? (
                                                        <div className="aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-lg ring-2 ring-slate-200 group-hover:ring-blue-300 transition-all">
                                                            <video 
                                                                src={videoUrl} 
                                                                controls 
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="aspect-video flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white group-hover:border-blue-400 transition-colors">
                                                            <div className="text-center px-4">
                                                                <div className="mx-auto h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                                                    <Film className="h-7 w-7 text-slate-400" />
                                                                </div>
                                                                <p className="text-sm font-medium text-slate-600 mb-1">Видео байршуулаагүй байна</p>
                                                                <p className="text-xs text-muted-foreground">Видео файлаа оруулна уу</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Upload Progress */}
                                                    {isUploading && (
                                                        <div className="space-y-3 p-4 border-2 border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-white shadow-sm">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                    Байршуулж байна...
                                                                </span>
                                                                <span className="text-sm font-bold text-blue-600">{uploadingVideos[index]}%</span>
                                                            </div>
                                                            <Progress 
                                                                value={uploadingVideos[index]} 
                                                                className="h-2.5 bg-blue-100"
                                                            />
                                                            <p className="text-xs text-blue-600 text-center">Та түр хүлээнэ үү...</p>
                                                        </div>
                                                    )}

                                                    {/* Video Actions */}
                                                    <div className="flex gap-2">
                                                        <Button 
                                                            type="button" 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="flex-1"
                                                            onClick={() => document.getElementById(`video-upload-${index}`)?.click()} 
                                                            disabled={isUploading}
                                                        >
                                                            {isUploading ? (
                                                                <>
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    Байршуулж байна
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Upload className="mr-2 h-4 w-4" />
                                                                    {videoUrl ? 'Солих' : 'Видео оруулах'}
                                                                </>
                                                            )}
                                                        </Button>
                                                        <input 
                                                            id={`video-upload-${index}`} 
                                                            type="file" 
                                                            accept="video/*" 
                                                            className="hidden" 
                                                            onChange={(e) => handleVideoUpload(e, index)} 
                                                        />
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button 
                                                                    type="button" 
                                                                    variant="destructive" 
                                                                    size="sm"
                                                                    disabled={isUploading}
                                                                    className="px-3"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="flex items-center gap-2">
                                                                        <AlertCircle className="h-5 w-5 text-destructive" />
                                                                        Та итгэлтэй байна уу?
                                                                    </AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Энэ видеог устгаснаар дахин сэргээх боломжгүй болно. Энэ үйлдлийг буцаах боломжгүй.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => remove(index)}
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                    >
                                                                        Устгах
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                    <FormField control={form.control} name={`videos.${index}.url`} render={() => (<FormMessage />)} />
                                                </div>

                                                {/* Form Fields Section */}
                                                <div className="space-y-5">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                                                            <Film className="h-4 w-4 text-purple-600" />
                                                        </div>
                                                        <FormLabel className="text-sm font-semibold">Мэдээлэл</FormLabel>
                                                    </div>
                                                    <FormField 
                                                        control={form.control} 
                                                        name={`videos.${index}.title`} 
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-sm font-medium">Гарчиг</FormLabel>
                                                                <FormControl>
                                                                    <Input 
                                                                        placeholder="Жишээ: Компанийн танилцуулга" 
                                                                        className="h-11 border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                                                                        {...field} 
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} 
                                                    />
                                                    <FormField 
                                                        control={form.control} 
                                                        name={`videos.${index}.description`} 
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-sm font-medium">Товч тайлбар</FormLabel>
                                                                <FormControl>
                                                                    <Textarea 
                                                                        placeholder="Энэ видеонд юу гардаг вэ? Товч тайлбар бичнэ үү..." 
                                                                        className="min-h-[120px] resize-none border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                                                                        {...field} 
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                
                                {/* Add Video Button */}
                                <div className="flex justify-center pt-2">
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="lg"
                                        className="h-12 px-6 border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all"
                                        onClick={() => append({ title: '', description: '', url: '' })} 
                                    >
                                        <PlusCircle className="mr-2 h-5 w-5" />
                                        Видео нэмэх
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </form>
        </Form>
    );
}

const defaultFormValues: VideosFormValues = {
    videos: [],
};

export default function EditCompanyVideosPage() {
    const { firestore } = useFirebase();

    const companyProfileRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
        []
    );

    const { data: companyProfile, isLoading: isLoadingProfile } = useDoc<VideosFormValues>(companyProfileRef);

    if (isLoadingProfile) {
        return (
            <div className="py-8">
                <VideoFormSkeleton />
            </div>
        )
    }

    const initialData = companyProfile || defaultFormValues;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-0 md:pt-0 scroll-smooth">
                <EditVideosForm initialData={initialData} />
            </div>
        </div>
    );
}
