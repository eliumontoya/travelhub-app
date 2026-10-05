import Link from "next/link";

import { CopyUrlButtonClient } from "@/components/CopyUrlButton";
import { ShareWhatsAppButton } from "@/components/ShareWhatsAppButton";
import { TripPublishSubmitButton } from "@/components/TripPublishSubmitButton";
import { formatAssignedClients, formatDateLong, formatTags } from "@/lib/item-meta";
import type { TripWithDetails } from "@/types";
import { statusMeta } from "./trip-editor-meta";

export function TripHeaderSection({
  trip,
  travelerHref,
  onTogglePublish,
}: {
  trip: TripWithDetails;
  travelerHref: string;
  onTogglePublish: (formData: FormData) => void | Promise<void>;
}) {
  const isPublished = trip.status === "published";

  return (
    <>
      <div className="border-b border-[#f0bd79]/35 bg-[#4a1834] p-5 text-[#fffdfb] sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#fffdfb] sm:text-3xl">{trip.title}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium print:hidden ${statusMeta[trip.status].color}`}>
                {statusMeta[trip.status].label}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#f7dfbc]">
              {formatAssignedClients(trip.clients)} · {trip.travelerCount}{" "}
              {trip.travelerCount === 1 ? "viajero" : "viajeros"}
            </p>
            <p className="mt-1 text-sm text-[#f0bd79]">
              {formatDateLong(trip.startDate)} – {formatDateLong(trip.endDate)}
            </p>
            {trip.tags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5 print:hidden">
                {formatTags(trip.tags).map((name) => (
                  <li
                    key={name}
                    className="rounded-full border border-[#f0bd79]/35 bg-[#5c123e] px-2.5 py-1 text-xs font-medium text-[#f7dfbc]"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2 print:hidden lg:justify-end">
            <form action={onTogglePublish}>
              <TripPublishSubmitButton isPublished={trip.status === "published"} />
            </form>
            <Link
              href={travelerHref}
              target="_blank"
              className="rounded-lg border border-[#f0bd79]/55 bg-[#fffdfb] px-4 py-2 text-sm font-semibold text-[#4a1834] shadow-[0_8px_18px_rgba(27,8,19,0.18)] transition hover:bg-[#f7dfbc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0bd79]"
            >
              {trip.status === "draft" ? "Vista previa borrador" : "Vista previa"}
            </Link>
            <Link
              href={`/dashboard/trips/${trip.id}/quote`}
              className="rounded-lg border border-[#f0bd79]/55 bg-[#fffdfb] px-4 py-2 text-sm font-semibold text-[#4a1834] shadow-[0_8px_18px_rgba(27,8,19,0.18)] transition hover:bg-[#f7dfbc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0bd79]"
            >
              Cotización
            </Link>
            {trip.status === "published" && (
              <>
                <CopyUrlButtonClient slug={trip.slug} />
                <ShareWhatsAppButton slug={trip.slug} title={trip.title} />
              </>
            )}
          </div>
        </div>
      </div>

      {isPublished && (
        <div className="border-b border-[#f0bd79]/35 bg-[#fff3e5] px-5 py-3 text-sm font-medium text-[#5c123e] print:hidden dark:bg-[#3a1c25] dark:text-[#f7dfbc]">
          Viaje publicado bloqueado. Pásalo a borrador para editar días, itinerario o acciones.
        </div>
      )}
    </>
  );
}
