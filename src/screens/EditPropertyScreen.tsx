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
import { getProperty, updateProperty, type PropertyDetail } from "../api";
import { geocode, type GeocodingResult } from "../geocoding";
import { colors, radii, shadow } from "../theme";

type Props = {
  propertyId: string;
  onCancel: () => void;
  onSaved: () => void;
};

export default function EditPropertyScreen({
  propertyId,
  onCancel,
  onSaved,
}: Props) {
  const [original, setOriginal] = useState<PropertyDetail | null>(null);

  const [address, setAddress] = useState("");
  const [kind, setKind] = useState<"rental" | "for_sale">("rental");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [sourceUrl, setSourceUrl] = useState("");

  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  // True after user picks a suggestion (or keeps the original address). Stops
  // suggestions until user edits again.
  const [picked, setPicked] = useState(true);
  const reqId = useRef(0);

  // Load existing values
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getProperty(propertyId);
        if (cancelled) return;
        setOriginal(data);
        setAddress(data.address);
        setKind(data.kind);
        setLatitude(data.latitude !== undefined ? String(data.latitude) : "");
        setLongitude(data.longitude !== undefined ? String(data.longitude) : "");
        setSourceUrl(data.source_url ?? "");
      } catch (err: any) {
        Alert.alert("Load failed", err?.message ?? String(err));
        onCancel();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, onCancel]);

  // Address autocomplete (only after user starts editing)
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

  async function handleSave() {
    if (!address.trim()) {
      Alert.alert("Missing address", "Address is required.");
      return;
    }
    if (!original) return;

    // Only send fields that actually changed.
    const patch: Parameters<typeof updateProperty>[1] = {};

    if (address.trim() !== original.address) {
      patch.address = address.trim();
    }
    if (kind !== original.kind) {
      patch.kind = kind;
    }
    const trimmedSource = sourceUrl.trim();
    if (trimmedSource !== (original.source_url ?? "")) {
      patch.source_url = trimmedSource; // empty string clears
    }
    const lat = latitude.trim() ? Number(latitude) : undefined;
    const lng = longitude.trim() ? Number(longitude) : undefined;
    const origLat = original.latitude;
    const origLng = original.longitude;
    if (lat !== origLat || lng !== origLng) {
      if (lat !== undefined && lng !== undefined) {
        patch.latitude = lat;
        patch.longitude = lng;
      }
      // If only one is missing, skip — backend rejects partial coords.
    }

    if (Object.keys(patch).length === 0) {
      Alert.alert("No changes", "Nothing was edited.");
      return;
    }

    setBusy(true);
    try {
      await updateProperty(propertyId, patch);
      onSaved();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!original) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.gradientHeader} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={onCancel} hitSlop={10}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit property</Text>
          <Pressable onPress={handleSave} disabled={busy} hitSlop={10}>
            <Text
              style={[
                styles.saveText,
                (busy || !address.trim()) && styles.saveDisabled,
              ]}
            >
              Save
            </Text>
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
          <Field label="Address *">
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={handleAddressChange}
              placeholder="Street address"
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
            <Text style={styles.hint}>Leave empty to clear.</Text>
          </Field>

          <Text style={styles.footHint}>
            To change <Text style={styles.footHintEm}>status</Text>,{" "}
            <Text style={styles.footHintEm}>units</Text>, or{" "}
            <Text style={styles.footHintEm}>notes</Text>, use the buttons on the
            detail page.
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: "500" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  saveText: { color: colors.primaryDeep, fontSize: 15, fontWeight: "700" },
  saveDisabled: { color: colors.textMuted },

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

  footHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 6,
  },
  footHintEm: { color: colors.primaryDeep, fontWeight: "600" },
  spinner: { marginTop: 24, alignItems: "center" },
});
