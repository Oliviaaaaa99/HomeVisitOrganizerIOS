import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getProperty, type PropertyDetail } from "../api";

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
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.address}>{data.address}</Text>
        <View style={styles.meta}>
          <Text style={styles.metaItem}>{data.kind}</Text>
          <Text style={styles.metaItem}>•</Text>
          <Text style={styles.metaItem}>{data.status}</Text>
          {data.latitude !== undefined && data.longitude !== undefined && (
            <>
              <Text style={styles.metaItem}>•</Text>
              <Text style={styles.metaItem}>
                {data.latitude.toFixed(4)}, {data.longitude.toFixed(4)}
              </Text>
            </>
          )}
        </View>

        {data.source_url ? (
          <Text style={styles.sourceUrl} numberOfLines={1}>
            {data.source_url}
          </Text>
        ) : null}

        <Section title={`Units (${data.units.length})`}>
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

        <Section title={`Notes (${data.notes.length})`}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topbar: {
    paddingTop: 60,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  backBtn: { padding: 8, alignSelf: "flex-start" },
  backText: { color: "#0a7ea4", fontSize: 17 },
  content: { padding: 20, paddingBottom: 60 },
  address: { fontSize: 24, fontWeight: "700", color: "#111" },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  metaItem: { fontSize: 13, color: "#666" },
  sourceUrl: { fontSize: 12, color: "#0a7ea4", marginTop: 8 },
  section: { marginTop: 28 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#777",
    textTransform: "uppercase",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600", color: "#111" },
  rowSubtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  price: { fontSize: 16, fontWeight: "600", color: "#0a7ea4" },
  note: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  noteBody: { fontSize: 15, color: "#111", lineHeight: 22 },
  noteTime: { fontSize: 11, color: "#999", marginTop: 6 },
  empty: { fontSize: 13, color: "#999", fontStyle: "italic" },
});
