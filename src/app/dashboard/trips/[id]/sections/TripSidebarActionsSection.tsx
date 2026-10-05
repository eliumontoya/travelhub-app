import { CopyTripSummaryButtonClient } from "@/components/CopyTripSummaryButton";
import { DuplicateTripButton } from "@/components/DuplicateTripButton";
import { PrintButton } from "@/components/PrintButton";
import { SaveAsTemplateDialog } from "@/components/SaveAsTemplateDialog";
import { TravelAgentCombobox } from "@/components/TravelAgentCombobox";
import { TripBudgetDialog } from "@/components/TripBudgetDialog";
import { TripClientsManager } from "@/components/TripClientsManager";
import { TripCommissionDialog } from "@/components/TripCommissionDialog";
import { TripCurrencyDialog } from "@/components/TripCurrencyDialog";
import { TripInstructionsDialog } from "@/components/TripInstructionsDialog";
import { TripInternalNotesDialog } from "@/components/TripInternalNotesDialog";
import { TripTagsManager } from "@/components/TripTagsManager";
import { TripTravelerCountDialog } from "@/components/TripTravelerCountDialog";
import { computeTripCompleteness, formatCost, formatDateLong } from "@/lib/item-meta";
import type { Client, Tag, TravelAgent, TripWithDetails } from "@/types";

export interface TripSidebarActionsActions {
  toggleShowCosts: (formData: FormData) => Promise<void>;
  setClients: (formData: FormData) => Promise<void>;
  setTags: (formData: FormData) => Promise<void>;
  setAgent: (formData: FormData) => Promise<void>;
  updateInstructions: (formData: FormData) => Promise<void>;
  updateInternalNotes: (formData: FormData) => Promise<void>;
  updateCurrency: (formData: FormData) => Promise<void>;
  updateTravelerCount: (formData: FormData) => Promise<void>;
  updateBudget: (formData: FormData) => Promise<void>;
  updateCommission: (formData: FormData) => Promise<void>;
  saveAsTemplate: (formData: FormData) => Promise<void>;
  duplicate: () => Promise<void>;
}

export function TripSidebarActionsSection({
  trip,
  isEditable,
  clients,
  tags,
  travelAgents,
  internalNotes,
  totalCost,
  hasAnyCost,
  budgetDiff,
  completeness,
  actions,
}: {
  trip: TripWithDetails;
  isEditable: boolean;
  clients: Client[];
  tags: Tag[];
  travelAgents: TravelAgent[];
  internalNotes: string | null;
  totalCost: number;
  hasAnyCost: boolean;
  budgetDiff: number | undefined;
  completeness: ReturnType<typeof computeTripCompleteness>;
  actions: TripSidebarActionsActions;
}) {
  return (
    <>
      <section className="rounded-xl border border-[#e7c797] bg-[#fffdfb] p-4 shadow-[0_10px_24px_rgba(74,24,52,0.06)] dark:border-[#f0bd79]/25 dark:bg-[#2b1520]">
        <h2 className="text-sm font-semibold text-[#4a1834] dark:text-[#fffdfb]">Acciones</h2>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {isEditable ? (
          <>
          <form action={actions.toggleShowCosts}>
            <button
              type="submit"
              className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-left text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
            >
              {trip.showCostsToClient ? "Ocultar costos al cliente" : "Mostrar costos al cliente"}
            </button>
          </form>
          <TripClientsManager
            clients={clients}
            assignedClientIds={trip.clients.map((c) => c.id)}
            trigger={
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-left text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
              >
                Gestionar clientes
              </button>
            }
            onSubmit={actions.setClients}
          />
          <TripTagsManager
            tags={tags}
            assignedTagIds={trip.tags.map((t) => t.id)}
            trigger={
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-left text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
              >
                Gestionar tags
              </button>
            }
            onSubmit={actions.setTags}
          />
          <form action={actions.setAgent} className="space-y-2">
            <label className="block text-sm font-medium text-[var(--operator-ink)] dark:text-[var(--operator-ink-subtle)]">
              Agente asignado
            </label>
            <TravelAgentCombobox
              travelAgents={travelAgents}
              name="assignedAgentId"
              defaultValue={trip.assignedAgentId}
            />
            <button
              type="submit"
              className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-left text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
            >
              Guardar agente
            </button>
          </form>
          <TripInstructionsDialog
            trip={trip}
            trigger={
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-left text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
              >
                Instrucciones
              </button>
            }
            onSubmit={actions.updateInstructions}
          />
          <TripInternalNotesDialog
            internalNotes={internalNotes}
            trigger={
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-left text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
              >
                Notas internas
              </button>
            }
            onSubmit={actions.updateInternalNotes}
          />
          <TripCurrencyDialog
            trip={trip}
            trigger={
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-left text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
              >
                Moneda ({trip.currency})
              </button>
            }
            onSubmit={actions.updateCurrency}
          />
          <TripTravelerCountDialog
            trip={trip}
            trigger={
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-left text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
              >
                # Viajeros
              </button>
            }
            onSubmit={actions.updateTravelerCount}
          />
          <TripBudgetDialog
            trip={trip}
            trigger={
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-left text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
              >
                Presupuesto
              </button>
            }
            onSubmit={actions.updateBudget}
          />
          <TripCommissionDialog
            trip={trip}
            trigger={
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-left text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
              >
                Comisión
              </button>
            }
            onSubmit={actions.updateCommission}
          />
          </>
          ) : (
            <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-950 dark:bg-green-950/20 dark:text-green-300">
              Las acciones de edición están bloqueadas mientras el viaje está publicado.
            </p>
          )}
          {isEditable && (
          <>
          <CopyTripSummaryButtonClient trip={trip} />
          <SaveAsTemplateDialog
            defaultTitle={trip.title}
            trigger={
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-left text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
              >
                Guardar como plantilla
              </button>
            }
            onSubmit={actions.saveAsTemplate}
          />
          <DuplicateTripButton onDuplicate={actions.duplicate} />
          </>
          )}
          <PrintButton />
        </div>
      </section>


      <section className="rounded-xl border border-[#e7c797] bg-[#fffdfb] p-4 shadow-[0_10px_24px_rgba(74,24,52,0.06)] dark:border-[#f0bd79]/25 dark:bg-[#2b1520]">
        <h2 className="text-sm font-semibold text-[#4a1834] dark:text-[#fffdfb]">Finanzas</h2>
        {(hasAnyCost || trip.budget !== undefined) ? (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">Costo total</span>
              <span className="font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">{formatCost(totalCost, trip.currency)}</span>
            </div>
            {trip.budget !== undefined && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">Presupuesto</span>
                  <span className="font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">{formatCost(trip.budget, trip.currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
                    {budgetDiff !== undefined && budgetDiff < 0 ? "Excedido" : "Disponible"}
                  </span>
                  <span
                    className={`font-semibold ${
                      budgetDiff !== undefined && budgetDiff < 0
                        ? "text-[var(--operator-coral)] dark:text-[var(--operator-coral)]"
                        : "text-green-700 dark:text-green-400"
                    }`}
                  >
                    {formatCost(Math.abs(budgetDiff ?? 0), trip.currency)}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--operator-ink-subtle)]">Sin costos registrados.</p>
        )}
      </section>

      <section className="rounded-xl border border-[#e7c797] bg-[#fffdfb] p-4 shadow-[0_10px_24px_rgba(74,24,52,0.06)] dark:border-[#f0bd79]/25 dark:bg-[#2b1520]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#4a1834] dark:text-[#fffdfb]">Completitud</h2>
          <span className="text-sm font-medium text-[var(--operator-ink)] dark:text-[var(--operator-ink-subtle)]">
            {completeness.documentPercentage}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#f8e7e7] dark:bg-[#5c123e]">
          <div
            className="h-full rounded-full bg-[#731044]"
            style={{ width: `${completeness.documentPercentage}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
          {completeness.itemsWithDocuments} de {completeness.totalItems} items tienen documentos.
        </p>
        {completeness.emptyDays.length > 0 && (
          <p className="mt-2 text-xs font-medium text-[var(--operator-brand)] dark:text-[var(--operator-gold)]">
            {completeness.emptyDays.length === 1
              ? `1 día sin items: ${formatDateLong(completeness.emptyDays[0].date)}`
              : `${completeness.emptyDays.length} días sin items`}
          </p>
        )}
      </section>
    </>
  );
}
