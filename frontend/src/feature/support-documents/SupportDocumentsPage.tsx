'use client';

import { useState, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RolePermissionGuard from '@/components/auth/RolePermissionGuard';
import { EmptyState } from '@/components/ui/empty-state';
import {
  createSupportDocumentAction,
  updateSupportDocumentAction,
  deleteSupportDocumentAction,
} from '@/api/server-actions/support-documents';
import type {
  SupportDocument,
  SupportDocumentCreate,
  SupportDocumentUpdate,
  SupportDocumentListResponse,
} from '@/api/types';
import CategorySection from './components/CategorySection';
import DocumentFormDialog from './components/DocumentFormDialog';

interface SupportDocumentsPageProps {
  initialData: SupportDocumentListResponse;
}

export default function SupportDocumentsPage({ initialData }: SupportDocumentsPageProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<SupportDocument | null>(null);

  // Group documents: system docs (org=null) and org docs, then by category
  const systemDocs = initialData.items.filter((doc) => doc.organizationId === null);
  const orgDocs = initialData.items.filter((doc) => doc.organizationId !== null);

  // Group org docs by category
  const orgDocsByCategory = orgDocs.reduce<Record<string, SupportDocument[]>>((acc, doc) => {
    const cat = doc.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  const handleCreate = useCallback(
    async (data: SupportDocumentCreate | SupportDocumentUpdate) => {
      const result = await createSupportDocumentAction(data as SupportDocumentCreate);
      if (result.success) {
        startTransition(() => router.refresh());
      }
    },
    [router],
  );

  const handleUpdate = useCallback(
    async (data: SupportDocumentCreate | SupportDocumentUpdate) => {
      if (!editingDocument) return;
      const result = await updateSupportDocumentAction(editingDocument.id, data as SupportDocumentUpdate);
      if (result.success) {
        startTransition(() => router.refresh());
      }
    },
    [editingDocument, router],
  );

  const handleDelete = useCallback(
    async (doc: SupportDocument) => {
      if (!confirm(`「${doc.title}」を削除しますか？`)) return;
      const result = await deleteSupportDocumentAction(doc.id);
      if (result.success) {
        startTransition(() => router.refresh());
      }
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

  const hasDocuments = initialData.items.length > 0;

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

      {!hasDocuments && (
        <EmptyState
          title="ドキュメントがありません"
          description="管理者がドキュメントを追加するとここに表示されます"
          icon={<FileText className="h-12 w-12" />}
        />
      )}

      {/* System-wide documents */}
      {systemDocs.length > 0 && (
        <CategorySection
          title="システム共通ドキュメント"
          documents={systemDocs}
          isAdmin={false}
        />
      )}

      {/* Org-specific documents grouped by category */}
      {Object.entries(orgDocsByCategory).map(([category, docs]) => (
        <RolePermissionGuard key={category} requiredRole="admin" hideOnDenied fallback={
          <CategorySection
            title={category}
            documents={docs}
            isAdmin={false}
          />
        }>
          <CategorySection
            title={category}
            documents={docs}
            isAdmin={true}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </RolePermissionGuard>
      ))}

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
