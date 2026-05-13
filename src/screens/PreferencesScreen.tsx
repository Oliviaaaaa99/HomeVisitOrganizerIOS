// User-preferences editor. Controls the ranker: budget, bedroom min, sqft
// min, work address. Empty fields = "no opinion" so a fresh user can save
// just one or two and the ranker still works for the rest.
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getPreferences,
  savePreferences,
  type Preferences,
} from "../api";
import { useT, type Lang } from "../i18n";
import { colors, radii, shadow } from "../theme";

type Props = {
  onBack: () => void;
};

export default function PreferencesScreen({ onBack }: Props) {
  const { t, lang, setLang } = useT();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  // We keep all fields as strings during edit; convert only on save so the
  // user can clear a number to "" without us interpreting that as 0.
  const [workAddress, setWorkAddress] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [minBeds, setMinBeds] = useState("");
  const [minBaths, setMinBaths] = useState("");
  const [minSqft, setMinSqft] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const p = await getPreferences();
        if (p.work_address) setWorkAddress(p.work_address);
        if (p.budget_min_cents != null)
          setBudgetMin(String(p.budget_min_cents / 100));
        if (p.budget_max_cents != null)
          setBudgetMax(String(p.budget_max_cents / 100));
        if (p.min_beds != null) setMinBeds(String(p.min_beds));
        if (p.min_baths != null) setMinBaths(String(p.min_baths));
        if (p.min_sqft != null) setMinSqft(String(p.min_sqft));
      } catch (err: any) {
        Alert.alert(t("preferences.couldntLoad"), err?.message ?? String(err));
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    try {
      const payload: Preferences = {};
      if (workAddress.trim()) payload.work_address = workAddress.trim();
      if (budgetMin.trim())
        payload.budget_min_cents = Math.round(parseFloat(budgetMin) * 100);
      if (budgetMax.trim())
        payload.budget_max_cents = Math.round(parseFloat(budgetMax) * 100);
      if (minBeds.trim()) payload.min_beds = parseInt(minBeds, 10);
      if (minBaths.trim()) payload.min_baths = parseFloat(minBaths);
      if (minSqft.trim()) payload.min_sqft = parseInt(minSqft, 10);
      await savePreferences(payload);
      onBack();
    } catch (err: any) {
      Alert.alert(t("common.saveFailed"), err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
            <Text style={styles.navPillText}>{t("preferences.cancel")}</Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={busy}
            hitSlop={10}
            style={({ pressed }) => [
              styles.navPillPrimary,
              pressed && { opacity: 0.85 },
              busy && { opacity: 0.6 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Text style={styles.navPillPrimaryText}>{t("preferences.save")}</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.title}>{t("preferences.title")}</Text>
        <Text style={styles.subtitle}>{t("preferences.subtitle")}</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>{t("preferences.languageSection")}</Text>
        <View style={styles.langSegmented}>
          {(
            [
              { key: "en" as Lang, label: t("preferences.languageEn") },
              { key: "zh" as Lang, label: t("preferences.languageZh") },
            ]
          ).map((opt) => {
            const active = lang === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setLang(opt.key)}
                style={[
                  styles.langSegment,
                  active && styles.langSegmentActive,
                ]}
              >
                <Text
                  style={[
                    styles.langSegmentText,
                    active && styles.langSegmentTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>{t("preferences.workSection")}</Text>
        <Text style={styles.fieldLabel}>{t("preferences.workLabel")}</Text>
        <TextInput
          style={styles.input}
          value={workAddress}
          onChangeText={setWorkAddress}
          placeholder={t("preferences.workPlaceholder")}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.helperText}>{t("preferences.workHelper")}</Text>

        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>{t("preferences.budgetSection")}</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t("preferences.budgetMin")}</Text>
            <TextInput
              style={styles.input}
              value={budgetMin}
              onChangeText={setBudgetMin}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t("preferences.budgetMax")}</Text>
            <TextInput
              style={styles.input}
              value={budgetMax}
              onChangeText={setBudgetMax}
              keyboardType="decimal-pad"
              placeholder="3000"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>{t("preferences.minimumsSection")}</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t("preferences.minBeds")}</Text>
            <TextInput
              style={styles.input}
              value={minBeds}
              onChangeText={setMinBeds}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t("preferences.minBaths")}</Text>
            <TextInput
              style={styles.input}
              value={minBaths}
              onChangeText={setMinBaths}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t("preferences.minSqft")}</Text>
            <TextInput
              style={styles.input}
              value={minSqft}
              onChangeText={setMinSqft}
              keyboardType="number-pad"
              placeholder="500"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    minWidth: 64,
    alignItems: "center",
  },
  navPillPrimaryText: {
    color: colors.textInverse,
    fontWeight: "800",
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 6,
  },
  scroll: { flex: 1 },
  content: { padding: 18 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryDeep,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  row: { flexDirection: "row", gap: 10 },
  langSegmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    padding: 4,
    gap: 4,
    ...shadow.card,
  },
  langSegment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radii.input - 4,
  },
  langSegmentActive: {
    backgroundColor: colors.primary,
  },
  langSegmentText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  langSegmentTextActive: {
    color: colors.textInverse,
  },
});
