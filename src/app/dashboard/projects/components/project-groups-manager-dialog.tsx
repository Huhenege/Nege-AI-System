'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useTenantWrite } from '@/firebase';
import {
  Timestamp,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Project, ProjectGroup } from '@/types/project';
import { Pencil, Plus, Trash2 } from 'lucide-react';

const COLOR_PRESETS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9', '#64748B'];

export interface ProjectGroupsManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ProjectGroup[];
}

export function ProjectGroupsManagerDialog({ open, onOpenChange, groups }: ProjectGroupsManagerDialogProps) {
  const { firestore, user } = useFirebase();
  const { tDoc, tCollection } = useTenantWrite();
  const { toast } = useToast();

  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState<string>(COLOR_PRESETS[0]);
  const [isSaving, setIsSaving] = React.useState(false);

  const [editing, setEditing] = React.useState<ProjectGroup | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editColor, setEditColor] = React.useState<string>(COLOR_PRESETS[0]);
  const [deletingGroup, setDeletingGroup] = React.useState<ProjectGroup | null>(null);

  React.useEffect(() => {
    if (!open) {
      setName('');
      setColor(COLOR_PRESETS[0]);
      setEditing(null);
      setEditName('');
      setEditColor(COLOR_PRESETS[0]);
      setIsSaving(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!firestore || !user) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ variant: 'destructive', title: 'Нэр оруулна уу' });
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(tCollection('project_groups'), {
        name: trimmed,
        color: color || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user.uid,
      });
      setName('');
      toast({ title: 'Бүлэг үүслээ' });
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Алдаа', description: e?.message || 'Бүлэг үүсгэхэд алдаа гарлаа.' });
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (g: ProjectGroup) => {
    setEditing(g);
    setEditName(g.name || '');
    setEditColor(g.color || COLOR_PRESETS[0]);
  };

  const handleSaveEdit = async () => {
    if (!firestore || !editing) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast({ variant: 'destructive', title: 'Нэр оруулна уу' });
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(tDoc('project_groups', editing.id), {
        name: trimmed,
        color: editColor || null,
        updatedAt: Timestamp.now(),
      });
      toast({ title: 'Шинэчлэгдлээ' });
      setEditing(null);
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Алдаа', description: e?.message || 'Шинэчлэхэд алдаа гарлаа.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const g = deletingGroup;
    if (!firestore || !g) return;
    setDeletingGroup(null);
    setIsSaving(true);
    try {
      // Remove group reference from projects first (best-effort)
      const q = query(tCollection('projects'), where('groupIds', 'array-contains', g.id));
      const snap = await getDocs(q);
      const projectDocs = snap.docs;

      let batch = writeBatch(firestore);
      let ops = 0;
      const commitIfNeeded = async () => {
        if (ops === 0) return;
        await batch.commit();
        batch = writeBatch(firestore);
        ops = 0;
      };

      for (const pDoc of projectDocs) {
        const p = pDoc.data() as Project;
        const next = (p.groupIds || []).filter((id) => id !== g.id);
        batch.update(pDoc.ref, { groupIds: next, updatedAt: Timestamp.now() });
        ops += 1;
        if (ops >= 450) await commitIfNeeded();
      }
      await commitIfNeeded();

      await deleteDoc(tDoc('project_groups', g.id));
      toast({ title: 'Бүлэг устгагдлаа' });
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Алдаа', description: e?.message || 'Устгахад алдаа гарлаа.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Бүлэг удирдах</DialogTitle>
          <DialogDescription>
            Бүлэг (tag) үүсгээд, төслүүдийг олон бүлэгт зэрэг хамааруулж болно.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Шинэ бүлэг</span>
            </div>
            <div className="space-y-2">
              <Label>Нэр</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ж: Onboarding, HR, Sprint 1..." />
            </div>
            <div className="space-y-2">
              <Label>Өнгө</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border ${color === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={isSaving} className="w-full">
              Бүлэг үүсгэх
            </Button>
          </div>

          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Бүлгүүд</span>
              <Badge variant="secondary">{groups.length}</Badge>
            </div>
            <ScrollArea className="h-[320px] w-full">
              <div className="space-y-2 pr-1">
                {groups.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Одоогоор бүлэг алга.</div>
                ) : (
                  groups.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl border bg-white dark:bg-slate-900">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: g.color || '#94a3b8' }} />
                      <span className="font-medium truncate flex-1 min-w-0">{g.name}</span>
                      <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => startEdit(g)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 shrink-0 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400" onClick={() => setDeletingGroup(g)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {editing && (
          <div className="mt-2 p-4 rounded-xl border bg-slate-50 dark:bg-slate-900/50">
            <div className="font-semibold mb-3">Засах: {editing.name}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Нэр</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Өнгө</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`h-7 w-7 rounded-full border ${editColor === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => setDeletingGroup(editing)} disabled={isSaving}>
                <Trash2 className="h-4 w-4 mr-2" />
                Устгах
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(null)} disabled={isSaving}>Болих</Button>
                <Button onClick={handleSaveEdit} disabled={isSaving}>Хадгалах</Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Хаах</Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={!!deletingGroup} onOpenChange={(open) => !open && setDeletingGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Бүлэг устгах</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deletingGroup?.name}&quot; бүлгийг устгахдаа итгэлтэй байна уу? Энэ бүлэгт холбогдсон төслүүдээс бүлгийн холбоос арилна.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

