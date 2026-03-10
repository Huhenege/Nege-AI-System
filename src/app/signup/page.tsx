'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFirebase } from '@/firebase';
import { setSessionCookie } from '@/lib/session';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Building } from 'lucide-react';
import { NegeLogo } from '@/components/icons/nege-logo';
import { useToast } from '@/hooks/use-toast';
import { createUserWithEmailAndPassword } from 'firebase/auth';

export default function SignupPage() {
  const router = useRouter();
  const auth = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!firestore) {
        setError('Firestore-н тохиргоо хийгдээгүй байна.');
        setIsLoading(false);
        return;
      }

      if (!companyName.trim()) {
        setError('Байгууллагын нэрийг оруулна уу.');
        setIsLoading(false);
        return;
      }

      const uc = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await uc.user.getIdToken();

      const res = await fetch('/api/companies/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          plan: 'free',
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Компани үүсгэхэд алдаа гарлаа');
      }

      // Force token refresh to pick up the custom claims set by the register API
      const freshToken = await uc.user.getIdToken(true);
      setSessionCookie(freshToken);

      toast({
        title: 'Амжилттай бүртгүүллээ!',
        description: `"${companyName}" компани үүсгэгдлээ.`,
      });

      router.replace('/dashboard');
    } catch (err: unknown) {
      console.error('Signup error:', err);
      const code = (err as { code?: string })?.code;
      let msg = 'Системийн дотоод алдаа гарлаа.';
      if (code === 'auth/email-already-in-use') {
        msg = 'Энэ имэйл хаяг аль хэдийн бүртгэгдсэн байна. Нэвтрэх хэсгээс ороорой.';
      } else if (code === 'auth/weak-password') {
        msg = 'Нууц үг хэт богино байна. Хамгийн багадаа 6 тэмдэгт оруулна уу.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Имэйл хаяг буруу байна.';
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      toast({ variant: 'destructive', title: 'Бүртгэлийн алдаа', description: msg });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <Card className="w-full max-w-sm border-0 shadow-none">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <NegeLogo className="h-12 w-auto" />
          </div>
          <CardTitle className="text-2xl">Байгууллага бүртгүүлэх</CardTitle>
          <CardDescription>
            Шинэ байгууллага үүсгэж, админ хэрэглэгчээр бүртгүүлэх.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Байгууллагын нэр</Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Миний компани ХХК"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isLoading}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Админ имэйл</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@yourcompany.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Нууц үг</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Бүртгүүлэх
            </Button>
          </form>
          <div className="mt-4 text-center text-sm space-y-2">
            <div>
              Бүртгэлтэй юу?{' '}
              <Link href="/login" className="underline">
                Нэвтрэх
              </Link>
            </div>
            <div>
              <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                ← Нүүр хуудас руу буцах
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
