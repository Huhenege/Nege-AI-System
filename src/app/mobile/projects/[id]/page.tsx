'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    useFirebase,
    useCollection,
    useMemoFirebase,
    useDoc,
    updateDocumentNonBlocking,
    addDocumentNonBlocking,
    tenantCollection,
    tenantDoc,
    useTenantWrite,
} from '@/firebase';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { collection, query, orderBy, Timestamp, DocumentReference } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    ChevronLeft,
    Calendar,
    Users,
    Clock,
    ListTodo,
    MessageCircle,
    Send,
    AtSign,
    Loader2,
    Circle,
    CheckCircle,
    Info,
    ChevronDown,
    ChevronUp,
    Plus,
} from 'lucide-react';
import { CreateTaskSheet } from '../components';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
    Project,
    Task,
    ProjectMessage,
    PROJECT_STATUS_LABELS,
    TaskStatus,
} from '@/types/project';
import { Employee } from '@/types';

export default function MobileProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const { firestore, user } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { employeeProfile } = useEmployeeProfile();
    
    // UI States
    const [isInfoExpanded, setIsInfoExpanded] = React.useState(false);
    const [isChatExpanded, setIsChatExpanded] = React.useState(true);
    const [taskFilter, setTaskFilter] = React.useState<'all' | 'mine'>('all');
    const [showCreateTask, setShowCreateTask] = React.useState(false);

    // Chat state
    const [message, setMessage] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const [mentionOpen, setMentionOpen] = React.useState(false);
    const [mentionSearch, setMentionSearch] = React.useState('');
    const [mentions, setMentions] = React.useState<string[]>([]);
    const [cursorPosition, setCursorPosition] = React.useState(0);
    const chatScrollRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Fetch project
    const projectRef = useMemoFirebase(
        ({ companyPath }) => firestore && projectId
            ? tenantDoc(firestore, companyPath, 'projects', projectId) as DocumentReference<Project>
            : null,
        [firestore, projectId]
    );
    const { data: project, isLoading: isProjectLoading } = useDoc<Project>(projectRef);

    // Fetch tasks
    const tasksQuery = useMemoFirebase(
        ({ companyPath }) => firestore && projectId
            ? query(
                collection(firestore, companyPath ? `${companyPath}/projects` : 'projects', projectId, 'tasks'),
                orderBy('createdAt', 'desc')
            )
            : null,
        [firestore, projectId]
    );
    const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

    // Fetch messages
    const messagesQuery = useMemoFirebase(
        ({ companyPath }) => firestore && projectId
            ? query(
                collection(firestore, companyPath ? `${companyPath}/projects` : 'projects', projectId, 'messages'),
                orderBy('createdAt', 'asc')
            )
            : null,
        [firestore, projectId]
    );
    const { data: messages } = useCollection<ProjectMessage>(messagesQuery);

    // Fetch all employees
    const employeesQuery = useMemoFirebase(
        ({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        [firestore]
    );
    const { data: employees } = useCollection<Employee>(employeesQuery);
    const employeeMap = React.useMemo(() => {
        const map = new Map<string, Employee>();
        employees?.forEach(e => e.id && map.set(e.id, e));
        return map;
    }, [employees]);

    // Team members
    const teamMembers = React.useMemo(() => {
        if (!project?.teamMemberIds || !employees) return [];
        return employees.filter(e => e.id && project.teamMemberIds.includes(e.id));
    }, [project?.teamMemberIds, employees]);

    // Filter tasks
    const filteredTasks = React.useMemo(() => {
        if (!tasks) return [];
        if (taskFilter === 'mine' && user) {
            return tasks.filter(t => 
                t.assigneeIds?.includes(user.uid) || t.ownerId === user.uid
            );
        }
        return tasks;
    }, [tasks, taskFilter, user]);

    // Task stats
    const taskStats = React.useMemo(() => {
        if (!tasks) return { total: 0, todo: 0, inProgress: 0, done: 0 };
        return {
            total: tasks.length,
            todo: tasks.filter(t => t.status === 'TODO').length,
            inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
            done: tasks.filter(t => t.status === 'DONE').length,
        };
    }, [tasks]);

    // My tasks count
    const myTasksCount = React.useMemo(() => {
        if (!tasks || !user) return 0;
        return tasks.filter(t => 
            t.assigneeIds?.includes(user.uid) || t.ownerId === user.uid
        ).length;
    }, [tasks, user]);

    const progressPercent = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;

    // Auto-scroll chat
    React.useEffect(() => {
        if (chatScrollRef.current && isChatExpanded) {
            setTimeout(() => {
                const scrollElement = chatScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
                if (scrollElement) {
                    scrollElement.scrollTop = scrollElement.scrollHeight;
                }
            }, 100);
        }
    }, [messages, isChatExpanded]);

    // Filter team members for mention
    const filteredMembers = React.useMemo(() => {
        if (!mentionSearch) return teamMembers;
        const search = mentionSearch.toLowerCase();
        return teamMembers.filter(m =>
            m.firstName?.toLowerCase().includes(search) ||
            m.lastName?.toLowerCase().includes(search)
        );
    }, [teamMembers, mentionSearch]);

    // Handle task status change
    const handleTaskStatusChange = async (task: Task, newStatus: TaskStatus) => {
        if (!firestore || !projectId) return;
        const taskRef = tDoc('projects', projectId, 'tasks', task.id);
        const updateData: any = {
            status: newStatus,
            updatedAt: Timestamp.now(),
        };
        if (newStatus === 'DONE') {
            updateData.completedAt = Timestamp.now();
        }
        await updateDocumentNonBlocking(taskRef, updateData);
    };

    // Chat functions
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const pos = e.target.selectionStart || 0;
        setMessage(value);
        setCursorPosition(pos);

        const textBeforeCursor = value.slice(0, pos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
            if (!textAfterAt.includes(' ')) {
                setMentionSearch(textAfterAt);
                setMentionOpen(true);
                return;
            }
        }
        setMentionOpen(false);
        setMentionSearch('');
    };

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

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const newPos = lastAtIndex + mentionText.length;
                inputRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const handleSend = async () => {
        if (!firestore || !projectId || !user || !message.trim()) return;

        setIsSending(true);
        try {
            await addDocumentNonBlocking(
                tCollection('projects', projectId, 'messages'),
                {
                    projectId,
                    content: message.trim(),
                    senderId: user.uid,
                    mentions,
                    createdAt: Timestamp.now(),
                }
            );
            setMessage('');
            setMentions([]);
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !mentionOpen) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatMessageContent = (content: string) => {
        const parts = content.split(/(@\S+)/g);
        return parts.map((part, index) => {
            if (part.startsWith('@')) {
                return <span key={index} className="text-indigo-600 font-medium">{part}</span>;
            }
            return part;
        });
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return '';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const isToday = date.toDateString() === now.toDateString();
            if (isToday) return format(date, 'HH:mm');
            return format(date, 'MM/dd HH:mm');
        } catch {
            return '';
        }
    };

    const getStatusStyle = (status: string) => {
        const styles: Record<string, { bg: string; text: string }> = {
            DRAFT: { bg: 'bg-slate-100', text: 'text-slate-600' },
            PLANNING: { bg: 'bg-slate-100', text: 'text-slate-600' },
            ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
            IN_PROGRESS: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
            ON_HOLD: { bg: 'bg-amber-100', text: 'text-amber-700' },
            COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-700' },
            ARCHIVED: { bg: 'bg-zinc-100', text: 'text-zinc-500' },
        };
        return styles[status] || styles.DRAFT;
    };

    if (isProjectLoading) {
        return (
            <div className="min-h-screen bg-slate-50 p-4 space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <p className="text-slate-400">Төсөл олдсонгүй</p>
            </div>
        );
    }

    const owner = employeeMap.get(project.ownerId);
    const statusStyle = getStatusStyle(project.status);
    const daysLeft = differenceInDays(parseISO(project.endDate), new Date());
    const isOverdue = isPast(parseISO(project.endDate)) && !['COMPLETED', 'ARCHIVED'].includes(project.status);

    // Calculate chat section height
    const chatHeight = isChatExpanded ? 'h-[280px]' : 'h-[52px]';

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <div className="bg-white/95 backdrop-blur-xl px-4 py-3 border-b border-slate-100 sticky top-0 z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-9 w-9 shrink-0">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-bold text-slate-900 truncate leading-tight">{project.name}</h1>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge className={cn("text-[9px] font-semibold border-0 px-1.5 py-0", statusStyle.bg, statusStyle.text)}>
                                {PROJECT_STATUS_LABELS[project.status] || project.status}
                            </Badge>
                            {project.type === 'onboarding' && (
                                <Badge className="text-[8px] px-1.5 py-0 bg-violet-100 text-violet-700 border-0">
                                    Onboarding
                                </Badge>
                            )}
                            {isOverdue ? (
                                <span className="text-[10px] text-red-500 font-medium">Хугацаа хэтэрсэн</span>
                            ) : daysLeft <= 7 && daysLeft >= 0 ? (
                                <span className="text-[10px] text-amber-600 font-medium">{daysLeft} хоног үлдсэн</span>
                            ) : (
                                <span className="text-[10px] text-slate-400">{format(parseISO(project.endDate), 'MM.dd')} хүртэл</span>
                            )}
                        </div>
                    </div>
                    <div className="flex -space-x-2">
                        {teamMembers.slice(0, 3).map((m) => (
                            <Avatar key={m.id} className="h-7 w-7 ring-2 ring-white">
                                <AvatarImage src={m.photoURL} />
                                <AvatarFallback className="text-[9px] bg-slate-100">{m.firstName?.[0]}</AvatarFallback>
                            </Avatar>
                        ))}
                        {teamMembers.length > 3 && (
                            <div className="h-7 w-7 rounded-full bg-slate-100 ring-2 ring-white flex items-center justify-center">
                                <span className="text-[9px] font-semibold text-slate-500">+{teamMembers.length - 3}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-3 pb-2">
                    {/* Progress Card - Compact */}
                    <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white overflow-hidden">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
                                        <span className="text-lg font-bold">{progressPercent}%</span>
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold">{taskStats.done}/{taskStats.total}</p>
                                        <p className="text-[10px] text-indigo-200">таск дууссан</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 text-center">
                                    <div>
                                        <p className="text-base font-bold">{taskStats.todo}</p>
                                        <p className="text-[9px] text-indigo-200">Хийх</p>
                                    </div>
                                    <div>
                                        <p className="text-base font-bold text-amber-300">{taskStats.inProgress}</p>
                                        <p className="text-[9px] text-indigo-200">Явагдаж</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Project Info - Collapsible */}
                    <Card className="rounded-xl border-0 shadow-sm overflow-hidden">
                        <button 
                            className="w-full px-3 py-2.5 flex items-center justify-between bg-white"
                            onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                        >
                            <div className="flex items-center gap-2">
                                <Info className="h-4 w-4 text-slate-400" />
                                <span className="text-sm font-medium text-slate-700">Төслийн мэдээлэл</span>
                            </div>
                            {isInfoExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>
                        {isInfoExpanded && (
                            <div className="px-3 pb-3 space-y-3 border-t border-slate-50 bg-slate-50/50 animate-in slide-in-from-top-1">
                                <div className="pt-3">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Зорилго</p>
                                    <p className="text-sm text-slate-700">{project.goal}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Хүлээгдэж буй үр дүн</p>
                                    <p className="text-sm text-slate-700">{project.expectedOutcome}</p>
                                </div>
                                <div className="flex gap-4">
                                    <div>
                                        <p className="text-[10px] text-slate-400">Эхлэх</p>
                                        <p className="text-sm font-medium text-slate-700">{format(parseISO(project.startDate), 'yyyy.MM.dd')}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400">Дуусах</p>
                                        <p className="text-sm font-medium text-slate-700">{format(parseISO(project.endDate), 'yyyy.MM.dd')}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Эзэн & Баг</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {teamMembers.map((m) => (
                                            <div key={m.id} className={cn(
                                                "flex items-center gap-1.5 bg-white rounded-full pl-1 pr-2 py-0.5 shadow-sm",
                                                m.id === project.ownerId && "ring-1 ring-indigo-200"
                                            )}>
                                                <Avatar className="h-5 w-5">
                                                    <AvatarImage src={m.photoURL} />
                                                    <AvatarFallback className="text-[8px]">{m.firstName?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-[10px] font-medium text-slate-700">{m.firstName}</span>
                                                {m.id === project.ownerId && <span className="text-[8px] text-indigo-600">★</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Tasks Section */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-1.5">
                                <ListTodo className="h-4 w-4 text-slate-500" />
                                <span className="text-sm font-semibold text-slate-900">Таскууд</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-full bg-indigo-100 hover:bg-indigo-200"
                                    onClick={() => setShowCreateTask(true)}
                                >
                                    <Plus className="h-3.5 w-3.5 text-indigo-600" />
                                </Button>
                            </div>
                            <div className="flex bg-slate-100 rounded-lg p-0.5">
                                <button
                                    onClick={() => setTaskFilter('all')}
                                    className={cn(
                                        "px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all",
                                        taskFilter === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                                    )}
                                >
                                    Бүгд ({taskStats.total})
                                </button>
                                <button
                                    onClick={() => setTaskFilter('mine')}
                                    className={cn(
                                        "px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all",
                                        taskFilter === 'mine' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                                    )}
                                >
                                    Миний ({myTasksCount})
                                </button>
                            </div>
                        </div>

                        {isTasksLoading ? (
                            <div className="space-y-2">
                                {[1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                            </div>
                        ) : filteredTasks.length === 0 ? (
                            <Card className="rounded-xl border-2 border-dashed border-slate-200 bg-white/50">
                                <CardContent className="py-6 text-center">
                                    <ListTodo className="w-6 h-6 text-slate-200 mx-auto mb-1" />
                                    <p className="text-xs text-slate-400">
                                        {taskFilter === 'mine' ? 'Танд хуваарилагдсан таск байхгүй' : 'Таск байхгүй'}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-1.5">
                                {filteredTasks.map((task) => {
                                    const isTaskOverdue = isPast(parseISO(task.dueDate)) && task.status !== 'DONE';
                                    const assignees = task.assigneeIds?.map(id => employeeMap.get(id)).filter(Boolean) || [];
                                    const isMyTask = user && (task.assigneeIds?.includes(user.uid) || task.ownerId === user.uid);

                                    return (
                                        <Card key={task.id} className={cn(
                                            "rounded-xl border-0 shadow-sm bg-white active:scale-[0.99] transition-transform",
                                            isMyTask && "ring-1 ring-indigo-100"
                                        )}>
                                            <CardContent className="p-3">
                                                <div className="flex items-start gap-2.5">
                                                    <button
                                                        onClick={() => handleTaskStatusChange(
                                                            task,
                                                            task.status === 'DONE' ? 'TODO' : task.status === 'TODO' ? 'IN_PROGRESS' : 'DONE'
                                                        )}
                                                        className="mt-0.5 shrink-0 active:scale-90 transition-transform"
                                                    >
                                                        {task.status === 'DONE' ? (
                                                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                                                        ) : task.status === 'IN_PROGRESS' ? (
                                                            <Clock className="w-5 h-5 text-amber-500" />
                                                        ) : (
                                                            <Circle className="w-5 h-5 text-slate-300" />
                                                        )}
                                                    </button>

                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn(
                                                            "text-sm font-medium leading-tight",
                                                            task.status === 'DONE' ? "text-slate-400 line-through" : "text-slate-900"
                                                        )}>
                                                            {task.title}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={cn(
                                                                "text-[10px] font-medium",
                                                                isTaskOverdue ? "text-red-500" : "text-slate-400"
                                                            )}>
                                                                {format(parseISO(task.dueDate), 'MM/dd')}
                                                            </span>
                                                            {assignees.length > 0 && (
                                                                <div className="flex -space-x-1">
                                                                    {assignees.slice(0, 2).map((emp) => (
                                                                        <Avatar key={emp!.id} className="h-4 w-4 ring-1 ring-white">
                                                                            <AvatarImage src={emp!.photoURL} />
                                                                            <AvatarFallback className="text-[6px]">{emp!.firstName?.[0]}</AvatarFallback>
                                                                        </Avatar>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {isMyTask && <Badge className="text-[8px] px-1 py-0 bg-indigo-100 text-indigo-600 border-0">Миний</Badge>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Chat Section - Fixed at Bottom */}
            <div className={cn(
                "bg-white border-t border-slate-200 transition-all duration-300 shrink-0",
                chatHeight
            )}>
                {/* Chat Header */}
                <button 
                    className="w-full px-4 py-3 flex items-center justify-between border-b border-slate-100"
                    onClick={() => setIsChatExpanded(!isChatExpanded)}
                >
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center">
                            <MessageCircle className="h-3.5 w-3.5 text-indigo-600" />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">Чат</span>
                        {messages && messages.length > 0 && (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                                {messages.length}
                            </span>
                        )}
                    </div>
                    {isChatExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                </button>

                {isChatExpanded && (
                    <>
                        {/* Messages */}
                        <ScrollArea ref={chatScrollRef} className="h-[168px]">
                            <div className="px-4 py-2 space-y-3">
                                {messages && messages.length > 0 ? (
                                    messages.map((msg) => {
                                        const sender = employeeMap.get(msg.senderId);
                                        const isCurrentUser = user?.uid === msg.senderId;

                                        return (
                                            <div key={msg.id} className={cn("flex gap-2", isCurrentUser && "flex-row-reverse")}>
                                                <Avatar className="h-6 w-6 shrink-0">
                                                    <AvatarImage src={sender?.photoURL} />
                                                    <AvatarFallback className="text-[8px] bg-indigo-100 text-indigo-600">
                                                        {sender?.firstName?.[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className={cn("max-w-[75%]", isCurrentUser && "text-right")}>
                                                    <div className={cn("flex items-center gap-1 mb-0.5", isCurrentUser && "flex-row-reverse")}>
                                                        <span className="text-[10px] font-medium text-slate-600">{sender?.firstName}</span>
                                                        <span className="text-[8px] text-slate-400">{formatTime(msg.createdAt)}</span>
                                                    </div>
                                                    <div className={cn(
                                                        "inline-block px-2.5 py-1.5 rounded-xl text-[13px]",
                                                        isCurrentUser
                                                            ? "bg-indigo-600 text-white rounded-tr-sm"
                                                            : "bg-slate-100 rounded-tl-sm text-slate-700"
                                                    )}>
                                                        {formatMessageContent(msg.content)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-center">
                                        <MessageCircle className="h-8 w-8 text-slate-200 mb-1" />
                                        <p className="text-xs text-slate-400">Мессеж байхгүй</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Message Input */}
                        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-2">
                                <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0 rounded-full"
                                            onClick={() => {
                                                setMessage(message + '@');
                                                setMentionOpen(true);
                                                inputRef.current?.focus();
                                            }}
                                        >
                                            <AtSign className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[180px] p-2 rounded-xl" align="start" side="top" onOpenAutoFocus={(e) => e.preventDefault()}>
                                        <div className="space-y-1 max-h-[150px] overflow-y-auto">
                                            {filteredMembers.length > 0 ? (
                                                filteredMembers.map((member) => (
                                                    <button
                                                        key={member.id}
                                                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-slate-100 text-left"
                                                        onClick={() => handleMentionSelect(member)}
                                                    >
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarImage src={member.photoURL} />
                                                            <AvatarFallback className="text-[8px]">{member.firstName?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-xs truncate">{member.firstName}</span>
                                                    </button>
                                                ))
                                            ) : (
                                                <p className="text-xs text-slate-400 px-2 py-2">Олдсонгүй</p>
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <Input
                                    ref={inputRef}
                                    value={message}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Мессеж..."
                                    className="flex-1 h-8 text-sm rounded-full border-slate-200 bg-white"
                                    disabled={isSending}
                                />

                                <Button
                                    size="icon"
                                    className="h-8 w-8 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-700"
                                    onClick={handleSend}
                                    disabled={isSending || !message.trim()}
                                >
                                    {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Create Task Sheet */}
            <CreateTaskSheet
                open={showCreateTask}
                onOpenChange={setShowCreateTask}
                projectId={projectId}
                teamMembers={teamMembers}
            />
        </div>
    );
}
