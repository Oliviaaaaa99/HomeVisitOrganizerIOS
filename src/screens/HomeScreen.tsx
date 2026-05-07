import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { listProperties, type Property } from "../api";
import { clearTokens } from "../storage";
import { colors, radii, shadow } from "../theme";

type Props = {
  onOpenProperty: (id: string) => void;
  onSignedOut: () => void;
};

export default function HomeScreen({ onOpenProperty, onSignedOut }: Props) {
  const [items, setItems] = useState<Property[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await listProperties();
      setItems(resp.items ?? []);
    } catch (err: any) {
      Alert.alert("Load failed", err?.message ?? String(err));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSignOut() {
    await clearTokens();
    onSignedOut();
  }

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (items === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={colors.gradientHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerInner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>My collection</Text>
            <Text style={styles.title}>Properties</Text>
          </View>
          <Pressable onPress={handleSignOut} hitSlop={8}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🌸</Text>
          <Text style={styles.emptyTitle}>No properties yet</Text>
          <Text style={styles.emptyHint}>
            Tour your first apartment to start tracking. Capture flow ships in
            Tier 2.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onOpenProperty(item.id)}
              style={({ pressed }) => [
                styles.card,
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={styles.cardRow}>
                <Text style={styles.address} numberOfLines={2}>
                  {item.address}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <View style={styles.badges}>
                <Pill text={item.kind} />
                <Pill text={item.status} />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function Pill({ text }: { text: string }) {
  const c = colors.pill[text] ?? { bg: colors.borderSoft, fg: colors.textSecondary };
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{text.replace("_", " ")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 22,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDeep,
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.85,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 4,
  },
  signOut: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: "600",
    paddingBottom: 6,
  },
  empty: {
    flex: 1,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    color: colors.textPrimary,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  listContent: { padding: 18, paddingTop: 22 },
  sep: { height: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 18,
    ...shadow.card,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  address: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: colors.textPrimary,
    lineHeight: 23,
  },
  chevron: { fontSize: 24, color: colors.primary, marginLeft: 8 },
  badges: { flexDirection: "row", marginTop: 12, gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  pillText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
});
