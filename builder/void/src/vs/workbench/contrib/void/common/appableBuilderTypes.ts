/*--------------------------------------------------------------------------------------
 *  Appable Builder — shared types + service interface (renderer ⇄ main).
 *  The engine runs in electron-main (needs node fs/child_process); the browser
 *  talks to it over the 'void-channel-appable' IPC channel.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export type Vibe = 'Cinematic' | 'Minimal' | 'Bold' | 'Soft' | 'Luxury';

export interface MasterBuildPrompt {
	appName: string;
	description: string;
	audience: string;
	/** What makes their version original; null on full interview. */
	twist: string | null;
	features: string[];
	/** Internal blueprint — drives template assembly (matches web RN path). */
	layoutArchetype: string;
	vibe: Vibe;
	colors: string;
	screens: string[];
	referenceApp: string | null;
}

/** Interview turns stored on the platform when syncing from Void. */
export interface InterviewTurn {
	questionId: string;
	question: string;
	answer: string;
}

export type BuildMode = 'base' | 'full';
export type ShipPath = 'mac' | 'windows';
export type BuildTarget = 'rn' | 'swift';

export interface BuildOptions {
	projectId: string;
	mode: BuildMode;
	email?: string;
	password?: string;
	/** If provided (e.g. from the in-Builder 5-question interview), the engine uses
	 *  this plan directly instead of fetching it from the platform by projectId. */
	masterPrompt?: MasterBuildPrompt;
}

/** One turn in the GPT-style assistant chat. */
export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface ChatRequest {
	messages: ChatMessage[];
	/** Optional current app plan, so the assistant can give app-specific help. */
	masterPrompt?: MasterBuildPrompt;
}

export interface ChatResponse {
	reply: string;
	/** Which model answered ('kimi' when the live model is configured, else 'offline'). */
	model: string;
}

/** The 5-question interview answers, collected in the Builder when the user
 *  hasn't already done the interview on the web. */
export interface InterviewAnswers {
	idea: string;
	audience: string;
	features: string;
	name: string;
	colors: string;
}

/** A friendly progress update. `detail` lines are only shown in advanced view. */
export interface ProgressEvent {
	kind: 'heading' | 'step' | 'ok' | 'fixing' | 'detail' | 'celebrate' | 'error';
	message: string;
	/** 0–100 build completion; drives the persistent progress bar in the UI. */
	percent?: number;
}

export interface BuildResult {
	appName: string;
	bundleId: string;
	mode: BuildMode;
	projectDir: string;
	fileCount: number;
	rounds: number;
	compiled: boolean;
	usage: { build: number; review: number };
	shipPath: ShipPath;
	codemagicYaml?: string;
	/** Built from web expoAppModel (capabilities + verify), not generic mock shell. */
	usedExpoModel?: boolean;
	capabilityPass?: boolean | null;
	shipSteps?: string[];
	readiness?: import('./readinessTypes.js').AppReadinessAuditDto | null;
	specVerify?: { pass: boolean; issues: string[]; checked: string[] };
}

export const APPABLE_CHANNEL = 'void-channel-appable';

/** App context returned when the web deep link is exchanged (no manual project ID). */
export interface HandoffPayload {
	app: {
		id: string;
		name: string;
		target: BuildTarget | null;
		githubRepoUrl: string | null;
		status: string;
	};
	masterPrompt: MasterBuildPrompt;
	user: {
		id: string;
		email: string;
		name: string | null;
		buildPower: number;
		reviewBalance: number;
		dataSharingOptIn: boolean;
	};
}

export interface IAppableBuilderService {
	readonly _serviceBrand: undefined;
	/** Friendly progress stream for the chat UI. */
	readonly onProgress: Event<ProgressEvent>;
	/** Run the full Phase-1 build loop for a project. */
	build(opts: BuildOptions): Promise<BuildResult>;
	/** GPT-style assistant chat (Kimi) — talk through and improve the app. */
	chat(req: ChatRequest): Promise<ChatResponse>;
	/** Turn the 5-question interview answers into a structured build plan (Kimi). */
	generatePlan(answers: InterviewAnswers): Promise<MasterBuildPrompt>;
	/** Fetch a saved plan from the platform by project ID (for the “I already have a plan” flow). */
	fetchPlan(projectId: string): Promise<MasterBuildPrompt>;
	/** Save in-Builder interview + plan to the platform (legal docs, project id). */
	syncInterviewProject(answers: InterviewAnswers, masterPrompt: MasterBuildPrompt): Promise<{ projectId: string }>;
	/** Fired when a web deep link (appable://handoff) is opened — auto-load the app. */
	readonly onHandoff: Event<HandoffPayload>;
	/** Pending handoff from startup URL, consumed once (renderer mounts after cold start). */
	takePendingHandoff(): Promise<HandoffPayload | null>;
	/** Persist launch-checklist pin / decision — same as web Build room. */
	patchReadiness(req: import('./readinessTypes.js').ReadinessPatchRequest): Promise<import('./readinessTypes.js').ReadinessPatchResult>;
	/** Tap-to-send pills for the active interview question (Kimi + fallbacks). */
	getInterviewChoices(stepId: import('./appableInterviewFlow.js').InterviewStepId, interview: InterviewTurn[]): Promise<{ suggestions: string[]; appablePick: string }>;
}

export const IAppableBuilderService = createDecorator<IAppableBuilderService>('appableBuilderService');
