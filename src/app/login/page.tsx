'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useUser, useFirebase } from '@/firebase';
import { setSessionCookie } from '@/lib/session';
import { NegeLogo } from '@/components/icons/nege-logo';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getDoc, doc } from 'firebase/firestore';


function isEmail(input: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(input);
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;

    setIsLoading(true);
    setError(null);

    const email = isEmail(identifier) ? identifier : `${identifier}@example.com`;

    try {
      const { signInWithEmailAndPassword, signOut } = await import('firebase/auth');
      const uc = await signInWithEmailAndPassword(auth, email, password);
      const uid = uc.user.uid;

      // loginDisabled шалгах (top-level + tenant)
      const employeeRef = doc(firestore, 'employees', uid);
      const empSnap = await getDoc(employeeRef);
      const employee = empSnap.data() as { loginDisabled?: boolean } | undefined;
      if (employee?.loginDisabled === true) {
        await signOut(auth);
        setIsLoading(false);
        const errorMessage = 'Нэвтрэх эрх идэвхгүй болсон байна.';
        setError(errorMessage);
        toast({ variant: 'destructive', title: 'Нэвтрэхэд алдаа гарлаа', description: errorMessage });
        return;
      }

      // Force-refresh token to always get latest custom claims
      let tokenResult = await uc.user.getIdTokenResult(true);

      // Super admin doesn't need companyId — skip ensure-claims
      if (tokenResult.claims.role === 'super_admin') {
        const finalToken = await uc.user.getIdToken(true);
        setSessionCookie(finalToken);
        toast({ title: 'Амжилттай нэвтэрлээ', description: 'Админ хуудас руу шилжиж байна.' });
        router.replace('/super-admin');
        return;
      }

      if (!tokenResult.claims.companyId) {
        // Claims not set yet — call ensure-claims to set them
        const idToken = await uc.user.getIdToken();
        const res = await fetch('/api/auth/ensure-claims', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}` },
        });
        if (res.ok) {
          tokenResult = await uc.user.getIdTokenResult(true);
        } else {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 404) {
            await signOut(auth);
            setIsLoading(false);
            setError('Энэ хэрэглэгч ямар нэг байгууллагад бүртгэгдээгүй байна. Бүртгүүлэх хэсгээс шинэ байгууллага үүсгэнэ үү.');
            return;
          }
          console.warn('[ensure-claims] Non-fatal error:', errData);
        }
      }

      const finalToken = await uc.user.getIdToken(true);
      setSessionCookie(finalToken);

      toast({ title: 'Амжилттай нэвтэрлээ', description: 'Хуудас руу шилжиж байна.' });
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      router.replace(redirectTo);

    } catch (err: any) {
      setIsLoading(false);
      let errorMessage = 'Нэвтрэх үед тооцоолоогүй алдаа гарлаа.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = 'Нэвтрэх нэр эсвэл нууц үг буруу байна.';
      } else {
        errorMessage = err.message || errorMessage;
      }
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Нэвтрэхэд алдаа гарлаа',
        description: errorMessage,
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-8">
      <Card className="w-full max-w-sm rounded-2xl border-0 shadow-xl">
        <CardHeader className="text-center space-y-2 pb-2">
          <div className="mb-2 flex flex-col items-center gap-4">
            <NegeLogo className="h-12 w-auto" />
            <CardTitle className="text-xl sm:text-2xl font-semibold tracking-tight">
              Нэвтрэх
            </CardTitle>
          </div>
          <CardDescription className="text-sm leading-relaxed">
            Өөрийн нэвтрэх нэр эсвэл имэйл хаягаар нэвтэрнэ үү.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Ажилтны код эсвэл имэйл</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="Код эсвэл имэйл хаяг"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Нууц үг</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {showPassword ? 'Нууц үг нуух' : 'Нууц үг харах'}
                  </span>
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Нэвтрэх
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="mt-6 text-center text-sm text-muted-foreground space-y-2">
        <div>
          Анхны админ уу?{' '}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors">
            Бүртгүүлэх
          </Link>
        </div>
        <div>
          <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
            ← Нүүр хуудас руу буцах
          </Link>
        </div>
      </div>
    </div>
  );
}
