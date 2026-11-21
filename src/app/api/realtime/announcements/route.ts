import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getAllowedAnnouncementFilters,
  getRealtime,
  isRealtimeConfigured,
  liveAnnouncementsQuery,
} from "@/lib/realtimeServer";

export async function POST() {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "TEACHER",
    "PARENT",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  if (!isRealtimeConfigured()) {
    return NextResponse.json(
      { error: "Neon Realtime is not configured on this environment." },
      { status: 503 }
    );
  }

  try {
    const { audiences, departments } = await getAllowedAnnouncementFilters(user);
    const query = liveAnnouncementsQuery(audiences, departments);
    const sealedQuery = await getRealtime().seal({ query });

    return NextResponse.json(
      {
        sealedQuery,
        realtimeUrl: process.env.NEON_REALTIME_URL || null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Seal realtime announcements error:", err);
    return NextResponse.json(
      { error: "Failed to seal live announcements query." },
      { status: 500 }
    );
  }
}
