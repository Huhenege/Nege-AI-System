'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { MessageCircle, Send, AtSign, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';

import {
    useFirebase,
    useMemoFirebase,
    useCollection,
    addDocumentNonBlocking,
    tenantCollection,
    useTenantWrite,
} from '@/firebase';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { ProjectMessage } from '@/types/project';
import { Employee } from '@/types';

interface ProjectChatSectionProps {
    projectId: string;
    teamMembers: Employee[];
    employeeMap: Map<string, Employee>;
}

export function ProjectChatSection({ projectId, teamMembers, employeeMap }: ProjectChatSectionProps) {
    const { firestore, user } = useFirebase();
    const { tCollection } = useTenantWrite();
    const [message, setMessage] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const [mentionOpen, setMentionOpen] = React.useState(false);
    const [mentionSearch, setMentionSearch] = React.useState('');
    const [mentions, setMentions] = React.useState<string[]>([]);
    const [cursorPosition, setCursorPosition] = React.useState(0);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Fetch messages in real-time
    const messagesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore && projectId
            ? query(
                collection(firestore, companyPath ? `${companyPath}/projects` : 'projects', projectId, 'messages'),
                orderBy('createdAt', 'asc')
            )
            : null,
        [firestore, projectId]
    );
    const { data: messages, isLoading } = useCollection<ProjectMessage>(messagesQuery);

    // Auto-scroll to bottom when new messages arrive
    React.useEffect(() => {
        if (scrollRef.current) {
            const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollElement) {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }
        }
    }, [messages]);

    // Filter team members for mention popover
    const filteredMembers = React.useMemo(() => {
        if (!mentionSearch) return teamMembers;
        const search = mentionSearch.toLowerCase();
        return teamMembers.filter(m => 
            m.firstName?.toLowerCase().includes(search) ||
            m.lastName?.toLowerCase().includes(search)
        );
    }, [teamMembers, mentionSearch]);

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const pos = e.target.selectionStart || 0;
        setMessage(value);
        setCursorPosition(pos);

        // Check if we should open mention popover
        const textBeforeCursor = value.slice(0, pos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        
        if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
            // Only open if there's no space after @ (user is typing a mention)
            if (!textAfterAt.includes(' ')) {
                setMentionSearch(textAfterAt);
                setMentionOpen(true);
                return;
            }
        }
        setMentionOpen(false);
        setMentionSearch('');
    };

    // Handle mention selection
    const handleMentionSelect = (member: Employee) => {
        if (!member.id) return;

        const textBeforeCursor = message.slice(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        const textAfterCursor = message.slice(cursorPosition);

        const mentionText = `@${member.firstName} `;
        const newMessage = message.slice(0, lastAtIndex) + mentionText + textAfterCursor;
        
        setMessage(newMessage);
        setMentions(prev => [...new Set([...prev, member.id!])]);
        setMentionOpen(false);
        setMentionSearch('');

        // Focus back on input
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const newPos = lastAtIndex + mentionText.length;
                inputRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    // Handle send message
    const handleSend = async () => {
        if (!firestore || !projectId || !user || !message.trim()) return;

        setIsSending(true);
        try {
            const messageData = {
                projectId,
                content: message.trim(),
                senderId: user.uid,
                mentions,
                createdAt: Timestamp.now(),
            };

            await addDocumentNonBlocking(
                tCollection('projects', projectId, 'messages'),
                messageData
            );

            setMessage('');
            setMentions([]);
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    // Handle enter key
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !mentionOpen) {
            e.preventDefault();
            handleSend();
        }
    };

    // Format message content with highlighted mentions
    const formatMessageContent = (content: string, messageMentions: string[]) => {
        if (!messageMentions || messageMentions.length === 0) {
            return content;
        }

        // Find and highlight @mentions in the content
        const parts = content.split(/(@\S+)/g);
        return parts.map((part, index) => {
            if (part.startsWith('@')) {
                return (
                    <span key={index} className="text-violet-600 dark:text-violet-400 font-medium">
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    // Format timestamp
    const formatTime = (timestamp: any) => {
        if (!timestamp) return '';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const isToday = date.toDateString() === now.toDateString();
            
            if (isToday) {
                return format(date, 'HH:mm');
            }
            return format(date, 'MM/dd HH:mm');
        } catch {
            return '';
        }
    };

    return (
        <div className="flex flex-col min-h-[480px]">
            {/* Chat Card — мессежүүд гүйлгэгддэг, хамгийн өндөр боломжит зай */}
            <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                            <MessageCircle className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-semibold">Төслийн чат</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Багийн гишүүдтэй харилцах
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1 min-h-0 overflow-hidden p-0 flex flex-col">
                    <ScrollArea ref={scrollRef} className="h-[400px] pr-4 shrink-0">
                        <div className="p-4 pt-0">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : messages && messages.length > 0 ? (
                                <div className="space-y-4">
                                    {messages.map((msg) => {
                                        const sender = employeeMap.get(msg.senderId);
                                        const isCurrentUser = user?.uid === msg.senderId;

                                        return (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    "flex gap-3",
                                                    isCurrentUser && "flex-row-reverse"
                                                )}
                                            >
                                                <Avatar className="h-8 w-8 shrink-0">
                                                    <AvatarImage src={sender?.photoURL} />
                                                    <AvatarFallback className="text-xs bg-violet-100 text-violet-600">
                                                        {sender?.firstName?.[0]}{sender?.lastName?.[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className={cn(
                                                    "max-w-[70%]",
                                                    isCurrentUser && "text-right"
                                                )}>
                                                    <div className={cn(
                                                        "flex items-center gap-2 mb-1",
                                                        isCurrentUser && "flex-row-reverse"
                                                    )}>
                                                        <span className="text-sm font-medium">
                                                            {sender ? `${sender.firstName} ${sender.lastName?.[0]}.` : 'Хэрэглэгч'}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatTime(msg.createdAt)}
                                                        </span>
                                                    </div>
                                                    <div className={cn(
                                                        "inline-block px-3 py-2 rounded-2xl text-sm",
                                                        isCurrentUser
                                                            ? "bg-violet-600 text-white rounded-tr-sm"
                                                            : "bg-slate-100 dark:bg-slate-800 rounded-tl-sm"
                                                    )}>
                                                        {formatMessageContent(msg.content, msg.mentions)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        Мессеж байхгүй байна
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Багийн гишүүдтэй харилцаж эхлээрэй
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Чат бичдэг хэсэг — картны доор */}
            <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                onClick={() => {
                                    const newMessage = message + '@';
                                    setMessage(newMessage);
                                    setMentionOpen(true);
                                    inputRef.current?.focus();
                                }}
                            >
                                <AtSign className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent 
                            className="w-[200px] p-2" 
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground px-2 pb-1">
                                    Гишүүн сонгох
                                </p>
                                {filteredMembers.length > 0 ? (
                                    filteredMembers.map((member) => (
                                        <button
                                            key={member.id}
                                            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                                            onClick={() => handleMentionSelect(member)}
                                        >
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={member.photoURL} />
                                                <AvatarFallback className="text-xs">
                                                    {member.firstName?.[0]}{member.lastName?.[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm truncate">
                                                {member.firstName} {member.lastName}
                                            </span>
                                        </button>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground px-2 py-2">
                                        Олдсонгүй
                                    </p>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Input
                        ref={inputRef}
                        value={message}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Мессеж бичих..."
                        className="flex-1"
                        disabled={isSending}
                    />

                    <Button
                        size="icon"
                        className="h-9 w-9 shrink-0 bg-violet-600 hover:bg-violet-700"
                        onClick={handleSend}
                        disabled={isSending || !message.trim()}
                    >
                        {isSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>

                {mentions.length > 0 && (
                    <div className="flex items-center gap-1">
                        <AtSign className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                            {mentions.length} хүн дурдсан
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
