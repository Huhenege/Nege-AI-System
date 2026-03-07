'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Newspaper, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import Image from 'next/image';
import { PageHeader } from '@/components/patterns/page-layout';

type Post = {
  id: string;
  title: string;
  imageUrl?: string;
  imageUrls?: string[];
  authorName: string;
  createdAt: string;
};

function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/dashboard/posts/edit/${post.id}`}>
      <Card className="group overflow-hidden bg-white dark:bg-slate-900/50 rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
        <div className="aspect-video relative bg-muted">
          {(post.imageUrls?.[0] ?? post.imageUrl) ? (
            <Image
              src={post.imageUrls?.[0] ?? post.imageUrl ?? ''}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="h-16 w-16 text-muted-foreground opacity-50" />
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold line-clamp-2 text-base">{post.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{post.authorName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(post.createdAt), 'yyyy.MM.dd, HH:mm')}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PostsPage() {
  const { firestore } = useFirebase();
  const postsQuery = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'posts'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );
  const {
    data: posts,
    isLoading,
    error,
  } = useCollection<Post>(postsQuery);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 pb-32">
        <PageHeader
          title="Нийтлэлийн самбар"
          description="Байгууллагын дотоод мэдээ, мэдээллийг удирдах хэсэг."
          showBackButton={true}
          hideBreadcrumbs={true}
          backButtonPlacement="inline"
          backBehavior="history"
          fallbackBackHref="/dashboard"
          actions={
            <AddActionButton
              label="Шинэ нийтлэл"
              description="Шинэ нийтлэл нэмэх"
              href="/dashboard/posts/add"
            />
          }
        />

        {!isLoading && !error && (!posts || posts.length === 0) ? (
          <Card className="bg-white dark:bg-slate-900/50 rounded-xl border shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Newspaper className="h-10 w-10 opacity-50" />
              </div>
              <p className="font-medium text-muted-foreground">Одоогоор нийтлэл байхгүй байна.</p>
              <Button asChild variant="link" className="mt-2">
                <Link href="/dashboard/posts/add">Анхны нийтлэлээ үүсгэх</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden bg-white dark:bg-slate-900/50 rounded-xl border shadow-sm">
                  <Skeleton className="aspect-video w-full" />
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            {error && (
              <div className="col-span-full py-12 text-center text-destructive">
                Алдаа гарлаа: {error.message}
              </div>
            )}
            {!isLoading && !error && posts && posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
