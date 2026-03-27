'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, User, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { initializeFirebase } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useTenant } from '@/contexts/tenant-context';

type MessageRole = 'user' | 'model' | 'system';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

interface EmployeeInfo {
  id: string;
  name: string;
  position?: string;
  department?: string;
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { firebaseApp } = initializeFirebase();
    const auth = getAuth(firebaseApp);
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export function FloatingAssistant() {
  const { companyId } = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: 'Сайн байна уу! Би Nege Systems-ийн AI туслах байна. Танд юугаар туслах вэ?\n\nЖишээ нь: "Шинэ төсөл үүсгэе" гэж бичээд үзээрэй.',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState<EmployeeInfo[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Component unmount хийгдэхэд pending request цуцлах
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) {
        setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
      }
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isOpen, scrollToBottom]);

  useEffect(() => {
    if (!isOpen || employees.length > 0 || !companyId) return;
    loadEmployees();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, employees.length, companyId]);

  async function loadEmployees() {
    if (!companyId) return;

    const token = await getAuthToken();
    const authHeaders: Record<string, string> = token
      ? { 'Authorization': `Bearer ${token}` }
      : {};

    // Strategy 1: Client-side Firestore (tenant-scoped)
    try {
      const { firestore } = initializeFirebase();
      const [empSnap, posSnap] = await Promise.all([
        getDocs(collection(firestore, `companies/${companyId}/employees`)),
        getDocs(collection(firestore, `companies/${companyId}/positions`)),
      ]);

      const posMap = new Map<string, string>();
      posSnap.docs.forEach(doc => {
        const d = doc.data();
        posMap.set(doc.id, d.title || d.name || '');
      });

      const emps: EmployeeInfo[] = empSnap.docs.map(doc => {
        const d = doc.data();
        const first = d.firstName || '';
        const last = d.lastName || '';
        const name = `${last} ${first}`.trim() || d.email || 'Нэргүй';
        return {
          id: doc.id,
          name,
          position: d.positionId ? posMap.get(d.positionId) : undefined,
        };
      });

      if (emps.length > 0) {
        setEmployees(emps);
        console.log('[FloatingAssistant] Loaded', emps.length, 'employees from Firestore');
        return;
      }
    } catch (err) {
      console.warn('[FloatingAssistant] Client Firestore failed:', err);
    }

    // Strategy 2: Next.js API fallback (now requires auth)
    try {
      const res = await fetch('/api/assistant/employees', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.employees) && data.employees.length > 0) {
          setEmployees(data.employees);
          console.log('[FloatingAssistant] Loaded', data.employees.length, 'employees from API fallback');
          return;
        }
      }
    } catch (err) {
      console.error('[FloatingAssistant] All employee sources failed:', err);
    }
  }

  function handleEmployeeClick(emp: EmployeeInfo, mode: 'single' | 'multi') {
    if (mode === 'single') {
      setSelectedEmployees(new Set());
      const displayName = emp.name;
      setInput(displayName);
      inputRef.current?.focus();
    } else {
      setSelectedEmployees(prev => {
        const next = new Set(prev);
        if (next.has(emp.id)) {
          next.delete(emp.id);
        } else {
          next.add(emp.id);
        }
        const names = employees
          .filter(e => next.has(e.id))
          .map(e => e.name);
        setInput(names.join(', '));
        return next;
      });
      inputRef.current?.focus();
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSelectedEmployees(new Set());
    setIsLoading(true);

    // Өмнөх pending request байвал цуцла
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const genkitMessages = newMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.role,
          content: [{ text: m.content }],
        }));

      const token = await getAuthToken();
      console.log('[FloatingAssistant] Sending', genkitMessages.length, 'messages,', employees.length, 'employees');

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: genkitMessages,
          employees: employees.map(e => ({
            id: e.id,
            name: e.name,
            position: e.position,
          })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.text || 'Уучлаарай, хариулт авч чадсангүй. Дахин оролдоно уу.',
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      // AbortError: хэрэглэгч шинэ хүсэлт илгээсэн эсвэл component unmount
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('[FloatingAssistant] Chat error:', error);
      const errMsg = error instanceof Error ? error.message : 'Тодорхойгүй алдаа';
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: `Уучлаарай, алдаа гарлаа: ${errMsg}. Та дахин оролдоно уу.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  function renderEmployeeSelector(jsonStr: string) {
    try {
      const data = JSON.parse(jsonStr);
      if (data.type !== 'employee_selector' || !Array.isArray(data.employees)) return null;
      const mode: 'single' | 'multi' = data.mode === 'multi' ? 'multi' : 'single';
      const label = data.label || 'Ажилтан сонгоно уу';

      return (
        <span className="block mt-2 mb-1">
          <span className="block text-xs font-semibold text-muted-foreground mb-2">{label}:</span>
          <span className="flex flex-wrap gap-1.5">
            {data.employees.map((emp: { id: string; name: string }) => {
              const isSelected = selectedEmployees.has(emp.id);
              return (
                <button
                  key={emp.id}
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/15"
                  )}
                  onClick={() => handleEmployeeClick(
                    employees.find(e => e.id === emp.id) || { id: emp.id, name: emp.name.split(' - ')[0] },
                    mode
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                  {emp.name}
                </button>
              );
            })}
          </span>
        </span>
      );
    } catch {
      return null;
    }
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed right-6 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl transition-all duration-300 z-50",
          isOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
        )}
        size="icon"
      >
        <Bot className="h-6 w-6" />
      </Button>

      <div
        className={cn(
          "fixed right-6 top-1/2 -translate-y-1/2 z-50 flex w-[400px] h-[640px] max-h-[85vh] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-300 origin-right",
          isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 bg-primary/10">
              <Bot className="h-4 w-4 text-primary m-auto" />
            </Avatar>
            <div>
              <p className="text-sm font-semibold">AI Туслах</p>
              <p className="text-xs text-muted-foreground">
                {employees.length > 0
                  ? `Nege Systems · ${employees.length} ажилтан`
                  : 'Nege Systems · ачаалж байна...'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="flex flex-col gap-4 pb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex max-w-[90%] items-end gap-2",
                  msg.role === 'user' ? "self-end flex-row-reverse" : "self-start"
                )}
              >
                <Avatar className="h-6 w-6 shrink-0 bg-muted">
                  <AvatarFallback className="text-[10px]">
                    {msg.role === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm",
                    msg.role === 'user'
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm",
                    "prose prose-sm dark:prose-invert max-w-none break-words",
                    msg.role === 'user' && "prose-p:text-primary-foreground prose-a:text-primary-foreground"
                  )}
                >
                  <ReactMarkdown
                    components={{
                      code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) {
                        const match = /language-(\w+)/.exec(className || '');
                        if (match && match[1] === 'json') {
                          const raw = String(children).replace(/\n$/, '');
                          const selector = renderEmployeeSelector(raw);
                          if (selector) return selector;
                        }
                        return <code className={className} {...props}>{children}</code>;
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex max-w-[80%] items-end gap-2 self-start">
                <Avatar className="h-6 w-6 shrink-0 bg-muted">
                  <AvatarFallback><Bot className="h-3 w-3" /></AvatarFallback>
                </Avatar>
                <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2 flex items-center gap-1 h-[36px]">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="p-3 bg-background border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Асуултаа энд бичнэ үү..."
              className="flex-1 rounded-full px-4"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full shrink-0"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Илгээх</span>
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
