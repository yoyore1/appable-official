import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { answerInsightsQuestion } from "@/lib/insights/liveQuery";
import { defaultInsightsState } from "@/lib/insights/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const project = await db.getProject(params.id);
  if (!project || project.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { question } = (await req.json()) as { question?: string };
  if (!question?.trim()) {
    return NextResponse.json({ error: "empty_question" }, { status: 400 });
  }

  const { answer, snapshots } = await answerInsightsQuestion(project, question.trim());
  const prior = project.insightsState ?? defaultInsightsState();
  await db.updateProject(params.id, {
    insightsState: { ...prior, lastLivePullAt: new Date().toISOString() },
  });

  return NextResponse.json({ answer, snapshots });
}
