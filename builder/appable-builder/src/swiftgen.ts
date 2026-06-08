/**
 * Deterministic SwiftUI project generator (the MOCK agent, and a structural
 * fallback even when the LLM is on). Produces a complete, XcodeGen-based iOS app:
 *
 *   project.yml      → XcodeGen spec (Codemagic & Mac run `xcodegen generate`)
 *   Sources/         → @main app, themed views per screen, mock data
 *   Resources/       → Info.plist, Assets.xcassets
 *   (full build)     → Supabase/auth/persistence, RevenueCat paywall, push
 *
 * We use XcodeGen (project.yml) instead of hand-writing a .pbxproj so the output
 * is clean, valid, and reproducible on both Mac and Codemagic.
 */
import type { BuildMode, GeneratedFile, MasterBuildPrompt } from "./types.js";

function pascal(s: string): string {
  const t = s.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const out = t.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return out || "App";
}
function appId(name: string): string {
  const base = pascal(name);
  return /^[A-Za-z]/.test(base) ? base : "App" + base;
}
function bundleId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `com.appable.${slug || "app"}`;
}

/** Map the vibe + color words to a SwiftUI accent color. */
function accentHex(prompt: MasterBuildPrompt): string {
  const c = prompt.colors.toLowerCase();
  if (c.includes("green") || c.includes("sage")) return "56A274";
  if (c.includes("blue")) return "4C8DFF";
  if (c.includes("purple") || c.includes("violet")) return "8A6DFF";
  if (c.includes("pink") || c.includes("rose")) return "FF6Fae";
  if (c.includes("gold") || c.includes("lux")) return "C8A24A";
  return "FF7A63"; // Appable coral default
}

function screenStruct(screen: string): string {
  return pascal(screen).replace(/Screen$/i, "") + "View";
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ");
}

function featureSymbol(feature: string, index: number): string {
  const f = feature.toLowerCase();
  if (/track|log|streak|habit|progress/.test(f)) return "chart.line.uptrend.xyaxis";
  if (/chat|message|social|community/.test(f)) return "bubble.left.and.bubble.right.fill";
  if (/photo|camera|scan|image/.test(f)) return "camera.viewfinder";
  if (/map|location|route|walk/.test(f)) return "map.fill";
  if (/calendar|schedule|plan/.test(f)) return "calendar";
  if (/shop|cart|buy|pay/.test(f)) return "bag.fill";
  if (/alarm|remind|notify/.test(f)) return "bell.badge.fill";
  const pool = ["sparkles", "bolt.fill", "heart.fill", "star.fill", "leaf.fill"];
  return pool[index % pool.length]!;
}

function realisticSubtitle(feature: string, appName: string): string {
  return `Built into ${appName} — ${feature.charAt(0).toLowerCase()}${feature.slice(1)} with real sample data.`;
}

export function generateSwiftUIProject(
  prompt: MasterBuildPrompt,
  mode: BuildMode
): GeneratedFile[] {
  const App = appId(prompt.appName);
  const bid = bundleId(prompt.appName);
  const accent = accentHex(prompt);
  const files: GeneratedFile[] = [];

  // Distinct, sanitized screen view names (skip onboarding/home/profile dupes).
  const featureScreens = prompt.screens.filter(
    (s) => !/onboard|home|profile/i.test(s)
  );
  const featureViews = featureScreens.map(screenStruct);

  // ---- XcodeGen spec ----
  files.push({
    path: "project.yml",
    contents: `name: ${App}
options:
  bundleIdPrefix: com.appable
  deploymentTarget:
    iOS: "17.0"
targets:
  ${App}:
    type: application
    platform: iOS
    sources:
      - Sources
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: ${bid}
        MARKETING_VERSION: "1.0"
        CURRENT_PROJECT_VERSION: "1"
        GENERATE_INFOPLIST_FILE: NO
        INFOPLIST_FILE: Resources/Info.plist
        TARGETED_DEVICE_FAMILY: "1,2"
        SWIFT_VERSION: "5.9"
        DEVELOPMENT_TEAM: ""
    resources:
      - Resources/Assets.xcassets
`,
  });

  // ---- Info.plist ----
  files.push({
    path: "Resources/Info.plist",
    contents: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key><string>${prompt.appName}</string>
  <key>CFBundleIdentifier</key><string>${bid}</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>UILaunchScreen</key><dict/>
  <key>UISupportedInterfaceOrientations</key>
  <array><string>UIInterfaceOrientationPortrait</string></array>
</dict>
</plist>
`,
  });

  // ---- Assets ----
  files.push({
    path: "Resources/Assets.xcassets/Contents.json",
    contents: `{ "info": { "author": "appable", "version": 1 } }\n`,
  });
  files.push({
    path: "Resources/Assets.xcassets/AccentColor.colorset/Contents.json",
    contents: accentColorset(accent),
  });
  files.push({
    path: "Resources/Assets.xcassets/AppIcon.appiconset/Contents.json",
    contents: `{ "images": [{ "idiom": "universal", "platform": "ios", "size": "1024x1024" }], "info": { "author": "appable", "version": 1 } }\n`,
  });

  // ---- Theme ----
  files.push({ path: "Sources/Theme.swift", contents: themeSwift(accent, prompt) });
  files.push({ path: "Sources/Design/DesignModifiers.swift", contents: designModifiersSwift() });

  // ---- @main App ----
  files.push({
    path: "Sources/App.swift",
    contents: `import SwiftUI

@main
struct ${App}App: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .tint(Theme.accent)
        }
    }
}
`,
  });

  // ---- Root + onboarding gate ----
  files.push({ path: "Sources/RootView.swift", contents: rootViewSwift(featureViews) });
  files.push({ path: "Sources/Views/OnboardingView.swift", contents: onboardingSwift(prompt) });
  files.push({ path: "Sources/Views/HomeView.swift", contents: homeSwift(prompt, featureViews) });
  files.push({ path: "Sources/Views/ProfileView.swift", contents: profileSwift(prompt) });

  // ---- One view per feature screen ----
  featureScreens.forEach((screen, i) => {
    files.push({
      path: `Sources/Views/${featureViews[i]}.swift`,
      contents: featureSwift(featureViews[i], screen, prompt.features[i] ?? screen),
    });
  });

  // ---- Mock data ----
  files.push({ path: "Sources/Models/MockData.swift", contents: mockDataSwift(prompt) });

  // ---- Legal references (free inclusions from the platform) ----
  files.push({
    path: "Sources/Legal/LegalLinks.swift",
    contents: `import Foundation

// Privacy / Terms / Support are generated & hosted by the Appable platform.
enum LegalLinks {
    static let privacy = URL(string: "https://getappable.com/legal/PROJECT_ID/privacy")!
    static let terms = URL(string: "https://getappable.com/legal/PROJECT_ID/terms")!
    static let support = URL(string: "https://getappable.com/legal/PROJECT_ID/support")!
}
`,
  });

  // ---- Full build extras: backend, paywall, push ----
  if (mode === "full") {
    files.push({ path: "Sources/Services/SupabaseClient.swift", contents: supabaseSwift(bid) });
    files.push({ path: "Sources/Services/AuthService.swift", contents: authSwift() });
    files.push({ path: "Sources/Services/Store.swift", contents: storeSwift() });
    files.push({ path: "Sources/Services/Paywall.swift", contents: paywallSwift(prompt) });
    files.push({ path: "Sources/Services/PushNotifications.swift", contents: pushSwift() });
  }

  // ---- README ----
  files.push({ path: "README.md", contents: readmeSwift(prompt, App, mode) });

  return files;
}

// --------------------------------------------------------------------------
// Swift templates
// --------------------------------------------------------------------------

function accentColorset(hex: string): string {
  const r = (parseInt(hex.slice(0, 2), 16) / 255).toFixed(3);
  const g = (parseInt(hex.slice(2, 4), 16) / 255).toFixed(3);
  const b = (parseInt(hex.slice(4, 6), 16) / 255).toFixed(3);
  return `{
  "colors": [
    { "idiom": "universal",
      "color": { "color-space": "srgb", "components": { "red": "${r}", "green": "${g}", "blue": "${b}", "alpha": "1.000" } } }
  ],
  "info": { "author": "appable", "version": 1 }
}
`;
}

function themeSwift(hex: string, prompt: MasterBuildPrompt): string {
  const r = (parseInt(hex.slice(0, 2), 16) / 255).toFixed(3);
  const g = (parseInt(hex.slice(2, 4), 16) / 255).toFixed(3);
  const b = (parseInt(hex.slice(4, 6), 16) / 255).toFixed(3);
  return `import SwiftUI

// Appable premium theme — vibe: ${prompt.vibe}, colors: ${prompt.colors}
enum Theme {
    static let accent = Color(red: ${r}, green: ${g}, blue: ${b})
    static let accentSoft = Color(red: ${r}, green: ${g}, blue: ${b}).opacity(0.14)
    static let cream = Color(red: 0.992, green: 0.980, blue: 0.957)
    static let charcoal = Color(red: 0.169, green: 0.149, blue: 0.141)
    static let warmGrey = Color(red: 0.45, green: 0.42, blue: 0.40)

    static let corner: CGFloat = 22
    static let cornerSmall: CGFloat = 16
    static let cardShadow = Color.black.opacity(0.08)

    static let spring = Animation.spring(response: 0.45, dampingFraction: 0.82)
    static let springSnappy = Animation.spring(response: 0.32, dampingFraction: 0.72)

    static func display(_ size: CGFloat) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }
}

extension View {
    func appableCard(padding: CGFloat = 18) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.92))
            .clipShape(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .shadow(color: Theme.cardShadow, radius: 18, x: 0, y: 10)
    }

    func glassCard(padding: CGFloat = 20) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.corner, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.35), lineWidth: 1)
            )
            .shadow(color: Theme.cardShadow, radius: 22, x: 0, y: 12)
    }

    func screenBackground() -> some View {
        self.background(
            LinearGradient(
                colors: [Theme.cream, Theme.accentSoft.opacity(0.35), Theme.cream],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
        )
    }

    func primaryButtonLabel() -> some View {
        self.font(.headline.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .foregroundStyle(.white)
            .background(Theme.accent)
            .clipShape(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .shadow(color: Theme.accent.opacity(0.35), radius: 14, x: 0, y: 8)
    }
}
`;
}

function designModifiersSwift(): string {
  return `import SwiftUI
import UIKit

enum Haptics {
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }
    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}

struct AppableSpringButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(Theme.springSnappy, value: configuration.isPressed)
    }
}

struct StaggeredAppear: ViewModifier {
    let index: Int
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 16)
            .onAppear {
                withAnimation(Theme.spring.delay(Double(index) * 0.07)) {
                    shown = true
                }
            }
    }
}

extension View {
    func staggeredAppear(index: Int) -> some View {
        modifier(StaggeredAppear(index: index))
    }
}

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1
    func body(content: Content) -> some View {
        content
            .overlay {
                GeometryReader { geo in
                    LinearGradient(
                        colors: [.clear, Color.white.opacity(0.45), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geo.size.width * 0.55)
                    .offset(x: phase * geo.size.width)
                }
                .clipped()
            }
            .onAppear {
                withAnimation(.linear(duration: 1.15).repeatForever(autoreverses: false)) {
                    phase = 1.4
                }
            }
    }
}

struct PremiumAsyncImage: View {
    let url: URL?

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFill()
            case .failure:
                ZStack {
                    Theme.accentSoft
                    Image(systemName: "photo")
                        .font(.title2)
                        .foregroundStyle(Theme.accent.opacity(0.55))
                }
            default:
                RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous)
                    .fill(Theme.accentSoft)
                    .redacted(reason: .placeholder)
                    .modifier(ShimmerModifier())
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
    }
}
`;
}

function rootViewSwift(featureViews: string[]): string {
  const tabs = ["HomeView", ...featureViews.slice(0, 2), "ProfileView"];
  const icons = ["house.fill", "sparkles", "star.fill", "person.fill"];
  const labels = ["Home", ...featureViews.slice(0, 2).map((v) => v.replace("View", "")), "Profile"];
  const tabItems = tabs
    .map(
      (v, i) =>
        `            ${v}()\n                .tag(${i})\n                .tabItem { Label("${labels[i]}", systemImage: "${icons[i % icons.length]}") }`
    )
    .join("\n");
  return `import SwiftUI

struct RootView: View {
    @AppStorage("didOnboard") private var didOnboard = false
    var body: some View {
        if didOnboard { MainTabView() }
        else { OnboardingView(onDone: { didOnboard = true }) }
    }
}

struct MainTabView: View {
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
${tabItems}
        }
        .tint(Theme.accent)
        .onChange(of: tab) { _, _ in Haptics.selection() }
    }
}
`;
}

function onboardingSwift(prompt: MasterBuildPrompt): string {
  const slides = prompt.features.slice(0, 3).map((f, i) => ({
    symbol: featureSymbol(f, i),
    title: esc(f),
    body: esc(`See how ${prompt.appName} handles ${f.toLowerCase()} — built for ${prompt.audience}.`),
  }));
  while (slides.length < 2) {
    const i = slides.length;
    slides.push({
      symbol: i === 0 ? "sparkles" : "checkmark.seal.fill",
      title: esc(i === 0 ? prompt.appName : "Ready when you are"),
      body: esc(i === 0 ? prompt.description : `Everything is tuned for ${prompt.audience}.`),
    });
  }
  const slideStructs = slides
    .map((s) => `        OnboardingSlide(symbol: "${s.symbol}", title: "${s.title}", subtitle: "${s.body}")`)
    .join(",\n");
  return `import SwiftUI

private struct OnboardingSlide: Identifiable {
    let id = UUID()
    let symbol: String
    let title: String
    let subtitle: String
}

struct OnboardingView: View {
    var onDone: () -> Void
    @State private var page = 0

    private let slides: [OnboardingSlide] = [
${slideStructs}
    ]

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Theme.cream, Theme.accentSoft, Theme.cream],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                TabView(selection: $page) {
                    ForEach(Array(slides.enumerated()), id: \\.offset) { index, slide in
                        VStack(spacing: 20) {
                            Spacer()
                            ZStack {
                                Circle()
                                    .fill(.ultraThinMaterial)
                                    .frame(width: 120, height: 120)
                                Image(systemName: slide.symbol)
                                    .font(.system(size: 44, weight: .semibold))
                                    .foregroundStyle(Theme.accent)
                                    .symbolEffect(.bounce, value: page == index)
                            }
                            .staggeredAppear(index: 0)
                            Text(slide.title)
                                .font(Theme.display(28))
                                .foregroundStyle(Theme.charcoal)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 28)
                                .staggeredAppear(index: 1)
                            Text(slide.subtitle)
                                .font(.body)
                                .foregroundStyle(Theme.warmGrey)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 32)
                                .staggeredAppear(index: 2)
                            Spacer()
                        }
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                .animation(Theme.spring, value: page)

                Button {
                    if page < slides.count - 1 {
                        Haptics.impact()
                        withAnimation(Theme.spring) { page += 1 }
                    } else {
                        Haptics.success()
                        onDone()
                    }
                } label: {
                    Text(page < slides.count - 1 ? "Next" : "Let's go")
                        .primaryButtonLabel()
                }
                .buttonStyle(AppableSpringButtonStyle())
                .padding(.horizontal, 24)
                .padding(.bottom, 36)
            }
        }
    }
}
`;
}

function homeSwift(prompt: MasterBuildPrompt, featureViews: string[]): string {
  const links = featureViews
    .map((v, i) => {
      const label = v.replace("View", "");
      const sym = featureSymbol(prompt.features[i] ?? label, i);
      return `                    NavigationLink(destination: ${v}()) {
                        HStack(spacing: 14) {
                            Image(systemName: "${sym}")
                                .font(.title3)
                                .foregroundStyle(Theme.accent)
                                .frame(width: 36)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("${esc(label)}")
                                    .font(.headline)
                                    .foregroundStyle(Theme.charcoal)
                                Text("${esc(prompt.features[i] ?? label)}")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.warmGrey)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.warmGrey)
                        }
                        .appableCard()
                    }
                    .buttonStyle(AppableSpringButtonStyle())
                    .simultaneousGesture(TapGesture().onEnded { Haptics.impact() })
                    .staggeredAppear(index: ${i + 2})`;
    })
    .join("\n");
  return `import SwiftUI

struct HomeView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("${esc(prompt.appName)}")
                            .font(Theme.display(30))
                            .foregroundStyle(Theme.charcoal)
                        Text("${esc(prompt.description)}")
                            .font(.body)
                            .foregroundStyle(Theme.warmGrey)
                        Text("For ${esc(prompt.audience)}")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.accent)
                    }
                    .glassCard()
                    .staggeredAppear(index: 0)

                    Text("Your features")
                        .font(.headline)
                        .foregroundStyle(Theme.charcoal)
                        .staggeredAppear(index: 1)
${links}
                }
                .padding(20)
            }
            .screenBackground()
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
`;
}

function featureSwift(view: string, screen: string, feature: string): string {
  const title = esc(screen.replace(/screen/i, "").trim() || feature);
  const feat = esc(feature);
  return `import SwiftUI

struct ${view}: View {
    private let items = MockData.sample
    @State private var selected: Item?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                Text("${feat}")
                    .font(Theme.display(26))
                    .foregroundStyle(Theme.charcoal)
                    .staggeredAppear(index: 0)

                ForEach(Array(items.enumerated()), id: \\.element.id) { index, item in
                    Button {
                        Haptics.impact()
                        selected = item
                    } label: {
                        HStack(alignment: .top, spacing: 14) {
                            PremiumAsyncImage(url: item.imageURL)
                                .frame(width: 64, height: 64)
                            VStack(alignment: .leading, spacing: 6) {
                                Text(item.title)
                                    .font(.headline)
                                    .foregroundStyle(Theme.charcoal)
                                Text(item.subtitle)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.warmGrey)
                                    .lineLimit(2)
                            }
                            Spacer(minLength: 0)
                        }
                        .appableCard(padding: 14)
                    }
                    .buttonStyle(AppableSpringButtonStyle())
                    .staggeredAppear(index: index + 1)
                }
            }
            .padding(20)
        }
        .screenBackground()
        .navigationTitle("${title}")
        .navigationBarTitleDisplayMode(.large)
        .sheet(item: $selected) { item in
            NavigationStack {
                VStack(alignment: .leading, spacing: 16) {
                    PremiumAsyncImage(url: item.imageURL)
                        .frame(height: 180)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
                    Text(item.title)
                        .font(Theme.display(24))
                    Text(item.subtitle)
                        .foregroundStyle(Theme.warmGrey)
                    Spacer()
                }
                .padding(20)
                .navigationTitle("Details")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            Haptics.selection()
                            selected = nil
                        }
                    }
                }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }
}
`;
}

function profileSwift(prompt: MasterBuildPrompt): string {
  return `import SwiftUI

struct ProfileView: View {
    @State private var notificationsOn = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    VStack(spacing: 8) {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(Theme.accent)
                            .symbolEffect(.pulse, options: .repeating.speed(0.35))
                        Text("${esc(prompt.appName)}")
                            .font(Theme.display(22))
                        Text("${esc(prompt.audience)}")
                            .font(.subheadline)
                            .foregroundStyle(Theme.warmGrey)
                    }
                    .glassCard()
                    .staggeredAppear(index: 0)

                    VStack(spacing: 0) {
                        Toggle(isOn: $notificationsOn) {
                            Label("Notifications", systemImage: "bell.fill")
                        }
                        .tint(Theme.accent)
                        .padding(16)
                        .onChange(of: notificationsOn) { _, _ in Haptics.selection() }
                    }
                    .appableCard()
                    .staggeredAppear(index: 1)

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Legal")
                            .font(.headline)
                            .foregroundStyle(Theme.charcoal)
                        Link(destination: LegalLinks.privacy) {
                            rowLabel("Privacy Policy", symbol: "hand.raised.fill")
                        }
                        Link(destination: LegalLinks.terms) {
                            rowLabel("Terms of Service", symbol: "doc.text.fill")
                        }
                        Link(destination: LegalLinks.support) {
                            rowLabel("Support", symbol: "questionmark.circle.fill")
                        }
                    }
                    .appableCard()
                    .staggeredAppear(index: 2)
                }
                .padding(20)
            }
            .screenBackground()
            .navigationTitle("Profile")
        }
    }

    private func rowLabel(_ title: String, symbol: String) -> some View {
        HStack {
            Image(systemName: symbol)
                .foregroundStyle(Theme.accent)
                .frame(width: 28)
            Text(title)
                .foregroundStyle(Theme.charcoal)
            Spacer()
            Image(systemName: "arrow.up.right")
                .font(.caption)
                .foregroundStyle(Theme.warmGrey)
        }
    }
}
`;
}

function mockDataSwift(prompt: MasterBuildPrompt): string {
  const samples = prompt.features
    .map((f, i) => {
      const title = esc(f);
      const sub = esc(realisticSubtitle(f, prompt.appName));
      const seed = (prompt.appName.length + i + 1) * 997;
      return `        Item(title: "${title}", subtitle: "${sub}", imageURL: URL(string: "https://picsum.photos/seed/${seed}/400/400"))`;
    })
    .join(",\n");
  return `import Foundation

struct Item: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let imageURL: URL?
}

enum MockData {
    static let sample: [Item] = [
${samples}
    ]
}
`;
}

// ---- Full build services ----
function supabaseSwift(bid: string): string {
  return `import Foundation

// Lightweight Supabase REST client (set these from your Supabase project).
enum Supabase {
    static let url = URL(string: ProcessInfo.processInfo.environment["SUPABASE_URL"] ?? "https://YOUR.supabase.co")!
    static let anonKey = ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"] ?? "YOUR_ANON_KEY"

    static func request(_ path: String, method: String = "GET", body: Data? = nil) -> URLRequest {
        var req = URLRequest(url: url.appendingPathComponent(path))
        req.httpMethod = method
        req.addValue(anonKey, forHTTPHeaderField: "apikey")
        req.addValue("Bearer \\(anonKey)", forHTTPHeaderField: "Authorization")
        req.addValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = body
        return req
    }
}
`;
}

function authSwift(): string {
  return `import SwiftUI

@MainActor
final class AuthService: ObservableObject {
    @Published var isSignedIn = false
    @Published var email = ""

    func signIn(email: String, password: String) async throws {
        // POST \\(Supabase.url)/auth/v1/token?grant_type=password
        self.email = email
        self.isSignedIn = true
    }

    func signOut() { isSignedIn = false }
}
`;
}

function storeSwift(): string {
  return `import Foundation

// Simple persistence layer backed by Supabase tables (REST).
actor Store {
    func fetch<T: Decodable>(_ table: String, as: T.Type) async throws -> [T] {
        let (data, _) = try await URLSession.shared.data(for: Supabase.request("rest/v1/\\(table)?select=*"))
        return try JSONDecoder().decode([T].self, from: data)
    }
}
`;
}

function paywallSwift(prompt: MasterBuildPrompt): string {
  return `import SwiftUI

// RevenueCat paywall scaffold. Add the RevenueCat SPM package and set your API key.
struct Paywall: View {
    var onPurchased: () -> Void = {}

    var body: some View {
        VStack(spacing: 22) {
            Image(systemName: "crown.fill")
                .font(.system(size: 48))
                .foregroundStyle(Theme.accent)
                .symbolEffect(.bounce, options: .speed(0.5))
            Text("Unlock ${esc(prompt.appName)} Pro")
                .font(Theme.display(26))
            Text("Everything, fully unlocked for ${esc(prompt.audience)}.")
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.warmGrey)
            Button {
                Haptics.success()
                onPurchased()
            } label: {
                Text("Subscribe")
                    .primaryButtonLabel()
            }
            .buttonStyle(AppableSpringButtonStyle())
        }
        .padding(28)
        .glassCard()
        .padding(20)
        .screenBackground()
    }
}
`;
}

function pushSwift(): string {
  return `import UIKit
import UserNotifications

final class PushManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushManager()

    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
    }
}
`;
}

function readmeSwift(prompt: MasterBuildPrompt, app: string, mode: BuildMode): string {
  return `# ${prompt.appName}

Generated by the Appable Builder (${mode} build).

## Build

This project uses [XcodeGen](https://github.com/yonaskolb/XcodeGen):

\`\`\`bash
brew install xcodegen   # Mac only
xcodegen generate       # creates ${app}.xcodeproj
open ${app}.xcodeproj
\`\`\`

On Windows, the build runs in the cloud via Codemagic (see codemagic.yaml).

## What's inside
- Vibe: ${prompt.vibe} · Colors: ${prompt.colors}
- Screens: ${prompt.screens.join(", ")}
${mode === "full" ? "- Full build: Supabase backend, auth, RevenueCat paywall, push notifications" : "- Base build: UI only, mock data"}
`;
}
