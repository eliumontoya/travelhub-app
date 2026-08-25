"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Supplier } from "@/types";
import { updateSupplierAction } from "@/app/dashboard/suppliers/actions";
import {
  getCoordinate,
  getDisplayName,
  loadGooglePlacesScript,
  type GooglePlacesLibrary,
  type PlaceLike,
  type SupplierPlaceSelection,
} from "@/components/SupplierPlaceAutocomplete";
type SearchStatus = "idle" | "missing-key" | "loading" | "ready" | "no-results" | "error";
type SupplierPlaceEnrichmentDialogProps = {
  open: boolean;
  supplier: Supplier;
  onClose: () => void;
  onUpdated: () => void;
  googleMapsApiKey?: string;
  initialCandidates?: SupplierPlaceSelection[];
  initialSelectedPlaceId?: string;
};
function formatType(type: string): string {
  return type.replace("_", " ");
}
function formatCoordinate(value: number | undefined): string {
  return value === undefined ? "—" : String(value);
}
function buildSearchQuery(supplier: Supplier): string {
  return [supplier.name, formatType(supplier.type), supplier.address].filter(Boolean).join(" ");
}
function placeToSelection(place: PlaceLike): SupplierPlaceSelection | null {
  const googlePlaceId = place.id;
  if (!googlePlaceId) return null;
  return {
    googlePlaceId,
    name: getDisplayName(place.displayName),
    address: place.formattedAddress,
    lat: getCoordinate(place.location, "lat"),
    lng: getCoordinate(place.location, "lng"),
  };
}
async function searchSupplierPlaces(
  apiKey: string,
  query: string
): Promise<SupplierPlaceSelection[]> {
  await loadGooglePlacesScript(apiKey);
  const googleWindow = window as Window & {
    google?: { maps?: { importLibrary?: (library: "places") => Promise<GooglePlacesLibrary> } };
  };
  const placesLibrary = await googleWindow.google?.maps?.importLibrary?.("places");
  if (!placesLibrary?.Place?.searchByText) throw new Error("Google Places search is unavailable");
  const { places } = await placesLibrary.Place.searchByText({
    textQuery: query,
    fields: ["id", "displayName", "formattedAddress", "location"],
    maxResultCount: 5,
    language: "es-MX",
    region: "mx",
  });
  return places.map(placeToSelection).filter((place): place is SupplierPlaceSelection => place !== null);
}
function appendSupplierFormData(formData: FormData, supplier: Supplier) {
  ([
    ["name", supplier.name],
    ["type", supplier.type],
    ["contactPhone", supplier.contactPhone ?? ""],
    ["contactEmail", supplier.contactEmail ?? ""],
    ["website", supplier.website ?? ""],
    ["notes", supplier.notes ?? ""],
    ["tags", supplier.tags.join(", ")],
  ] as const).forEach(([key, value]) => formData.set(key, value));
}
type ComparisonRow = { label: string; current: string; found: string };
export function SupplierPlaceEnrichmentDialog({
  open,
  supplier,
  onClose,
  onUpdated,
  googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  initialCandidates = [],
  initialSelectedPlaceId,
}: SupplierPlaceEnrichmentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(buildSearchQuery(supplier));
  const [status, setStatus] = useState<SearchStatus>(
    googleMapsApiKey ? (initialCandidates.length > 0 ? "ready" : "idle") : "missing-key"
  );
  const [candidates, setCandidates] = useState<SupplierPlaceSelection[]>(initialCandidates);
  const [selectedPlaceId, setSelectedPlaceId] = useState(initialSelectedPlaceId ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, [open]);
  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.googlePlaceId === selectedPlaceId),
    [candidates, selectedPlaceId]
  );
  const comparisonRows: ComparisonRow[] = selectedCandidate
    ? [
        { label: "Dirección", current: supplier.address ?? "—", found: selectedCandidate.address ?? "—" },
        { label: "Latitud", current: formatCoordinate(supplier.lat), found: formatCoordinate(selectedCandidate.lat) },
        { label: "Longitud", current: formatCoordinate(supplier.lng), found: formatCoordinate(selectedCandidate.lng) },
        { label: "Google Place ID", current: supplier.googlePlaceId ?? "—", found: selectedCandidate.googlePlaceId },
      ]
    : [];
  function close() {
    dialogRef.current?.close();
    onClose();
  }
  function handleSearch() {
    if (!googleMapsApiKey) {
      setStatus("missing-key");
      return;
    }
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    setStatus("loading");
    setError(null);
    setSelectedPlaceId("");
    startTransition(async () => {
      try {
        const results = await searchSupplierPlaces(googleMapsApiKey, trimmedQuery);
        setCandidates(results);
        setStatus(results.length > 0 ? "ready" : "no-results");
      } catch {
        setCandidates([]);
        setStatus("error");
      }
    });
  }
  function handleConfirm() {
    if (!selectedCandidate) return;
    setError(null);
    const formData = new FormData();
    appendSupplierFormData(formData, supplier);
    formData.set("address", selectedCandidate.address ?? supplier.address ?? "");
    formData.set("lat", selectedCandidate.lat === undefined ? "" : String(selectedCandidate.lat));
    formData.set("lng", selectedCandidate.lng === undefined ? "" : String(selectedCandidate.lng));
    formData.set("googlePlaceId", selectedCandidate.googlePlaceId);
    startTransition(async () => {
      const result = await updateSupplierAction(supplier.id, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onUpdated();
      close();
    });
  }
  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-3xl rounded-xl border border-gray-200 p-0 backdrop:bg-black/40 dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Completar desde Google
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Busca coincidencias para {supplier.name} y confirma antes de actualizar el proveedor.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={!googleMapsApiKey || status === "loading"}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            placeholder="Nombre, tipo, ciudad o dirección"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={!googleMapsApiKey || status === "loading" || isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {status === "loading" ? "Buscando…" : "Buscar en Google Maps"}
          </button>
        </div>
        {status === "missing-key" && (
          <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
            Google Places no está configurado. Puedes editar el proveedor manualmente.
          </p>
        )}
        {status === "no-results" && (
          <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
            No encontramos coincidencias confiables. Puedes ajustar la búsqueda o editar manualmente.
          </p>
        )}
        {status === "error" && (
          <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
            Google Places no respondió. Intenta de nuevo o edita el proveedor manualmente.
          </p>
        )}
        {candidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Candidatos</p>
            <div className="grid gap-2">
              {candidates.map((candidate) => (
                <button
                  type="button"
                  key={candidate.googlePlaceId}
                  onClick={() => setSelectedPlaceId(candidate.googlePlaceId)}
                  className={`rounded-lg border p-3 text-left text-sm ${
                    selectedPlaceId === candidate.googlePlaceId
                      ? "border-blue-500 bg-blue-50 text-blue-950"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
                  }`}
                >
                  <span className="block font-medium">{candidate.name ?? "Resultado sin nombre"}</span>
                  <span className="block text-xs">{candidate.address ?? "Sin dirección disponible"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedCandidate && (
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Comparar antes de aplicar
            </h4>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide">
                  <th className="py-1 text-gray-500">Campo</th>
                  <th className="py-1 text-gray-500">Actual</th>
                  <th className="py-1 text-blue-600">Encontrado en Google</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-t border-gray-100 dark:border-gray-800">
                    <th className="py-1 pr-2 text-left font-medium">{row.label}</th>
                    <td className="py-1 pr-2">{row.current}</td>
                    <td className="py-1">{row.found}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
          >
            Cancelar
          </button>
          {selectedCandidate && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Actualizando…" : "Confirmar y actualizar"}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
