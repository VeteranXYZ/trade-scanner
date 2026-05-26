import { NextResponse } from "next/server";

export const runtime = "nodejs";

const disabledMessage =
  "Persistent scan history is not enabled in this deployment. This private scanner currently uses real-time Remote Binance scans only.";

export async function GET() {
  return NextResponse.json(
    {
      error: disabledMessage,
      horizonCandles: 0,
      itemCount: 0,
      evaluations: [],
      summary: {
        evaluationCount: 0,
        completedCount: 0,
        pendingCount: 0,
        bySignal: {},
        byPhase: {},
        byAlignment: {},
      },
    },
    { status: 501 },
  );
}
