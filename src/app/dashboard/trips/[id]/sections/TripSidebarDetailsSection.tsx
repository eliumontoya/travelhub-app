import type { ComponentProps } from "react";

import { DeleteTripDialog } from "@/components/DeleteTripDialog";
import { PackingListManager } from "@/components/PackingListManager";
import { TripCoverImage } from "@/components/TripCoverImage";
import { TripDocuments } from "@/components/TripDocuments";
import { TripPhotoGallery } from "@/components/TripPhotoGallery";
import { formatDateLong, formatDateTime } from "@/lib/item-meta";
import type { ServiceDocumentSummary, TripFeedback, TripWithDetails } from "@/types";
import { ServiceChecklistManager } from "../ServiceChecklistManager";
import { statusMeta } from "./trip-editor-meta";

type CoverActions = Pick<ComponentProps<typeof TripCoverImage>, "onUpload" | "onRemove">;
type PhotoActions = Pick<ComponentProps<typeof TripPhotoGallery>, "onUpload" | "onDelete">;
type DocumentActions = Pick<ComponentProps<typeof TripDocuments>, "onUpload" | "onDelete" | "onRefresh">;
type PackingActions = Pick<ComponentProps<typeof PackingListManager>, "onAdd" | "onToggle" | "onDelete">;
type ChecklistActions = Pick<
  ComponentProps<typeof ServiceChecklistManager>,
  | "getServiceChecklistAction"
  | "addChecklistItemAction"
  | "updateChecklistItemAction"
  | "deleteChecklistItemAction"
  | "reorderChecklistItemsAction"
  | "markUploadReviewedAction"
  | "requestReUploadAction"
>;

export interface TripSidebarDetailsActions {
  cover: CoverActions;
  photos: PhotoActions;
  documents: DocumentActions;
  packing: PackingActions;
  checklist: ChecklistActions;
  deleteTrip: (formData: FormData) => Promise<void>;
}

export function TripSidebarDetailsSection({
  trip,
  isEditable,
  clientNameById,
  serviceDocumentSummaries,
  feedback,
  documentsEnabled,
  photosEnabled,
  coversEnabled,
  actions,
}: {
  trip: TripWithDetails;
  isEditable: boolean;
  clientNameById: Record<string, string>;
  serviceDocumentSummaries: ServiceDocumentSummary[];
  feedback: TripFeedback[];
  documentsEnabled: boolean;
  photosEnabled: boolean;
  coversEnabled: boolean;
  actions: TripSidebarDetailsActions;
}) {
  return (
    <>
      {isEditable && (
      <TripCoverImage
        coverImageUrl={trip.coverImageUrl}
        coversEnabled={coversEnabled}
        onUpload={actions.cover.onUpload}
        onRemove={actions.cover.onRemove}
      />
      )}

      {isEditable && (
      <TripPhotoGallery
        photos={trip.photos}
        photosEnabled={photosEnabled}
        onUpload={actions.photos.onUpload}
        onDelete={actions.photos.onDelete}
      />
      )}

      {isEditable && (
      <TripDocuments
        documents={trip.documents}
        documentsEnabled={documentsEnabled}
        onUpload={actions.documents.onUpload}
        onDelete={actions.documents.onDelete}
        onRefresh={actions.documents.onRefresh}
      />
      )}

      <ServiceChecklistManager
        tripId={trip.id}
        summaries={serviceDocumentSummaries}
        clientNameById={clientNameById}
        isArchived={trip.status === "archived"}
        {...actions.checklist}
      />

      {trip.statusHistory.length > 0 && (
        <section className="rounded-xl border border-[#e7c797] bg-[#fffdfb] p-4 shadow-[0_10px_24px_rgba(74,24,52,0.06)] dark:border-[#f0bd79]/25 dark:bg-[#2b1520]">
          <h2 className="mb-2 text-sm font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">Historial de estado</h2>
          <ul className="space-y-1.5">
            {[...trip.statusHistory].reverse().slice(0, 3).map((entry) => (
              <li key={entry.id} className="text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
                <span className="block text-xs text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]">{formatDateTime(entry.changedAt)}</span>
                <span>
                  {entry.fromStatus ? (
                    <>
                      {statusMeta[entry.fromStatus].label} →{" "}
                      <span className="font-medium text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">
                        {statusMeta[entry.toStatus].label}
                      </span>
                    </>
                  ) : (
                    <>
                      Creado como{" "}
                      <span className="font-medium text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">
                        {statusMeta[entry.toStatus].label}
                      </span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {feedback.length > 0 && (
        <section className="rounded-xl border border-[#e7c797] bg-[#fffdfb] p-4 shadow-[0_10px_24px_rgba(74,24,52,0.06)] dark:border-[#f0bd79]/25 dark:bg-[#2b1520]">
          <h3 className="mb-4 font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">Feedback recibido</h3>
          <div className="space-y-3">
            {feedback.map((f) => (
              <div key={f.id} className="rounded-lg border border-[var(--operator-border)] p-3 dark:border-[var(--operator-border)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[var(--operator-gold)]/15 px-3 py-1 text-xs font-semibold text-[var(--operator-brand)]">
                    Calificación {f.rating}/5
                  </span>
                  <span className="text-xs text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]">{formatDateLong(f.createdAt.slice(0, 10))}</span>
                </div>
                {f.comment && <p className="mt-1 text-sm text-[#5c123e] dark:text-[#f7dfbc]">{f.comment}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {isEditable && (
      <PackingListManager
        items={trip.packingItems}
        onAdd={actions.packing.onAdd}
        onToggle={actions.packing.onToggle}
        onDelete={actions.packing.onDelete}
      />
      )}

      <section className="rounded-xl border border-[var(--operator-coral)]/40 bg-[var(--operator-coral)]/10/60 p-4 dark:border-[var(--operator-coral)]/40 dark:bg-[var(--operator-coral)]/10/10">
        <h2 className="text-sm font-semibold text-[var(--operator-coral)] dark:text-[var(--operator-coral)]">Zona de peligro</h2>
        <p className="mt-2 text-sm text-[var(--operator-coral)] dark:text-[var(--operator-coral)]">
          Borra definitivamente este viaje y sus datos relacionados.
        </p>
        <div className="mt-3">
          <DeleteTripDialog tripTitle={trip.title} action={actions.deleteTrip} />
        </div>
      </section>
    </>
  );
}
