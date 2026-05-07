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
  onAddProperty: () => void;
  onSignedOut: () => void;
  reloadKey: number;
};

type KindFilter = "all" | "rental" | "for_sale";

export default function HomeScreen({
  onOpenProperty,
  onAddProperty,
  onSignedOut,
  reloadKey,
}: Props) {
  const [items, setItems] = useState<Property[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<KindFilter>("all");

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
  }, [load, reloadKey]);

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

  const displayed =
    filter === "all" ? items : items.filter((p) => p.kind === filter);

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
            <View style={styles.titleRow}>
              <Text style={styles.title}>Properties</Text>
              <Text style={styles.titleEmoji}>🏠</Text>
            </View>
            {items.length > 0 ? (
              <Text style={styles.subtitle}>{summarize(items)}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Filter chips — only show when there's something to filter */}
      {items.length > 0 ? (
        <View style={styles.filterRow}>
          <FilterChip
            label="All"
            active={filter === "all"}
            onPress={() => setFilter("all")}
            count={items.length}
          />
          <FilterChip
            label="🛋️ Rentals"
            active={filter === "rental"}
            onPress={() => setFilter("rental")}
            count={items.filter((p) => p.kind === "rental").length}
          />
          <FilterChip
            label="🔑 For sale"
            active={filter === "for_sale"}
            onPress={() => setFilter("for_sale")}
            count={items.filter((p) => p.kind === "for_sale").length}
          />
        </View>
      ) : null}

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🌸</Text>
          <Text style={styles.emptyTitle}>No properties yet</Text>
          <Text style={styles.emptyHint}>
            Tap{" "}
            <Text style={styles.emptyHintEm}>+ Add</Text>{" "}
            to track your first place. Capture flow (camera, photos) ships in Tier
            2.
          </Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔎</Text>
          <Text style={styles.emptyTitle}>
            No {filter === "rental" ? "rentals" : "for-sale properties"} yet
          </Text>
          <Text style={styles.emptyHint}>
            Switch back to <Text style={styles.emptyHintEm}>All</Text> or add
            one with <Text style={styles.emptyHintEm}>+ Add</Text>.
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
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
              <View pointerEvents="none" style={styles.sparkleCluster}>
                <Text style={[styles.sparkle, { top: 6, right: 10, fontSize: 16, opacity: 0.95 }]}>✦</Text>
                <Text style={[styles.sparkle, { top: 3, right: 28, fontSize: 9, opacity: 0.7 }]}>✧</Text>
                <Text style={[styles.sparkle, { top: 14, right: 22, fontSize: 11, opacity: 0.85 }]}>✦</Text>
                <Text style={[styles.sparkle, { top: 8, right: 44, fontSize: 8, opacity: 0.65 }]}>✧</Text>
                <Text style={[styles.sparkle, { top: 20, right: 6, fontSize: 10, opacity: 0.8 }]}>✧</Text>
                <Text style={[styles.sparkle, { top: 18, right: 38, fontSize: 8, opacity: 0.7 }]}>✦</Text>
              </View>
              <View style={styles.cardRow}>
                <View style={styles.kindBadge}>
                  <Text style={styles.kindEmoji}>
                    {KIND_EMOJI[item.kind] ?? "🏠"}
                  </Text>
                </View>
                <View style={styles.cardMain}>
                  <Text style={styles.address} numberOfLines={2}>
                    {item.address}
                  </Text>
                  <View style={styles.badges}>
                    <Pill text={item.kind} />
                    <Pill text={item.status} />
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Floating + Add button */}
      <Pressable
        onPress={onAddProperty}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
      >
        <LinearGradient
          colors={colors.gradientButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Text style={styles.fabText}>+ Add</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text
        style={[
          styles.filterChipLabel,
          active && styles.filterChipLabelActive,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.filterChipCount,
          active && styles.filterChipCountActive,
        ]}
      >
        {count}
      </Text>
    </Pressable>
  );
}

function Pill({ text }: { text: string }) {
  const c = colors.pill[text] ?? { bg: colors.borderSoft, fg: colors.textSecondary };
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>
        {text.replace("_", " ")}
      </Text>
    </View>
  );
}

// Build a one-liner like "3 properties · 2 shortlisted · 1 rejected".
// Statuses with zero count are skipped; toured is implicit since it's the
// default and would clutter the header for users who haven't categorized yet.
function summarize(items: Property[]): string {
  const counts: Record<string, number> = {};
  for (const p of items) counts[p.status] = (counts[p.status] ?? 0) + 1;
  const parts: string[] = [`${items.length} ${items.length === 1 ? "property" : "properties"}`];
  if (counts.shortlisted) parts.push(`${counts.shortlisted} shortlisted`);
  if (counts.rejected) parts.push(`${counts.rejected} rejected`);
  return parts.join(" · ");
}

const KIND_EMOJI: Record<string, string> = {
  rental: "🛋️",
  for_sale: "🔑",
};

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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  titleEmoji: {
    fontSize: 28,
    // Slight nudge to optically center with the heavy title baseline
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  signOutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFFB3",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  signOutText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
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
  emptyHintEm: { color: colors.primaryDeep, fontWeight: "700" },

  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDeep,
  },
  filterChipLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  filterChipLabelActive: {
    color: colors.textInverse,
  },
  filterChipCount: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    backgroundColor: colors.bgAlt,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    overflow: "hidden",
    minWidth: 20,
    textAlign: "center",
  },
  filterChipCountActive: {
    color: colors.primaryDeep,
    backgroundColor: "#FFFFFFCC",
  },

  listContent: { padding: 18, paddingTop: 14, paddingBottom: 100 },
  sep: { height: 14 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: 16,
    paddingRight: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 4,
    borderLeftColor: colors.cardAccent,
    overflow: "hidden",
    ...shadow.card,
  },
  sparkleCluster: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 60,
    height: 36,
  },
  sparkle: {
    position: "absolute",
    color: colors.pinkDeep,
    fontWeight: "700",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  kindBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  kindEmoji: { fontSize: 22 },
  cardMain: { flex: 1 },
  address: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    lineHeight: 22,
  },
  chevron: { fontSize: 24, color: colors.primary, marginLeft: 6 },
  badges: { flexDirection: "row", marginTop: 8, gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  pillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },

  fab: {
    position: "absolute",
    bottom: 30,
    right: 22,
    borderRadius: radii.pill,
    ...shadow.card,
  },
  fabInner: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  fabText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
