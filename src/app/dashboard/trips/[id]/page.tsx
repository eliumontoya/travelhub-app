import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ALL_CLIENTS_PAGE_SIZE,
  ALL_SUPPLIERS_PAGE_SIZE,
  getClients,
  getSuppliers,
  getTags,
  getTravelAgents,
  getTripById,
  getTripFeedback,
  getTripInternalNotes,
  getServiceDocumentSummariesForTrip,
} from "@/lib/data";
import { computeTripCompleteness } from "@/lib/item-meta";
import { travelerPreviewHref } from "@/lib/trip-visibility";
import { getDailyWeather } from "@/lib/weather";
import { UndoToastHost } from "@/components/UndoToast";
import { TripEditorShortcuts } from "@/components/TripEditorShortcuts";
import {
  addDayAction,
  addItemAction,
  addPackingItemAction,
  deleteDayAction,
  deleteDocumentAction,
  deleteItemAction,
  deleteTripPhotoAction,
  deleteTripDocumentAction,
  deleteTripAction,
  duplicateTripAction,
  duplicateItemAction,
  deletePackingItemAction,
  editDayAction,
  editItemAction,
  generateTripDaysAction,
  getItemDocumentsAction,
  moveDayAction,
  moveItemAction,
  moveItemToDayAction,
  publishTripStatusAction,
  restoreDayAction,
  restoreItemAction,
  saveTripAsTemplateAction,
  setShowCostsToClientAction,
  setTripClientsAction,
  setTripTagsAction,
  togglePackingItemAction,
  updateTripBudgetAction,
  updateTripCommissionAction,
  updateTripCurrencyAction,
  updateTripInstructionsAction,
  updateTripInternalNotesAction,
  updateTripTravelerCountAction,
  updateTripAssignedAgentAction,
  uploadDocumentAction,
  uploadTripDocumentAction,
  uploadTripPhotoAction,
  uploadTripCoverAction,
  removeTripCoverAction,
  getTripDocumentsAction,
  addChecklistItemAction,
  updateChecklistItemAction,
  deleteChecklistItemAction,
  reorderChecklistItemsAction,
  markUploadReviewedAction,
  requestReUploadAction,
  getServiceChecklistForTripAction,
} from "./actions";
import { TripHeaderSection } from "./sections/TripHeaderSection";
import { DaysNavSection } from "./sections/DaysNavSection";
import { ItinerarySection } from "./sections/ItinerarySection";
import type { DayCardActions } from "./sections/DayCard";
import {
  TripSidebarActionsSection,
  type TripSidebarActionsActions,
} from "./sections/TripSidebarActionsSection";
import {
  TripSidebarDetailsSection,
  type TripSidebarDetailsActions,
} from "./sections/TripSidebarDetailsSection";
import { countDaysInRange } from "./sections/trip-editor-meta";

const documentsEnabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const photosEnabled = documentsEnabled;
const coversEnabled = photosEnabled;

export default async function TripEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [trip, { items: clients }, tags, internalNotes, { items: allSuppliers }, travelAgents, serviceDocumentSummaries] =
    await Promise.all([
      getTripById(id),
      getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
      getTags(),
      getTripInternalNotes(id),
      getSuppliers({ pageSize: ALL_SUPPLIERS_PAGE_SIZE }),
      getTravelAgents(),
      getServiceDocumentSummariesForTrip(id),
    ]);
  const clientNameById = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  if (!trip) notFound();
  const feedback = await getTripFeedback(trip.id);

  const dayOrder = trip.days.map((d) => ({ id: d.id, sortOrder: d.sortOrder }));
  const tripDateRangeDays = countDaysInRange(trip.startDate, trip.endDate);
  const completeness = computeTripCompleteness(trip);

  const totalCost = trip.days.reduce(
    (daysSum, day) => daysSum + day.items.reduce((itemsSum, item) => itemsSum + (item.cost ?? 0), 0),
    0
  );
  const hasAnyCost = trip.days.some((day) => day.items.some((item) => item.cost !== undefined));
  const budgetDiff = trip.budget !== undefined ? trip.budget - totalCost : undefined;
  const isPublished = trip.status === "published";
  const isEditable = !isPublished;
  const travelerHref = travelerPreviewHref(trip.slug, trip.id, trip.status);

  const dayWeather = await Promise.all(
    trip.days.map((day) => {
      const withLocation = day.items.find((item) => item.lat !== undefined && item.lng !== undefined);
      return getDailyWeather(withLocation?.lat, withLocation?.lng, day.date);
    })
  );

  const dayCardActions: DayCardActions = {
    moveDay: moveDayAction.bind(null, trip.id, dayOrder),
    editDay: editDayAction.bind(null, trip.id),
    deleteDay: deleteDayAction.bind(null, trip.id),
    restoreDay: restoreDayAction.bind(null, trip.id),
    addItem: addItemAction.bind(null, trip.id),
    moveItem: moveItemAction.bind(null, trip.id),
    moveItemToDay: moveItemToDayAction,
    editItem: editItemAction.bind(null, trip.id),
    deleteItem: deleteItemAction.bind(null, trip.id),
    restoreItem: restoreItemAction.bind(null, trip.id),
    duplicateItem: duplicateItemAction.bind(null, trip.id),
    getItemDocuments: getItemDocumentsAction,
    uploadDocument: uploadDocumentAction.bind(null, trip.id),
    deleteDocument: deleteDocumentAction.bind(null, trip.id),
  };

  const sidebarActions: TripSidebarActionsActions = {
    toggleShowCosts: setShowCostsToClientAction.bind(null, trip.id, trip.slug, !trip.showCostsToClient),
    setClients: setTripClientsAction.bind(null, trip.id),
    setTags: setTripTagsAction.bind(null, trip.id),
    setAgent: updateTripAssignedAgentAction.bind(null, trip.id),
    updateInstructions: updateTripInstructionsAction.bind(null, trip.id, trip.slug),
    updateInternalNotes: updateTripInternalNotesAction.bind(null, trip.id),
    updateCurrency: updateTripCurrencyAction.bind(null, trip.id),
    updateTravelerCount: updateTripTravelerCountAction.bind(null, trip.id, trip.slug),
    updateBudget: updateTripBudgetAction.bind(null, trip.id),
    updateCommission: updateTripCommissionAction.bind(null, trip.id),
    saveAsTemplate: saveTripAsTemplateAction.bind(null, trip.id),
    duplicate: duplicateTripAction.bind(null, trip.id),
  };

  const detailsActions: TripSidebarDetailsActions = {
    cover: {
      onUpload: uploadTripCoverAction.bind(null, trip.id, trip.slug),
      onRemove: removeTripCoverAction.bind(null, trip.id, trip.slug),
    },
    photos: {
      onUpload: uploadTripPhotoAction.bind(null, trip.id, trip.slug),
      onDelete: deleteTripPhotoAction.bind(null, trip.id, trip.slug),
    },
    documents: {
      onUpload: uploadTripDocumentAction.bind(null, trip.id, trip.slug),
      onDelete: deleteTripDocumentAction.bind(null, trip.id, trip.slug),
      onRefresh: getTripDocumentsAction.bind(null, trip.id),
    },
    packing: {
      onAdd: addPackingItemAction.bind(null, trip.id),
      onToggle: togglePackingItemAction.bind(null, trip.id),
      onDelete: deletePackingItemAction.bind(null, trip.id),
    },
    checklist: {
      getServiceChecklistAction: getServiceChecklistForTripAction.bind(null, trip.id),
      addChecklistItemAction: addChecklistItemAction.bind(null, trip.id),
      updateChecklistItemAction: updateChecklistItemAction.bind(null, trip.id),
      deleteChecklistItemAction: deleteChecklistItemAction.bind(null, trip.id),
      reorderChecklistItemsAction: reorderChecklistItemsAction.bind(null, trip.id),
      markUploadReviewedAction: markUploadReviewedAction.bind(null, trip.id),
      requestReUploadAction: requestReUploadAction.bind(null, trip.id),
    },
    deleteTrip: deleteTripAction.bind(null, trip.id),
  };

  return (
    <main className="mx-auto max-w-7xl bg-[#fdf7f3] px-4 py-6 text-[#321426] selection:bg-[#f0bd79] selection:text-[#321426] print:max-w-3xl print:bg-white print:py-0 dark:bg-[#21111a] dark:text-[#fdf7f3]">
      <Link href="/dashboard/trips" className="text-sm font-medium text-[#731044] underline-offset-4 hover:text-[#4a1834] hover:underline print:hidden dark:text-[#f0bd79]">
        ← Volver
      </Link>

      <section className="mt-4 overflow-hidden rounded-2xl border border-[#4a1834]/15 bg-[#fffdfb] shadow-[0_22px_55px_rgba(74,24,52,0.12)] print:mt-0 print:border-0 print:shadow-none dark:border-[#f0bd79]/20 dark:bg-[#2b1520]">
        <TripHeaderSection
          trip={trip}
          travelerHref={travelerHref}
          onTogglePublish={publishTripStatusAction.bind(null, trip.id, trip.status === "published" ? "draft" : "published")}
        />

        <div className="grid gap-6 bg-[#fdf7f3] p-4 lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:p-5 print:block print:bg-white print:p-0 dark:bg-[#21111a]">
          <DaysNavSection
            trip={trip}
            isEditable={isEditable}
            tripDateRangeDays={tripDateRangeDays}
            onAddDay={addDayAction.bind(null, trip.id)}
            onGenerateDays={generateTripDaysAction.bind(null, trip.id)}
          />

          <ItinerarySection
            trip={trip}
            isEditable={isEditable}
            dayOrder={dayOrder}
            dayWeather={dayWeather}
            tripDateRangeDays={tripDateRangeDays}
            allSuppliers={allSuppliers}
            documentsEnabled={documentsEnabled}
            actions={dayCardActions}
            onAddDay={addDayAction.bind(null, trip.id)}
            onGenerateDays={generateTripDaysAction.bind(null, trip.id)}
          />

          <aside className="space-y-4 print:hidden">
            <TripSidebarActionsSection
              trip={trip}
              isEditable={isEditable}
              clients={clients}
              tags={tags}
              travelAgents={travelAgents}
              internalNotes={internalNotes}
              totalCost={totalCost}
              hasAnyCost={hasAnyCost}
              budgetDiff={budgetDiff}
              completeness={completeness}
              actions={sidebarActions}
            />
            <TripSidebarDetailsSection
              trip={trip}
              isEditable={isEditable}
              clientNameById={clientNameById}
              serviceDocumentSummaries={serviceDocumentSummaries}
              feedback={feedback}
              documentsEnabled={documentsEnabled}
              photosEnabled={photosEnabled}
              coversEnabled={coversEnabled}
              actions={detailsActions}
            />
          </aside>
        </div>
      </section>

      <TripEditorShortcuts />
      <UndoToastHost />
    </main>
  );
}
