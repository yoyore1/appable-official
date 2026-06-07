/*--------------------------------------------------------------------------------------
 *  Appable Builder — main-process IPC channel. Registered in app.ts as
 *  'void-channel-appable'. Runs the build engine and streams ProgressEvents to
 *  the renderer. (Can't be a plain service because it needs node deps.)
 *--------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { BuildOptions, ChatRequest, HandoffPayload, InterviewAnswers, ProgressEvent } from '../common/appableBuilderTypes.js';
import { buildApp, chatWithAgent, fetchPlanForProject, generatePlanFromInterview, primeAppableEnv } from './appable/engine.js';
import { exchangeHandoffToken, parseHandoffUri } from './appable/handoff.js';

export class AppableBuilderChannel implements IServerChannel {

	private readonly _onProgress = new Emitter<ProgressEvent>();
	readonly onProgress: Event<ProgressEvent> = this._onProgress.event;

	private readonly _onHandoff = new Emitter<HandoffPayload>();
	readonly onHandoff: Event<HandoffPayload> = this._onHandoff.event;

	private _pendingHandoff: HandoffPayload | null = null;

	constructor(appRoot?: string) {
		primeAppableEnv(appRoot);
	}

	listen(_: unknown, event: string): Event<any> {
		switch (event) {
			case 'onProgress': return this.onProgress;
			case 'onHandoff': return this._onHandoff.event;
			default: throw new Error(`[AppableBuilderChannel] unknown event: ${event}`);
		}
	}

	async call(_: unknown, command: string, params: any): Promise<any> {
		switch (command) {
			case 'build': {
				const opts = params as BuildOptions;
				return buildApp(opts, (e) => this._onProgress.fire(e));
			}
			case 'chat': {
				return chatWithAgent(params as ChatRequest);
			}
			case 'generatePlan': {
				return generatePlanFromInterview(params as InterviewAnswers);
			}
			case 'fetchPlan': {
				return fetchPlanForProject(params as string);
			}
			case 'takePendingHandoff': {
				const p = this._pendingHandoff;
				this._pendingHandoff = null;
				return p;
			}
			default: throw new Error(`[AppableBuilderChannel] unknown command: ${command}`);
		}
	}

	/**
	 * Handle `appable://handoff?token=…&api=…` from the OS (cold start or while
	 * running). Exchanges the token, stores pending for late-mounting UI, and
	 * fires onHandoff for listeners already attached.
	 */
	async handleHandoffUri(uri: URI): Promise<boolean> {
		const parsed = parseHandoffUri(uri);
		if (!parsed) {
			return false;
		}
		try {
			const payload = await exchangeHandoffToken(parsed.api, parsed.token);
			if (parsed.target && !payload.app.target) {
				payload.app.target = parsed.target;
			}
			this._pendingHandoff = payload;
			this._onHandoff.fire(payload);
			return true;
		} catch (e) {
			this._onProgress.fire({
				kind: 'error',
				message: `Couldn't open your app from getappable.com — ${String((e as Error)?.message ?? e)}. Try the link again.`,
			});
			return true;
		}
	}
}
