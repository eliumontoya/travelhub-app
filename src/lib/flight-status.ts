const AVIATIONSTACK_URL = "https://api.aviationstack.com/v1/flights";

interface AviationstackFlight {
  flight_status?: string;
}

interface AviationstackResponse {
  data?: AviationstackFlight[];
}

const FLIGHT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Programado",
  active: "En vuelo",
  landed: "Aterrizó",
  cancelled: "Cancelado",
  incident: "Incidente",
  diverted: "Desviado",
};

function normalizeFlightNumber(flightNumber: string | null | undefined): string | null {
  const normalized = flightNumber?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
  return normalized || null;
}

interface FlightStatusResult {
  status: string | null;
  flightNumber: string | null;
}

export async function getFlightStatus(flightNumberInput?: string | null): Promise<FlightStatusResult> {
  const flightNumber = normalizeFlightNumber(flightNumberInput);
  if (!flightNumber) return { status: null, flightNumber: null };

  const apiKey = process.env.FLIGHT_API_KEY;
  if (!apiKey) return { status: null, flightNumber };

  try {
    const url = `${AVIATIONSTACK_URL}?access_key=${apiKey}&flight_iata=${encodeURIComponent(flightNumber)}`;
    const res = await fetch(url);
    if (!res.ok) return { status: null, flightNumber };

    const json: AviationstackResponse = await res.json();
    const rawStatus = json.data?.[0]?.flight_status;
    if (!rawStatus) return { status: null, flightNumber };

    return { status: FLIGHT_STATUS_LABELS[rawStatus] ?? rawStatus, flightNumber };
  } catch {
    return { status: null, flightNumber };
  }
}
