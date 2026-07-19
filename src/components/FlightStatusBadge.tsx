import { getFlightStatus } from "@/lib/flight-status";

export async function FlightStatusBadge({ title }: { title: string }) {
  const status = await getFlightStatus(title);
  if (!status) return null;

  return (
    <span className="w-fit rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
      {status}
    </span>
  );
}
