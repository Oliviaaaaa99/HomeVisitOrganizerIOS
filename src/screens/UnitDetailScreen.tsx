// Single-unit detail page. The user picks a unit (a specific apartment),
// not a building, so when they tap a unit on Home this is what they see —
// just that one unit, with the parent property as a subtitle for context.
//
// Sibling units of the same property are intentionally not shown here. To
// compare them, the user goes back to Home (sections show all of them) or
// taps "View property" at the bottom to land on PropertyDetailScreen.
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createUnitNote,
  deleteNote,
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
  unitId: string;
  onBack: () => void;
  onViewProperty: () => void;
};

export default function UnitDetailScreen({
  propertyId,
  unitId,
  onBack,
  onViewProperty,
}: Props) {
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const reload = useCallback(async () => {
    try {
      const detail = await getProperty(propertyId);
      const u = detail.units.find((x) => x.id === unitId) ?? null;
      setProperty(detail);
      setUnit(u);
    } catch (err: any) {
      Alert.alert("Load failed", err?.message ?? String(err));
    }
  }, [propertyId, unitId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleStatus(next: UnitStatus) {
    if (!unit || unit.status === next || busy) return;
    setBusy(`status-${next}`);
    try {
      const updated = await updateUnitStatus(unit.id, next);
      setUnit({ ...unit, ...updated });
    } catch (err: any) {
      Alert.alert("Update failed", err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  function handleDelete() {
    if (!unit || busy) return;
    Alert.alert(
      "Delete this unit?",
      "This is permanent. Photos and unit-level notes go with it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy("delete");
            try {
              await deleteUnit(unit.id);
              onBack();
            } catch (err: any) {
              Alert.alert("Delete failed", err?.message ?? String(err));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  if (!property || !unit) {
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
        <View style={styles.navRow}>
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={({ pressed }) => [
              styles.navPill,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.navPillText}>‹ Back</Text>
          </Pressable>
          <Pressable
            onPress={() => setEditing((e) => !e)}
            hitSlop={10}
            style={({ pressed }) => [
              styles.navPillPrimary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.navPillPrimaryText}>
              {editing ? "Done" : "Edit"}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.eyebrow}>
          {property.kind === "rental" ? "🛋️ Rental" : "🔑 For sale"}
        </Text>
        <Text style={styles.unitTitle}>{unitTitle(unit)}</Text>
        <Pressable onPress={onViewProperty} hitSlop={6}>
          <Text style={styles.propertyAddress} numberOfLines={2}>
            {property.address}
            <Text style={styles.viewPropertyLink}>  ↗</Text>
          </Text>
        </Pressable>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {editing ? (
          <UnitEditor
            unit={unit}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              await reload();
            }}
          />
        ) : (
          <View style={styles.specsCard}>
            {unit.price_cents != null ? (
              <Text style={styles.price}>
                ${(unit.price_cents / 100).toLocaleString()}
                {property.kind === "rental" ? (
                  <Text style={styles.priceSuffix}>/mo</Text>
                ) : null}
              </Text>
            ) : null}
            <Text style={styles.specsLine}>{unitDetailSubtitle(unit)}</Text>
            {unit.available_from ? (
              <Text style={styles.availableFrom}>
                Available from {unit.available_from}
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.statusSection}>
          <Text style={styles.statusLabel}>Status</Text>
          <View style={styles.statusBar}>
            {(
              [
                { key: "toured", label: "✓ Toured" },
                { key: "shortlisted", label: "★ Shortlist" },
                { key: "rejected", label: "✕ Reject" },
                { key: "archived", label: "📦 Archive" },
              ] as { key: UnitStatus; label: string }[]
            ).map((o) => {
              const active = unit.status === o.key;
              const loading = busy === `status-${o.key}`;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => handleStatus(o.key)}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.statusChip,
                    active && styles.statusChipActive,
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
                        styles.statusChipText,
                        active && styles.statusChipTextActive,
                      ]}
                    >
                      {o.label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <PhotoStrip unitId={unit.id} />
        </View>

        <UnitNotesSection
          unitId={unit.id}
          notes={property.notes.filter((n) => n.unit_id === unit.id)}
          onChanged={reload}
        />

        <Pressable
          onPress={handleDelete}
          disabled={busy === "delete"}
          style={({ pressed }) => [
            styles.deleteBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          {busy === "delete" ? (
            <ActivityIndicator color={colors.pinkDeep} />
          ) : (
            <Text style={styles.deleteBtnText}>Delete this unit</Text>
          )}
        </Pressable>

        <Pressable
          onPress={onViewProperty}
          style={({ pressed }) => [
            styles.viewPropertyBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.viewPropertyBtnText}>
            View property ({property.units.length} units total) →
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function UnitEditor({
  unit,
  onCancel,
  onSaved,
}: {
  unit: Unit;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [unitLabel, setUnitLabel] = useState(unit.unit_label ?? "");
  const [priceText, setPriceText] = useState(
    unit.price_cents != null ? String(unit.price_cents / 100) : "",
  );
  const [sqftText, setSqftText] = useState(
    unit.sqft != null ? String(unit.sqft) : "",
  );
  const [bedsText, setBedsText] = useState(
    unit.beds != null ? String(unit.beds) : "",
  );
  const [bathsText, setBathsText] = useState(
    unit.baths != null ? String(unit.baths) : "",
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const priceCents = priceText.trim()
        ? Math.round(parseFloat(priceText) * 100)
        : undefined;
      const sqft = sqftText.trim() ? parseInt(sqftText, 10) : undefined;
      const beds = bedsText.trim() ? parseInt(bedsText, 10) : undefined;
      const baths = bathsText.trim() ? parseFloat(bathsText) : undefined;
      await updateUnit(unit.id, {
        unit_label: unitLabel,
        price_cents: priceCents,
        sqft,
        beds,
        baths,
      });
      onSaved();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.editorCard}>
      <Text style={styles.editorLabel}>Label</Text>
      <TextInput
        style={styles.input}
        value={unitLabel}
        onChangeText={setUnitLabel}
        placeholder="e.g. Apt 4B (optional)"
        placeholderTextColor={colors.textMuted}
      />
      <View style={styles.editorRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.editorLabel}>Price</Text>
          <TextInput
            style={styles.input}
            value={priceText}
            onChangeText={setPriceText}
            keyboardType="decimal-pad"
            placeholder="2200"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.editorLabel}>Sqft</Text>
          <TextInput
            style={styles.input}
            value={sqftText}
            onChangeText={setSqftText}
            keyboardType="number-pad"
            placeholder="500"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>
      <View style={styles.editorRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.editorLabel}>Beds</Text>
          <TextInput
            style={styles.input}
            value={bedsText}
            onChangeText={setBedsText}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.editorLabel}>Baths</Text>
          <TextInput
            style={styles.input}
            value={bathsText}
            onChangeText={setBathsText}
            keyboardType="decimal-pad"
            placeholder="1.5"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>
      <View style={styles.editorActions}>
        <Pressable
          onPress={onCancel}
          disabled={busy}
          style={({ pressed }) => [
            styles.editorCancel,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.editorCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={busy}
          style={({ pressed }) => [
            styles.editorSave,
            pressed && { opacity: 0.85 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.editorSaveText}>Save</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function UnitNotesSection({
  unitId,
  notes,
  onChanged,
}: {
  unitId: string;
  notes: Note[];
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  async function add() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await createUnitNote(unitId, body);
      setDraft("");
      setAdding(false);
      await onChanged();
    } catch (err: any) {
      Alert.alert("Couldn't add note", err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(noteId: string) {
    const body = editDraft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await updateNote(noteId, body);
      setEditing(null);
      setEditDraft("");
      await onChanged();
    } catch (err: any) {
      Alert.alert("Couldn't save", err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(noteId: string) {
    Alert.alert("Delete this note?", "This is permanent.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await deleteNote(noteId);
            await onChanged();
          } catch (err: any) {
            Alert.alert("Couldn't delete", err?.message ?? String(err));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.notesSection}>
      <View style={styles.notesHeader}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <Pressable
          onPress={() => {
            setAdding((a) => !a);
            setEditing(null);
            setDraft("");
          }}
          hitSlop={6}
        >
          <Text style={styles.addLink}>{adding ? "− Cancel" : "+ Add note"}</Text>
        </Pressable>
      </View>

      {adding ? (
        <View style={styles.noteEditor}>
          <TextInput
            style={styles.noteInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Kitchen too small, balcony faces east, …"
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus
          />
          <Pressable
            onPress={add}
            disabled={busy || !draft.trim()}
            style={({ pressed }) => [
              styles.noteSave,
              (!draft.trim() || busy) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.noteSaveText}>Save</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {notes.length === 0 && !adding ? (
        <Text style={styles.notesEmpty}>No notes yet for this unit.</Text>
      ) : null}

      {notes.map((n) =>
        editing === n.id ? (
          <View key={n.id} style={styles.noteEditor}>
            <TextInput
              style={styles.noteInput}
              value={editDraft}
              onChangeText={setEditDraft}
              multiline
              autoFocus
            />
            <View style={styles.noteEditorRow}>
              <Pressable
                onPress={() => {
                  setEditing(null);
                  setEditDraft("");
                }}
                disabled={busy}
                style={({ pressed }) => [
                  styles.noteCancel,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.noteCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => saveEdit(n.id)}
                disabled={busy || !editDraft.trim()}
                style={({ pressed }) => [
                  styles.noteSave,
                  (!editDraft.trim() || busy) && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.noteSaveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View key={n.id} style={styles.noteCard}>
            <Text style={styles.noteBody}>{n.body}</Text>
            <View style={styles.noteActions}>
              <Pressable
                onPress={() => {
                  setEditing(n.id);
                  setEditDraft(n.body);
                  setAdding(false);
                }}
                hitSlop={6}
              >
                <Text style={styles.noteActionLink}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(n.id)} hitSlop={6}>
                <Text style={styles.noteActionLinkDanger}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ),
      )}
    </View>
  );
}

function unitTitle(u: Unit): string {
  if (u.unit_label?.trim()) return u.unit_label;
  switch (u.unit_type) {
    case "Studio":
    case "studio":
      return "Studio";
    case "1B":
      return "1-bedroom";
    case "2B":
      return "2-bedroom";
    case "3B":
      return "3-bedroom";
    default:
      return u.unit_type;
  }
}

function unitDetailSubtitle(u: Unit): string {
  const parts: string[] = [];
  if (u.beds != null) parts.push(`${u.beds} bed${u.beds === 1 ? "" : "s"}`);
  if (u.baths != null)
    parts.push(`${u.baths} bath${u.baths === 1 ? "" : "s"}`);
  if (u.sqft != null) parts.push(`${u.sqft} sqft`);
  return parts.length === 0 ? "No specs yet" : parts.join(" · ");
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
    marginBottom: 16,
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  navPillPrimaryText: {
    color: colors.textInverse,
    fontWeight: "800",
    fontSize: 14,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDeep,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  unitTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 4,
  },
  propertyAddress: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "600",
    marginTop: 6,
  },
  viewPropertyLink: { color: colors.primaryDeep, fontWeight: "700" },

  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 60 },

  specsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 18,
    ...shadow.card,
  },
  price: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  priceSuffix: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  specsLine: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
    fontWeight: "600",
  },
  availableFrom: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
  },

  statusSection: { marginTop: 18 },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  statusBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  statusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  statusChipTextActive: { color: "#FFFFFF" },

  photoSection: { marginTop: 22 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 6,
  },

  notesSection: { marginTop: 22 },
  notesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  addLink: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryDeep,
  },
  notesEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  noteEditor: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    marginBottom: 10,
  },
  noteInput: {
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 60,
    textAlignVertical: "top",
  },
  noteEditorRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  noteCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  noteCancelText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 13,
  },
  noteSave: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    minWidth: 70,
    marginTop: 8,
    alignSelf: "flex-end",
  },
  noteSaveText: {
    color: colors.textInverse,
    fontWeight: "800",
    fontSize: 13,
  },
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 14,
    marginBottom: 8,
  },
  noteBody: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  noteActions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  noteActionLink: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDeep,
  },
  noteActionLinkDanger: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.pinkDeep,
  },

  deleteBtn: {
    marginTop: 26,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.pinkSoft,
    alignItems: "center",
  },
  deleteBtnText: {
    color: colors.pinkDeep,
    fontWeight: "700",
    fontSize: 14,
  },

  viewPropertyBtn: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  viewPropertyBtnText: {
    color: colors.primaryDeep,
    fontWeight: "700",
    fontSize: 14,
  },

  editorCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    ...shadow.card,
  },
  editorLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryDeep,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 4,
  },
  editorRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.bgAlt,
  },
  editorActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    justifyContent: "flex-end",
  },
  editorCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  editorCancelText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 13,
  },
  editorSave: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  editorSaveText: {
    color: colors.textInverse,
    fontWeight: "800",
    fontSize: 13,
  },
});
