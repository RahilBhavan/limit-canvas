import { runAssist } from "@/lib/agents/orchestrator";
import { assistRequestSchema } from "@/lib/agents/schemas";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = assistRequestSchema.parse(await request.json());
    const result = await runAssist(body);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Assist failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
