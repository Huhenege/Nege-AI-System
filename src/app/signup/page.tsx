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
import { Loader2, Building, User } from 'lucide-react';
import { NegeLogo } from '@/components/icons/nege-logo';
import { useToast } from '@/hooks/use-toast';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';

// ─── Password strength validation ────────────────────────────────────────────

interface PasswordStrength {
  score: number; // 0–4
  label: string;
  color: string;
  errors: string[];
}

function checkPasswordStrength(password: string): PasswordStrength {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push('Хамгийн багадаа 8 тэмдэгт байх ёстой');
  } else {
    score++;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Том үсэг (A–Z) орсон байх ёстой');
  } else {
    score++;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Тоо (0–9) орсон байх ёстой');
  } else {
    score++;
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Тусгай тэмдэгт (!@#$...) орсон байх ёстой');
  } else {
    score++;
  }

  const labels = ['Маш сул', 'Сул', 'Дунд', 'Хүчтэй', 'Маш хүчтэй'];
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-blue-500',
    'bg-green-500',
  ];

  return { score, label: labels[score], color: colors[score], errors };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter();
  const auth = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordStrength = password.length > 0 ? checkPasswordStrength(password) : null;

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

      // ── Client-side validation ──────────────────────────────────────────
      if (!companyName.trim()) {
        setError('Байгууллагын нэрийг оруулна уу.');
        setIsLoading(false);
        return;
      }

      if (!firstName.trim() || !lastName.trim()) {
        setError('Нэр, овог заавал шаардлагатай.');
        setIsLoading(false);
        return;
      }

      if (passwordStrength && passwordStrength.score < 3) {
        setError('Нууц үг хүчтэй биш байна. Шаардлагыг хангана уу.');
        setIsLoading(false);
        return;
      }

      // ── Firebase Auth user creation ─────────────────────────────────────
      const uc = await createUserWithEmailAndPassword(auth, email, password);

      // Update display name immediately
      await updateProfile(uc.user, {
        displayName: `${lastName} ${firstName}`,
      });

      // Send email verification (non-blocking)
      sendEmailVerification(uc.user).catch((err) =>
        console.warn('[signup] sendEmailVerification failed:', err)
      );

      const idToken = await uc.user.getIdToken();

      // ── Register company via API ────────────────────────────────────────
      const res = await fetch('/api/companies/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          plan: 'free',
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        // If company registration fails, clean up the created auth user to avoid orphan accounts
        await uc.user.delete().catch(() => {});
        throw new Error(result.error || 'Компани үүсгэхэд алдаа гарлаа');
      }

      // Force token refresh to pick up the custom claims set by the register API
      const freshToken = await uc.user.getIdToken(true);
      setSessionCookie(freshToken);

      toast({
        title: 'Амжилттай бүртгүүллээ!',
        description: `"${companyName}" компани үүсгэгдлээ. Имэйл баталгаажуулах захидал илгээлээ.`,
      });

      router.replace('/dashboard');
    } catch (err: unknown) {
      console.error('Signup error:', err);
      const code = (err as { code?: string })?.code;
      let msg = 'Системийн дотоод алдаа гарлаа.';
      if (code === 'auth/email-already-in-use') {
        msg = 'Энэ имэйл хаяг аль хэдийн бүртгэгдсэн байна. Нэвтрэх хэсгээс ороорой.';
      } else if (code === 'auth/weak-password') {
        msg = 'Нууц үг хэт богино байна. Хамгийн багадаа 8 тэмдэгт оруулна уу.';
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
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-8">
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

            {/* Company name */}
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

            {/* Admin name */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="lastName">Овог</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Батбаяр"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isLoading}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">Нэр</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Болд"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Email */}
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

            {/* Password + strength indicator */}
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
              {passwordStrength && (
                <div className="space-y-1">
                  {/* Strength bar */}
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < passwordStrength.score
                            ? passwordStrength.color
                            : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{passwordStrength.label}</p>
                  {passwordStrength.errors.length > 0 && (
                    <ul className="text-xs text-destructive space-y-0.5 list-disc list-inside">
                      {passwordStrength.errors.map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || (passwordStrength !== null && passwordStrength.score < 3)}
            >
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
