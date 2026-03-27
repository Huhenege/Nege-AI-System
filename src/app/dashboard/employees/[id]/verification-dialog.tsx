'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/firebase';
import { Loader2, Mail, Phone, CheckCircle2, AlertCircle } from 'lucide-react';

interface VerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'email' | 'phone';
  target: string;
  employeeId: string;
  onVerified: () => void;
}

type Step = 'send' | 'verify';

export function VerificationDialog({
  open,
  onOpenChange,
  type,
  target,
  employeeId,
  onVerified,
}: VerificationDialogProps) {
  const { user } = useUser();
  const [step, setStep] = React.useState<Step>('send');
  const [verificationId, setVerificationId] = React.useState('');
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [countdown, setCountdown] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setStep('send');
      setVerificationId('');
      setCode('');
      setError('');
      setCountdown(0);
    }
  }, [open]);

  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  React.useEffect(() => {
    if (step === 'verify' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  const getToken = React.useCallback(async () => {
    if (!user) throw new Error('Нэвтрээгүй байна');
    return user.getIdToken();
  }, [user]);

  const handleSendOTP = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const res = await fetch('/api/verify/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, target, employeeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Алдаа гарлаа');
      }
      setVerificationId(data.verificationId);
      setStep('verify');
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Код илгээхэд алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }, [getToken, type, target, employeeId]);

  const handleVerifyOTP = React.useCallback(async () => {
    if (code.length !== 6) {
      setError('6 оронтой код оруулна уу');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const res = await fetch('/api/verify/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ verificationId, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Баталгаажуулахад алдаа гарлаа');
      }
      onVerified();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Баталгаажуулахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }, [getToken, verificationId, code, onVerified, onOpenChange]);

  const handleResend = React.useCallback(async () => {
    setCode('');
    setError('');
    await handleSendOTP();
  }, [handleSendOTP]);

  const icon =
    type === 'email' ? (
      <Mail className="h-5 w-5 text-primary" />
    ) : (
      <Phone className="h-5 w-5 text-primary" />
    );

  const typeLabel = type === 'email' ? 'Имэйл' : 'Утасны дугаар';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon}
            {typeLabel} баталгаажуулах
          </DialogTitle>
          <DialogDescription>
            {step === 'send'
              ? `${target} руу баталгаажуулах код илгээх`
              : `${target} руу илгээсэн 6 оронтой кодыг оруулна уу`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step === 'send' ? (
            <>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="text-sm font-medium text-slate-700 mb-1">
                  {typeLabel}
                </div>
                <div className="text-lg font-semibold">{target}</div>
              </div>

              <Button
                onClick={handleSendOTP}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Код илгээх
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Input
                  ref={inputRef}
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCode(val);
                    setError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && code.length === 6) {
                      handleVerifyOTP();
                    }
                  }}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl font-bold tracking-[0.5em] h-14"
                  disabled={loading}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {target} руу илгээсэн
                  </span>
                  {countdown > 0 ? (
                    <span>{countdown} сек</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-primary hover:underline font-medium"
                      disabled={loading}
                    >
                      Дахин илгээх
                    </button>
                  )}
                </div>
              </div>

              <Button
                onClick={handleVerifyOTP}
                disabled={loading || code.length !== 6}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Баталгаажуулах
              </Button>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
