import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";

const API_BASE =
  process.env.EXPO_PUBLIC_APPABLE_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

type ExpoModel = {
  tabs: { id: string; label: string }[];
  home: {
    headline: string;
    subheadline: string;
    heroLabel: string;
    heroSublabel: string;
    sections: { title: string; items: { id: string; title: string; subtitle: string; imageUrl?: string }[] }[];
  };
  tabScreens: Record<string, { title: string; subtitle: string; items: { id: string; title: string; subtitle: string; imageUrl?: string }[] }>;
  profile: {
    displayName: string;
    tagline: string;
    stats: { label: string; value: string }[];
  };
  theme: {
    accent: string;
    cream: string;
    card: string;
    charcoal: string;
    muted: string;
  };
};

type Params = { projectId?: string; token?: string };

function parseParams(url: string | null): Params {
  if (!url) return {};
  const parsed = Linking.parse(url);
  const q = parsed.queryParams ?? {};
  return {
    projectId: typeof q.projectId === "string" ? q.projectId : undefined,
    token: typeof q.token === "string" ? q.token : undefined,
  };
}

export default function App() {
  const [params, setParams] = useState<Params>({});
  const [appName, setAppName] = useState("Your app");
  const [model, setModel] = useState<ExpoModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tabId, setTabId] = useState("home");

  useEffect(() => {
    void Linking.getInitialURL().then((url) => setParams(parseParams(url)));
    const sub = Linking.addEventListener("url", ({ url }) => setParams(parseParams(url)));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!params.projectId || !params.token) {
      setError(
        "Open from Appable — in Expo Go, scan the QR code on the build page after your app is ready."
      );
      return;
    }
    setError(null);
    setModel(null);
    const url = `${API_BASE}/api/projects/${params.projectId}/expo-model?token=${encodeURIComponent(params.token)}`;
    void fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load your app. Check Wi‑Fi and try again.");
        return r.json() as Promise<{ appName: string; model: ExpoModel }>;
      })
      .then((data) => {
        setAppName(data.appName);
        setModel(data.model);
        setTabId(data.model.tabs[0]?.id ?? "home");
      })
      .catch((e: Error) => setError(e.message));
  }, [params.projectId, params.token]);

  const theme = model?.theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Appable</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!model) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator color={theme?.accent ?? "#ff7a63"} />
          <Text style={styles.loading}>Loading {appName}…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const screen =
    tabId === "home"
      ? null
      : tabId === "profile"
        ? null
        : model.tabScreens[tabId];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {tabId === "home" && (
          <View>
            <Text style={styles.headline}>{model.home.headline}</Text>
            <Text style={styles.subhead}>{model.home.subheadline}</Text>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>{model.home.heroLabel}</Text>
              <Text style={styles.heroSub}>{model.home.heroSublabel}</Text>
            </View>
            {model.home.sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.items.map((item) => (
                  <View key={item.id} style={styles.card}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                    ) : null}
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <Text style={styles.cardSub}>{item.subtitle}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {tabId === "profile" && (
          <View>
            <Text style={styles.headline}>{model.profile.displayName}</Text>
            <Text style={styles.subhead}>{model.profile.tagline}</Text>
            <View style={styles.statsRow}>
              {model.profile.stats.map((s) => (
                <View key={s.label} style={styles.stat}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {screen && (
          <View>
            <Text style={styles.headline}>{screen.title}</Text>
            <Text style={styles.subhead}>{screen.subtitle}</Text>
            {screen.items.map((item) => (
              <View key={item.id} style={styles.card}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                ) : null}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSub}>{item.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.tabBar}>
        {model.tabs.map((tab) => {
          const active = tab.id === tabId;
          return (
            <Pressable key={tab.id} onPress={() => setTabId(tab.id)} style={styles.tab}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme?: ExpoModel["theme"]) {
  const accent = theme?.accent ?? "#ff7a63";
  const cream = theme?.cream ?? "#faf6f0";
  const card = theme?.card ?? "#ffffff";
  const charcoal = theme?.charcoal ?? "#2b2622";
  const muted = theme?.muted ?? "#8a8178";

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: cream },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    scroll: { padding: 16, paddingBottom: 88 },
    loading: { marginTop: 12, color: muted, fontSize: 14 },
    errorTitle: { fontSize: 20, fontWeight: "700", color: charcoal, marginBottom: 8 },
    errorBody: { fontSize: 14, color: muted, textAlign: "center", lineHeight: 20 },
    headline: { fontSize: 24, fontWeight: "700", color: charcoal },
    subhead: { fontSize: 14, color: muted, marginTop: 4, marginBottom: 16, lineHeight: 20 },
    hero: {
      backgroundColor: card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: "#e8ded3",
    },
    heroLabel: { fontSize: 16, fontWeight: "600", color: charcoal },
    heroSub: { fontSize: 13, color: muted, marginTop: 4 },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 15, fontWeight: "600", color: charcoal, marginBottom: 8 },
    card: {
      flexDirection: "row",
      backgroundColor: card,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: "#e8ded3",
      gap: 10,
    },
    thumb: { width: 52, height: 52, borderRadius: 10 },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 14, fontWeight: "600", color: charcoal },
    cardSub: { fontSize: 12, color: muted, marginTop: 2 },
    statsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
    stat: {
      flex: 1,
      backgroundColor: card,
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#e8ded3",
    },
    statValue: { fontSize: 18, fontWeight: "700", color: accent },
    statLabel: { fontSize: 11, color: muted, marginTop: 2 },
    tabBar: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: "#e8ded3",
      backgroundColor: card,
      paddingBottom: 8,
      paddingTop: 8,
    },
    tab: { flex: 1, alignItems: "center", paddingVertical: 6 },
    tabLabel: { fontSize: 11, color: muted, fontWeight: "500" },
    tabLabelActive: { color: accent, fontWeight: "700" },
  });
}
