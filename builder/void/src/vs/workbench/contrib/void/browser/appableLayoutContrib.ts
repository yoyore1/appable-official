/*--------------------------------------------------------------------------------------
 *  Appable Builder — startup layout. Re-applies full-width Appable chrome after restore.
 *--------------------------------------------------------------------------------------*/

import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IAppableLayoutService } from './appableLayoutService.js';
import { VOID_VIEW_CONTAINER_ID, VOID_VIEW_ID } from './sidebarPane.js';
import { mainWindow } from '../../../../base/browser/window.js';

function markAppableChrome(): void {
	try {
		mainWindow.document.body.classList.add('appable-chat-first');
		const workbench = mainWindow.document.querySelector('.monaco-workbench');
		if (workbench) {
			workbench.classList.add('appable-chat-first');
		}
	} catch {
		// document not ready
	}
}
markAppableChrome();

export class AppableLayoutStartContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.appableLayoutStart';
	constructor(
		@IAppableLayoutService private readonly layoutService: IAppableLayoutService,
		@IViewsService private readonly viewsService: IViewsService,
	) {
		const enforce = async () => {
			this.layoutService.enforceSimple();
			await this.viewsService.openViewContainer(VOID_VIEW_CONTAINER_ID, true);
			await this.viewsService.openView(VOID_VIEW_ID, true);
		};

		enforce();
		setTimeout(enforce, 500);
		setTimeout(enforce, 2000);
	}
}
registerWorkbenchContribution2(AppableLayoutStartContribution.ID, AppableLayoutStartContribution, WorkbenchPhase.AfterRestored);
