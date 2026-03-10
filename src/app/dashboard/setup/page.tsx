'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/contexts/tenant-context';
import { useTenantWrite, useAuth } from '@/firebase';
import { setDoc, addDoc, updateDoc, doc as firestoreDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Building,
  Network,
  Briefcase,
  UserPlus,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'company', label: 'Компани', icon: Building, description: 'Байгууллагын мэдээлэл' },
  { id: 'department', label: 'Хэлтэс', icon: Network, description: 'Эхний хэлтэс нэмэх' },
  { id: 'position', label: 'Ажлын байр', icon: Briefcase, description: 'Эхний ажлын байр' },
  { id: 'done', label: 'Бэлэн', icon: Rocket, description: 'Систем бэлэн боллоо' },
];

export default function SetupWizardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const { company, companyId } = useTenant();
  const { firestore, tDoc, tCollection } = useTenantWrite();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Force-refresh auth token before Firestore writes to ensure claims are current
  const ensureFreshToken = async () => {
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
    }
  };

  const markSetupComplete = async () => {
    if (!firestore || !companyId) return;
    try {
      await ensureFreshToken();
      await updateDoc(firestoreDoc(firestore, 'companies', companyId), {
        setupComplete: true,
      });
    } catch (err) {
      console.error('Failed to mark setup complete:', err);
    }
  };

  const handleSkipToFinish = async () => {
    await markSetupComplete();
    setCurrentStep(3);
  };

  const handleGoToDashboard = async () => {
    await markSetupComplete();
    router.push('/dashboard');
  };

  // Step data
  const [companyData, setCompanyData] = useState({
    phone: '',
    address: '',
    description: '',
  });
  const [deptName, setDeptName] = useState('');
  const [deptColor, setDeptColor] = useState('#3b82f6');
  const [positionTitle, setPositionTitle] = useState('');
  const [createdDeptId, setCreatedDeptId] = useState<string | null>(null);

  const handleSaveCompany = async () => {
    if (!firestore || !companyId) return;
    setIsSaving(true);
    try {
      await ensureFreshToken();
      await setDoc(
        tDoc('company', 'profile'),
        {
          name: company?.name || '',
          phone: companyData.phone,
          address: companyData.address,
          description: companyData.description,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast({ title: 'Компанийн мэдээлэл хадгалагдлаа' });
      setCurrentStep(1);
    } catch (err) {
      toast({ title: 'Алдаа', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDepartment = async () => {
    if (!firestore || !deptName.trim()) return;
    setIsSaving(true);
    try {
      await ensureFreshToken();
      const docRef = await addDoc(tCollection('departments'), {
        name: deptName.trim(),
        color: deptColor,
        description: '',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCreatedDeptId(docRef.id);
      toast({ title: `"${deptName}" хэлтэс үүсгэгдлээ` });
      setCurrentStep(2);
    } catch (err) {
      toast({ title: 'Алдаа', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePosition = async () => {
    if (!firestore || !positionTitle.trim()) return;
    setIsSaving(true);
    try {
      await ensureFreshToken();
      await addDoc(tCollection('positions'), {
        title: positionTitle.trim(),
        departmentId: createdDeptId || '',
        isActive: true,
        isApproved: true,
        headcount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Mark setup as complete on the main company document
      await updateDoc(firestoreDoc(firestore, 'companies', companyId), {
        setupComplete: true,
      });

      toast({ title: `"${positionTitle}" ажлын байр үүсгэгдлээ` });
      setCurrentStep(3);
    } catch (err) {
      toast({ title: 'Алдаа', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  idx < currentStep
                    ? 'bg-primary text-primary-foreground'
                    : idx === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {idx < currentStep ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn('h-0.5 w-8', idx < currentStep ? 'bg-primary' : 'bg-muted')} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {currentStep === 0 && (
          <Card>
            <CardHeader className="text-center">
              <Building className="mx-auto h-10 w-10 text-primary mb-2" />
              <CardTitle>Компанийн мэдээлэл</CardTitle>
              <CardDescription>Байгууллагын үндсэн мэдээллийг бөглөнө үү</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Компанийн нэр</Label>
                <Input value={company?.name || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Утас</Label>
                <Input
                  placeholder="+976 ..."
                  value={companyData.phone}
                  onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Хаяг</Label>
                <Input
                  placeholder="Хот, дүүрэг, хороо"
                  value={companyData.address}
                  onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Товч танилцуулга</Label>
                <Textarea
                  placeholder="Компанийн үйл ажиллагааны чиглэл..."
                  value={companyData.description}
                  onChange={(e) => setCompanyData({ ...companyData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                  Алгасах <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button onClick={handleSaveCompany} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Хадгалах <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 1 && (
          <Card>
            <CardHeader className="text-center">
              <Network className="mx-auto h-10 w-10 text-primary mb-2" />
              <CardTitle>Эхний хэлтэс үүсгэх</CardTitle>
              <CardDescription>Байгууллагын бүтцийн анхны хэлтсийг нэмнэ үү</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Хэлтэсийн нэр</Label>
                <Input
                  placeholder="Жишээ: Захиргаа"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Өнгө</Label>
                <div className="flex gap-2">
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setDeptColor(c)}
                      className={cn(
                        'h-8 w-8 rounded-full border-2 transition-transform',
                        deptColor === c ? 'scale-110 border-foreground' : 'border-transparent'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setCurrentStep(0)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Буцах
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setCurrentStep(2)}>
                    Алгасах <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                  <Button onClick={handleSaveDepartment} disabled={isSaving || !deptName.trim()}>
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Үүсгэх <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader className="text-center">
              <Briefcase className="mx-auto h-10 w-10 text-primary mb-2" />
              <CardTitle>Эхний ажлын байр</CardTitle>
              <CardDescription>Ажлын байрны нэрийг оруулна уу</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Ажлын байрны нэр</Label>
                <Input
                  placeholder="Жишээ: Захирал"
                  value={positionTitle}
                  onChange={(e) => setPositionTitle(e.target.value)}
                />
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Буцах
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleSkipToFinish}>
                    Алгасах <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                  <Button onClick={handleSavePosition} disabled={isSaving || !positionTitle.trim()}>
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Үүсгэх <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-2">
                <Rocket className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-xl">Систем бэлэн боллоо!</CardTitle>
              <CardDescription className="text-base">
                Таны байгууллага амжилттай тохируулагдлаа. Одоо системийг бүрэн ашиглах боломжтой.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pt-2">
              <Button size="lg" onClick={handleGoToDashboard}>
                Dashboard руу очих <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
