/*--------------------------------------------------------------------------------------
 *  Appable Builder — startup layout + advanced-view action.
 *  Re-applies chat-first layout after workbench restore (which fights back).
 *--------------------------------------------------------------------------------------*/

import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { APPABLE_TOGGLE_ADVANCED_ACTION_ID, IAppableLayoutService } from './appableLayoutService.js';
import { VOID_VIEW_CONTAINER_ID } from './sidebarPane.js';
import { localize2 } from '../../../../nls.js';
import { mainWindow } from '../../../../base/browser/window.js';

const EXPLORER_CONTAINER_ID = 'workbench.view.explorer';

// Apply the chat-first chrome class as early as the module loads, so the workbench
// paints cream on first frame instead of flashing Void-dark before layout enforces.
try {
	mainWindow.document.body.classList.add('appable-chat-first');
} catch {
	// document not ready in this context — layout service will add it shortly.
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: APPABLE_TOGGLE_ADVANCED_ACTION_ID,
			title: localize2('appableToggleAdvanced', 'Toggle Advanced View'),
		});
	}
	run(accessor: ServicesAccessor): void {
		accessor.get(IAppableLayoutService).toggleAdvanced();
	}
});

export class AppableLayoutStartContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.appableLayoutStart';
	constructor(
		@IAppableLayoutService private readonly layoutService: IAppableLayoutService,
		@IViewsService private readonly viewsService: IViewsService,
	) {
		const enforce = () => {
			if (this.layoutService.isAdvanced) {
				return;
			}
			this.layoutService.enforceSimple();
			this.viewsService.closeViewContainer(EXPLORER_CONTAINER_ID);
			void this.viewsService.openViewContainer(VOID_VIEW_CONTAINER_ID, true);
		};

		// A few delayed passes — workbench restore re-shows explorer after startup.
		// Do NOT hook onDidLayoutMainContainer: resizePart → layout → enforce → infinite loop (freeze).
		enforce();
		setTimeout(enforce, 250);
		setTimeout(enforce, 1000);
	}
}
registerWorkbenchContribution2(AppableLayoutStartContribution.ID, AppableLayoutStartContribution, WorkbenchPhase.Eventually);
