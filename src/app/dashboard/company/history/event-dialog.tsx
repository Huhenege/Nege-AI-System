'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useFirebase, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { doc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Save, Image, X, PlusCircle, Video, Upload, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CompanyHistoryEvent } from '@/types/company-history';
import { ScrollArea } from '@/components/ui/scroll-area';

const eventSchema = z.object({
    title: z.string().min(1, 'Гарчиг оруулна уу'),
    description: z.string().min(1, 'Тайлбар оруулна уу'),
    startDate: z.string().min(1, 'Эхлэх огноо оруулна уу'),
    endDate: z.string().optional(),
    imageUrls: z.array(z.string()).default([]),
    videoUrls: z.array(z.string()).default([]),
    isActive: z.boolean().default(true),
});

type EventFormValues = z.infer<typeof eventSchema>;

interface EventDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: CompanyHistoryEvent | null;
}

export function EventDialog({ open, onOpenChange, event }: EventDialogProps) {
    const { firestore, storage } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [isUploading, setIsUploading] = React.useState(false);
    const [newVideoUrl, setNewVideoUrl] = React.useState('');

    const isEditing = !!event;

    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventSchema),
        defaultValues: {
            title: '',
            description: '',
            startDate: '',
            endDate: '',
            imageUrls: [],
            videoUrls: [],
            isActive: true,
        },
    });

    // Reset form when event changes
    React.useEffect(() => {
        if (event) {
            form.reset({
                title: event.title || '',
                description: event.description || '',
                startDate: event.startDate || '',
                endDate: event.endDate || '',
                imageUrls: event.imageUrls || [],
                videoUrls: event.videoUrls || [],
                isActive: event.isActive ?? true,
            });
        } else {
            form.reset({
                title: '',
                description: '',
                startDate: '',
                endDate: '',
                imageUrls: [],
                videoUrls: [],
                isActive: true,
            });
        }
    }, [event, form]);

    const { isSubmitting } = form.formState;
    const imageUrls = form.watch('imageUrls');
    const videoUrls = form.watch('videoUrls');

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !storage) return;

        setIsUploading(true);
        const newUrls: string[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const eventId = event?.id || `new-${Date.now()}`;
                const storageRef = ref(storage, `company-history/${eventId}/${Date.now()}-${file.name}`);
                await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(storageRef);
                newUrls.push(downloadURL);
            }

            form.setValue('imageUrls', [...imageUrls, ...newUrls]);
            toast({ title: 'Зураг амжилттай нэмэгдлээ' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Зураг байршуулахад алдаа гарлаа' });
        } finally {
            setIsUploading(false);
        }
    };

    const removeImage = (index: number) => {
        const newUrls = imageUrls.filter((_, i) => i !== index);
        form.setValue('imageUrls', newUrls);
    };

    const addVideoUrl = () => {
        if (!newVideoUrl.trim()) return;
        
        // Basic YouTube URL validation
        if (!newVideoUrl.includes('youtube.com') && !newVideoUrl.includes('youtu.be')) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Зөвхөн YouTube холбоос оруулна уу' });
            return;
        }

        form.setValue('videoUrls', [...videoUrls, newVideoUrl.trim()]);
        setNewVideoUrl('');
    };

    const removeVideo = (index: number) => {
        const newUrls = videoUrls.filter((_, i) => i !== index);
        form.setValue('videoUrls', newUrls);
    };

    const getYouTubeThumbnail = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        const videoId = match && match[2].length === 11 ? match[2] : null;
        if (videoId) {
            return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        }
        return null;
    };

    const onSubmit = async (values: EventFormValues) => {
        if (!firestore) return;

        try {
            const now = Timestamp.now();
            
            if (isEditing && event) {
                // Update existing
                const eventRef = tDoc('companyHistory', event.id);
                updateDocumentNonBlocking(eventRef, {
                    ...values,
                    updatedAt: now,
                });
                toast({ title: 'Амжилттай шинэчлэгдлээ' });
            } else {
                // Create new
                const newEventRef = doc(tCollection('companyHistory'));
                setDocumentNonBlocking(newEventRef, {
                    ...values,
                    order: Date.now(),
                    createdAt: now,
                    updatedAt: now,
                });
                toast({ title: 'Амжилттай нэмэгдлээ' });
            }

            onOpenChange(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Хадгалахад алдаа гарлаа' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle>
                        {isEditing ? 'Үйл явдал засах' : 'Шинэ үйл явдал нэмэх'}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(90vh-140px)]">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6">
                            {/* Title */}
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Гарчиг *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Жишээ: Компани байгуулагдсан" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Description */}
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Тайлбар *</FormLabel>
                                        <FormControl>
                                            <Textarea 
                                                placeholder="Үйл явдлын дэлгэрэнгүй тайлбар..."
                                                className="min-h-[100px] resize-none"
                                                {...field} 
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="startDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Эхлэх огноо *</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="endDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Дуусах огноо</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormDescription className="text-xs">
                                                Хэрэв нэг өдрийн үйл явдал бол хоосон орхино
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Images */}
                            <div className="space-y-3">
                                <FormLabel className="flex items-center gap-2">
                                    <Image className="h-4 w-4" />
                                    Зургууд
                                </FormLabel>
                                
                                {/* Image previews */}
                                {imageUrls.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {imageUrls.map((url, index) => (
                                            <div key={index} className="relative group aspect-square">
                                                <img 
                                                    src={url} 
                                                    alt={`Image ${index + 1}`}
                                                    className="w-full h-full object-cover rounded-lg"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
                                                    className="absolute top-1 right-1 h-6 w-6 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Upload button */}
                                <div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageUpload}
                                        className="hidden"
                                        id="image-upload"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => document.getElementById('image-upload')?.click()}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Upload className="h-4 w-4 mr-2" />
                                        )}
                                        Зураг нэмэх
                                    </Button>
                                </div>
                            </div>

                            {/* Videos */}
                            <div className="space-y-3">
                                <FormLabel className="flex items-center gap-2">
                                    <Video className="h-4 w-4" />
                                    Видео (YouTube)
                                </FormLabel>

                                {/* Video list */}
                                {videoUrls.length > 0 && (
                                    <div className="space-y-2">
                                        {videoUrls.map((url, index) => {
                                            const thumbnail = getYouTubeThumbnail(url);
                                            return (
                                                <div key={index} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                                                    {thumbnail && (
                                                        <img 
                                                            src={thumbnail} 
                                                            alt="Video thumbnail"
                                                            className="h-12 w-20 object-cover rounded"
                                                        />
                                                    )}
                                                    <span className="flex-1 text-sm truncate">{url}</span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive"
                                                        onClick={() => removeVideo(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Add video URL */}
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="YouTube URL оруулах..."
                                        value={newVideoUrl}
                                        onChange={(e) => setNewVideoUrl(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addVideoUrl();
                                            }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={addVideoUrl}
                                    >
                                        <PlusCircle className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Active toggle */}
                            <FormField
                                control={form.control}
                                name="isActive"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                        <div>
                                            <FormLabel>Идэвхтэй</FormLabel>
                                            <FormDescription className="text-xs">
                                                Идэвхгүй бол ажилтны апп дээр харагдахгүй
                                            </FormDescription>
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
                        </form>
                    </Form>
                </ScrollArea>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/20">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Цуцлах
                    </Button>
                    <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting || isUploading}>
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        {isEditing ? 'Хадгалах' : 'Нэмэх'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
