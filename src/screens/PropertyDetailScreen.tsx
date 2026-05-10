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
  createNote,
  createUnit,
  deleteNote,
  deleteProperty,
  deleteUnit,
  getProperty,
  updateNote,
  updateUnit,
  updateUnitStatus,
  type Note,
  type PropertyDetail,
  type Unit,
  type UnitStatus,
} from "../api";
import { colors, radii, shadow } from "../theme";
import PhotoStrip from "./PhotoStrip";

type Props = {
  propertyId: string;
  onBack: () => void;
  onEdit: () => void;
};

const UNIT_TYPES: Record<"rental" | "for_sale", readonly string[]> = {
  rental: ["studio", "1B", "2B", "3B"],
  for_sale: ["condo", "townhouse", "sfh", "apartment"],
} as const;

export default function PropertyDetailScreen({ propertyId, onBack, onEdit }: Props) {
  const [data, setData] = useState<PropertyDetail | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Inline-form state — exactly one of these is non-null at a time.
  // null = no form open.  "new" = creating.  uuid = editing that row.
  const [unitMode, setUnitMode] = useState<null | "new" | string>(null);
  const [noteMode, setNoteMode] = useState<null | "new" | string>(null);

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

  async function handleUnitStatus(unit: Unit, next: UnitStatus) {
    if (!data || unit.status === next || busyAction) return;
    setBusyAction(`unit-${unit.id}-${next}`);
    try {
      const updated = await updateUnitStatus(unit.id, next);
      setData({
        ...data,
        units: data.units.map((u) => (u.id === unit.id ? { ...u, ...updated } : u)),
      });
    } catch (err: any) {
      Alert.alert("Update failed", err?.message ?? String(err));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete() {
    if (!data || busyAction) return;
    Alert.alert(
      "Delete this property?",
      "This permanently removes the property, its units, notes, and photos. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusyAction("delete");
            try {
              await deleteProperty(propertyId);
              onBack();
            } catch (err: any) {
              Alert.alert("Delete failed", err?.message ?? String(err));
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

  // This screen only deals with notes scoped to the property as a whole;
  // unit-scoped notes are surfaced on UnitDetailScreen.
  const propertyNotes = data.notes.filter((n) => !n.unit_id);

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.gradientHeader} style={styles.header}>
        <View style={styles.topNavRow}>
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={({ pressed }) => [
              styles.navPillSecondary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.navPillSecondaryText}>‹ Back</Text>
          </Pressable>
          <Pressable
            onPress={onEdit}
            hitSlop={10}
            style={({ pressed }) => [
              styles.navPillPrimary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.navPillPrimaryText}>Edit</Text>
          </Pressable>
        </View>
        <Text style={styles.address}>{data.address}</Text>
        <View style={styles.metaRow}>
          <Pill text={data.kind} />
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
        {/* Property-level action: only Delete remains. Tour-state lives on
            units now — flip it from the unit row in the list below or from
            the Home swipe gesture. */}
        <View style={styles.actionRow}>
          <ActionButton
            text="Delete property"
            variant="danger"
            loading={busyAction === "delete"}
            onPress={handleDelete}
          />
        </View>

        {/* Units */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Units · {data.units.length}
            </Text>
            <Pressable
              onPress={() => {
                setUnitMode((m) => (m === "new" ? null : "new"));
                setNoteMode(null);
              }}
              hitSlop={6}
            >
              <Text style={styles.addLink}>
                {unitMode === "new" ? "− Cancel" : "+ Add unit"}
              </Text>
            </Pressable>
          </View>

          {unitMode === "new" ? (
            <UnitForm
              kind={data.kind}
              propertyId={propertyId}
              onCancel={() => setUnitMode(null)}
              onSaved={async () => {
                setUnitMode(null);
                await reload();
              }}
            />
          ) : null}

          {data.units.length === 0 && unitMode !== "new" ? (
            <Text style={styles.empty}>No units</Text>
          ) : (
            data.units.map((u) =>
              unitMode === u.id ? (
                <UnitForm
                  key={u.id}
                  kind={data.kind}
                  propertyId={propertyId}
                  initial={u}
                  onCancel={() => setUnitMode(null)}
                  onSaved={async () => {
                    setUnitMode(null);
                    await reload();
                  }}
                />
              ) : (
                <View key={u.id} style={styles.unitBlock}>
                  <Pressable
                    onPress={() => {
                      setUnitMode(u.id);
                      setNoteMode(null);
                    }}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
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
                  </Pressable>
                  <UnitStatusBar
                    unit={u}
                    busy={busyAction}
                    onChange={(next) => handleUnitStatus(u, next)}
                  />
                  <PhotoStrip unitId={u.id} />
                </View>
              ),
            )
          )}
        </View>

        {/* Property-level notes — about the place as a whole. Per-unit notes
            (e.g. "Studio's kitchen is small") live on UnitDetailScreen. */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              About this place · {propertyNotes.length}
            </Text>
            <Pressable
              onPress={() => {
                setNoteMode((m) => (m === "new" ? null : "new"));
                setUnitMode(null);
              }}
              hitSlop={6}
            >
              <Text style={styles.addLink}>
                {noteMode === "new" ? "− Cancel" : "+ Add note"}
              </Text>
            </Pressable>
          </View>

          {noteMode === "new" ? (
            <NoteForm
              propertyId={propertyId}
              onCancel={() => setNoteMode(null)}
              onSaved={async () => {
                setNoteMode(null);
                await reload();
              }}
            />
          ) : null}

          {propertyNotes.length === 0 && noteMode !== "new" ? (
            <Text style={styles.empty}>No notes about the place yet.</Text>
          ) : (
            propertyNotes.map((n) =>
              noteMode === n.id ? (
                <NoteForm
                  key={n.id}
                  propertyId={propertyId}
                  initial={n}
                  onCancel={() => setNoteMode(null)}
                  onSaved={async () => {
                    setNoteMode(null);
                    await reload();
                  }}
                />
              ) : (
                <Pressable
                  key={n.id}
                  onPress={() => {
                    setNoteMode(n.id);
                    setUnitMode(null);
                  }}
                  style={({ pressed }) => [
                    styles.note,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.noteBody}>{n.body}</Text>
                  <Text style={styles.noteTime}>
                    {new Date(n.created_at).toLocaleString()}
                  </Text>
                </Pressable>
              ),
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ---- Inline form components ----

function UnitForm({
  kind,
  propertyId,
  initial,
  onSaved,
  onCancel,
}: {
  kind: "rental" | "for_sale";
  propertyId: string;
  initial?: Unit;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [unitType, setUnitType] = useState<string>(initial?.unit_type ?? "");
  const [unitLabel, setUnitLabel] = useState(initial?.unit_label ?? "");
  const [priceDollars, setPriceDollars] = useState(
    initial?.price_cents != null ? (initial.price_cents / 100).toString() : "",
  );
  const [beds, setBeds] = useState(
    initial?.beds != null ? initial.beds.toString() : "",
  );
  const [baths, setBaths] = useState(
    initial?.baths != null ? initial.baths.toString() : "",
  );
  const [sqft, setSqft] = useState(
    initial?.sqft != null ? initial.sqft.toString() : "",
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

      if (isEdit && initial) {
        await updateUnit(initial.id, {
          unit_type: unitType,
          unit_label: unitLabel.trim(), // empty clears
          price_cents: priceCents,
          beds: beds.trim() ? parseInt(beds, 10) : undefined,
          baths: baths.trim() ? Number(baths) : undefined,
          sqft: sqft.trim() ? parseInt(sqft, 10) : undefined,
        });
      } else {
        await createUnit(propertyId, {
          unit_type: unitType,
          unit_label: unitLabel.trim() || undefined,
          price_cents: priceCents,
          beds: beds.trim() ? parseInt(beds, 10) : undefined,
          baths: baths.trim() ? Number(baths) : undefined,
          sqft: sqft.trim() ? parseInt(sqft, 10) : undefined,
        });
      }
      onSaved();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!isEdit || !initial) return;
    Alert.alert("Delete this unit?", "This is permanent.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteUnit(initial.id);
            onSaved(); // close form + reload
          } catch (err: any) {
            Alert.alert("Delete failed", err?.message ?? String(err));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.inlineCard}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{isEdit ? "Edit unit" : "New unit"}</Text>
        <Pressable onPress={onCancel} hitSlop={6}>
          <Text style={styles.formCancel}>Cancel</Text>
        </Pressable>
      </View>
      <View style={styles.chipRow}>
        {UNIT_TYPES[kind].map((t) => (
          <Pressable
            key={t}
            onPress={() => setUnitType(unitType === t ? "" : t)}
            style={[styles.typeChip, unitType === t && styles.typeChipActive]}
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
      <View style={styles.formActions}>
        {isEdit ? (
          <Pressable
            onPress={confirmDelete}
            disabled={deleting || saving}
            style={({ pressed }) => [
              styles.deleteBtn,
              (deleting || saving) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {deleting ? (
              <ActivityIndicator color={colors.pinkDeep} size="small" />
            ) : (
              <Text style={styles.deleteBtnText}>Delete</Text>
            )}
          </Pressable>
        ) : null}
        <Pressable
          onPress={save}
          disabled={saving || !unitType}
          style={({ pressed }) => [
            styles.saveBtn,
            { flex: 1 },
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
              <Text style={styles.saveBtnText}>
                {isEdit ? "Save changes" : "Save unit"}
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function NoteForm({
  propertyId,
  initial,
  onSaved,
  onCancel,
}: {
  propertyId: string;
  initial?: Note;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [body, setBody] = useState(initial?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    if (!body.trim()) {
      Alert.alert("Note can't be empty");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && initial) {
        await updateNote(initial.id, body.trim());
      } else {
        await createNote(propertyId, body.trim());
      }
      onSaved();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!isEdit || !initial) return;
    Alert.alert("Delete this note?", "This is permanent.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteNote(initial.id);
            onSaved();
          } catch (err: any) {
            Alert.alert("Delete failed", err?.message ?? String(err));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.inlineCard}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{isEdit ? "Edit note" : "New note"}</Text>
        <Pressable onPress={onCancel} hitSlop={6}>
          <Text style={styles.formCancel}>Cancel</Text>
        </Pressable>
      </View>
      <TextInput
        style={[styles.formInput, styles.noteFormInput]}
        value={body}
        onChangeText={setBody}
        placeholder="What did you think? 采光、噪音、HOA、通勤…"
        placeholderTextColor={colors.textMuted}
        multiline
        autoFocus={!isEdit}
      />
      <View style={styles.formActions}>
        {isEdit ? (
          <Pressable
            onPress={confirmDelete}
            disabled={deleting || saving}
            style={({ pressed }) => [
              styles.deleteBtn,
              (deleting || saving) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {deleting ? (
              <ActivityIndicator color={colors.pinkDeep} size="small" />
            ) : (
              <Text style={styles.deleteBtnText}>Delete</Text>
            )}
          </Pressable>
        ) : null}
        <Pressable
          onPress={save}
          disabled={saving || !body.trim()}
          style={({ pressed }) => [
            styles.saveBtn,
            { flex: 1 },
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
              <Text style={styles.saveBtnText}>
                {isEdit ? "Save changes" : "Save note"}
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// Inline 4-state status switcher for a unit. Tapping a chip flips the
// unit's status; the active chip is filled, others are outlined.
function UnitStatusBar({
  unit,
  busy,
  onChange,
}: {
  unit: Unit;
  busy: string | null;
  onChange: (next: UnitStatus) => void;
}) {
  const options: { key: UnitStatus; label: string }[] = [
    { key: "toured", label: "✓ Toured" },
    { key: "shortlisted", label: "★ Shortlist" },
    { key: "rejected", label: "✕ Reject" },
    { key: "archived", label: "📦 Archive" },
  ];
  return (
    <View style={styles.unitStatusBar}>
      {options.map((o) => {
        const active = unit.status === o.key;
        const loading = busy === `unit-${unit.id}-${o.key}`;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            disabled={loading}
            style={({ pressed }) => [
              styles.unitStatusChip,
              active && styles.unitStatusChipActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            {loading ? (
              <ActivityIndicator
                color={active ? "#FFFFFF" : colors.primaryDeep}
                size="small"
              />
            ) : (
              <Text
                style={[
                  styles.unitStatusChipText,
                  active && styles.unitStatusChipTextActive,
                ]}
              >
                {o.label}
              </Text>
            )}
          </Pressable>
        );
      })}
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
  topNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  // Secondary nav pill (Back/Cancel — outline + soft fill)
  navPillSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFFB3",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  navPillSecondaryText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  // Primary nav pill (Edit/Save — filled)
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
  addLink: { fontSize: 13, color: colors.pinkDeep, fontWeight: "700" },

  inlineCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  formTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primaryDeep,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  formCancel: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
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
  formActions: { flexDirection: "row", gap: 8 },
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
  deleteBtn: {
    borderWidth: 1,
    borderColor: colors.pinkSoft,
    borderRadius: radii.button,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  deleteBtnText: { color: colors.pinkDeep, fontSize: 14, fontWeight: "700" },

  unitBlock: { marginBottom: 14 },
  unitStatusBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  unitStatusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  unitStatusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unitStatusChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  unitStatusChipTextActive: {
    color: "#FFFFFF",
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
