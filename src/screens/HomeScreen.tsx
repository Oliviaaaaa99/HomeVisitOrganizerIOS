import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { listProperties, type Property } from "../api";
import { clearTokens } from "../storage";

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
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <Text style={styles.title}>My Properties</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No properties yet</Text>
          <Text style={styles.emptyHint}>
            Add some via the backend (POST /v1/properties) — capture flow ships
            in Tier 2.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onOpenProperty(item.id)}
            >
              <View style={styles.cardRow}>
                <Text style={styles.address} numberOfLines={2}>
                  {item.address}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <View style={styles.badges}>
                <Badge text={item.kind} />
                <Badge text={item.status} kind="status" />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function Badge({
  text,
  kind,
}: {
  text: string;
  kind?: "status";
}) {
  const palette: Record<string, { bg: string; fg: string }> = {
    rental: { bg: "#e8f4ff", fg: "#0a5d8a" },
    for_sale: { bg: "#fef3e8", fg: "#a55600" },
    toured: { bg: "#f0f0f0", fg: "#333" },
    shortlisted: { bg: "#e8f8ec", fg: "#1f7a3a" },
    rejected: { bg: "#fdecec", fg: "#9a1f1f" },
    archived: { bg: "#f0f0f0", fg: "#888" },
  };
  const c = palette[text] ?? { bg: "#eee", fg: "#333" };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topbar: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#111" },
  signOut: { color: "#0a7ea4", fontSize: 15, paddingBottom: 4 },
  empty: { padding: 32, alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8, color: "#444" },
  emptyHint: { fontSize: 14, color: "#888", textAlign: "center" },
  listContent: { padding: 16 },
  sep: { height: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  address: { flex: 1, fontSize: 16, fontWeight: "500", color: "#111" },
  chevron: { fontSize: 22, color: "#bbb", marginLeft: 8 },
  badges: { flexDirection: "row", marginTop: 10, gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "600" },
});
