import type { BrainstormTurn, InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import {
  enrichBuildUserMessage,
  formatBuildThreadForPrompt,
} from "@/lib/expoApp/buildChatContext";
import {
  formatRetrievedBuildContext,
  indexBuildContext,
  retrieveBuildContext,
} from "@/lib/expoApp/buildContext";
import { buildExpandedRetrievalQuery } from "@/lib/expoApp/buildRetrieve";

export function prepareCodeAgentPrompt(input: {
  message: string;
  model: ExpoAppModel;
  mp: MasterBuildPrompt;
  buildHistory: BrainstormTurn[];
  interview?: InterviewTurn[];
  brainstormHistory?: BrainstormTurn[];
  brainstormContext?: string;
}): {
  enrichedMessage: string;
  threadBlock: string;
  retrievedBlock: string;
} {
  const buildHistory = input.buildHistory ?? [];
  const enrichedMessage = enrichBuildUserMessage(input.message, buildHistory);
  const threadBlock = formatBuildThreadForPrompt(buildHistory);

  const chunks = indexBuildContext({
    model: input.model,
    mp: input.mp,
    interview: input.interview,
    brainstormHistory: input.brainstormHistory,
    buildHistory,
    connectorNote: input.brainstormContext,
  });

  const retrievalQuery = buildExpandedRetrievalQuery(enrichedMessage, buildHistory);
  const retrieved = retrieveBuildContext(enrichedMessage, chunks, {
    buildHistory,
    topK: 18,
  });
  const retrievedBlock = formatRetrievedBuildContext(
    retrievalQuery,
    retrieved,
    buildHistory
  );

  return { enrichedMessage, threadBlock, retrievedBlock };
}
