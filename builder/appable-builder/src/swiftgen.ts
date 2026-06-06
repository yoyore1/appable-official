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
    iOS: "16.0"
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

// Appable theme — vibe: ${prompt.vibe}, colors: ${prompt.colors}
enum Theme {
    static let accent = Color(red: ${r}, green: ${g}, blue: ${b})
    static let cream = Color(red: 0.992, green: 0.980, blue: 0.957)
    static let charcoal = Color(red: 0.169, green: 0.149, blue: 0.141)

    static let corner: CGFloat = 22
    static let cardShadow = Color.black.opacity(0.08)
}

extension View {
    func card() -> some View {
        self.padding(18)
            .background(Theme.cream)
            .clipShape(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .shadow(color: Theme.cardShadow, radius: 18, x: 0, y: 10)
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
        `            ${v}()\n                .tabItem { Label("${labels[i]}", systemImage: "${icons[i % icons.length]}") }`
    )
    .join("\n");
  return `import SwiftUI

struct RootView: View {
    @AppStorage("didOnboard") private var didOnboard = false

    var body: some View {
        if didOnboard {
            MainTabView()
        } else {
            OnboardingView(onDone: { didOnboard = true })
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
${tabItems}
        }
    }
}
`;
}

function onboardingSwift(prompt: MasterBuildPrompt): string {
  return `import SwiftUI

struct OnboardingView: View {
    var onDone: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "sparkles")
                .font(.system(size: 56))
                .foregroundStyle(Theme.accent)
            Text("${prompt.appName}")
                .font(.largeTitle.bold())
            Text("${prompt.description}")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
            Button(action: onDone) {
                Text("Let's go")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Theme.accent)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
        .background(Theme.cream.ignoresSafeArea())
    }
}
`;
}

function homeSwift(prompt: MasterBuildPrompt, featureViews: string[]): string {
  const links = featureViews
    .map(
      (v) =>
        `                    NavigationLink(destination: ${v}()) {
                        HStack {
                            Text("${v.replace("View", "")}")
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(.secondary)
                        }.card()
                    }.buttonStyle(.plain)`
    )
    .join("\n");
  return `import SwiftUI

struct HomeView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Welcome back 👋")
                        .font(.title2.bold())
                    Text("${prompt.description}")
                        .foregroundStyle(.secondary)
${links}
                }
                .padding()
            }
            .background(Theme.cream.ignoresSafeArea())
            .navigationTitle("${prompt.appName}")
        }
    }
}
`;
}

function featureSwift(view: string, screen: string, feature: string): string {
  return `import SwiftUI

struct ${view}: View {
    private let items = MockData.${'sample'}

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("${feature}")
                    .font(.title2.bold())
                ForEach(items) { item in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.title).font(.headline)
                        Text(item.subtitle).font(.subheadline).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
                }
            }
            .padding()
        }
        .background(Theme.cream.ignoresSafeArea())
        .navigationTitle("${screen.replace(/screen/i, "").trim()}")
    }
}
`;
}

function profileSwift(prompt: MasterBuildPrompt): string {
  return `import SwiftUI

struct ProfileView: View {
    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    Label("Your profile", systemImage: "person.circle")
                    Label("Notifications", systemImage: "bell")
                }
                Section("About ${prompt.appName}") {
                    Link("Privacy Policy", destination: LegalLinks.privacy)
                    Link("Terms of Service", destination: LegalLinks.terms)
                    Link("Support", destination: LegalLinks.support)
                }
            }
            .navigationTitle("Profile")
        }
    }
}
`;
}

function mockDataSwift(prompt: MasterBuildPrompt): string {
  const samples = prompt.features
    .map((f, i) => `        Item(title: "${f}", subtitle: "Tap to explore ${f.toLowerCase()}")`)
    .join(",\n");
  return `import Foundation

struct Item: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
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
        VStack(spacing: 20) {
            Text("Unlock ${prompt.appName} Pro")
                .font(.title.bold())
            Text("Everything, fully unlocked.")
                .foregroundStyle(.secondary)
            Button("Subscribe") { onPurchased() }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Theme.accent)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
        }
        .padding()
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
