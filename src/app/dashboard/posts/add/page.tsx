'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/patterns/page-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { useFirebase, useUser, addDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Loader2,
  Save,
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  FileEdit,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import Image from 'next/image';

const postSchema = z.object({
  title: z.string().min(1, 'Гарчиг хоосон байж болохгүй.'),
  content: z.string().min(1, 'Агуулга хоосон байж болохгүй.'),
  imageUrls: z.array(z.string()).optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

export default function AddPostPage() {
  return (
    <React.Suspense fallback={
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Ачаалж байна...</p>
      </div>
    }>
      <AddPostContent />
    </React.Suspense>
  );
}

function AddPostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firestore, firebaseApp } = useFirebase();
  const { user } = useUser();
  const { tCollection } = useTenantWrite();
  const { employeeProfile } = useEmployeeProfile();
  const { toast } = useToast();
  const [imagePreviews, setImagePreviews] = React.useState<string[]>([]);
  const [imageFiles, setImageFiles] = React.useState<File[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [autoSaving, setAutoSaving] = React.useState(false);

  const isDraftFromEvent = searchParams.get('draft') === '1';
  const eventTitle = searchParams.get('title') || '';
  const eventContent = searchParams.get('content') || '';
  const eventDate = searchParams.get('date') || '';

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: isDraftFromEvent ? eventTitle : '',
      content: isDraftFromEvent
        ? (eventContent ? `📅 ${eventDate}\n\n${eventContent}` : `📅 ${eventDate}\n\n${eventTitle} - дэлгэрэнгүй мэдээлэл энд бичнэ.`)
        : '',
      imageUrls: [],
    },
  });

  const { isSubmitting } = form.formState;

  React.useEffect(() => {
    if (!isDraftFromEvent || !firestore || !user || !employeeProfile || autoSaving) return;
    setAutoSaving(true);

    const autoSaveDraft = async () => {
      const postsCollection = tCollection('posts');
      const content = eventContent
        ? `📅 ${eventDate}\n\n${eventContent}`
        : `📅 ${eventDate}\n\n${eventTitle} - дэлгэрэнгүй мэдээлэл энд бичнэ.`;

      try {
        const docRef = await addDocumentNonBlocking(postsCollection, {
          title: eventTitle,
          content,
          imageUrls: [],
          status: 'draft',
          authorName: `${employeeProfile.firstName} ${employeeProfile.lastName}`,
          createdAt: new Date().toISOString(),
          likes: [],
          sourceEventTitle: eventTitle,
        });

        if (docRef) {
          toast({ title: 'Ноорог үүсгэгдлээ', description: 'Үйл явдлын мэдээлэл ноорог болгон хадгалагдлаа.' });
          router.replace(`/dashboard/posts/edit/${docRef.id}`);
        }
      } catch {
        toast({ title: 'Алдаа', description: 'Ноорог хадгалахад алдаа гарлаа.', variant: 'destructive' });
        setAutoSaving(false);
      }
    };

    autoSaveDraft();
  }, [isDraftFromEvent, firestore, user, employeeProfile]);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setImageFiles((prevFiles) => [...prevFiles, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setImagePreviews((prevPreviews) => [...prevPreviews, ...newPreviews]);
    }
  };
  
  const handleRemoveImage = (index: number) => {
    setImageFiles(files => files.filter((_, i) => i !== index));
    setImagePreviews(previews => previews.filter((_, i) => i !== index));
  }

  const savePost = async (values: PostFormValues, status: 'published' | 'draft') => {
    if (!firestore || !employeeProfile) return;

    setIsUploading(true);
    const imageUrls: string[] = [];
    if (imageFiles.length > 0) {
        if (!firebaseApp) {
          throw new Error('Firebase app init хийгдээгүй байна.');
        }
        const storage = getStorage(firebaseApp);
        for (const file of imageFiles) {
            const storageRef = ref(storage, `posts/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            imageUrls.push(downloadURL);
        }
    }
    setIsUploading(false);

    const postsCollection = tCollection('posts');
    await addDocumentNonBlocking(postsCollection, {
      ...values,
      imageUrls,
      status,
      authorName: `${employeeProfile.firstName} ${employeeProfile.lastName}`,
      createdAt: new Date().toISOString(),
      likes: [],
    });

    toast({
      title: status === 'draft' ? 'Ноорог хадгалагдлаа' : 'Амжилттай нийтлэгдлээ',
      description: status === 'draft' ? 'Нийтлэл ноорог байдлаар хадгалагдлаа.' : 'Шинэ нийтлэл самбарт нэмэгдлээ.',
    });

    router.push('/dashboard/posts');
  };

  const handleSave = async (values: PostFormValues) => {
    await savePost(values, 'published');
  };

  const handleSaveDraft = async () => {
    const values = form.getValues();
    if (!values.title?.trim()) {
      toast({ title: 'Гарчиг шаардлагатай', description: 'Ноорог хадгалахын тулд гарчиг оруулна уу.', variant: 'destructive' });
      return;
    }
    await savePost({ ...values, content: values.content || '' }, 'draft');
  };

  if (autoSaving) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Ноорог нийтлэл үүсгэж байна...</p>
      </div>
    );
  }

  return (
    <div className="py-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
          <div className="mb-4">
            <PageHeader
              title="Шинэ нийтлэл нэмэх"
              showBackButton
              hideBreadcrumbs
              backButtonPlacement="inline"
              backBehavior="history"
              fallbackBackHref="/dashboard/posts"
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => router.push('/dashboard/posts')}
                    disabled={isSubmitting || isUploading}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Цуцлах
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSubmitting || isUploading}
                  >
                    <FileEdit className="mr-2 h-4 w-4" />
                    Ноорог
                  </Button>
                  <Button type="submit" disabled={isSubmitting || isUploading}>
                    {isSubmitting || isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Нийтлэх
                  </Button>
                </div>
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Нийтлэлийн агуулга</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Гарчиг</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Нийтлэлийн сэтгэл татам гарчиг"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дэлгэрэнгүй агуулга</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Таны бодол, мэдээлэл..."
                        rows={10}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Зураг</CardTitle>
              <CardDescription>
                Нийтлэлдээ зураг хавсаргах (заавал биш).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {imagePreviews.map((src, index) => (
                        <div key={index} className="relative aspect-square">
                            <Image src={src} alt={`Preview ${index + 1}`} fill className="object-cover rounded-md" />
                            <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => handleRemoveImage(index)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                 </div>
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex items-center justify-center w-full rounded-md border-2 border-dashed p-8 text-muted-foreground hover:bg-muted/50"
                >
                    <div className="text-center">
                        <Upload className="mx-auto h-8 w-8" />
                        <p className="mt-2 text-sm">Зураг сонгох</p>
                    </div>
                    <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageSelect}
                    />
                </label>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
