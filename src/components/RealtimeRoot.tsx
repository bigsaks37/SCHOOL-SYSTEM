"use client";

import { useState, type ReactNode } from "react";
import { createRealtimeClient } from "@neon/realtime/client";
import { RealtimeProvider } from "@neon/realtime-react";

interface RealtimeRootProps {
  realtimeUrl?: string | null;
  children: ReactNode;
}

export function RealtimeRoot({ realtimeUrl, children }: RealtimeRootProps) {
  const url = realtimeUrl || process.env.NEXT_PUBLIC_NEON_REALTIME_URL || "";

  const [client] = useState(() =>
    url ? createRealtimeClient({ url }) : null
  );

  if (!client) {
    return <>{children}</>;
  }

  return <RealtimeProvider client={client}>{children}</RealtimeProvider>;
}
