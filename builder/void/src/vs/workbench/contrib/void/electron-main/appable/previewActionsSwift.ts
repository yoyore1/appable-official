/*--------------------------------------------------------------------------------------
 *  previewActions → Swift — mirrors web previewActions.ts behavior.
 *--------------------------------------------------------------------------------------*/

import type { ExpoAppModel, ExpoListItem, ExpoTabScreen } from '../../common/expoAppModelTypes.js';
import { effectivePreviewRules } from './previewActionSeed.js';

function esc(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

const SF_ICON: Record<string, string> = {
	home: 'house.fill',
	'chef-hat': 'fork.knife',
	utensils: 'fork.knife',
	'shopping-cart': 'cart.fill',
	list: 'list.bullet',
	user: 'person.fill',
	camera: 'camera.fill',
	heart: 'heart.fill',
	'book-open': 'book.fill',
	search: 'magnifyingglass',
	settings: 'gearshape.fill',
	bell: 'bell.fill',
	shield: 'shield.fill',
	'help-circle': 'questionmark.circle.fill',
};

function sfIcon(icon: string): string {
	return SF_ICON[icon] ?? 'circle.fill';
}

function pascal(s: string): string {
	const t = s.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
	const out = t.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
	return out || 'Tab';
}

function viewNameForTab(tabId: string, label: string): string {
	const base = pascal(label || tabId);
	return /view$/i.test(base) ? base : `${base}View`;
}

export function modelDataWithActionsSwift(model: ExpoAppModel): string {
	const seen = new Set<string>();
	const rows: string[] = [];
	const push = (items: ExpoListItem[], tabId: string) => {
		for (const item of items) {
			if (seen.has(item.id)) { continue; }
			seen.add(item.id);
			const img = item.imageUrl?.trim() || `https://picsum.photos/seed/${esc(item.id)}/400/400`;
			const pa = item.primaryAction ? `"${esc(item.primaryAction)}"` : 'nil';
			const badge = item.badge ? `"${esc(item.badge)}"` : 'nil';
			const meta = item.meta ? `"${esc(item.meta)}"` : 'nil';
			const body = item.body ? `"${esc(item.body)}"` : 'nil';
			rows.push(
				`        Item(id: "${esc(item.id)}", tabId: "${esc(tabId)}", title: "${esc(item.title)}", subtitle: "${esc(item.subtitle)}", badge: ${badge}, meta: ${meta}, body: ${body}, primaryAction: ${pa}, imageURL: URL(string: "${esc(img)}"))`
			);
		}
	};
	for (const sec of model.home.sections) { push(sec.items, 'home'); }
	if (model.homeByRole) {
		for (const block of Object.values(model.homeByRole)) {
			for (const sec of block.sections) { push(sec.items, 'home'); }
		}
	}
	for (const [tabId, screen] of Object.entries(model.tabScreens)) { push(screen.items, tabId); }

	return `import Foundation

struct Item: Identifiable, Equatable {
    let id: String
    let tabId: String
    let title: String
    let subtitle: String
    var badge: String?
    var meta: String?
    var body: String?
    var primaryAction: String?
    let imageURL: URL?

    var actionLabel: String { primaryAction ?? "Open" }
}

enum MockData {
    static let catalog: [Item] = [
${rows.length ? rows.join(',\n') : '        Item(id: "1", tabId: "home", title: "Welcome", subtitle: "Ready", badge: nil, meta: nil, body: nil, primaryAction: nil, imageURL: nil)'}
    ]

    static func items(forTab tabId: String) -> [Item] {
        catalog.filter { $0.tabId == tabId }
    }

    static func item(byId id: String) -> Item? {
        catalog.first { $0.id == id }
    }
}
`;
}

export function previewActionRouterSwift(model: ExpoAppModel): string {
	const effective = effectivePreviewRules(model);
	const rules = effective.rules;
	const messagingTab = effective.messagingTabId ?? '';
	const feedTab = effective.feedTabId ?? '';

	const ruleStructs = rules.map((r) => `        ActionRule(match: "${esc(r.match)}", kind: "${esc(r.kind)}", toast: "${esc(r.toast)}", navigateTabId: ${r.navigateTabId ? `"${esc(r.navigateTabId)}"` : 'nil'}, statusBadge: ${r.statusBadge ? `"${esc(r.statusBadge)}"` : 'nil'}, statusMeta: ${r.statusMeta ? `"${esc(r.statusMeta)}"` : 'nil'}, nextPrimaryAction: ${r.nextPrimaryAction ? `"${esc(r.nextPrimaryAction)}"` : 'nil'}, composeTitle: ${r.composeTitle ? `"${esc(r.composeTitle)}"` : 'nil'}, detailAppend: ${r.detailAppend ? `"${esc(r.detailAppend)}"` : 'nil'}, openDetailAfter: ${r.openDetailAfter === false ? 'false' : 'true'})`).join(',\n');

	return `import SwiftUI

struct ActionRule {
    let match: String
    let kind: String
    let toast: String
    let navigateTabId: String?
    let statusBadge: String?
    let statusMeta: String?
    let nextPrimaryAction: String?
    let composeTitle: String?
    let detailAppend: String?
    let openDetailAfter: Bool
}

enum PreviewActionRouter {
    static let messagingTabId: String? = ${messagingTab ? `"${esc(messagingTab)}"` : 'nil'}
    static let feedTabId: String? = ${feedTab ? `"${esc(feedTab)}"` : 'nil'}
    static let rules: [ActionRule] = [
${ruleStructs || '        ActionRule(match: "open", kind: "open_detail", toast: "Opened", navigateTabId: nil, statusBadge: nil, statusMeta: nil, nextPrimaryAction: nil, composeTitle: nil, detailAppend: nil, openDetailAfter: true)'}
    ]

    static func rule(for label: String) -> ActionRule? {
        let l = label.lowercased()
        return rules.first { l.contains($0.match.lowercased()) || $0.match.lowercased() == l }
    }

    @MainActor
    static func apply(label: String, item: Item, state: AppState) {
        guard let rule = rule(for: label) else {
            state.openDetail(item)
            state.toast = "Opened \\(item.title)"
            return
        }
        state.toast = rule.toast
        switch rule.kind {
        case "compose_message":
            if let patch = patch(for: rule, item: item) { state.patchItem(patch) }
            state.openCompose(title: rule.composeTitle ?? "Message \\(item.title)")
            if let tid = rule.navigateTabId ?? messagingTabId { state.selectTab(id: tid) }
        case "update_status":
            if let patch = patch(for: rule, item: item) { state.patchItem(patch) }
            if rule.openDetailAfter { state.openDetail(state.resolved(item)) }
            if let tid = rule.navigateTabId { state.selectTab(id: tid) }
        case "navigate_tab":
            if let tid = rule.navigateTabId ?? feedTabId { state.selectTab(id: tid) }
        case "save":
            state.toggleSave(item.id)
        case "open_detail":
            if let patch = patch(for: rule, item: item) { state.patchItem(patch) }
            if rule.openDetailAfter { state.openDetail(state.resolved(item)) }
        default:
            if rule.openDetailAfter { state.openDetail(state.resolved(item)) }
        }
    }

    private static func patch(for rule: ActionRule, item: Item) -> Item? {
        var next = item
        var changed = false
        if let b = rule.statusBadge { next.badge = b; changed = true }
        if let m = rule.statusMeta { next.meta = m; changed = true }
        if let p = rule.nextPrimaryAction { next.primaryAction = p; changed = true }
        if let append = rule.detailAppend {
            let base = next.body ?? next.subtitle
            next.body = base.map { "\\($0)\\n\\n\\(append)" } ?? append
            changed = true
        }
        if rule.kind == "compose_message" && rule.statusMeta == nil && rule.statusBadge == nil && next.meta == nil {
            next.meta = "Just now"
            changed = true
        }
        return changed ? next : nil
    }
}
`;
}

function homeBlockSwift(model: ExpoAppModel, roleId: string | null): {
	headline: string; subheadline: string; heroLabel: string; heroSublabel: string;
} {
	const block =
		roleId && model.homeByRole?.[roleId] ? model.homeByRole[roleId]! : model.home;
	return {
		headline: block.headline,
		subheadline: block.subheadline,
		heroLabel: block.heroLabel,
		heroSublabel: block.heroSublabel,
	};
}

export function appStateWithActionsSwift(model: ExpoAppModel): string {
	const roles = model.flow?.roles ?? [];
	const hasDualRole = roles.length > 1 && Boolean(model.homeByRole);
	const tabCases = model.tabs.map((t, i) => `        case "${esc(t.id)}": return ${i}`).join('\n');
	const roleCases = roles.map((r) => {
		const b = homeBlockSwift(model, r.id);
		return `        case "${esc(r.id)}": return HomeCopy(headline: "${esc(b.headline)}", subheadline: "${esc(b.subheadline)}", heroLabel: "${esc(b.heroLabel)}", heroSublabel: "${esc(b.heroSublabel)}")`;
	}).join('\n');
	const defaultHome = homeBlockSwift(model, roles[0]?.id ?? null);
	const tabViews = model.tabs.map((t) => {
		const isHome = /home/i.test(t.id) || /home/i.test(t.label);
		const isProfile = /profile/i.test(t.id) || /profile/i.test(t.label);
		const view = isHome ? 'HomeView' : isProfile ? 'ProfileView' : viewNameForTab(t.id, t.label);
		return { id: t.id, label: t.label, view, icon: sfIcon(t.icon) };
	});

	return `import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @Published var selectedTab: Int = 0
    @Published var toast: String = ""
    @Published var detailItem: Item?
    @Published var showCompose = false
    @Published var composeTitle = "Message"
    @Published var isSignedIn: Bool = ${model.flow?.auth?.enabled ? 'false' : 'true'}
    @Published var selectedRole: String? = ${roles.length ? `"${esc(roles[0]!.id)}"` : 'nil'}

    private var overrides: [String: Item] = [:]
    private var saved: Set<String> = []

    static let tabs: [(id: String, label: String, icon: String)] = [
${tabViews.map((t) => `        ("${esc(t.id)}", "${esc(t.label)}", "${t.icon}")`).join(',\n')}
    ]

    func resolved(_ item: Item) -> Item {
        overrides[item.id] ?? item
    }

    func items(forTab tabId: String) -> [Item] {
        MockData.items(forTab: tabId).map { resolved($0) }
    }

    func tabIndex(for id: String) -> Int? {
        switch id {
${tabCases}
        default: return nil
        }
    }

    func selectTab(id: String) {
        if let idx = tabIndex(for: id) {
            selectedTab = idx
            Haptics.selection()
        }
    }

    func openDetail(_ item: Item) {
        detailItem = resolved(item)
    }

    func openCompose(title: String) {
        composeTitle = title
        showCompose = true
    }

    func patchItem(_ item: Item) {
        overrides[item.id] = item
    }

    func runAction(on item: Item) {
        Haptics.impact()
        PreviewActionRouter.apply(label: item.actionLabel, item: resolved(item), state: self)
    }

    func runHero() {
        Haptics.impact()
        if let rule = PreviewActionRouter.rules.first(where: { $0.kind == "navigate_tab" }) {
            PreviewActionRouter.apply(label: rule.match, item: MockData.catalog.first ?? Item(id: "hero", tabId: "home", title: "Home", subtitle: "", badge: nil, meta: nil, body: nil, primaryAction: rule.match, imageURL: nil), state: self)
        } else {
            toast = "${esc(model.home.heroSublabel || 'Done')}"
        }
    }

    func signOut() {
        isSignedIn = false
        toast = "Signed out"
    }

    func toggleSave(_ id: String) {
        if saved.contains(id) { saved.remove(id); toast = "Removed from saved" }
        else { saved.insert(id); toast = "Saved" }
    }

    struct HomeCopy {
        let headline: String
        let subheadline: String
        let heroLabel: String
        let heroSublabel: String
    }

    var hasDualRole: Bool { ${hasDualRole ? 'true' : 'false'} }

    var roleOptions: [(id: String, label: String)] {
        [${roles.map((r) => `("${esc(r.id)}", "${esc(r.label)}")`).join(', ') || ''}]
    }

    func homeCopy() -> HomeCopy {
        guard let role = selectedRole else {
            return HomeCopy(headline: "${esc(defaultHome.headline)}", subheadline: "${esc(defaultHome.subheadline)}", heroLabel: "${esc(defaultHome.heroLabel)}", heroSublabel: "${esc(defaultHome.heroSublabel)}")
        }
        switch role {
${roleCases || `        default: return HomeCopy(headline: "${esc(defaultHome.headline)}", subheadline: "${esc(defaultHome.subheadline)}", heroLabel: "${esc(defaultHome.heroLabel)}", heroSublabel: "${esc(defaultHome.heroSublabel)}")`}
        default:
            return HomeCopy(headline: "${esc(defaultHome.headline)}", subheadline: "${esc(defaultHome.subheadline)}", heroLabel: "${esc(defaultHome.heroLabel)}", heroSublabel: "${esc(defaultHome.heroSublabel)}")
        }
    }
}
`;
}

export function rootViewFromModelSwift(model: ExpoAppModel): string {
	const tabViews = model.tabs.map((t) => {
		const isHome = /home/i.test(t.id) || /home/i.test(t.label);
		const isProfile = /profile/i.test(t.id) || /profile/i.test(t.label);
		const view = isHome ? 'HomeView' : isProfile ? 'ProfileView' : viewNameForTab(t.id, t.label);
		return { view, label: t.label, icon: sfIcon(t.icon) };
	});

	const tabItems = tabViews
		.map((t, i) => `            ${t.view}()\n                .tag(${i})\n                .tabItem { Label("${esc(t.label)}", systemImage: "${t.icon}") }`)
		.join('\n');

	return `import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @AppStorage("didOnboard") private var didOnboard = false

    var body: some View {
        ZStack(alignment: .bottom) {
            if didOnboard { mainTabs } else { OnboardingView(onDone: { didOnboard = true }) }
            if !appState.toast.isEmpty {
                Text(appState.toast)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Theme.charcoal.opacity(0.92))
                    .clipShape(Capsule())
                    .padding(.bottom, 88)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) {
                            withAnimation { appState.toast = "" }
                        }
                    }
            }
        }
        .sheet(item: $appState.detailItem) { item in DetailSheet(item: item) }
        .sheet(isPresented: $appState.showCompose) { ComposeSheet(title: appState.composeTitle) }
    }

    private var mainTabs: some View {
        TabView(selection: $appState.selectedTab) {
${tabItems}
        }
        .tint(Theme.accent)
        .onChange(of: appState.selectedTab) { _, _ in Haptics.selection() }
    }
}
`;
}

export function detailSheetSwift(): string {
	return `import SwiftUI

struct DetailSheet: View {
    let item: Item
    @Environment(\\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    PremiumAsyncImage(url: item.imageURL).frame(height: 200).clipShape(RoundedRectangle(cornerRadius: Theme.corner))
                    Text(item.title).font(Theme.display(24)).foregroundStyle(Theme.charcoal)
                    Text(item.subtitle).foregroundStyle(Theme.warmGrey)
                    if let body = item.body, !body.isEmpty {
                        Text(body).font(.body).foregroundStyle(Theme.charcoal)
                    }
                    if let badge = item.badge {
                        Text(badge).font(.caption.weight(.bold)).foregroundStyle(Theme.accent)
                    }
                }.padding(20)
            }
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
    }
}
`;
}

export function composeSheetSwift(): string {
	return `import SwiftUI

struct ComposeSheet: View {
    let title: String
    @State private var text = ""
    @Environment(\\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                TextField("Type your message…", text: $text, axis: .vertical).lineLimit(3...6).textFieldStyle(.roundedBorder)
                Button("Send") {
                    appState.toast = text.isEmpty ? "Message sent" : "Sent: \\(text.prefix(40))"
                    dismiss()
                }.buttonStyle(AppableSpringButtonStyle()).primaryButtonLabel()
                Spacer()
            }.padding(20).navigationTitle(title)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}
`;
}

export function itemCardSwift(): string {
	return `import SwiftUI

struct ItemCard: View {
    @EnvironmentObject private var appState: AppState
    let item: Item
    let index: Int

    var body: some View {
        let live = appState.resolved(item)
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 14) {
                PremiumAsyncImage(url: live.imageURL).frame(width: 72, height: 72)
                VStack(alignment: .leading, spacing: 6) {
                    Text(live.title).font(.headline).foregroundStyle(Theme.charcoal)
                    Text(live.subtitle).font(.subheadline).foregroundStyle(Theme.warmGrey)
                    if let badge = live.badge { Text(badge).font(.caption.weight(.semibold)).foregroundStyle(Theme.accent) }
                    if let meta = live.meta { Text(meta).font(.caption).foregroundStyle(Theme.warmGrey) }
                }
                Spacer()
            }
            if let action = live.primaryAction {
                Button(action) { appState.runAction(on: live) }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.accent)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .appableCard()
        .staggeredAppear(index: index)
    }
}
`;
}

export function modelHomeWithActionsSwift(model: ExpoAppModel): string {
	return `import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        let copy = appState.homeCopy()
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if appState.hasDualRole {
                        Picker("Role", selection: Binding(
                            get: { appState.selectedRole ?? appState.roleOptions.first?.id ?? "" },
                            set: { appState.selectedRole = $0 }
                        )) {
                            ForEach(appState.roleOptions, id: \\.id) { role in
                                Text(role.label).tag(role.id)
                            }
                        }.pickerStyle(.segmented).staggeredAppear(index: 0)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text(copy.headline).font(Theme.display(30)).foregroundStyle(Theme.charcoal)
                        Text(copy.subheadline).font(.body).foregroundStyle(Theme.warmGrey)
                    }.glassCard().staggeredAppear(index: appState.hasDualRole ? 1 : 0)

                    Button { appState.runHero() } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(copy.heroLabel).font(.headline).foregroundStyle(.white)
                            Text(copy.heroSublabel).font(.subheadline).foregroundStyle(.white.opacity(0.9))
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(18).background(Theme.accent.gradient).clipShape(RoundedRectangle(cornerRadius: Theme.corner))
                    }.buttonStyle(AppableSpringButtonStyle()).staggeredAppear(index: appState.hasDualRole ? 2 : 1)

                    ForEach(Array(appState.items(forTab: "home").enumerated()), id: \\.element.id) { index, item in
                        ItemCard(item: item, index: index + (appState.hasDualRole ? 3 : 2))
                    }
                }.padding(20)
            }.screenBackground()
        }
    }
}
`;
}

export function tabFeatureWithActionsSwift(view: string, screen: ExpoTabScreen, tabId: string): string {
	return `import SwiftUI

struct ${view}: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                Text("${esc(screen.title)}").font(Theme.display(26)).foregroundStyle(Theme.charcoal)
                Text("${esc(screen.subtitle)}").font(.subheadline).foregroundStyle(Theme.warmGrey)
                ForEach(Array(appState.items(forTab: "${esc(tabId)}").enumerated()), id: \\.element.id) { index, item in
                    ItemCard(item: item, index: index)
                }
            }.padding(20)
        }.screenBackground().navigationTitle("${esc(screen.title)}")
    }
}
`;
}
