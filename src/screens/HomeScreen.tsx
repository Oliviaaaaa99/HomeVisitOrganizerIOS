import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  commitAvatar,
  deleteAvatar,
  deleteProperty,
  deleteUnit,
  getMe,
  getProperty,
  listProperties,
  presignAvatar,
  updateUnitStatus,
  type Property,
  type PropertyDetail,
  type Unit,
  type UnitStatus,
} from "../api";
import { clearTokens, loadUserEmail } from "../storage";
import { colors, radii, shadow } from "../theme";

type Props = {
  onOpenProperty: (id: string) => void;
  onOpenUnit: (propertyId: string, unitId: string) => void;
  onAddProperty: () => void;
  onSignedOut: () => void;
  reloadKey: number;
};

type KindFilter = "any" | "rental" | "for_sale";
type StatusFilter = "any" | "shortlisted" | "toured" | "rejected";

// SectionList row payload: either a real Unit, or a placeholder for sections
// whose property has no units yet.
type EmptyUnitRow = { _empty: true; id: string };
type UnitRow = Unit | EmptyUnitRow;
type Section = { property: PropertyDetail; data: UnitRow[] };

export default function HomeScreen({
  onOpenProperty,
  onOpenUnit,
  onAddProperty,
  onSignedOut,
  reloadKey,
}: Props) {
  const [items, setItems] = useState<PropertyDetail[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>("any");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingUnitId, setDeletingUnitId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  // Track open Swipeables so we can close one if a new card is dragged.
  const swipeRefs = useRef<Map<string, Swipeable>>(new Map());

  useEffect(() => {
    loadUserEmail().then(setUserEmail);
    getMe()
      .then((me) => setAvatarUrl(me.avatar_url ?? null))
      .catch(() => {
        // If /me fails (offline, expired), avatar stays null and we fall back
        // to the initial-letter avatar. Other API calls will surface the
        // real auth error.
      });
  }, []);

  async function handleChangeAvatar() {
    if (avatarBusy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert(
        "Photo permission needed",
        "Enable in Settings → Privacy → Photos.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    setAvatarBusy(true);
    try {
      const presigned = await presignAvatar();
      const blob = await (await fetch(result.assets[0].uri)).blob();
      const put = await fetch(presigned.url, { method: "PUT", body: blob });
      if (!put.ok) {
        throw new Error(`upload failed: HTTP ${put.status}`);
      }
      const committed = await commitAvatar(presigned.s3_key);
      // Cache-bust so RN's image cache picks up the new bytes if a previous
      // avatar at the same URL was already fetched.
      setAvatarUrl(`${committed.avatar_url}?v=${Date.now()}`);
    } catch (err: any) {
      Alert.alert("Avatar upload failed", err?.message ?? String(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleRemoveAvatar() {
    if (avatarBusy) return;
    setAvatarBusy(true);
    try {
      await deleteAvatar();
      setAvatarUrl(null);
    } catch (err: any) {
      Alert.alert("Couldn't remove avatar", err?.message ?? String(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function toggleShortlist(u: Unit) {
    if (togglingId) return;
    const next: UnitStatus =
      u.status === "shortlisted" ? "toured" : "shortlisted";
    setTogglingId(u.id);
    // Optimistic — flip the row immediately so the gesture feels instant.
    setItems((prev) =>
      prev
        ? prev.map((p) =>
            p.id === u.property_id
              ? {
                  ...p,
                  units: p.units.map((x) =>
                    x.id === u.id ? { ...x, status: next } : x,
                  ),
                }
              : p,
          )
        : prev,
    );
    swipeRefs.current.get(u.id)?.close();
    try {
      await updateUnitStatus(u.id, next);
    } catch (err: any) {
      // Revert on failure.
      setItems((prev) =>
        prev
          ? prev.map((p) =>
              p.id === u.property_id
                ? {
                    ...p,
                    units: p.units.map((x) =>
                      x.id === u.id ? { ...x, status: u.status } : x,
                    ),
                  }
                : p,
            )
          : prev,
      );
      Alert.alert("Couldn't update", err?.message ?? String(err));
    } finally {
      setTogglingId(null);
    }
  }

  function confirmDelete(p: Property) {
    Alert.alert(
      "Delete this property?",
      `${p.address}\n\nThis permanently removes the property, its units, notes, and photos.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => swipeRefs.current.get(p.id)?.close(),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(p.id);
            try {
              await deleteProperty(p.id);
              setItems((prev) => (prev ? prev.filter((x) => x.id !== p.id) : prev));
              swipeRefs.current.delete(p.id);
            } catch (err: any) {
              Alert.alert("Delete failed", err?.message ?? String(err));
              swipeRefs.current.get(p.id)?.close();
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
      { cancelable: true, onDismiss: () => swipeRefs.current.get(p.id)?.close() },
    );
  }

  function confirmDeleteUnit(u: Unit) {
    Alert.alert(
      "Delete this unit?",
      `${unitTitle(u)}\n\nThis permanently removes the unit and its photos. The property and its other units stay.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => swipeRefs.current.get(u.id)?.close(),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingUnitId(u.id);
            try {
              await deleteUnit(u.id);
              setItems((prev) =>
                prev
                  ? prev.map((p) =>
                      p.id === u.property_id
                        ? { ...p, units: p.units.filter((x) => x.id !== u.id) }
                        : p,
                    )
                  : prev,
              );
              swipeRefs.current.delete(u.id);
            } catch (err: any) {
              Alert.alert("Delete failed", err?.message ?? String(err));
              swipeRefs.current.get(u.id)?.close();
            } finally {
              setDeletingUnitId(null);
            }
          },
        },
      ],
      { cancelable: true, onDismiss: () => swipeRefs.current.get(u.id)?.close() },
    );
  }

  const load = useCallback(async () => {
    try {
      // First get the property index, then fan out to fetch each one's units
      // in parallel. With small N (a handful of properties for one user) this
      // is fine; if the list ever grows we'll bake `units` into the list
      // endpoint server-side.
      const resp = await listProperties();
      const properties = resp.items ?? [];
      const details = await Promise.all(
        properties.map((p) =>
          getProperty(p.id).catch((): PropertyDetail | null => null),
        ),
      );
      // Drop any that failed to fetch — they'll come back on the next refresh.
      const ok = details.filter((d): d is PropertyDetail => d !== null);
      setItems(ok);
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

  const matchKind = (p: Property, k: KindFilter) =>
    k === "any" || p.kind === k;
  const matchUnitStatus = (u: Unit, s: StatusFilter) =>
    s === "any" || u.status === s;

  // Filter logic with status now living on units:
  // - Sections (properties) are kept if their kind matches the kind filter.
  // - Inside each kept section, units are filtered by status.
  // - When the status filter is "any" we keep all units (including empty
  //   placeholder for unitless properties); otherwise we drop sections that
  //   end up with zero matching units, since "show me only my shortlisted"
  //   shouldn't render empty-section headers.
  const sections: Section[] = items.flatMap((property) => {
    if (!matchKind(property, kindFilter)) return [];
    if (statusFilter === "any") {
      return [
        {
          property,
          data:
            property.units.length === 0
              ? [{ _empty: true as const, id: `empty-${property.id}` }]
              : property.units,
        } as Section,
      ];
    }
    const matched = property.units.filter((u) =>
      matchUnitStatus(u, statusFilter),
    );
    if (matched.length === 0) return [];
    return [{ property, data: matched } as Section];
  });

  // Counts on each chip reflect what would render if you picked it, given
  // the OTHER row's current filter — so the badges stay honest.
  const kindCount = (k: KindFilter) =>
    items.reduce((n, p) => {
      if (!matchKind(p, k)) return n;
      if (statusFilter === "any")
        return n + (p.units.length === 0 ? 1 : p.units.length);
      const matched = p.units.filter((u) =>
        matchUnitStatus(u, statusFilter),
      ).length;
      return n + matched;
    }, 0);
  const statusCount = (s: StatusFilter) =>
    items.reduce((n, p) => {
      if (!matchKind(p, kindFilter)) return n;
      if (s === "any") return n + (p.units.length === 0 ? 1 : p.units.length);
      return n + p.units.filter((u) => matchUnitStatus(u, s)).length;
    }, 0);

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
            onPress={() => setAccountSheetOpen(true)}
            style={({ pressed }) => [
              styles.avatar,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityLabel="Account"
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{initialFor(userEmail)}</Text>
            )}
          </Pressable>
        </View>
      </LinearGradient>

      <Modal
        visible={accountSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountSheetOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setAccountSheetOpen(false)}
        >
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetAvatarBlock}>
              <View style={styles.sheetAvatar}>
                {avatarBusy ? (
                  <ActivityIndicator color={colors.primaryDeep} />
                ) : avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.sheetAvatarImg} />
                ) : (
                  <Text style={styles.sheetAvatarInitial}>
                    {initialFor(userEmail)}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={handleChangeAvatar}
                disabled={avatarBusy}
                style={({ pressed }) => [
                  styles.sheetAvatarBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.sheetAvatarBtnText}>
                  {avatarUrl ? "Change avatar" : "Add avatar"}
                </Text>
              </Pressable>
              {avatarUrl ? (
                <Pressable
                  onPress={handleRemoveAvatar}
                  disabled={avatarBusy}
                  style={({ pressed }) => [
                    styles.sheetAvatarRemove,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.sheetAvatarRemoveText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.sheetEyebrow}>Signed in as</Text>
            <Text style={styles.sheetEmail} numberOfLines={1}>
              {userEmail ?? "(sign out and back in to refresh)"}
            </Text>
            <Pressable
              onPress={() => {
                setAccountSheetOpen(false);
                handleSignOut();
              }}
              style={({ pressed }) => [
                styles.sheetSignOut,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.sheetSignOutText}>Sign out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Filter rows — kind × status, AND'd together. Each row scrolls
          horizontally so adding more chips later doesn't overflow. */}
      {items.length > 0 ? (
        <View style={styles.filterRows}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <FilterChip
              label="Any kind"
              active={kindFilter === "any"}
              onPress={() => setKindFilter("any")}
              count={kindCount("any")}
            />
            <FilterChip
              label="🛋️ Rentals"
              active={kindFilter === "rental"}
              onPress={() => setKindFilter("rental")}
              count={kindCount("rental")}
            />
            <FilterChip
              label="🔑 For sale"
              active={kindFilter === "for_sale"}
              onPress={() => setKindFilter("for_sale")}
              count={kindCount("for_sale")}
            />
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <FilterChip
              label="Any status"
              active={statusFilter === "any"}
              onPress={() => setStatusFilter("any")}
              count={statusCount("any")}
            />
            <FilterChip
              label="★ Shortlisted"
              active={statusFilter === "shortlisted"}
              onPress={() => setStatusFilter("shortlisted")}
              count={statusCount("shortlisted")}
            />
            <FilterChip
              label="✓ Toured"
              active={statusFilter === "toured"}
              onPress={() => setStatusFilter("toured")}
              count={statusCount("toured")}
            />
            <FilterChip
              label="✕ Rejected"
              active={statusFilter === "rejected"}
              onPress={() => setStatusFilter("rejected")}
              count={statusCount("rejected")}
            />
          </ScrollView>
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
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔎</Text>
          <Text style={styles.emptyTitle}>Nothing matches</Text>
          <Text style={styles.emptyHint}>
            Loosen the filters above or add one with{" "}
            <Text style={styles.emptyHintEm}>+ Add</Text>.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          SectionSeparatorComponent={() => <View style={styles.sectionSep} />}
          renderSectionHeader={({ section }) => {
            const property = section.property;
            return (
              <View style={[styles.familyBackdrop, styles.familyTop]}>
                <Swipeable
                  ref={(r) => {
                    if (r) swipeRefs.current.set(property.id, r);
                    else swipeRefs.current.delete(property.id);
                  }}
                  friction={2}
                  rightThreshold={40}
                  overshootRight={false}
                  renderRightActions={() => (
                    <View style={styles.swipeActionContainer}>
                      <Pressable
                        onPress={() => confirmDelete(property)}
                        style={({ pressed }) => [
                          styles.swipeDelete,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        {deletingId === property.id ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.swipeDeleteText}>Delete</Text>
                        )}
                      </Pressable>
                    </View>
                  )}
                  onSwipeableWillOpen={() => {
                    swipeRefs.current.forEach((ref, id) => {
                      if (id !== property.id) ref?.close();
                    });
                  }}
                >
                  <Pressable
                    onPress={() => onOpenProperty(property.id)}
                    disabled={deletingId === property.id}
                    style={({ pressed }) => [
                      styles.sectionHeader,
                      pressed && { opacity: 0.7 },
                      deletingId === property.id && { opacity: 0.5 },
                    ]}
                  >
                    <View style={styles.sectionHeaderTopRow}>
                      <Text style={styles.sectionAddress} numberOfLines={2}>
                        {property.address}
                      </Text>
                      <Text style={styles.sectionUnitCount}>
                        {property.units.length === 0
                          ? "No units"
                          : `${property.units.length} ${property.units.length === 1 ? "unit" : "units"}`}
                      </Text>
                    </View>
                    <View style={styles.sectionHeaderMetaRow}>
                      <Pill text={property.kind} />
                    </View>
                  </Pressable>
                </Swipeable>
              </View>
            );
          }}
          renderSectionFooter={() => (
            <View style={[styles.familyBackdrop, styles.familyBottom]} />
          )}
          renderItem={({ item, section }) => {
            // Sections always carry at least one item — when the property has
            // no units, we render an "Add unit" placeholder row.
            if ("_empty" in item) {
              return (
                <View style={styles.familyBackdrop}>
                  <Pressable
                    onPress={() => onOpenProperty(section.property.id)}
                    style={({ pressed }) => [
                      styles.unitRow,
                      styles.unitRowEmpty,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.unitRowEmptyText}>+ Add a unit</Text>
                  </Pressable>
                </View>
              );
            }
            const isShortlisted = item.status === "shortlisted";
            return (
              <View style={styles.familyBackdrop}>
              <Swipeable
                ref={(r) => {
                  if (r) swipeRefs.current.set(item.id, r);
                  else swipeRefs.current.delete(item.id);
                }}
                friction={2}
                leftThreshold={40}
                rightThreshold={40}
                overshootLeft={false}
                overshootRight={false}
                renderLeftActions={() => (
                  <View style={styles.unitSwipeLeftContainer}>
                    <Pressable
                      onPress={() => toggleShortlist(item)}
                      disabled={togglingId === item.id}
                      style={({ pressed }) => [
                        styles.swipeShortlist,
                        isShortlisted && styles.swipeShortlistActive,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      {togglingId === item.id ? (
                        <ActivityIndicator
                          color={isShortlisted ? colors.primaryDeep : "#FFFFFF"}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.swipeShortlistText,
                            isShortlisted && styles.swipeShortlistTextActive,
                          ]}
                        >
                          {isShortlisted ? "Unshortlist" : "★ Shortlist"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}
                renderRightActions={() => (
                  <View style={styles.unitSwipeRightContainer}>
                    <Pressable
                      onPress={() => confirmDeleteUnit(item)}
                      style={({ pressed }) => [
                        styles.swipeDelete,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      {deletingUnitId === item.id ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.swipeDeleteText}>Delete</Text>
                      )}
                    </Pressable>
                  </View>
                )}
                onSwipeableWillOpen={() => {
                  swipeRefs.current.forEach((ref, id) => {
                    if (id !== item.id) ref?.close();
                  });
                }}
              >
                <Pressable
                  onPress={() => onOpenUnit(section.property.id, item.id)}
                  disabled={deletingUnitId === item.id}
                  style={({ pressed }) => [
                    styles.unitRow,
                    isShortlisted && styles.unitRowShortlisted,
                    pressed && { opacity: 0.85 },
                    deletingUnitId === item.id && { opacity: 0.5 },
                  ]}
                >
                  <View pointerEvents="none" style={styles.unitSparkleCluster}>
                    <Text style={[styles.sparkle, { top: 5, right: 8, fontSize: 12, opacity: 0.9, color: "#F5E9E0" }]}>✦</Text>
                    <Text style={[styles.sparkle, { top: 3, right: 22, fontSize: 7, opacity: 0.7, color: "#E5E0EE" }]}>✧</Text>
                    <Text style={[styles.sparkle, { top: 14, right: 16, fontSize: 8, opacity: 0.8, color: "#F5E9E0" }]}>✦</Text>
                  </View>
                  <Text style={styles.unitEmoji}>
                    {section.property.kind === "for_sale" ? "🔑" : "🛋"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.unitTitle}>{unitTitle(item)}</Text>
                    <Text style={styles.unitSubtitle}>
                      {unitSubtitle(item)}
                    </Text>
                  </View>
                  <Pill text={item.status} />
                  <Text style={styles.unitChevron}>›</Text>
                </Pressable>
              </Swipeable>
              </View>
            );
          }}
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

// Header subtitle line summarizing the user's collection. Counts unit-level
// status now since that's where state lives. Statuses with zero count are
// skipped; "toured" is implicit (the default) and would clutter the line.
function summarize(items: PropertyDetail[]): string {
  let units = 0;
  let shortlisted = 0;
  let rejected = 0;
  for (const p of items) {
    units += p.units.length;
    for (const u of p.units) {
      if (u.status === "shortlisted") shortlisted++;
      else if (u.status === "rejected") rejected++;
    }
  }
  const parts: string[] = [
    `${items.length} ${items.length === 1 ? "property" : "properties"}`,
  ];
  if (units > 0) parts.push(`${units} ${units === 1 ? "unit" : "units"}`);
  if (shortlisted) parts.push(`${shortlisted} shortlisted`);
  if (rejected) parts.push(`${rejected} rejected`);
  return parts.join(" · ");
}

const KIND_EMOJI: Record<string, string> = {
  rental: "🛋️",
  for_sale: "🔑",
};

function initialFor(email: string | null): string {
  if (!email) return "·";
  const trimmed = email.trim();
  return (trimmed[0] ?? "·").toUpperCase();
}

function unitTitle(u: Unit): string {
  // Lead with the user's label if they bothered to set one (e.g. "Apt 4B"),
  // otherwise the type — "Studio", "1-bedroom", "townhouse", etc.
  return u.unit_label?.trim() || prettyUnitType(u.unit_type);
}

function unitSubtitle(u: Unit): string {
  const parts: string[] = [];
  if (u.price_cents != null) {
    parts.push(`$${(u.price_cents / 100).toLocaleString()}`);
  }
  if (u.sqft != null) parts.push(`${u.sqft} sqft`);
  if (u.beds != null) parts.push(`${u.beds}bd`);
  if (u.baths != null) parts.push(`${u.baths}ba`);
  return parts.length === 0 ? "No details yet" : parts.join(" · ");
}

function prettyUnitType(t: string): string {
  switch (t) {
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
      return t;
  }
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFFD0",
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    color: colors.primaryDeep,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "#0008",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 36,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...shadow.card,
  },
  sheetAvatarBlock: {
    alignItems: "center",
    marginBottom: 18,
  },
  sheetAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  sheetAvatarImg: { width: "100%", height: "100%" },
  sheetAvatarInitial: {
    color: colors.primaryDeep,
    fontSize: 32,
    fontWeight: "800",
  },
  sheetAvatarBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  sheetAvatarBtnText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: "700",
  },
  sheetAvatarRemove: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sheetAvatarRemoveText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  sheetEyebrow: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sheetEmail: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 22,
  },
  sheetSignOut: {
    paddingVertical: 14,
    borderRadius: radii.button,
    backgroundColor: colors.pinkSoft,
    borderWidth: 1,
    borderColor: colors.pink,
    alignItems: "center",
  },
  sheetSignOutText: {
    color: colors.pinkDeep,
    fontSize: 15,
    fontWeight: "800",
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

  filterRows: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 6,
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
  sectionSep: { height: 22 },
  swipeActionContainer: {
    justifyContent: "center",
    paddingLeft: 8,
  },
  swipeDelete: {
    backgroundColor: "#E11D48",
    width: 88,
    height: "100%",
    borderRadius: radii.card,
    justifyContent: "center",
    alignItems: "center",
    ...shadow.card,
  },
  swipeDeleteText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  swipeLeftActionContainer: {
    justifyContent: "center",
    paddingRight: 8,
  },
  swipeShortlist: {
    backgroundColor: colors.primary,
    width: 110,
    height: "100%",
    borderRadius: radii.card,
    justifyContent: "center",
    alignItems: "center",
    ...shadow.card,
  },
  swipeShortlistActive: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  swipeShortlistText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  swipeShortlistTextActive: {
    color: colors.primaryDeep,
  },
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
  cardShortlisted: {
    borderLeftColor: "#d674c7",
  },
  // Family backdrop: a soft pale-lavender container that wraps the section
  // header + all of its unit rows + footer. Three render hooks in SectionList
  // each emit a chunk with this same bg + horizontal inset; the top chunk
  // gets rounded top corners, the bottom (footer) gets rounded bottom corners.
  // Looks like one continuous tray holding the property and its units.
  familyBackdrop: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    borderColor: colors.borderSoft,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  familyTop: {
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  familyBottom: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  // Section header inside the backdrop is just a label.
  sectionHeader: {
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sectionHeaderShortlisted: {},
  sectionHeaderTopRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionAddress: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: 0.1,
  },
  sectionUnitCount: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sectionHeaderMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  // Unit row now wears the brand: lavender bg, hairline, sparkle cluster,
  // shadow, kind/star emoji + status pill on the right. The decision unit
  // is also the visual anchor.
  unitRow: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    paddingRight: 18,
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 4,
    // Soft gray rail by default — only the shortlisted variant earns a
    // saturated color (pink), so favorites stand out without every row
    // shouting.
    borderLeftColor: "#A8A8C0",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    ...shadow.card,
  },
  unitRowShortlisted: {
    borderColor: "#d674c7",
    borderLeftColor: "#d674c7",
    backgroundColor: "#FBE6F7",
  },
  unitSparkleCluster: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 36,
    height: 28,
  },
  unitSwipeLeftContainer: {
    justifyContent: "center",
    paddingLeft: 4,
    paddingRight: 8,
    marginTop: 8,
  },
  unitSwipeRightContainer: {
    justifyContent: "center",
    paddingLeft: 8,
    paddingRight: 4,
    marginTop: 8,
  },
  unitEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  unitTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  unitSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  unitChevron: {
    fontSize: 22,
    color: colors.textMuted,
    marginLeft: 6,
  },
  unitRowEmpty: {
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderLeftColor: colors.primary,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 18,
  },
  unitRowEmptyText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryDeep,
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
    fontWeight: "700",
    textShadowColor: "#FFFFFFAA",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
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
