'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useUser, useFirebase, useDoc, useMemoFirebase, tenantDoc } from '@/firebase';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Building, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getDoc, doc } from 'firebase/firestore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';


function isEmail(input: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(input);
}

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const companyProfileRef = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
    []
  );
  const { data: companyProfile, isLoading: isLoadingProfile } = useDoc(companyProfileRef);

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

      // Custom Claims шалгах — байхгүй бол автоматаар тохируулна
      const tokenResult = await uc.user.getIdTokenResult();
      if (!tokenResult.claims.companyId) {
        const idToken = await uc.user.getIdToken();
        const res = await fetch('/api/auth/ensure-claims', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}` },
        });
        if (res.ok) {
          // Claims тохируулагдсан — token refresh хийж шинэ claims авна
          await uc.user.getIdToken(true);
        }
      }

      toast({ title: 'Амжилттай нэвтэрлээ', description: 'Хуудас руу шилжиж байна.' });
      router.replace('/dashboard');

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-sm rounded-2xl border-0 shadow-xl">
        <CardHeader className="text-center space-y-2 pb-2">
          <div className="mb-2 flex flex-col items-center gap-4">
            {isLoadingProfile ? (
              <>
                <Skeleton className="h-16 w-16 rounded-2xl" />
                <Skeleton className="h-7 w-40" />
              </>
            ) : (
              <>
                <Avatar className="h-16 w-16 rounded-2xl ring-4 ring-primary/5">
                  <AvatarImage src={companyProfile?.logoUrl} alt={companyProfile?.name} />
                  <AvatarFallback className="rounded-2xl bg-primary/10">
                    <Building className="h-8 w-8 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl sm:text-2xl font-semibold tracking-tight">
                  {companyProfile?.name || 'Nege Systems'}-т нэвтрэх
                </CardTitle>
              </>
            )}
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
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Анхны админ уу?{' '}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors">
          Бүртгүүлэх
        </Link>
      </div>
    </div>
  );
}
