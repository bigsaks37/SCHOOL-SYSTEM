import { neonAuth } from "@/lib/neonAuth";

export const { GET, POST, PUT, DELETE, PATCH } = neonAuth.handler();
