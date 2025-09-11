"use client";
import { useMemo, useState } from "react";
import type { StageWithUserCount, UserDetailResponse, UUID } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateUserStagesAction } from "@/api/server-actions/users";
import { toast } from "sonner";

type Props = {
  stages: StageWithUserCount[];
  users: UserDetailResponse[];
};

type UserStageChange = {
  userId: UUID;
  fromStageId: UUID | null;
  toStageId: UUID;
};

export default function StageManagementBoard({ stages, users }: Props) {
  const stageOrder = useMemo(() => stages.map(s => s.id), [stages]);
  const [columns, setColumns] = useState<Record<string, UserDetailResponse[]>>(() => {
    const map: Record<string, UserDetailResponse[]> = {};
    stageOrder.forEach(id => { map[id] = []; });
    users.forEach(u => {
      const sid = u.stage?.id as string | undefined;
      if (sid && map[sid]) map[sid].push(u);
    });
    return map;
  });
  const [pending, setPending] = useState<UserStageChange[]>([]);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  function findUserById(userId: string): UserDetailResponse | undefined {
    // Search in current columns first
    for (const list of Object.values(columns)) {
      const found = list.find(u => u.id === userId);
      if (found) return found;
    }
    // Fallback to original users
    return users.find(u => u.id === userId);
  }

  function onMoveUser(user: UserDetailResponse, toStageId: string) {
    const fromStageId = user.stage?.id || null;
    if (fromStageId === toStageId) return;

    setColumns(prev => {
      const next = { ...prev };
      if (fromStageId) {
        next[fromStageId] = next[fromStageId].filter(u => u.id !== user.id);
      }
      next[toStageId] = [...(next[toStageId] || []), { ...user, stage: { id: toStageId, name: user.stage?.name || "" } as any }];
      return next;
    });

    setPending(prev => {
      const rest = prev.filter(p => p.userId !== user.id);
      return [...rest, { userId: user.id, fromStageId, toStageId }];
    });
    setIsEdit(true);
  }

  async function onSave() {
    if (!pending.length) return;
    setSaving(true);
    const changes = pending.map(p => ({ userId: p.userId, toStageId: p.toStageId }));
    const res = await updateUserStagesAction(changes);
    setSaving(false);
    if (res.success) {
      setIsEdit(false);
      setPending([]);
      toast.success("Changes saved successfully");
    } else {
      toast.error("Failed to save some changes");
    }
  }

  function onCancel() {
    // Reset to initial distribution
    const reset: Record<string, UserDetailResponse[]> = {};
    stageOrder.forEach(id => { reset[id] = []; });
    users.forEach(u => {
      const sid = u.stage?.id as string | undefined;
      if (sid && reset[sid]) reset[sid].push(u);
    });
    setColumns(reset);
    setPending([]);
    setIsEdit(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant={isEdit ? "default" : "secondary"} disabled={!isEdit || saving} onClick={onSave}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
        <Button variant="ghost" disabled={!isEdit || saving} onClick={onCancel}>Cancel</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {stages.map(stage => (
          <StageColumn
            key={stage.id}
            stageId={stage.id}
            title={stage.name}
            users={columns[stage.id] || []}
            onMoveUser={onMoveUser}
            findUserById={findUserById}
          />
        ))}
      </div>
    </div>
  );
}

function StageColumn({ stageId, title, users, onMoveUser, findUserById }: {
  stageId: string;
  title: string;
  users: UserDetailResponse[];
  onMoveUser: (user: UserDetailResponse, toStageId: string) => void;
  findUserById: (userId: string) => UserDetailResponse | undefined;
}) {
  function onDrop(ev: React.DragEvent<HTMLDivElement>) {
    ev.preventDefault();
    const payload = ev.dataTransfer.getData("text/plain");
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as { id: string };
      const user = findUserById(parsed.id);
      if (user) onMoveUser(user, stageId);
    } catch {}
  }
  return (
    <Card className="p-3" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <div className="font-semibold mb-2">{title}</div>
      <div className="space-y-2">
        {users.map(u => (
          <UserCard key={u.id} user={u} />
        ))}
      </div>
    </Card>
  );
}

function UserCard({ user }: { user: UserDetailResponse }) {
  function onDragStart(ev: React.DragEvent<HTMLDivElement>) {
    ev.dataTransfer.setData("text/plain", JSON.stringify({ id: user.id }));
    ev.dataTransfer.effectAllowed = "move";
  }
  return (
    <Card className="p-2 cursor-move" draggable onDragStart={onDragStart}>
      <div className="text-sm font-medium">{user.name}</div>
      <div className="text-xs text-muted-foreground">{user.employee_code} • {user.email}</div>
    </Card>
  );
}


