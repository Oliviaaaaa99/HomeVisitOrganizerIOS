import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  archiveProperty,
  createNote,
  createUnit,
  getProperty,
  updatePropertyStatus,
  type Property,
  type PropertyDetail,
} from "../api";
import { colors, radii, shadow } from "../theme";

type Props = {
  propertyId: string;
  onBack: () => void;
};

const UNIT_TYPES: Record<"rental" | "for_sale", readonly string[]> = {
  rental: ["studio", "1B", "2B", "3B"],
  for_sale: ["condo", "townhouse", "sfh", "apartment"],
} as const;

export default function PropertyDetailScreen({ propertyId, onBack }: Props) {
  const [data, setData] = useState<PropertyDetail | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await getProperty(propertyId);
        if (!cancelled) setData(detail);
      } catch (err: any) {
        Alert.alert("Load failed", err?.message ?? String(err));
        onBack();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, onBack]);

  async function reload() {
    try {
      const detail = await getProperty(propertyId);
      setData(detail);
    } catch (err: any) {
      Alert.alert("Reload failed", err?.message ?? String(err));
    }
  }

  async function handleStatus(next: Property["status"]) {
    if (!data || data.status === next || busyAction) return;
    setBusyAction(next);
    try {
      const updated = await updatePropertyStatus(propertyId, next);
      setData({ ...data, ...updated });
    } catch (err: any) {
      Alert.alert("Update failed", err?.message ?? String(err));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleArchive() {
    if (!data || busyAction) return;
    Alert.alert(
      "Archive property?",
      "It will move to status=archived and disappear from the default list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: async () => {
            setBusyAction("archive");
            try {
              await archiveProperty(propertyId);
              onBack();
            } catch (err: any) {
              Alert.alert("Archive failed", err?.message ?? String(err));
            } finally {
              setBusyAction(null);
            }
          },
        },
      ],
    );
  }

  function openSourceURL() {
    if (!data?.source_url) return;
    Linking.openURL(data.source_url).catch((err) => {
      Alert.alert("Couldn't open", String(err));
    });
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.gradientHeader} style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.address}>{data.address}</Text>
        <View style={styles.metaRow}>
          <Pill text={data.kind} />
          <Pill text={data.status} />
          {data.latitude !== undefined && data.longitude !== undefined && (
            <Text style={styles.coords}>
              {data.latitude.toFixed(4)}, {data.longitude.toFixed(4)}
            </Text>
          )}
        </View>
        {data.source_url ? (
          <Pressable onPress={openSourceURL} hitSlop={6}>
            <Text style={styles.sourceUrl} numberOfLines={1}>
              ↗ {data.source_url}
            </Text>
          </Pressable>
        ) : null}
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ActionRow
          status={data.status}
          busy={busyAction}
          onShortlist={() => handleStatus("shortlisted")}
          onReject={() => handleStatus("rejected")}
          onUnshortlist={() => handleStatus("toured")}
          onArchive={handleArchive}
        />

        {/* Units */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Units · {data.units.length}
            </Text>
            <Pressable
              onPress={() => {
                setShowAddUnit((v) => !v);
                setShowAddNote(false);
              }}
              hitSlop={6}
            >
              <Text style={styles.addLink}>
                {showAddUnit ? "− Cancel" : "+ Add unit"}
              </Text>
            </Pressable>
          </View>

          {showAddUnit ? (
            <AddUnitForm
              kind={data.kind}
              onSaved={async () => {
                setShowAddUnit(false);
                await reload();
              }}
            />
          ) : null}

          {data.units.length === 0 && !showAddUnit ? (
            <Text style={styles.empty}>No units</Text>
          ) : (
            data.units.map((u) => (
              <View key={u.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>
                    {u.unit_label ?? u.unit_type}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {u.unit_type}
                    {u.beds != null && u.baths != null
                      ? ` · ${u.beds}BR/${u.baths}BA`
                      : ""}
                    {u.sqft ? ` · ${u.sqft} sqft` : ""}
                  </Text>
                </View>
                {u.price_cents != null ? (
                  <Text style={styles.price}>
                    ${(u.price_cents / 100).toLocaleString()}
                    {data.kind === "rental" ? (
                      <Text style={styles.priceSuffix}>/mo</Text>
                    ) : null}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Notes · {data.notes.length}
            </Text>
            <Pressable
              onPress={() => {
                setShowAddNote((v) => !v);
                setShowAddUnit(false);
              }}
              hitSlop={6}
            >
              <Text style={styles.addLink}>
                {showAddNote ? "− Cancel" : "+ Add note"}
              </Text>
            </Pressable>
          </View>

          {showAddNote ? (
            <AddNoteForm
              onSaved={async () => {
                setShowAddNote(false);
                await reload();
              }}
            />
          ) : null}

          {data.notes.length === 0 && !showAddNote ? (
            <Text style={styles.empty}>No notes</Text>
          ) : (
            data.notes.map((n) => (
              <View key={n.id} style={styles.note}>
                <Text style={styles.noteBody}>{n.body}</Text>
                <Text style={styles.noteTime}>
                  {new Date(n.created_at).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );

  // helpers using the closure (propertyId, etc.)
  function AddUnitForm({
    kind,
    onSaved,
  }: {
    kind: "rental" | "for_sale";
    onSaved: () => void;
  }) {
    const [unitType, setUnitType] = useState<string>("");
    const [unitLabel, setUnitLabel] = useState("");
    const [priceDollars, setPriceDollars] = useState("");
    const [beds, setBeds] = useState("");
    const [baths, setBaths] = useState("");
    const [sqft, setSqft] = useState("");
    const [saving, setSaving] = useState(false);

    async function save() {
      if (!unitType) {
        Alert.alert("Pick a unit type");
        return;
      }
      setSaving(true);
      try {
        const priceCents = priceDollars.trim()
          ? Math.round(Number(priceDollars) * 100)
          : undefined;
        if (priceCents !== undefined && Number.isNaN(priceCents)) {
          throw new Error("price is not a number");
        }
        await createUnit(propertyId, {
          unit_type: unitType,
          unit_label: unitLabel.trim() || undefined,
          price_cents: priceCents,
          beds: beds.trim() ? parseInt(beds, 10) : undefined,
          baths: baths.trim() ? Number(baths) : undefined,
          sqft: sqft.trim() ? parseInt(sqft, 10) : undefined,
        });
        onSaved();
      } catch (err: any) {
        Alert.alert("Save failed", err?.message ?? String(err));
      } finally {
        setSaving(false);
      }
    }

    return (
      <View style={styles.inlineCard}>
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
        <View style={styles.formRow2}>
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            value={unitLabel}
            onChangeText={setUnitLabel}
            placeholder="Unit label (Apt 12A)"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            value={priceDollars}
            onChangeText={setPriceDollars}
            placeholder={kind === "rental" ? "Price /mo" : "Price"}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.formRow3}>
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            value={beds}
            onChangeText={setBeds}
            placeholder="Beds"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            value={baths}
            onChangeText={setBaths}
            placeholder="Baths"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            value={sqft}
            onChangeText={setSqft}
            placeholder="Sqft"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
        </View>
        <Pressable
          onPress={save}
          disabled={saving || !unitType}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || !unitType) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <LinearGradient
            colors={colors.gradientButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtnInner}
          >
            {saving ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.saveBtnText}>Save unit</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  function AddNoteForm({ onSaved }: { onSaved: () => void }) {
    const [body, setBody] = useState("");
    const [saving, setSaving] = useState(false);

    async function save() {
      if (!body.trim()) {
        Alert.alert("Note can't be empty");
        return;
      }
      setSaving(true);
      try {
        await createNote(propertyId, body.trim());
        onSaved();
      } catch (err: any) {
        Alert.alert("Save failed", err?.message ?? String(err));
      } finally {
        setSaving(false);
      }
    }

    return (
      <View style={styles.inlineCard}>
        <TextInput
          style={[styles.formInput, styles.noteFormInput]}
          value={body}
          onChangeText={setBody}
          placeholder="What did you think? 采光、噪音、HOA、通勤…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Pressable
          onPress={save}
          disabled={saving || !body.trim()}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || !body.trim()) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <LinearGradient
            colors={colors.gradientButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtnInner}
          >
            {saving ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.saveBtnText}>Save note</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    );
  }
}

function ActionRow({
  status,
  busy,
  onShortlist,
  onReject,
  onUnshortlist,
  onArchive,
}: {
  status: Property["status"];
  busy: string | null;
  onShortlist: () => void;
  onReject: () => void;
  onUnshortlist: () => void;
  onArchive: () => void;
}) {
  if (status === "archived") return null;
  return (
    <View style={styles.actionRow}>
      {status === "shortlisted" ? (
        <ActionButton
          text="Move to toured"
          variant="secondary"
          loading={busy === "toured"}
          onPress={onUnshortlist}
        />
      ) : (
        <ActionButton
          text="★ Shortlist"
          variant="primary"
          loading={busy === "shortlisted"}
          onPress={onShortlist}
        />
      )}
      {status !== "rejected" && (
        <ActionButton
          text="Reject"
          variant="ghost"
          loading={busy === "rejected"}
          onPress={onReject}
        />
      )}
      <ActionButton
        text="Archive"
        variant="danger"
        loading={busy === "archive"}
        onPress={onArchive}
      />
    </View>
  );
}

function ActionButton({
  text,
  variant,
  loading,
  onPress,
}: {
  text: string;
  variant: "primary" | "secondary" | "ghost" | "danger";
  loading: boolean;
  onPress: () => void;
}) {
  const palette = {
    primary: { bg: colors.primary, fg: colors.textInverse },
    secondary: { bg: colors.primarySoft, fg: colors.primaryDeep },
    ghost: { bg: colors.surface, fg: colors.textSecondary },
    danger: { bg: colors.surface, fg: colors.pinkDeep },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: palette.bg },
        variant === "ghost" || variant === "danger"
          ? { borderWidth: 1, borderColor: colors.borderSoft }
          : null,
        pressed && { opacity: 0.85 },
        loading && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <Text style={[styles.actionText, { color: palette.fg }]}>{text}</Text>
      )}
    </Pressable>
  );
}

function Pill({ text }: { text: string }) {
  const c = colors.pill[text] ?? { bg: "#FFFFFFAA", fg: colors.primaryDeep };
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>
        {text.replace("_", " ")}
      </Text>
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
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: { alignSelf: "flex-start", paddingVertical: 6, paddingRight: 16 },
  backText: { color: colors.primaryDeep, fontSize: 16, fontWeight: "600" },
  address: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 8,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  coords: { fontSize: 12, color: colors.textSecondary, marginLeft: 4 },
  sourceUrl: {
    fontSize: 12,
    color: colors.primaryDeep,
    marginTop: 10,
    opacity: 0.95,
    fontWeight: "600",
  },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 60 },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  actionText: { fontSize: 13, fontWeight: "700" },

  section: { marginTop: 6, marginBottom: 18 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primaryDeep,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  addLink: {
    fontSize: 13,
    color: colors.pinkDeep,
    fontWeight: "700",
  },

  inlineCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  typeChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  typeChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  typeChipTextActive: { color: colors.primaryDeep },
  formRow2: { flexDirection: "row", gap: 8, marginBottom: 8 },
  formRow3: { flexDirection: "row", gap: 8, marginBottom: 12 },
  formInput: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.bgAlt,
  },
  noteFormInput: { minHeight: 90, marginBottom: 12, textAlignVertical: "top" },
  saveBtn: { borderRadius: radii.button, overflow: "hidden" },
  saveBtnInner: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.button,
  },
  saveBtnText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    ...shadow.card,
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  rowSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  price: { fontSize: 16, fontWeight: "700", color: colors.pinkDeep },
  priceSuffix: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  note: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 10,
    ...shadow.card,
  },
  noteBody: { fontSize: 15, color: colors.textPrimary, lineHeight: 23 },
  noteTime: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
  empty: { fontSize: 13, color: colors.textMuted, fontStyle: "italic" },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  pillText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
});
