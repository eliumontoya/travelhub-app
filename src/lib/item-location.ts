import type { ItemWithSupplier } from "@/types";

export type ResolvedItemLocation = {
  label: string;
  address?: string;
  lat?: number;
  lng?: number;
  source: "item" | "supplier";
};

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function hasCoordinates(lat: number | undefined, lng: number | undefined) {
  return lat !== undefined && lng !== undefined;
}

export function resolveItemLocation(item: ItemWithSupplier): ResolvedItemLocation | null {
  const itemLocation = clean(item.location);
  if (hasCoordinates(item.lat, item.lng)) {
    return {
      label: itemLocation ?? item.title,
      address: itemLocation,
      lat: item.lat,
      lng: item.lng,
      source: "item",
    };
  }

  if (itemLocation) {
    return {
      label: itemLocation,
      address: itemLocation,
      source: "item",
    };
  }

  const supplier = item.supplier;
  if (!supplier) return null;
  const supplierAddress = clean(supplier.address);
  if (hasCoordinates(supplier.lat, supplier.lng)) {
    return {
      label: supplierAddress ?? supplier.name,
      address: supplierAddress,
      lat: supplier.lat,
      lng: supplier.lng,
      source: "supplier",
    };
  }

  if (supplierAddress) {
    return {
      label: supplierAddress,
      address: supplierAddress,
      source: "supplier",
    };
  }

  return null;
}

export function buildGoogleMapsUrl(location: Pick<ResolvedItemLocation, "address" | "lat" | "lng">) {
  const query = hasCoordinates(location.lat, location.lng)
    ? `${location.lat},${location.lng}`
    : clean(location.address);
  return query ? `https://maps.google.com/?q=${encodeURIComponent(query)}` : null;
}

export function shouldAutofillSupplierLocation({
  currentLocation,
  currentLat,
  currentLng,
}: {
  currentLocation: string;
  currentLat: number | undefined;
  currentLng: number | undefined;
}) {
  return !clean(currentLocation) && !hasCoordinates(currentLat, currentLng);
}
