// Flat list of all units across all properties, sorted by AI ranking score.
// Companion view to Home (which is property-grouped). Tap a card → unit
// detail. Each card shows the parent property as a subtitle so location
// context isn't lost when units are pulled out of their grouping.
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
import { computeRanking, type RankedUnit } from "../api";
import { unitTypeLabel, useT } from "../i18n";
import { colors, radii, shadow } from "../theme";

type Props = {
  onBack: () => void;
  onOpenUnit: (propertyId: string, unitId: string) => void;
  onOpenPreferences: () => void;
};

export default function RankedScreen({
  onBack,
  onOpenUnit,
  onOpenPreferences,
}: Props) {
  const { t } = useT();
  const [items, setItems] = useState<RankedUnit[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await computeRanking();
      setItems(resp.items);
    } catch (err: any) {
      Alert.alert(t("ranked.couldntCompute"), err?.message ?? String(err));
      setItems([]);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={colors.gradientHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.navRow}>
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={({ pressed }) => [
              styles.navPill,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.navPillText}>{t("ranked.homeBtn")}</Text>
          </Pressable>
          <Pressable
            onPress={onOpenPreferences}
            hitSlop={10}
            style={({ pressed }) => [
              styles.navPillPrimary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.navPillPrimaryText}>{t("ranked.preferencesBtn")}</Text>
          </Pressable>
        </View>
        <Text style={styles.eyebrow}>{t("ranked.eyebrow")}</Text>
        <Text style={styles.title}>{t("ranked.title")}</Text>
        <Text style={styles.subtitle}>{t("ranked.subtitle")}</Text>
      </LinearGradient>

      {items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyTitle}>{t("ranked.emptyTitle")}</Text>
          <Text style={styles.emptyHint}>{t("ranked.emptyHint")}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.unit_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => onOpenUnit(item.property_id, item.unit_id)}
              style={({ pressed }) => [
                styles.card,
                pressed && { transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medal}>{medalFor(index)}</Text>
                  <Text style={styles.unitTitle}>
                    {item.unit_label?.trim() || unitTypeLabel(t, item.unit_type)}
                  </Text>
                  <Text style={styles.address} numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreNumber}>
                    {item.score.toFixed(1)}
                  </Text>
                  <Text style={styles.scoreOutOf}>/10</Text>
                </View>
              </View>

              {item.reasons.length > 0 ? (
                <View style={styles.reasons}>
                  {item.reasons.slice(0, 4).map((r, i) => (
                    <Text
                      key={i}
                      style={[
                        styles.reason,
                        r.sign === "pro"
                          ? styles.reasonPro
                          : styles.reasonCon,
                      ]}
                    >
                      {r.sign === "pro" ? "✓" : "✕"} {r.message}
                    </Text>
                  ))}
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function medalFor(index: number): string {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 18,
    paddingTop: 60,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  navPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navPillText: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
  navPillPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  navPillPrimaryText: {
    color: colors.textInverse,
    fontWeight: "800",
    fontSize: 13,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 6,
  },

  listContent: { padding: 18, paddingBottom: 40 },
  empty: {
    flex: 1,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.card,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  medal: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primaryDeep,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  unitTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  address: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
    marginTop: 3,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primaryDeep,
  },
  scoreOutOf: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "700",
    marginLeft: 1,
  },
  reasons: {
    marginTop: 12,
    gap: 4,
  },
  reason: {
    fontSize: 12,
    fontWeight: "600",
  },
  reasonPro: { color: "#166534" },
  reasonCon: { color: colors.dangerDeep },
});
