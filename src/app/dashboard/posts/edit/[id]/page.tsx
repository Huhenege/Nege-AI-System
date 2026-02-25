'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { useFirebase, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Loader2,
  Save,
  X,
  Upload,
  Trash2,
  FileImage,
  ArrowLeft,
  ThumbsUp,
  Heart,
  Smile,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Employee } from '@/app/dashboard/employees/data';

const postSchema = z.object({
  title: z.string().min(1, 'Гарчиг хоосон байж болохгүй.'),
  content: z.string().min(1, 'Агуулга хоосон байж болохгүй.'),
  imageUrls: z.array(z.string()).optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

type ReactionType = 'like' | 'love' | 'care';

type Post = PostFormValues & {
  id: string;
  reactions?: { [userId: string]: ReactionType };
};

function ReactionIcon({ type, className }: { type: ReactionType; className?: string }) {
  if (type === 'like') return <ThumbsUp className={cn('h-4 w-4 text-blue-500', className)} />;
  if (type === 'love') return <Heart className={cn('h-4 w-4 text-red-500 fill-red-500', className)} />;
  if (type === 'care') return <Smile className={cn('h-4 w-4 text-amber-500', className)} />;
  return null;
}

function PostReactionsReport({ post }: { post: Post }) {
  const { firestore } = useFirebase();
  const [details, setDetails] = React.useState<{ employee: Employee; reaction: ReactionType }[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const reactions = post.reactions || {};
  const userIds = Object.keys(reactions);

  React.useEffect(() => {
    if (!firestore || userIds.length === 0) {
      setDetails([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const list: { employee: Employee; reaction: ReactionType }[] = [];
      for (const uid of userIds) {
        const snap = await getDoc(doc(firestore, 'employees', uid));
        if (snap.exists() && !cancelled) {
          list.push({ employee: snap.data() as Employee, reaction: reactions[uid] });
        }
      }
      if (!cancelled) {
        setDetails(list);
      }
      setIsLoading(false);
    };
    setIsLoading(true);
    load();
    return () => { cancelled = true; };
  }, [firestore, post.id, JSON.stringify(post.reactions || {})]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    );
  }

  if (details.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Ажилчид эможи дарсан байхгүй байна.
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[400px] overflow-y-auto">
      {details.map(({ employee, reaction }) => (
        <div
          key={employee.id}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={employee.photoURL} />
            <AvatarFallback className="text-xs">{employee.firstName?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {employee.firstName} {employee.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{employee.employeeCode}</p>
          </div>
          <ReactionIcon type={reaction} />
        </div>
      ))}
    </div>
  );
}

function EditFormSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-4 w-24" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1">
        <Card className="border-0 shadow-sm sticky top-4">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-4" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function EditPostPage() {
  const router = useRouter();
  const { id } = useParams();
  const postId = Array.isArray(id) ? id[0] : id;

  const { firestore } = useFirebase();
  const { toast } = useToast();

  const postDocRef = React.useMemo(() => (firestore && postId ? doc(firestore, 'posts', postId) : null), [firestore, postId]);
  const { data: post, isLoading: isLoadingPost } = useDoc<Post>(postDocRef);
  
  const [imageFiles, setImageFiles] = React.useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = React.useState<string[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
        title: '',
        content: '',
        imageUrls: [],
    }
  });

  React.useEffect(() => {
      if (post) {
          form.reset(post);
          setExistingImageUrls(post.imageUrls || []);
      }
  }, [post, form]);

  const { isSubmitting } = form.formState;
  
  const localImagePreviews = React.useMemo(() => imageFiles.map(file => URL.createObjectURL(file)), [imageFiles]);
  const allImagePreviews = [...existingImageUrls, ...localImagePreviews];


  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setImageFiles(prev => [...prev, ...newFiles]);
    }
  };
  
  const handleRemoveImage = (index: number) => {
      if (index < existingImageUrls.length) {
          // It's an existing image, just remove its URL
          setExistingImageUrls(urls => urls.filter((_, i) => i !== index));
      } else {
          // It's a new local file
          const localIndex = index - existingImageUrls.length;
          setImageFiles(files => files.filter((_, i) => i !== localIndex));
      }
  }


  const handleSave = async (values: PostFormValues) => {
    if (!postDocRef) return;

    setIsUploading(true);
    
    // Upload new files
    const newImageUrls: string[] = [];
    if (imageFiles.length > 0) {
        const storage = getStorage();
        for (const file of imageFiles) {
            const storageRef = ref(storage, `posts/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            newImageUrls.push(downloadURL);
        }
    }
    setIsUploading(false);
    
    const finalImageUrls = [...existingImageUrls, ...newImageUrls];

    updateDocumentNonBlocking(postDocRef, {
        ...values,
        imageUrls: finalImageUrls,
    });

    toast({
      title: 'Амжилттай хадгаллаа',
      description: 'Нийтлэл шинэчлэгдлээ.',
    });

    router.push('/dashboard/posts');
  };

  const handleDelete = async () => {
    if (!postDocRef || !postId) return;
    setDeleting(true);
    try {
      await deleteDoc(postDocRef);
      toast({
        title: 'Нийтлэл устгагдлаа',
        description: 'Пост амжилттай устгалаа.',
      });
      router.push('/dashboard/posts');
    } catch (error) {
      console.error('Delete post error:', error);
      toast({
        title: 'Устгахад алдаа гарлаа',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (isLoadingPost) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-8 pb-32">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
          <EditFormSkeleton />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-8 flex items-center justify-center">
          <Card className="max-w-md w-full border-0 shadow-sm">
            <CardContent className="pt-6 text-center">
              <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-4">
                <FileImage className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="font-medium">Нийтлэл олдсонгүй</p>
              <p className="text-sm text-muted-foreground mt-1">Энэ нийтлэл устгагдсан эсвэл холбоос буруу байж магадгүй.</p>
              <Button asChild variant="outline" className="mt-6">
                <Link href="/dashboard/posts">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Нийтлэлүүд рүү буцах
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 md:p-8 pb-32">
        <PageHeader
          title="Нийтлэл засах"
          description={post.title ? (post.title.length > 50 ? `"${post.title.slice(0, 50)}…"` : `"${post.title}"`) : undefined}
          showBackButton
          hideBreadcrumbs
          backButtonPlacement="inline"
          backBehavior="history"
          fallbackBackHref="/dashboard/posts"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isSubmitting || isUploading || deleting}
              >
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Устгах
              </Button>
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
                type="submit"
                form="post-edit-form"
                disabled={isSubmitting || isUploading}
              >
                {isSubmitting || isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Хадгалах
              </Button>
            </div>
          }
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Нийтлэлийг устгах уу?</AlertDialogTitle>
              <AlertDialogDescription>
                Энэ нийтлэлийг бүрмөсөн устгана. Энэ үйлдлийг буцааж болохгүй.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Цуцлах</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Устгаж байна...' : 'Устгах'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2">
            <Form {...form}>
              <form id="post-edit-form" onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6 space-y-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Гарчиг</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Нийтлэлийн сэтгэл татам гарчиг"
                              className="text-base h-11"
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
                          <FormLabel>Агуулга</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Таны бодол, мэдээлэл..."
                              rows={12}
                              className="resize-y min-h-[200px] text-base"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Зураг</CardTitle>
                    <CardDescription>
                      Нийтлэлдээ зураг нэмэх (заавал биш). Олон зураг сонгох боломжтой.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {allImagePreviews.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {allImagePreviews.map((src, index) => (
                          <div
                            key={typeof src === 'string' && src.startsWith('blob:') ? `blob-${index}` : src}
                            className="group relative aspect-square rounded-lg overflow-hidden bg-muted border"
                          >
                            {src.startsWith('blob:') ? (
                              <img src={src} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                            ) : (
                              <Image
                                src={src}
                                alt={`Preview ${index + 1}`}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 50vw, 25vw"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              className={cn(
                                "absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity",
                                "hover:bg-destructive focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
                              )}
                              aria-label="Зураг хасах"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <label
                      htmlFor="image-upload"
                      className={cn(
                        "cursor-pointer flex flex-col items-center justify-center w-full rounded-lg border-2 border-dashed transition-colors",
                        "p-8 text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/30",
                        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                      )}
                    >
                      <Upload className="h-10 w-10 mb-3" />
                      <p className="text-sm font-medium">Зураг нэмэх</p>
                      <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG эсвэл WebP</p>
                      <Input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageSelect}
                      />
                    </label>
                  </CardContent>
                </Card>
              </form>
            </Form>
          </div>

          <div className="lg:col-span-1">
            <Card className="border-0 shadow-sm sticky top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Эможи тайлан</CardTitle>
                <CardDescription>
                  Энэ нийтлэл дээр ажилчид дарсан эможигийн тайлан
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PostReactionsReport post={post} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
