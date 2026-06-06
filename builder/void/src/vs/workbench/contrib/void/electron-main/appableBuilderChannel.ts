/*--------------------------------------------------------------------------------------
 *  Appable Builder — main-process IPC channel. Registered in app.ts as
 *  'void-channel-appable'. Runs the build engine and streams ProgressEvents to
 *  the renderer. (Can't be a plain service because it needs node deps.)
 *--------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { BuildOptions, ChatRequest, InterviewAnswers, ProgressEvent } from '../common/appableBuilderTypes.js';
import { buildApp, chatWithAgent, fetchPlanForProject, generatePlanFromInterview, primeAppableEnv } from './appable/engine.js';

export class AppableBuilderChannel implements IServerChannel {

	private readonly _onProgress = new Emitter<ProgressEvent>();
	readonly onProgress: Event<ProgressEvent> = this._onProgress.event;

	constructor(appRoot?: string) {
		primeAppableEnv(appRoot);
	}

	listen(_: unknown, event: string): Event<any> {
		switch (event) {
			case 'onProgress': return this.onProgress;
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
			default: throw new Error(`[AppableBuilderChannel] unknown command: ${command}`);
		}
	}
}
