/*--------------------------------------------------------------------------------------
 *  Appable Builder — chat-first layout. Full-width Appable chrome only.
 *  Preview pane opens later via showPhonePreview().
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IWorkbenchThemeService, ThemeSettingDefaults } from '../../../services/themes/common/workbenchThemeService.js';

const TERMINAL_VIEW_ID = 'terminal';

export interface IAppableLayoutService {
	readonly _serviceBrand: undefined;
	enforceSimple(): void;
	showPhonePreview(): void;
}

export const IAppableLayoutService = createDecorator<IAppableLayoutService>('appableLayoutService');

class AppableLayoutService extends Disposable implements IAppableLayoutService {
	_serviceBrand: undefined;

	private _previewOpen = false;
	private _applying = false;
	private _didExpandSidebar = false;

	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IWorkbenchThemeService private readonly themeService: IWorkbenchThemeService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IViewsService private readonly viewsService: IViewsService,
	) {
		super();
		// Do NOT hook onDidChangePartVisibility — resize/hide → event → apply → infinite freeze.
	}

	enforceSimple(): void {
		this.apply();
	}

	showPhonePreview(): void {
		this._previewOpen = true;
		this._didExpandSidebar = false;
		this.layoutService.setPartHidden(false, Parts.EDITOR_PART, mainWindow);
		this.apply();
	}

	private apply(): void {
		if (this._applying) {
			return;
		}
		this._applying = true;
		try {
			const body = mainWindow.document.body;
			body.classList.add('appable-chat-first');
			body.classList.toggle('appable-preview-open', this._previewOpen);
			const workbench = mainWindow.document.querySelector('.monaco-workbench');
			if (workbench) {
				workbench.classList.add('appable-chat-first');
				workbench.classList.toggle('appable-preview-open', this._previewOpen);
			}

			this.configurationService.updateValue('window.menuBarVisibility', 'hidden');
			this.configurationService.updateValue('workbench.statusBar.visible', false);
			this.configurationService.updateValue('window.commandCenter', false);
			this.configurationService.updateValue('workbench.layoutControl.enabled', false);
			this.configurationService.updateValue('workbench.editor.showTabs', 'none');
			this.configurationService.updateValue('terminal.integrated.hideOnStartup', 'always');

			void this.themeService.setColorTheme(ThemeSettingDefaults.COLOR_THEME_LIGHT, 'auto');

			this.layoutService.setPartHidden(true, Parts.ACTIVITYBAR_PART);
			this.layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
			this.layoutService.setPartHidden(true, Parts.PANEL_PART);
			this.layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);

			this.closeVoidPanels();

			if (this._previewOpen) {
				this.layoutService.setPartHidden(false, Parts.EDITOR_PART, mainWindow);
				this.applyPreviewSplit();
			} else {
				this.layoutService.setPartHidden(true, Parts.EDITOR_PART, mainWindow);
			}
		} finally {
			this._applying = false;
		}
	}

	private closeVoidPanels(): void {
		try {
			this.viewsService.closeView(TERMINAL_VIEW_ID);
		} catch { /* optional */ }
		try {
			this.viewsService.closeViewContainer(TERMINAL_VIEW_ID);
		} catch { /* optional */ }
	}

	private expandSidebarFull(): void {
		if (this._didExpandSidebar) {
			return;
		}
		try {
			const main = this.layoutService.mainContainerDimension;
			const sidebar = this.layoutService.getSize(Parts.SIDEBAR_PART);
			const target = Math.floor(main.width * 0.92);
			const delta = target - sidebar.width;
			if (delta > 24) {
				this.layoutService.resizePart(Parts.SIDEBAR_PART, delta, 0);
				this._didExpandSidebar = true;
			}
		} catch {
			// grid not ready — contrib will retry
		}
	}

	private applyPreviewSplit(): void {
		this._didExpandSidebar = false;
		try {
			const main = this.layoutService.mainContainerDimension;
			const targetSidebar = Math.floor(main.width * 0.58);
			const sidebar = this.layoutService.getSize(Parts.SIDEBAR_PART);
			const delta = targetSidebar - sidebar.width;
			if (Math.abs(delta) > 20) {
				this.layoutService.resizePart(Parts.SIDEBAR_PART, delta, 0);
				this.layoutService.resizePart(Parts.EDITOR_PART, -delta, 0);
			}
		} catch {
			// layout not ready
		}
	}
}

registerSingleton(IAppableLayoutService, AppableLayoutService, InstantiationType.Delayed);
