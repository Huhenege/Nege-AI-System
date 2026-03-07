'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { firestore, firebaseApp } = useFirebase();
  const { tCollection } = useTenantWrite();
  const { employeeProfile } = useEmployeeProfile();
  const { toast } = useToast();
  const [imagePreviews, setImagePreviews] = React.useState<string[]>([]);
  const [imageFiles, setImageFiles] = React.useState<File[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      content: '',
      imageUrls: [],
    },
  });

  const { isSubmitting } = form.formState;

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

  const handleSave = async (values: PostFormValues) => {
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
      authorName: `${employeeProfile.firstName} ${employeeProfile.lastName}`,
      createdAt: new Date().toISOString(),
      likes: [],
    });

    toast({
      title: 'Амжилттай хадгаллаа',
      description: 'Шинэ нийтлэл самбарт нэмэгдлээ.',
    });

    router.push('/dashboard/posts');
  };

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
