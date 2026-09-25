"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { TravelerActivityForm } from "@/components/TravelerActivityForm";
import { OperatorButton } from "@/components/ui/OperatorButton";

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
      <OperatorButton
        variant="secondary"
        aria-expanded={isExpanded}
        onClick={() => context.setExpandedDayId(isExpanded ? null : tripDayId)}
        className="min-h-10 border border-[var(--operator-border)] text-[var(--operator-brand)]"
      >
        + Agregar actividad a este día
      </OperatorButton>
      {isExpanded && (
        <div className="mt-3 rounded-[var(--operator-radius-card)] border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] p-3">
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
