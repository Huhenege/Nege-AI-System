'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

type MessageRole = 'user' | 'model' | 'system';

interface Message {
  id: string;
  role: MessageRole;
  content: string | any[];
}

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: 'Сайн байна уу! Би Nege Systems-ийн AI туслах байна. Танд юугаар туслах вэ?',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Map format for Genkit (user/model and text/media content)
      const genkitMessages = newMessages.map(m => ({
        role: m.role,
        content: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
      }));

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: genkitMessages }),
      });

      if (!res.ok) throw new Error('Failed to fetch response');

      const data = await res.json();
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.text || 'Уучлаарай, хариулт олдсонгүй.',
      };

      setMessages(prev => [...prev, assistantMsg]);
      
      // If genkit returns full message objects, we could append them directly.
      // But we just use the text output for simplicity here.
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: 'Уучлаарай, системд алдаа гарлаа. Та дахин оролдоно уу.',
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
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

      {/* Chat Window */}
      <div
        className={cn(
          "fixed right-6 top-1/2 -translate-y-1/2 z-50 flex w-[380px] h-[600px] max-h-[80vh] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-300 origin-right",
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
              <p className="text-xs text-muted-foreground">Nege Systems</p>
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
                  "flex max-w-[85%] items-end gap-2",
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
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        if (!inline && match && match[1] === 'json') {
                          try {
                            const data = JSON.parse(String(children).replace(/\n$/, ''));
                            if (data.type === 'employee_selector' && Array.isArray(data.employees)) {
                              return (
                                <span className="mt-3 mb-1 flex flex-col gap-2 bg-background p-2 rounded-lg border">
                                  <span className="text-xs font-semibold text-muted-foreground mb-1">Сонгох боломжтой ажилчид:</span>
                                  <span className="flex flex-wrap gap-1.5">
                                    {data.employees.map((emp: any) => (
                                      <button
                                        key={emp.id}
                                        type="button"
                                        className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setInput((prev) => {
                                            const name = emp.name.split(' - ')[0]; // Extract just name if it has position
                                            return prev ? `${prev}, ${name}` : name;
                                          });
                                        }}
                                      >
                                        {emp.name}
                                      </button>
                                    ))}
                                  </span>
                                </span>
                              );
                            }
                          } catch (e) {
                            // Fallback to default code block
                          }
                        }
                        return <code className={className} {...props}>{children}</code>;
                      }
                    }}
                  >
                    {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
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
