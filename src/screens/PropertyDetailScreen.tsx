import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getProperty, type PropertyDetail } from "../api";
import { colors, radii, shadow } from "../theme";

type Props = {
  propertyId: string;
  onBack: () => void;
};

export default function PropertyDetailScreen({ propertyId, onBack }: Props) {
  const [data, setData] = useState<PropertyDetail | null>(null);

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
          <Text style={styles.sourceUrl} numberOfLines={1}>
            {data.source_url}
          </Text>
        ) : null}
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Section title={`Units · ${data.units.length}`}>
          {data.units.length === 0 ? (
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
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </Section>

        <Section title={`Notes · ${data.notes.length}`}>
          {data.notes.length === 0 ? (
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
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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
  coords: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  sourceUrl: {
    fontSize: 12,
    color: colors.primaryDeep,
    marginTop: 10,
    opacity: 0.85,
  },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 60 },
  section: { marginTop: 6, marginBottom: 18 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primaryDeep,
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.8,
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
  rowSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },
  price: { fontSize: 16, fontWeight: "700", color: colors.pinkDeep },
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
