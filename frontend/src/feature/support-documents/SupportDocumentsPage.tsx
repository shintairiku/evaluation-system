'use client';

import { useState, useCallback, useTransition, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DndContext, DragEndEvent, DragOverlay, closestCenter } from '@dnd-kit/core';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RolePermissionGuard from '@/components/auth/RolePermissionGuard';
import { EmptyState } from '@/components/ui/empty-state';
import { useCurrentUserContext } from '@/context/CurrentUserContext';
import {
  createSupportDocumentAction,
  updateSupportDocumentAction,
  deleteSupportDocumentAction,
  reorderSupportDocumentsAction,
} from '@/api/server-actions/support-documents';
import type {
  SupportDocument,
  SupportDocumentCreate,
  SupportDocumentUpdate,
  SupportDocumentListResponse,
  SupportDocumentReorderItem,
} from '@/api/types';
import CategorySection from './components/CategorySection';
import DocumentFormDialog from './components/DocumentFormDialog';
import DocumentCard from './components/DocumentCard';

interface SupportDocumentsPageProps {
  initialData: SupportDocumentListResponse;
}

export default function SupportDocumentsPage({ initialData }: SupportDocumentsPageProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { user } = useCurrentUserContext();
  const isAdmin = useMemo(
    () => user?.roles?.some((r) => r.name.toLowerCase() === 'admin') ?? false,
    [user?.roles],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<SupportDocument | null>(null);
  const [documents, setDocuments] = useState(initialData.items);
  const [activeDoc, setActiveDoc] = useState<SupportDocument | null>(null);

  // Sync local state when server data changes (after router.refresh)
  useEffect(() => {
    setDocuments(initialData.items);
  }, [initialData.items]);

  // Group documents: system docs (org=null) and org docs, then by category
  const systemDocs = documents.filter((doc) => doc.organizationId === null);
  const orgDocs = documents.filter((doc) => doc.organizationId !== null);

  // Group org docs by category, preserving displayOrder
  const orgDocsByCategory = orgDocs.reduce<Record<string, SupportDocument[]>>((acc, doc) => {
    const cat = doc.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  // Sort docs within each category by displayOrder
  for (const docs of Object.values(orgDocsByCategory)) {
    docs.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  const handleCreate = useCallback(
    async (data: SupportDocumentCreate | SupportDocumentUpdate) => {
      const result = await createSupportDocumentAction(data as SupportDocumentCreate);
      if (!result.success) {
        toast.error(result.errorMessage || 'ドキュメントの追加に失敗しました');
        return;
      }
      toast.success('ドキュメントを追加しました');
      startTransition(() => router.refresh());
    },
    [router],
  );

  const handleUpdate = useCallback(
    async (data: SupportDocumentCreate | SupportDocumentUpdate) => {
      if (!editingDocument) return;
      const result = await updateSupportDocumentAction(editingDocument.id, data as SupportDocumentUpdate);
      if (!result.success) {
        toast.error(result.errorMessage || 'ドキュメントの更新に失敗しました');
        return;
      }
      toast.success('ドキュメントを更新しました');
      startTransition(() => router.refresh());
    },
    [editingDocument, router],
  );

  const handleDelete = useCallback(
    async (doc: SupportDocument) => {
      if (!confirm(`「${doc.title}」を削除しますか？`)) return;
      const result = await deleteSupportDocumentAction(doc.id);
      if (!result.success) {
        toast.error(result.errorMessage || 'ドキュメントの削除に失敗しました');
        return;
      }
      toast.success('ドキュメントを削除しました');
      startTransition(() => router.refresh());
    },
    [router],
  );

  const handleEdit = useCallback((doc: SupportDocument) => {
    setEditingDocument(doc);
    setDialogOpen(true);
  }, []);

  const handleOpenCreate = useCallback(() => {
    setEditingDocument(null);
    setDialogOpen(true);
  }, []);

  // Drag & Drop handlers
  const handleDragStart = useCallback(
    (event: { active: { id: string | number } }) => {
      const doc = documents.find((d) => d.id === event.active.id);
      setActiveDoc(doc ?? null);
    },
    [documents],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDoc(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const draggedDocId = active.id as string;
      const draggedDoc = documents.find((d) => d.id === draggedDocId);
      if (!draggedDoc || draggedDoc.organizationId === null) return;

      // Determine target category
      let targetCategory: string;
      let targetDocId: string | null = null;

      if (String(over.id).startsWith('category:')) {
        // Dropped on a category zone
        targetCategory = String(over.id).replace('category:', '');
      } else {
        // Dropped on another document — get that document's category
        const overDoc = documents.find((d) => d.id === over.id);
        if (!overDoc) return;
        targetCategory = overDoc.category;
        targetDocId = overDoc.id;
      }

      // Build new documents array with updated category + order
      const updatedDocs = documents.map((d) => ({ ...d }));
      const draggedIdx = updatedDocs.findIndex((d) => d.id === draggedDocId);
      if (draggedIdx === -1) return;

      // Update the dragged doc's category
      updatedDocs[draggedIdx] = { ...updatedDocs[draggedIdx], category: targetCategory };

      // Get all docs in the target category (excluding system docs)
      const categoryDocs = updatedDocs
        .filter((d) => d.category === targetCategory && d.organizationId !== null)
        .sort((a, b) => a.displayOrder - b.displayOrder);

      // Reorder: remove dragged doc and insert at target position
      const withoutDragged = categoryDocs.filter((d) => d.id !== draggedDocId);
      const draggedItem = categoryDocs.find((d) => d.id === draggedDocId)!;

      let insertIdx = withoutDragged.length; // default: end
      if (targetDocId) {
        const overIdx = withoutDragged.findIndex((d) => d.id === targetDocId);
        if (overIdx !== -1) insertIdx = overIdx;
      }
      withoutDragged.splice(insertIdx, 0, draggedItem);

      // Assign new displayOrder values
      const reorderItems: SupportDocumentReorderItem[] = withoutDragged.map((d, i) => ({
        id: d.id,
        category: targetCategory,
        displayOrder: i,
      }));

      // Also recalculate order for the source category if different
      if (draggedDoc.category !== targetCategory) {
        const sourceCategoryDocs = updatedDocs
          .filter((d) => d.category === draggedDoc.category && d.organizationId !== null && d.id !== draggedDocId)
          .sort((a, b) => a.displayOrder - b.displayOrder);
        sourceCategoryDocs.forEach((d, i) => {
          reorderItems.push({ id: d.id, category: draggedDoc.category, displayOrder: i });
        });
      }

      // Optimistic update
      const optimisticDocs = updatedDocs.map((d) => {
        const reordered = reorderItems.find((r) => r.id === d.id);
        if (reordered) {
          return { ...d, category: reordered.category, displayOrder: reordered.displayOrder };
        }
        return d;
      });
      setDocuments(optimisticDocs);

      // Persist
      const result = await reorderSupportDocumentsAction(reorderItems);
      if (!result.success) {
        toast.error(result.errorMessage || '並び替えに失敗しました');
        setDocuments(initialData.items); // revert
        return;
      }
      startTransition(() => router.refresh());
    },
    [documents, initialData.items, router],
  );

  const hasDocuments = documents.length > 0;

  const renderContent = () => (
    <>
      {!hasDocuments && (
        <EmptyState
          title="ドキュメントがありません"
          description="管理者がドキュメントを追加するとここに表示されます"
          icon={<FileText className="h-12 w-12" />}
        />
      )}

      {/* System-wide documents — not draggable */}
      {systemDocs.length > 0 && (
        <CategorySection
          title="システム共通ドキュメント"
          documents={systemDocs}
          isAdmin={false}
        />
      )}

      {/* Org-specific documents grouped by category */}
      {Object.entries(orgDocsByCategory).map(([category, docs]) =>
        isAdmin ? (
          <CategorySection
            key={category}
            title={category}
            documents={docs}
            isAdmin={true}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : (
          <CategorySection
            key={category}
            title={category}
            documents={docs}
            isAdmin={false}
          />
        ),
      )}
    </>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">リンク集</h1>
          <p className="text-sm text-muted-foreground mt-1">
            評価に関する参考資料・外部リンク
          </p>
        </div>

        <RolePermissionGuard requiredRole="admin" hideOnDenied>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            追加
          </Button>
        </RolePermissionGuard>
      </div>

      {isAdmin ? (
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {renderContent()}
          <DragOverlay>
            {activeDoc && (
              <DocumentCard document={activeDoc} isAdmin={false} />
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        renderContent()
      )}

      {/* Form dialog */}
      <DocumentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        document={editingDocument}
        existingCategories={initialData.categories}
        onSubmit={editingDocument ? handleUpdate : handleCreate}
      />
    </div>
  );
}
