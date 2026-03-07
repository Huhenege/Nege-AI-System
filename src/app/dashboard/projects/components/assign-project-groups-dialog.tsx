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
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useTenantWrite } from '@/firebase';
import { Timestamp, updateDoc } from 'firebase/firestore';
import type { Project, ProjectGroup } from '@/types/project';

export interface AssignProjectGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  groups: ProjectGroup[];
}

export function AssignProjectGroupsDialog({ open, onOpenChange, project, groups }: AssignProjectGroupsDialogProps) {
  const { firestore } = useFirebase();
  const { tDoc } = useTenantWrite();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && project) setSelectedIds(project.groupIds || []);
  }, [open, project]);

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((prev) => checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id));
  };

  const save = async () => {
    if (!firestore || !project) return;
    setIsSaving(true);
    try {
      await updateDoc(tDoc('projects', project.id), {
        groupIds: selectedIds,
        updatedAt: Timestamp.now(),
      });
      toast({ title: 'Хадгалагдлаа', description: 'Төслийн бүлгүүд шинэчлэгдлээ.' });
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Алдаа', description: e?.message || 'Хадгалахад алдаа гарлаа.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Бүлэг тохируулах</DialogTitle>
          <DialogDescription>
            {project ? `“${project.name}” төслийг олон бүлэгт зэрэг хамааруулж болно.` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Сонгосон</span>
          <Badge variant="secondary">{selectedIds.length}</Badge>
        </div>

        <ScrollArea className="h-[280px] pr-2">
          <div className="space-y-2">
            {groups.length === 0 ? (
              <div className="text-sm text-muted-foreground">Бүлэг алга. Эхлээд “Бүлэг үүсгэх” хийгээрэй.</div>
            ) : (
              groups.map((g) => {
                const checked = selectedIds.includes(g.id);
                return (
                  <label key={g.id} className="flex items-center gap-3 p-3 rounded-xl border bg-white cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={(v) => toggle(g.id, !!v)} />
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color || '#94a3b8' }} />
                    <span className="font-medium">{g.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Болих</Button>
          <Button onClick={save} disabled={isSaving || !project}>Хадгалах</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

