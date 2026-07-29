import { NextRequest, NextResponse } from "next/server";
import { getFlightStatus } from "@/lib/flight-status";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");
  const flightNumber = request.nextUrl.searchParams.get("flightNumber");
  if (!title) {
    return NextResponse.json({ status: null, flightNumber: null });
  }

  const result = await getFlightStatus(title, flightNumber);
  return NextResponse.json(result);
}
