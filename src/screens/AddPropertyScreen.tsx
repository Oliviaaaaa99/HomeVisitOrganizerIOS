import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
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
import { createNote, createProperty, createUnit } from "../api";
import { geocode, type GeocodingResult } from "../geocoding";
import { colors, radii, shadow } from "../theme";

type Props = {
  onCancel: () => void;
  onCreated: () => void;
};

const UNIT_TYPES: Record<"rental" | "for_sale", readonly string[]> = {
  rental: ["studio", "1B", "2B", "3B"],
  for_sale: ["condo", "townhouse", "sfh", "apartment"],
} as const;

export default function AddPropertyScreen({ onCancel, onCreated }: Props) {
  // Property fields
  const [address, setAddress] = useState("");
  const [kind, setKind] = useState<"rental" | "for_sale">("rental");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [sourceUrl, setSourceUrl] = useState("");

  // Optional unit fields
  const [unitType, setUnitType] = useState<string>("");
  const [unitLabel, setUnitLabel] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [sqft, setSqft] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");

  // Optional first note
  const [noteText, setNoteText] = useState("");

  const [busy, setBusy] = useState(false);

  // Geocoding suggestions
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(false);
  const reqId = useRef(0);

  // When kind flips, reset unit_type so we don't keep an invalid value.
  useEffect(() => {
    setUnitType("");
  }, [kind]);

  // Debounced address lookup
  useEffect(() => {
    if (picked) return;
    if (address.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const myId = ++reqId.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await geocode(address);
        if (reqId.current === myId) setSuggestions(results);
      } catch {
        if (reqId.current === myId) setSuggestions([]);
      } finally {
        if (reqId.current === myId) setSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [address, picked]);

  function handleAddressChange(text: string) {
    setAddress(text);
    setPicked(false);
  }
  function handlePickSuggestion(s: GeocodingResult) {
    setAddress(s.displayName);
    setLatitude(s.lat.toString());
    setLongitude(s.lon.toString());
    setSuggestions([]);
    setPicked(true);
  }
  function handleClearCoords() {
    setLatitude("");
    setLongitude("");
    setPicked(false);
  }

  async function handleSave() {
    if (!address.trim()) {
      Alert.alert("Missing address", "Address is required.");
      return;
    }
    setBusy(true);
    const warnings: string[] = [];
    try {
      const lat = latitude.trim() ? Number(latitude) : undefined;
      const lng = longitude.trim() ? Number(longitude) : undefined;
      if (lat !== undefined && Number.isNaN(lat)) {
        throw new Error("latitude is not a number");
      }
      if (lng !== undefined && Number.isNaN(lng)) {
        throw new Error("longitude is not a number");
      }

      // 1. Create property (the only required step)
      const property = await createProperty({
        address: address.trim(),
        kind,
        latitude: lat,
        longitude: lng,
        source_url: sourceUrl.trim() || undefined,
      });

      // 2. Optional unit — only if a unit_type was picked
      if (unitType.trim()) {
        try {
          const priceCents = priceDollars.trim()
            ? Math.round(Number(priceDollars) * 100)
            : undefined;
          if (priceCents !== undefined && Number.isNaN(priceCents)) {
            throw new Error("price is not a number");
          }
          await createUnit(property.id, {
            unit_type: unitType,
            unit_label: unitLabel.trim() || undefined,
            price_cents: priceCents,
            sqft: sqft.trim() ? parseInt(sqft, 10) : undefined,
            beds: beds.trim() ? parseInt(beds, 10) : undefined,
            baths: baths.trim() ? Number(baths) : undefined,
          });
        } catch (err: any) {
          warnings.push(`Unit failed: ${err?.message ?? String(err)}`);
        }
      }

      // 3. Optional note
      if (noteText.trim()) {
        try {
          await createNote(property.id, noteText.trim());
        } catch (err: any) {
          warnings.push(`Note failed: ${err?.message ?? String(err)}`);
        }
      }

      if (warnings.length > 0) {
        Alert.alert("Property saved with warnings", warnings.join("\n\n"), [
          { text: "OK", onPress: onCreated },
        ]);
      } else {
        onCreated();
      }
    } catch (err: any) {
      Alert.alert("Save failed", err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  const hasCoords = latitude.trim() !== "" && longitude.trim() !== "";

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.gradientHeader} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={onCancel}
            hitSlop={10}
            style={({ pressed }) => [
              styles.navPillSecondary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.navPillSecondaryText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>New property</Text>
          <Pressable
            onPress={handleSave}
            disabled={busy || !address.trim()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.navPillPrimary,
              (busy || !address.trim()) && styles.navPillDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.navPillPrimaryText}>Save</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* === Property === */}
          <Field label="Address *">
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={handleAddressChange}
              placeholder="Type a street address..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              multiline
            />
            {searching ? (
              <View style={styles.searchHint}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.searchHintText}>Looking up…</Text>
              </View>
            ) : null}
            {!picked && suggestions.length > 0 ? (
              <View style={styles.suggestions}>
                {suggestions.map((s, i) => (
                  <Pressable
                    key={`${s.lat},${s.lon},${i}`}
                    onPress={() => handlePickSuggestion(s)}
                    style={({ pressed }) => [
                      styles.suggestion,
                      i < suggestions.length - 1 && styles.suggestionBorder,
                      pressed && { backgroundColor: colors.primarySoft },
                    ]}
                  >
                    <Text style={styles.suggestionMain} numberOfLines={2}>
                      {s.displayName.split(",").slice(0, 2).join(",")}
                    </Text>
                    <Text style={styles.suggestionSub} numberOfLines={1}>
                      {s.displayName.split(",").slice(2).join(",").trim()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {hasCoords && picked ? (
              <View style={styles.autoFilledBanner}>
                <Text style={styles.autoFilledText}>
                  ✓ Auto-filled coordinates: {Number(latitude).toFixed(4)},{" "}
                  {Number(longitude).toFixed(4)}
                </Text>
                <Pressable onPress={handleClearCoords} hitSlop={6}>
                  <Text style={styles.autoFilledClear}>Clear</Text>
                </Pressable>
              </View>
            ) : null}
          </Field>

          <Field label="Kind">
            <View style={styles.segmented}>
              <SegmentButton
                text="Rental"
                active={kind === "rental"}
                onPress={() => setKind("rental")}
              />
              <SegmentButton
                text="For sale"
                active={kind === "for_sale"}
                onPress={() => setKind("for_sale")}
              />
            </View>
          </Field>

          <Field label="Source URL">
            <TextInput
              style={styles.input}
              value={sourceUrl}
              onChangeText={setSourceUrl}
              placeholder="https://www.zillow.com/..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Field>

          {/* === Optional Unit === */}
          <View style={styles.divider}>
            <Text style={styles.dividerText}>Unit details (optional)</Text>
          </View>

          <Field label="Unit type">
            <View style={styles.chipRow}>
              {UNIT_TYPES[kind].map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setUnitType(unitType === t ? "" : t)}
                  style={[
                    styles.typeChip,
                    unitType === t && styles.typeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      unitType === t && styles.typeChipTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>
              {unitType
                ? "A unit will be created with the values below."
                : "Tap a type if you want to create a unit. Skip to add later."}
            </Text>
          </Field>

          {unitType ? (
            <>
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Field label="Unit label">
                    <TextInput
                      style={styles.input}
                      value={unitLabel}
                      onChangeText={setUnitLabel}
                      placeholder="Apt 12A"
                      placeholderTextColor={colors.textMuted}
                    />
                  </Field>
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Field
                    label={
                      kind === "rental" ? "Price ($/mo)" : "Price ($)"
                    }
                  >
                    <TextInput
                      style={styles.input}
                      value={priceDollars}
                      onChangeText={setPriceDollars}
                      placeholder={kind === "rental" ? "1800" : "1750000"}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </Field>
                </View>
              </View>
              <View style={styles.row3}>
                <View style={{ flex: 1 }}>
                  <Field label="Beds">
                    <TextInput
                      style={styles.input}
                      value={beds}
                      onChangeText={setBeds}
                      placeholder="2"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </Field>
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <Field label="Baths">
                    <TextInput
                      style={styles.input}
                      value={baths}
                      onChangeText={setBaths}
                      placeholder="2.0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </Field>
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <Field label="Sqft">
                    <TextInput
                      style={styles.input}
                      value={sqft}
                      onChangeText={setSqft}
                      placeholder="1240"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </Field>
                </View>
              </View>
            </>
          ) : null}

          {/* === Optional first note === */}
          <View style={styles.divider}>
            <Text style={styles.dividerText}>First note (optional)</Text>
          </View>

          <Field label="What did you think?">
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="采光很好；HOA 偏高；地铁 5 分钟…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </Field>

          <Text style={styles.footHint}>
            Status defaults to <Text style={styles.footHintEm}>toured</Text>.
            You can change it on the detail page after creating.
          </Text>

          {busy ? (
            <View style={styles.spinner}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function SegmentButton({
  text,
  active,
  onPress,
}: {
  text: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  navPillSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navPillSecondaryText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  navPillPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDeep,
  },
  navPillPrimaryText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  navPillDisabled: {
    backgroundColor: colors.borderSoft,
    borderColor: colors.borderSoft,
  },

  scroll: { flex: 1 },
  content: { padding: 22, paddingBottom: 80 },
  field: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDeep,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 8, lineHeight: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    ...shadow.card,
  },
  noteInput: { minHeight: 90, textAlignVertical: "top" },

  searchHint: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  searchHintText: { fontSize: 12, color: colors.textMuted },
  suggestions: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    overflow: "hidden",
    ...shadow.card,
  },
  suggestion: { padding: 14 },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  suggestionMain: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  suggestionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  autoFilledBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.input,
  },
  autoFilledText: {
    fontSize: 12,
    color: colors.primaryDeep,
    fontWeight: "600",
    flex: 1,
  },
  autoFilledClear: {
    fontSize: 12,
    color: colors.pinkDeep,
    fontWeight: "700",
    paddingLeft: 12,
  },

  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    padding: 4,
    ...shadow.card,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.input - 4,
  },
  segmentBtnActive: { backgroundColor: colors.primarySoft },
  segmentText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  segmentTextActive: { color: colors.primaryDeep },

  divider: { marginTop: 14, marginBottom: 14 },
  dividerText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.pinkDeep,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  typeChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  typeChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  typeChipTextActive: { color: colors.primaryDeep },

  row2: { flexDirection: "row" },
  row3: { flexDirection: "row" },

  footHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 6,
  },
  footHintEm: { color: colors.primaryDeep, fontWeight: "600" },
  spinner: { marginTop: 24, alignItems: "center" },
});
