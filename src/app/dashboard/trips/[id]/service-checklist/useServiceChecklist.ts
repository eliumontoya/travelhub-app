"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ServiceChecklistItemWithUpload,
  ServiceWithChecklist,
} from "@/types";

export type AddChecklistItemAction = (
  serviceId: string,
  formData: FormData,
) => Promise<void>;
export type UpdateChecklistItemAction = (
  checklistItemId: string,
  formData: FormData,
) => Promise<void>;
export type DeleteChecklistItemAction = (checklistItemId: string) => Promise<void>;
export type ReorderChecklistItemsAction = (
  serviceId: string,
  orderedIds: string[],
) => Promise<void>;
export type MarkUploadReviewedAction = (uploadId: string) => Promise<void>;
export type RequestReUploadAction = (
  uploadId: string,
  formData: FormData,
) => Promise<void>;
export type GetServiceChecklistAction = (
  serviceId: string,
) => Promise<ServiceWithChecklist>;

export type ServiceChecklistActions = {
  getServiceChecklistAction: GetServiceChecklistAction;
  addChecklistItemAction: AddChecklistItemAction;
  updateChecklistItemAction: UpdateChecklistItemAction;
  deleteChecklistItemAction: DeleteChecklistItemAction;
  reorderChecklistItemsAction: ReorderChecklistItemsAction;
  markUploadReviewedAction: MarkUploadReviewedAction;
  requestReUploadAction: RequestReUploadAction;
};

export function statusLabel(item: ServiceChecklistItemWithUpload) {
  const status = item.upload?.status;
  if (status === "processed") return { icon: "✓", text: "Procesado" };
  if (status === "reviewed") return { icon: "✓", text: "Revisado" };
  if (status === "re_upload_requested")
    return { icon: "!", text: "Re-subir solicitado" };
  if (status === "uploaded")
    return { icon: "↻", text: "Pendiente de revisión" };
  return { icon: "□", text: "Pendiente" };
}

export function itemHasReviewableUpload(item: ServiceChecklistItemWithUpload) {
  return item.upload?.status === "uploaded";
}

export function useServiceChecklist({
  actions,
}: {
  actions: ServiceChecklistActions;
}) {
  const {
    getServiceChecklistAction,
    addChecklistItemAction,
    updateChecklistItemAction,
    deleteChecklistItemAction,
    reorderChecklistItemsAction,
    markUploadReviewedAction,
    requestReUploadAction,
  } = actions;

  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [isPending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [selectedChecklist, setSelectedChecklist] =
    useState<ServiceWithChecklist | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [reUploadItemId, setReUploadItemId] = useState<string | null>(null);

  async function refreshChecklist(serviceId: string) {
    setDetailError(null);
    try {
      setSelectedChecklist(await getServiceChecklistAction(serviceId));
    } catch (err) {
      setDetailError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los documentos.",
      );
    }
  }

  function runAction(action: () => Promise<void>, refreshServiceId?: string) {
    setGlobalError(null);
    startTransition(async () => {
      try {
        await action();
        if (refreshServiceId) await refreshChecklist(refreshServiceId);
        router.refresh();
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : "Error inesperado");
      }
    });
  }

  function openChecklist(serviceId: string) {
    setSelectedChecklist(null);
    setSelectedServiceId(serviceId);
    dialogRef.current?.showModal();
    startTransition(() => {
      void refreshChecklist(serviceId);
    });
  }

  function closeChecklist() {
    dialogRef.current?.close();
  }

  function handleDialogClose() {
    const serviceId = selectedServiceId;
    setSelectedServiceId(null);
    setSelectedChecklist(null);
    setEditingItemId(null);
    setReUploadItemId(null);
    if (serviceId) triggerRefs.current[serviceId]?.focus();
  }

  function handleAddItem(
    serviceId: string,
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    runAction(async () => {
      await addChecklistItemAction(serviceId, formData);
      form.reset();
    }, serviceId);
  }

  function handleUpdateItem(
    checklistItemId: string,
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    runAction(async () => {
      await updateChecklistItemAction(checklistItemId, formData);
      setEditingItemId(null);
    });
  }

  function handleDeleteItem(checklistItemId: string) {
    if (!confirm("¿Eliminar este item del checklist?")) return;
    runAction(() => deleteChecklistItemAction(checklistItemId));
  }

  function handleReorder(
    serviceId: string,
    items: ServiceChecklistItemWithUpload[],
    checklistItemId: string,
    direction: "up" | "down",
  ) {
    const index = items.findIndex((item) => item.id === checklistItemId);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= items.length) return;
    const next = [...items];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    runAction(() =>
      reorderChecklistItemsAction(
        serviceId,
        next.map((item) => item.id),
      ),
    );
  }

  function handleMarkReviewed(uploadId: string) {
    runAction(() => markUploadReviewedAction(uploadId));
  }

  function handleRequestReUpload(
    uploadId: string,
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    runAction(async () => {
      await requestReUploadAction(uploadId, formData);
      setReUploadItemId(null);
    });
  }

  return {
    isPending,
    globalError,
    detailError,
    selectedServiceId,
    selectedChecklist,
    editingItemId,
    reUploadItemId,
    setEditingItemId,
    setReUploadItemId,
    dialogRef,
    triggerRefs,
    openChecklist,
    closeChecklist,
    handleDialogClose,
    handleAddItem,
    handleUpdateItem,
    handleDeleteItem,
    handleReorder,
    handleMarkReviewed,
    handleRequestReUpload,
  };
}
