'use client';
import { ModuleGate } from '@/components/module-gate';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="onboarding">{children}</ModuleGate>;
}
