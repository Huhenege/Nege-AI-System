'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, initiateEmailSignUp, useFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/icons';
import { Loader2, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

      // Signup нээлттэй эсэхийг шалгах
      const signupConfigRef = doc(firestore, 'system', 'signup_config');
      let configSnap = await getDoc(signupConfigRef);
      if (!configSnap.exists()) {
        await setDoc(signupConfigRef, { open: true });
        configSnap = await getDoc(signupConfigRef);
      }
      if (!configSnap.exists() || !configSnap.data()?.open) {
        setError('Одоогоор бүртгэл хаалттай байна.');
        toast({
          variant: 'destructive',
          title: 'Бүртгэл хаалттай',
          description: 'Бүртгэл нээгдээгүй байна.',
        });
        setIsLoading(false);
        return;
      }

      initiateEmailSignUp(auth, email, password);

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const idToken = await user.getIdToken();

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

            // Close signup after first company is registered
            try {
              await setDoc(doc(firestore, 'system', 'signup_config'), { open: false }, { merge: true });
            } catch {
              // Admin can fix this from Firebase Console
            }

            toast({
              title: 'Амжилттай бүртгүүллээ!',
              description: `"${companyName}" компани үүсгэгдлээ. Нэвтрэх хэсэг рүү шилжинэ.`,
            });
            router.push('/login');
          } catch (regError: unknown) {
            const msg = regError instanceof Error ? regError.message : 'Компани үүсгэхэд алдаа гарлаа';
            setError(msg);
            toast({ variant: 'destructive', title: 'Алдаа', description: msg });
            setIsLoading(false);
          }
          unsubscribe();
        } else {
          setTimeout(() => {
            if (!auth.currentUser) {
              setError('Бүртгэл үүсгэхэд алдаа гарлаа.');
              toast({ variant: 'destructive', title: 'Алдаа', description: 'Бүртгэл үүсгэхэд алдаа гарлаа.' });
              setIsLoading(false);
            }
          }, 2000);
        }
      }, (authError) => {
        setError(authError.message || 'Бүртгэл үүсгэхэд алдаа гарлаа.');
        toast({ variant: 'destructive', title: 'Алдаа', description: authError.message });
        console.error(authError);
        setIsLoading(false);
        unsubscribe();
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Системийн дотоод алдаа гарлаа.';
      console.error('Signup error:', err);
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Logo className="h-10 w-10 text-primary" />
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
          <div className="mt-4 text-center text-sm">
            Бүртгэлтэй юу?{' '}
            <Link href="/login" className="underline">
              Нэвтрэх
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
