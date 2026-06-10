/*--------------------------------------------------------------------------------------
 *  Shared view snippets for spec-driven Swift (onboarding, profile).
 *--------------------------------------------------------------------------------------*/

import type { ExpoAppModel } from '../../common/expoAppModelTypes.js';

function esc(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

export function modelOnboardingSwift(model: ExpoAppModel): string {
	const slides = model.onboarding.length
		? model.onboarding
		: [{ title: 'Welcome', subtitle: 'Let\'s get started', imageUrl: '' }];
	const slideStructs = slides
		.map((s, i) => `        OnboardingSlide(symbol: "sparkles", title: "${esc(s.title)}", subtitle: "${esc(s.subtitle)}", cta: "${esc(s.ctaLabel ?? (i < slides.length - 1 ? 'Next' : 'Let\'s go'))}")`)
		.join(',\n');
	return `import SwiftUI

private struct OnboardingSlide: Identifiable {
    let id = UUID()
    let symbol: String
    let title: String
    let subtitle: String
    let cta: String
}

struct OnboardingView: View {
    var onDone: () -> Void
    @State private var page = 0
    private let slides: [OnboardingSlide] = [
${slideStructs}
    ]

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.cream, Theme.accentSoft, Theme.cream], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            VStack(spacing: 0) {
                TabView(selection: $page) {
                    ForEach(Array(slides.enumerated()), id: \\.offset) { index, slide in
                        VStack(spacing: 20) {
                            Spacer()
                            Image(systemName: slide.symbol).font(.system(size: 44, weight: .semibold)).foregroundStyle(Theme.accent)
                            Text(slide.title).font(Theme.display(28)).foregroundStyle(Theme.charcoal).multilineTextAlignment(.center).padding(.horizontal, 28)
                            Text(slide.subtitle).font(.body).foregroundStyle(Theme.warmGrey).multilineTextAlignment(.center).padding(.horizontal, 32)
                            Spacer()
                        }.tag(index)
                    }
                }.tabViewStyle(.page(indexDisplayMode: .always))
                Button {
                    if page < slides.count - 1 { withAnimation(Theme.spring) { page += 1 } } else { onDone() }
                } label: {
                    Text(slides[min(page, slides.count - 1)].cta).primaryButtonLabel()
                }.buttonStyle(AppableSpringButtonStyle()).padding(.horizontal, 24).padding(.bottom, 36)
            }
        }
    }
}
`;
}

export function modelProfileSwift(model: ExpoAppModel): string {
	const p = model.profile;
	const stats = p.stats.map((s, i) => `                    statRow("${esc(s.label)}", "${esc(s.value)}", ${i})`).join('\n');
	const settings = p.settings.map((s) => {
		const lower = s.label.toLowerCase();
		if (/sign[\s-]?out/.test(lower)) {
			return `                    Button { appState.signOut() } label: { rowLabel("${esc(s.label)}", symbol: "rectangle.portrait.and.arrow.right") }`;
		}
		if (/delete/.test(lower)) {
			return `                    Button { appState.toast = "Account deletion requested" } label: { rowLabel("${esc(s.label)}", symbol: "trash") }`;
		}
		return `                    rowLabel("${esc(s.label)}", symbol: "gearshape")`;
	}).join('\n');
	return `import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("${esc(p.displayName)}").font(Theme.display(26)).foregroundStyle(Theme.charcoal)
                        Text("${esc(p.tagline)}").foregroundStyle(Theme.warmGrey)
                    }.appableCard().staggeredAppear(index: 0)
                    VStack(spacing: 12) { ${stats} }.appableCard().staggeredAppear(index: 1)
                    VStack(spacing: 0) { ${settings} }.appableCard().staggeredAppear(index: 2)
                }.padding(20)
            }.screenBackground().navigationTitle("Profile")
        }
    }

    private func statRow(_ label: String, _ value: String, _ index: Int) -> some View {
        HStack { Text(label).foregroundStyle(Theme.warmGrey); Spacer(); Text(value).font(.headline) }.staggeredAppear(index: index)
    }

    private func rowLabel(_ title: String, symbol: String) -> some View {
        HStack {
            Image(systemName: symbol).foregroundStyle(Theme.accent).frame(width: 28)
            Text(title).foregroundStyle(Theme.charcoal)
            Spacer()
        }.padding(.vertical, 8)
    }
}
`;
}
