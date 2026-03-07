'use client';

import { useCollection, useAuth, useFirestore, useTenantWrite } from '@/firebase';
import { query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { RecognitionPost } from '@/types/points'; // We'll need to update this type to include expandable fields if we join data client-side
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useMemo } from 'react';

// Component to rendering a single post
function FeedCard({ post }: { post: RecognitionPost }) {
    const firestore = useFirestore();
    const { tDoc } = useTenantWrite();

    const [sender, setSender] = useState<any>(null);
    const [receivers, setReceivers] = useState<any[]>([]);
    const [valueData, setValueData] = useState<any>(null);

    useEffect(() => {
        if (!firestore) return;

        // Fetch sender
        if (post.fromUserId) {
            getDoc(tDoc('employees', post.fromUserId)).then(s => setSender(s.data()));
        }
        // Fetch receivers (just taking first one for now if multiple)
        if (post.toUserId && post.toUserId.length > 0) {
            Promise.all(post.toUserId.map(id => getDoc(tDoc('employees', id)))).then(snaps => {
                setReceivers(snaps.map(s => s.data()));
            });
        }
        // Fetch value
        if (post.valueId) {
            getDoc(tDoc('company', 'branding', 'values', post.valueId)).then(v => setValueData(v.data()));
        }
    }, [post, firestore, tDoc]);

    if (!sender || receivers.length === 0) return <div className="animate-pulse h-40 bg-muted/20 rounded-xl mb-4" />;

    const receiverNames = receivers.map(r => `${r?.lastName || ''} ${r?.firstName || 'Ажилтан'}`).join(', ');

    return (
        <Card className="mb-4 overflow-hidden border-none shadow-sm ring-1 ring-border/50">
            <CardHeader className="p-4 pb-2 flex flex-row items-start gap-3">
                <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
                    <AvatarImage src={sender.photoURL} />
                    <AvatarFallback>{sender.firstName?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="text-sm">
                        <span className="font-semibold text-foreground">{sender.lastName || ''} {sender.firstName || 'Систем'}</span>
                        <span className="text-muted-foreground mx-1">➜</span>
                        <span className="font-semibold text-foreground">{receiverNames}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        {post.createdAt && (post.createdAt as any).toDate ? formatDistanceToNow((post.createdAt as any).toDate(), { addSuffix: true }) : 'Дөнгөж сая'}
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <Badge variant="secondary" className="font-semibold text-primary bg-primary/10 hover:bg-primary/20 gap-1 pl-1.5 pr-2.5">
                        +{post.pointAmount} <span className="opacity-70 text-[10px]">ОНОО</span>
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-0">
                <div className="ml-12">
                    {valueData && (
                        <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border"
                            style={{ borderColor: valueData.color, color: valueData.color, backgroundColor: `${valueData.color}10` }}>
                            <span>{valueData.emoji}</span> {valueData.title}
                        </div>
                    )}
                    <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{post.message}</p>
                </div>
            </CardContent>

            <CardFooter className="p-2 bg-muted/30 flex gap-4 pl-16">
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground hover:text-red-500 hover:bg-red-50">
                    <Heart className="w-4 h-4" /> <span className="text-xs">Таалагдлаа</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground">
                    <MessageCircle className="w-4 h-4" /> <span className="text-xs">Сэтгэгдэл</span>
                </Button>
            </CardFooter>
        </Card>
    );
}

// Main Feed Container
export function RecognitionFeed() {
    const firestore = useFirestore();
    const { tCollection } = useTenantWrite();
    const postsQuery = useMemo(() => firestore ? query(tCollection('recognition_posts'), orderBy('createdAt', 'desc'), limit(20)) : null, [firestore, tCollection]);
    const { data: posts, isLoading } = useCollection<RecognitionPost>(postsQuery);

    if (isLoading) return <div className="py-10 text-center text-muted-foreground">Ачааллаж байна...</div>;

    if (!posts || posts.length === 0) {
        return (
            <div className="text-center py-16 bg-muted/10 rounded-xl border border-dashed">
                <div className="text-4xl mb-3">📭</div>
                <h3 className="font-medium text-lg">Одоогоор мэдээлэл алга</h3>
                <p className="text-muted-foreground mb-4">Та анхны талархлыг илгээгээрэй!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {posts.map(post => <FeedCard key={post.id} post={post} />)}
        </div>
    );
}
