import { NextRequest, NextResponse } from "next/server";
import { getFlightStatus } from "@/lib/flight-status";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");
  if (!title) {
    return NextResponse.json({ status: null, flightNumber: null });
  }

  const result = await getFlightStatus(title);
  return NextResponse.json(result);
}
