/*--------------------------------------------------------------------------------------
 *  Spec-driven Swift codegen — expoAppModel + previewActions + capability spec.
 *--------------------------------------------------------------------------------------*/

import type { BuildMode, MasterBuildPrompt } from '../../common/appableBuilderTypes.js';
import type { ExpoAppModel } from '../../common/expoAppModelTypes.js';
import {
	appStateWithActionsSwift,
	composeSheetSwift,
	detailSheetSwift,
	itemCardSwift,
	modelDataWithActionsSwift,
	modelHomeWithActionsSwift,
	previewActionRouterSwift,
	rootViewFromModelSwift,
	tabFeatureWithActionsSwift,
} from './previewActionsSwift.js';
import { modelOnboardingSwift, modelProfileSwift } from './swiftFromExpoModelViews.js';
import { bundleIdFor, generateSwiftUIProject, xcodeProjectName, type GeneratedFile } from './swiftgen.js';

function esc(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

function pascal(s: string): string {
	const t = s.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
	const out = t.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
	return out || 'App';
}

function viewNameForTab(tabId: string, label: string): string {
	const base = pascal(label || tabId);
	return /view$/i.test(base) ? base : `${base}View`;
}

function readmeSpecSwift(mp: MasterBuildPrompt, model: ExpoAppModel): string {
	const App = xcodeProjectName(mp.appName);
	const pass = model.capabilityAudit?.pass;
	const ruleCount = model.previewActions?.rules?.length ?? 0;
	return `# ${mp.appName} — spec-driven iOS build

Built from **expoAppModel** with **${ruleCount}** previewActions rules wired in Swift.

- Category: ${model.category}
- Capability review: ${pass === true ? 'passed' : pass === false ? 'partial' : 'n/a'}
- Tabs: ${model.tabs.map((t) => t.label).join(', ')}

## Build
\`\`\`bash
brew install xcodegen && xcodegen generate && open ${App}.xcodeproj
\`\`\`
`;
}

/** Generate SwiftUI from web expoAppModel — previewActions, tabs, readiness spec. */
export function generateSwiftFromExpoModel(
	mp: MasterBuildPrompt,
	model: ExpoAppModel,
	mode: BuildMode,
	projectId?: string
): GeneratedFile[] {
	const files = generateSwiftUIProject(mp, mode, projectId);
	const patch = (path: string, contents: string) => {
		const i = files.findIndex((f) => f.path === path);
		if (i >= 0) { files[i] = { path, contents }; }
		else { files.push({ path, contents }); }
	};

	patch('Sources/Models/MockData.swift', modelDataWithActionsSwift(model));
	patch('Sources/Models/PreviewActionRouter.swift', previewActionRouterSwift(model));
	patch('Sources/Models/AppState.swift', appStateWithActionsSwift(model));
	patch('Sources/Views/ItemCard.swift', itemCardSwift());
	patch('Sources/Views/DetailSheet.swift', detailSheetSwift());
	patch('Sources/Views/ComposeSheet.swift', composeSheetSwift());
	patch('Sources/RootView.swift', rootViewFromModelSwift(model));
	patch('Sources/Views/OnboardingView.swift', modelOnboardingSwift(model));
	patch('Sources/Views/HomeView.swift', modelHomeWithActionsSwift(model));
	patch('Sources/Views/ProfileView.swift', modelProfileSwift(model));
	patch('README.md', readmeSpecSwift(mp, model));

	for (const tab of model.tabs) {
		const isHome = /home/i.test(tab.id) || /home/i.test(tab.label);
		const isProfile = /profile/i.test(tab.id) || /profile/i.test(tab.label);
		if (isHome || isProfile || /onboard/i.test(tab.label)) { continue; }
		const screen = model.tabScreens[tab.id] ?? {
			title: tab.label,
			subtitle: mp.features[0] ?? tab.label,
			items: [],
		};
		const view = viewNameForTab(tab.id, tab.label);
		patch(`Sources/Views/${view}.swift`, tabFeatureWithActionsSwift(view, screen, tab.id));
	}

	const appFile = files.find((f) => f.path === 'Sources/App.swift');
	if (appFile) {
		const App = xcodeProjectName(mp.appName);
		appFile.contents = `import SwiftUI

@main
struct ${App}App: App {
    @StateObject private var appState = AppState()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .tint(Theme.accent)
        }
    }
}
`;
	}

	return files;
}

export { bundleIdFor, xcodeProjectName };
