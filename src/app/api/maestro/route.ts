// src/app/api/maestro/route.ts
import { POST as agentPOST } from "@/app/api/agent/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reexporta o mesmo handler de /api/agent
export const POST = agentPOST;
