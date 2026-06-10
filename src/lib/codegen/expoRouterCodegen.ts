import { writeFile, mkdir } from "fs/promises";
import path from "path";
import type { ExpoAppModel, ExpoTab } from "@/lib/expoApp/types";
import type { MasterBuildPrompt } from "@/lib/types";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
}

function routeName(tab: ExpoTab, index: number): string {
  if (index === 0 || tab.id === "home") return "index";
  return tab.id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

const LOAD_MODEL = `import modelJson from "../../model/expoAppModel.json";
import type { ExpoAppModel } from "../types/model";
export const model = modelJson as ExpoAppModel;
export default model;
`;

const MODEL_TYPES = `export interface ExpoListItem {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  badge?: string;
  imageUrl: string;
  tags?: string[];
  primaryAction?: string;
}

export interface ExpoAppModel {
  tabs: { id: string; label: string; icon: string }[];
  home: {
    headline: string;
    subheadline: string;
    heroLabel: string;
    heroSublabel: string;
    sections: { title: string; items: ExpoListItem[] }[];
  };
  tabScreens: Record<string, { title: string; subtitle: string; items: ExpoListItem[] }>;
  profile: { displayName: string; tagline: string; stats: { label: string; value: string }[] };
  theme: { accent: string; cream: string; card: string; charcoal: string; muted: string; line: string };
  elementStyles?: Record<string, { color?: string; background?: string }>;
  flow?: {
    welcomeTitle?: string;
    welcomeSubtitle?: string;
    roles?: { id: string; label: string; description: string }[];
    setupTitle?: string;
    setupSubtitle?: string;
    setupSubmitLabel?: string;
    auth?: {
      enabled: boolean;
      signUpTitle: string;
      signInTitle: string;
      signUpSubtitle?: string;
      signInSubtitle?: string;
    };
  };
}
`;

const EDITABLE = `import { Text, View, type TextProps, type ViewProps } from "react-native";
import model from "./model";

type Ov = { color?: string; background?: string };
function ov(id: string): Ov {
  return (model.elementStyles ?? {})[id] ?? {};
}

/** Editable text — tagged so the Appable builder can tap-to-edit content + color. */
export function EText({
  id,
  path,
  style,
  children,
  ...rest
}: TextProps & { id: string; path?: string }) {
  const o = ov(id);
  return (
    <Text
      {...rest}
      dataSet={{ appableKind: "text", appableId: id, appablePath: path ?? id }}
      style={[style, o.color ? { color: o.color } : undefined]}
    >
      {children}
    </Text>
  );
}

/** Editable container — tap-to-edit background color. kind="screen" for full screens. */
export function EView({
  id,
  kind = "box",
  style,
  children,
  ...rest
}: ViewProps & { id: string; kind?: "box" | "screen" }) {
  const o = ov(id);
  return (
    <View
      {...rest}
      dataSet={{ appableKind: kind, appableId: id }}
      style={[style, o.background ? { backgroundColor: o.background } : undefined]}
    >
      {children}
    </View>
  );
}

export function screenBg(id: string, fallback: string): string {
  return ov(id).background ?? fallback;
}
`;

const LIST_CARD = `import { Image, StyleSheet, View } from "react-native";
import type { ExpoListItem } from "../types/model";
import { EText, EView } from "../lib/editable";

export function ListCard({
  item,
  theme,
  idBase,
}: {
  item: ExpoListItem;
  theme: { accent: string; card: string; charcoal: string; muted: string };
  idBase: string;
}) {
  return (
    <EView id={idBase + ".card"} style={[styles.card, { backgroundColor: theme.card }]}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.thumb} /> : null}
      <View style={styles.body}>
        <View style={styles.row}>
          <EText id={idBase + ".title"} path={idBase + ".title"} style={[styles.title, { color: theme.charcoal }]}>{item.title}</EText>
          {item.badge ? (
            <EText id={idBase + ".badge"} path={idBase + ".badge"} style={[styles.badge, badgeStyle(item.badge, theme.accent)]}>{item.badge}</EText>
          ) : null}
        </View>
        {item.subtitle ? <EText id={idBase + ".subtitle"} path={idBase + ".subtitle"} style={[styles.sub, { color: theme.muted }]}>{item.subtitle}</EText> : null}
        {item.meta ? <EText id={idBase + ".meta"} path={idBase + ".meta"} style={[styles.meta, { color: theme.muted }]}>{item.meta}</EText> : null}
      </View>
    </EView>
  );
}

function badgeStyle(badge: string, accent: string) {
  const b = badge.toLowerCase();
  if (b === "open") return { backgroundColor: "rgba(34,197,94,0.18)", color: "#15803d" };
  if (b === "matched") return { backgroundColor: "rgba(59,130,246,0.18)", color: "#1d4ed8" };
  if (b === "done") return { backgroundColor: "rgba(100,116,139,0.2)", color: "#475569" };
  return { backgroundColor: accent + "22", color: accent };
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", borderRadius: 14, padding: 10, marginBottom: 8, gap: 10 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  body: { flex: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  title: { fontSize: 14, fontWeight: "600", flex: 1 },
  sub: { fontSize: 12, marginTop: 2 },
  meta: { fontSize: 11, marginTop: 4 },
  badge: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
});
`;

function homeScreenTsx(): string {
  return `import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import model from "../../src/lib/model";
import { EText, EView, screenBg } from "../../src/lib/editable";
import { ListCard } from "../../src/components/ListCard";

export default function HomeScreen() {
  const { home, theme } = model;
  return (
    <SafeAreaView
      dataSet={{ appableKind: "screen", appableId: "home.screen" }}
      style={[styles.safe, { backgroundColor: screenBg("home.screen", theme.cream) }]}
      edges={["top"]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <EText id="home.headline" style={[styles.headline, { color: theme.charcoal }]}>{home.headline}</EText>
        <EText id="home.subheadline" style={[styles.sub, { color: theme.muted }]}>{home.subheadline}</EText>
        <EView id="home.hero" style={[styles.hero, { backgroundColor: theme.card }]}>
          <EText id="home.heroLabel" style={[styles.heroLabel, { color: theme.charcoal }]}>{home.heroLabel}</EText>
          <EText id="home.heroSublabel" style={[styles.heroSub, { color: theme.muted }]}>{home.heroSublabel}</EText>
        </EView>
        {home.sections.map((section, si) => (
          <EView id={"home.sections[" + si + "]"} key={section.title} style={styles.section}>
            <EText id={"home.sections[" + si + "].title"} style={[styles.sectionTitle, { color: theme.charcoal }]}>{section.title}</EText>
            {section.items.map((item, ii) => (
              <ListCard key={item.id} item={item} theme={theme} idBase={"home.sections[" + si + "].items[" + ii + "]"} />
            ))}
          </EView>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  headline: { fontSize: 22, fontWeight: "700" },
  sub: { fontSize: 14, marginTop: 4, marginBottom: 12 },
  hero: { borderRadius: 16, padding: 16, marginBottom: 16 },
  heroLabel: { fontSize: 16, fontWeight: "600" },
  heroSub: { fontSize: 13, marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 8 },
});
`;
}

function tabScreenTsx(tabId: string): string {
  const base = `tabScreens.${tabId}`;
  return `import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import model from "../../src/lib/model";
import { EText, screenBg } from "../../src/lib/editable";
import { ListCard } from "../../src/components/ListCard";

const screenId = ${JSON.stringify(tabId)};
const screen = model.tabScreens[screenId];

export default function TabScreen() {
  const { theme } = model;
  if (!screen) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.cream }]}>
        <Text style={{ color: theme.muted, padding: 16 }}>Screen not found</Text>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView
      dataSet={{ appableKind: "screen", appableId: ${JSON.stringify(`${base}.screen`)} }}
      style={[styles.safe, { backgroundColor: screenBg(${JSON.stringify(`${base}.screen`)}, theme.cream) }]}
      edges={["top"]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <EText id={${JSON.stringify(`${base}.title`)}} style={[styles.title, { color: theme.charcoal }]}>{screen.title}</EText>
        <EText id={${JSON.stringify(`${base}.subtitle`)}} style={[styles.sub, { color: theme.muted }]}>{screen.subtitle}</EText>
        {screen.items.map((item, ii) => (
          <ListCard key={item.id} item={item} theme={theme} idBase={${JSON.stringify(`${base}.items[`)} + ii + "]"} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: "700" },
  sub: { fontSize: 14, marginBottom: 12 },
});
`;
}

function tabsLayoutTsx(model: ExpoAppModel): string {
  const screens = model.tabs
    .map((tab, i) => {
      const name = routeName(tab, i);
      return `      <Tabs.Screen name="${name}" options={{ title: ${JSON.stringify(tab.label)} }} />`;
    })
    .join("\n");

  return `import { Tabs } from "expo-router";
import model from "../../src/lib/model";

export default function TabLayout() {
  const accent = model.theme.accent;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarStyle: { backgroundColor: model.theme.card },
      }}
    >
${screens}
    </Tabs>
  );
}
`;
}

/** Generate full expo-router app from ExpoAppModel. */
export async function generateExpoRouterApp(
  workspaceRoot: string,
  model: ExpoAppModel,
  mp: MasterBuildPrompt
): Promise<void> {
  const appDir = path.join(workspaceRoot, "app");
  const tabsDir = path.join(appDir, "(tabs)");
  const srcDir = path.join(workspaceRoot, "src");
  await mkdir(tabsDir, { recursive: true });
  await mkdir(path.join(srcDir, "components"), { recursive: true });
  await mkdir(path.join(srcDir, "lib"), { recursive: true });
  await mkdir(path.join(srcDir, "types"), { recursive: true });

  await writeFile(path.join(srcDir, "types", "model.ts"), MODEL_TYPES, "utf8");
  await writeFile(path.join(srcDir, "lib", "model.ts"), LOAD_MODEL, "utf8");
  await writeFile(path.join(srcDir, "lib", "editable.tsx"), EDITABLE, "utf8");
  await writeFile(path.join(srcDir, "components", "ListCard.tsx"), LIST_CARD, "utf8");

  await writeFile(
    path.join(appDir, "_layout.tsx"),
    `import { Stack } from "expo-router";
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
`,
    "utf8"
  );

  await writeFile(
    path.join(appDir, "index.tsx"),
    `import { Redirect } from "expo-router";
import model from "../src/lib/model";
export default function Index() {
  if (model.flow?.welcomeTitle) return <Redirect href="/welcome" />;
  return <Redirect href="/(tabs)" />;
}
`,
    "utf8"
  );

  if (model.flow?.welcomeTitle) {
    await writeFile(
      path.join(appDir, "welcome.tsx"),
      `import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import model from "../src/lib/model";
import { EText, screenBg } from "../src/lib/editable";

export default function WelcomeScreen() {
  const { flow, theme } = model;
  const next = flow?.roles?.length ? "/role" : flow?.setupTitle ? "/setup" : "/(tabs)";
  return (
    <SafeAreaView
      dataSet={{ appableKind: "screen", appableId: "welcome.screen" }}
      style={[styles.safe, { backgroundColor: screenBg("welcome.screen", theme.cream) }]}
    >
      <View style={styles.body}>
        <EText id="flow.welcomeTitle" style={[styles.title, { color: theme.charcoal }]}>{flow?.welcomeTitle}</EText>
        <EText id="flow.welcomeSubtitle" style={[styles.sub, { color: theme.muted }]}>{flow?.welcomeSubtitle}</EText>
        <Pressable
          dataSet={{ appableKind: "box", appableId: "welcome.button" }}
          style={[styles.btn, { backgroundColor: model.elementStyles?.["welcome.button"]?.background ?? theme.accent }]}
          onPress={() => router.push(next)}
        >
          <Text style={styles.btnText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 26, fontWeight: "700" },
  sub: { fontSize: 15, marginTop: 8, marginBottom: 24 },
  btn: { borderRadius: 14, padding: 16, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
`,
      "utf8"
    );
  }

  if (model.flow?.roles?.length) {
    await writeFile(
      path.join(appDir, "role.tsx"),
      `import { Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import model from "../src/lib/model";
import { EText, screenBg } from "../src/lib/editable";

export default function RoleScreen() {
  const { flow, theme } = model;
  const next = flow?.setupTitle ? "/setup" : "/(tabs)";
  return (
    <SafeAreaView
      dataSet={{ appableKind: "screen", appableId: "role.screen" }}
      style={[styles.safe, { backgroundColor: screenBg("role.screen", theme.cream) }]}
    >
      <EText id="role.heading" style={[styles.title, { color: theme.charcoal }]}>Choose your role</EText>
      {flow?.roles?.map((role, ri) => (
        <Pressable
          key={role.id}
          dataSet={{ appableKind: "box", appableId: "flow.roles[" + ri + "].card" }}
          style={[styles.card, { backgroundColor: model.elementStyles?.["flow.roles[" + ri + "].card"]?.background ?? theme.card }]}
          onPress={() => router.push(next)}
        >
          <EText id={"flow.roles[" + ri + "].label"} style={[styles.roleTitle, { color: theme.charcoal }]}>{role.label}</EText>
          <EText id={"flow.roles[" + ri + "].description"} style={[styles.roleSub, { color: theme.muted }]}>{role.description}</EText>
        </Pressable>
      ))}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  card: { borderRadius: 14, padding: 16, marginBottom: 10 },
  roleTitle: { fontSize: 16, fontWeight: "600" },
  roleSub: { fontSize: 13, marginTop: 4 },
});
`,
      "utf8"
    );
  }

  if (model.flow?.setupTitle) {
    await writeFile(
      path.join(appDir, "setup.tsx"),
      `import { Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import model from "../src/lib/model";
import { EText, screenBg } from "../src/lib/editable";

export default function SetupScreen() {
  const { flow, theme } = model;
  const next = flow?.auth?.enabled ? "/sign-in" : "/(tabs)";
  return (
    <SafeAreaView
      dataSet={{ appableKind: "screen", appableId: "setup.screen" }}
      style={[styles.safe, { backgroundColor: screenBg("setup.screen", theme.cream) }]}
    >
      <EText id="flow.setupTitle" style={[styles.title, { color: theme.charcoal }]}>{flow?.setupTitle}</EText>
      <EText id="flow.setupSubtitle" style={[styles.sub, { color: theme.muted }]}>{flow?.setupSubtitle}</EText>
      <Pressable
        dataSet={{ appableKind: "box", appableId: "setup.button" }}
        style={[styles.btn, { backgroundColor: model.elementStyles?.["setup.button"]?.background ?? theme.accent }]}
        onPress={() => router.push(next)}
      >
        <Text style={styles.btnText}>{flow?.setupSubmitLabel ?? "Continue"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, padding: 16, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  sub: { fontSize: 14, marginTop: 8, marginBottom: 24 },
  btn: { borderRadius: 14, padding: 16, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
`,
      "utf8"
    );
  }

  if (model.flow?.auth?.enabled) {
    await writeFile(
      path.join(appDir, "sign-in.tsx"),
      `import { Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import model from "../src/lib/model";
import { EText, screenBg } from "../src/lib/editable";

export default function SignInScreen() {
  const { flow, theme } = model;
  const auth = flow?.auth;
  return (
    <SafeAreaView
      dataSet={{ appableKind: "screen", appableId: "signin.screen" }}
      style={[styles.safe, { backgroundColor: screenBg("signin.screen", theme.cream) }]}
    >
      <EText id="flow.auth.signInTitle" style={[styles.title, { color: theme.charcoal }]}>{auth?.signInTitle}</EText>
      <EText id="flow.auth.signInSubtitle" style={[styles.sub, { color: theme.muted }]}>{auth?.signInSubtitle}</EText>
      <Pressable
        dataSet={{ appableKind: "box", appableId: "signin.button" }}
        style={[styles.btn, { backgroundColor: model.elementStyles?.["signin.button"]?.background ?? theme.accent }]}
        onPress={() => router.replace("/(tabs)")}
      >
        <Text style={styles.btnText}>{auth?.signInSubmitLabel ?? "Sign in"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, padding: 16, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  sub: { fontSize: 14, marginTop: 8, marginBottom: 24 },
  btn: { borderRadius: 14, padding: 16, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
`,
      "utf8"
    );
  }

  await writeFile(path.join(tabsDir, "_layout.tsx"), tabsLayoutTsx(model), "utf8");
  await writeFile(path.join(tabsDir, "index.tsx"), homeScreenTsx(), "utf8");

  for (let i = 0; i < model.tabs.length; i++) {
    const tab = model.tabs[i]!;
    const name = routeName(tab, i);
    if (name === "index") continue;
    await writeFile(path.join(tabsDir, `${name}.tsx`), tabScreenTsx(tab.id), "utf8");
  }

  const pkg = {
    name: slug(mp.appName),
    version: "1.0.0",
    private: true,
    main: "expo-router/entry",
    scripts: {
      start: "expo start",
      android: "expo start --android",
      ios: "expo start --ios",
      typecheck: "tsc --noEmit",
      "eas:preview": "eas build --profile preview --platform all --non-interactive",
      "eas:production": "eas build --profile production --platform all --non-interactive",
    },
    dependencies: {
      expo: "~51.0.39",
      "expo-router": "~3.5.23",
      "expo-linking": "~6.3.1",
      "expo-constants": "~16.0.2",
      "expo-status-bar": "~1.12.1",
      react: "18.2.0",
      "react-dom": "18.2.0",
      "react-native": "0.74.5",
      "react-native-web": "~0.19.10",
      "react-native-safe-area-context": "4.10.5",
      "react-native-screens": "3.31.1",
    },
    devDependencies: {
      "@babel/core": "^7.24.0",
      "@types/react": "~18.2.79",
      typescript: "~5.3.3",
    },
  };

  await writeFile(
    path.join(workspaceRoot, "package.json"),
    JSON.stringify(pkg, null, 2),
    "utf8"
  );

  const appSlug = slug(mp.appName).slice(0, 32);
  const projectId = path.basename(workspaceRoot);
  await writeFile(
    path.join(workspaceRoot, "app.json"),
    JSON.stringify(
      {
        expo: {
          name: mp.appName,
          slug: appSlug,
          version: "1.0.0",
          orientation: "portrait",
          scheme: appSlug,
          userInterfaceStyle: "light",
          plugins: ["expo-router"],
          web: { bundler: "metro", output: "single" },
          experiments: { baseUrl: `/api/expo-web/${projectId}` },
          extra: { router: { origin: false } },
        },
      },
      null,
      2
    ),
    "utf8"
  );

  await writeFile(
    path.join(workspaceRoot, "eas.json"),
    JSON.stringify(
      {
        cli: { version: ">= 12.0.0", appVersionSource: "remote" },
        build: {
          development: {
            developmentClient: true,
            distribution: "internal",
          },
          preview: {
            distribution: "internal",
            ios: { simulator: true },
          },
          production: {
            autoIncrement: true,
          },
        },
        submit: {
          production: {},
        },
      },
      null,
      2
    ),
    "utf8"
  );

  await writeFile(
    path.join(workspaceRoot, "babel.config.js"),
    `module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
`,
    "utf8"
  );

  await writeFile(
    path.join(workspaceRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020"],
          jsx: "react-jsx",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          resolveJsonModule: true,
        },
        include: ["app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx", "model/**/*.json"],
      },
      null,
      2
    ),
    "utf8"
  );

  await writeFile(
    path.join(workspaceRoot, "README.md"),
    `# ${mp.appName}\n\nExpo Router app generated by Appable.\n\n` +
      `- \`npm install && npm start\` — Expo Go / simulator\n` +
      `- \`npm run typecheck\` — verify types\n` +
      `- \`npm run eas:preview\` — EAS internal build (needs EXPO_TOKEN)\n` +
      `- \`npm run eas:production\` — store build\n`,
    "utf8"
  );

  // Remove legacy single-file app if present
  try {
    const { unlink } = await import("fs/promises");
    await unlink(path.join(workspaceRoot, "App.tsx"));
  } catch {
    /* ok */
  }
}
