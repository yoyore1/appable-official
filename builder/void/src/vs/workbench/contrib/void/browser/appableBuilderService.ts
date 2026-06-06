/*--------------------------------------------------------------------------------------
 *  Appable Builder — renderer-side service. Thin proxy over the main-process
 *  'void-channel-appable' channel. React talks to THIS; it forwards to the engine.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Event } from '../../../../base/common/event.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import {
	APPABLE_CHANNEL, BuildOptions, BuildResult, ChatRequest, ChatResponse, IAppableBuilderService,
	InterviewAnswers, MasterBuildPrompt, ProgressEvent,
} from '../common/appableBuilderTypes.js';

class AppableBuilderService extends Disposable implements IAppableBuilderService {
	_serviceBrand: undefined;

	private readonly channel: IChannel;
	readonly onProgress: Event<ProgressEvent>;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
	) {
		super();
		this.channel = mainProcessService.getChannel(APPABLE_CHANNEL);
		this.onProgress = this.channel.listen<ProgressEvent>('onProgress');
	}

	build(opts: BuildOptions): Promise<BuildResult> {
		return this.channel.call<BuildResult>('build', opts);
	}

	chat(req: ChatRequest): Promise<ChatResponse> {
		return this.channel.call<ChatResponse>('chat', req);
	}

	generatePlan(answers: InterviewAnswers): Promise<MasterBuildPrompt> {
		return this.channel.call<MasterBuildPrompt>('generatePlan', answers);
	}

	fetchPlan(projectId: string): Promise<MasterBuildPrompt> {
		return this.channel.call<MasterBuildPrompt>('fetchPlan', projectId);
	}
}

registerSingleton(IAppableBuilderService, AppableBuilderService, InstantiationType.Delayed);
