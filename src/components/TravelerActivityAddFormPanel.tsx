"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { TravelerActivityForm } from "@/components/TravelerActivityForm";

type TravelerActivityAddFormContextValue = {
  expandedDayId: string | null;
  setExpandedDayId: (dayId: string | null) => void;
};

const TravelerActivityAddFormContext =
  createContext<TravelerActivityAddFormContextValue | null>(null);

export function TravelerActivityAddFormProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);

  return (
    <TravelerActivityAddFormContext.Provider
      value={{ expandedDayId, setExpandedDayId }}
    >
      {children}
    </TravelerActivityAddFormContext.Provider>
  );
}

export function TravelerActivityAddFormPanel({
  tripId,
  tripDayId,
  slug,
}: {
  tripId: string;
  tripDayId: string;
  slug: string;
}) {
  const context = useContext(TravelerActivityAddFormContext);
  const isExpanded = context?.expandedDayId === tripDayId;

  if (!context) {
    return (
      <TravelerActivityForm tripId={tripId} tripDayId={tripDayId} slug={slug} />
    );
  }

  return (
    <section className="mb-4 print:hidden">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => context.setExpandedDayId(isExpanded ? null : tripDayId)}
        className="inline-flex min-h-10 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
      >
        + Agregar actividad a este día
      </button>
      {isExpanded && (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-950 dark:bg-blue-950/20">
          <TravelerActivityForm
            tripId={tripId}
            tripDayId={tripDayId}
            slug={slug}
          />
        </div>
      )}
    </section>
  );
}
