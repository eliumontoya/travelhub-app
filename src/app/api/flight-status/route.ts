import { NextRequest, NextResponse } from "next/server";
import { getFlightStatus } from "@/lib/flight-status";

export async function GET(request: NextRequest) {
  const flightNumber = request.nextUrl.searchParams.get("flightNumber");
  const result = await getFlightStatus(flightNumber);
  return NextResponse.json(result);
}
