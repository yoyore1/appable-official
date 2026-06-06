/*--------------------------------------------------------------------------------------
 *  Appable Builder — chat-first layout. Appable owns the sidebar; IDE chrome is hidden
 *  until the user toggles Advanced view.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IWorkbenchThemeService, ThemeSettingDefaults } from '../../../services/themes/common/workbenchThemeService.js';

export interface IAppableLayoutService {
	readonly _serviceBrand: undefined;
	readonly isAdvanced: boolean;
	readonly onDidChangeAdvanced: Event<boolean>;
	setAdvanced(on: boolean): void;
	toggleAdvanced(): void;
	/** Re-apply simple layout (call after workbench restore fights back). */
	enforceSimple(): void;
}

export const IAppableLayoutService = createDecorator<IAppableLayoutService>('appableLayoutService');

export const APPABLE_TOGGLE_ADVANCED_ACTION_ID = 'appable.toggleAdvancedView';

class AppableLayoutService extends Disposable implements IAppableLayoutService {
	_serviceBrand: undefined;

	private _advanced = false;
	private _didExpandSidebar = false;
	private readonly _onDidChangeAdvanced = this._register(new Emitter<boolean>());
	readonly onDidChangeAdvanced = this._onDidChangeAdvanced.event;

	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IWorkbenchThemeService private readonly themeService: IWorkbenchThemeService,
	) {
		super();
	}

	get isAdvanced(): boolean {
		return this._advanced;
	}

	setAdvanced(on: boolean): void {
		if (this._advanced === on) {
			this.apply(on);
			return;
		}
		this._advanced = on;
		this.apply(on);
		this._onDidChangeAdvanced.fire(on);
	}

	toggleAdvanced(): void {
		this.setAdvanced(!this._advanced);
	}

	enforceSimple(): void {
		if (!this._advanced) {
			this.apply(false);
		}
	}

	private apply(advanced: boolean): void {
		this.setChatFirstChrome(!advanced);

		if (advanced) {
			// Power-user IDE: show everything, allow dark theme
			this.layoutService.setPartHidden(false, Parts.ACTIVITYBAR_PART);
			this.layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
			this.layoutService.setPartHidden(false, Parts.PANEL_PART);
			this.layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
			return;
		}

		// Chat-first: Appable sidebar + warm light chrome
		void this.themeService.setColorTheme(ThemeSettingDefaults.COLOR_THEME_LIGHT, 'auto');
		this.layoutService.setPartHidden(true, Parts.ACTIVITYBAR_PART);
		this.layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
		this.layoutService.setPartHidden(true, Parts.PANEL_PART);
		this.layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
		this.expandAppableSidebar();
	}

	private setChatFirstChrome(on: boolean): void {
		mainWindow.document.body.classList.toggle('appable-chat-first', on);
	}

	private expandAppableSidebar(): void {
		if (this._didExpandSidebar) {
			return;
		}
		try {
			const main = this.layoutService.mainContainerDimension;
			const targetSidebar = Math.floor(main.width * 0.68);
			const sidebar = this.layoutService.getSize(Parts.SIDEBAR_PART);
			const delta = targetSidebar - sidebar.width;
			if (delta > 20) {
				this._didExpandSidebar = true;
				this.layoutService.resizePart(Parts.SIDEBAR_PART, delta, 0);
				this.layoutService.resizePart(Parts.EDITOR_PART, -delta, 0);
			}
		} catch {
			// layout not ready yet — delayed enforce will retry
		}
	}
}

registerSingleton(IAppableLayoutService, AppableLayoutService, InstantiationType.Delayed);
