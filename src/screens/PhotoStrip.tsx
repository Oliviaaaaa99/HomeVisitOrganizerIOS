import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  commitMedia,
  deleteMedia,
  listMedia,
  presignMedia,
  updateMediaCaption,
  type MediaItem,
} from "../api";
import { colors, radii, shadow } from "../theme";

type Props = {
  unitId: string;
};

export default function PhotoStrip({ unitId }: Props) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [viewerKey, setViewerKey] = useState<MediaItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);

  function openViewer(item: MediaItem) {
    setViewerKey(item);
    setEditingCaption(false);
    setCaptionDraft(item.caption ?? "");
  }

  function closeViewer() {
    setViewerKey(null);
    setEditingCaption(false);
    setCaptionDraft("");
  }

  async function saveCaption() {
    if (!viewerKey) return;
    const trimmed = captionDraft.trim();
    if (trimmed === (viewerKey.caption ?? "")) {
      setEditingCaption(false);
      return;
    }
    setSavingCaption(true);
    try {
      await updateMediaCaption(viewerKey.id, trimmed);
      // Update both the strip and the open viewer so the change shows immediately.
      setItems((prev) =>
        prev
          ? prev.map((m) =>
              m.id === viewerKey.id
                ? { ...m, caption: trimmed || undefined }
                : m,
            )
          : prev,
      );
      setViewerKey({ ...viewerKey, caption: trimmed || undefined });
      setEditingCaption(false);
    } catch (err: any) {
      Alert.alert("Couldn't save caption", err?.message ?? String(err));
    } finally {
      setSavingCaption(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const resp = await listMedia(unitId);
      setItems(resp.items ?? []);
    } catch (err: any) {
      // Silent on initial 404 etc — show empty strip
      setItems([]);
    }
  }, [unitId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddPhotos() {
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
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    setProgress(0);
    try {
      // 1. Ask backend for N upload URLs
      const presigned = await presignMedia(unitId, result.assets.length);

      // 2. PUT bytes to each presigned URL — do them in parallel
      let done = 0;
      await Promise.all(
        result.assets.map(async (asset, idx) => {
          const upload = presigned.uploads[idx];
          // RN's fetch supports file:// URIs and returns a Blob with the
          // right Content-Type from the file extension.
          const blob = await (await fetch(asset.uri)).blob();
          const res = await fetch(upload.url, {
            method: "PUT",
            body: blob,
          });
          if (!res.ok) {
            throw new Error(`upload ${idx + 1} failed: HTTP ${res.status}`);
          }
          done++;
          setProgress(done / result.assets.length);
        }),
      );

      // 3. Commit (writes media_assets rows on the backend)
      await commitMedia(
        unitId,
        presigned.uploads.map((u) => ({
          s3_key: u.s3_key,
          media_type: "photo",
        })),
      );

      // 4. Refresh thumbnails
      await load();
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message ?? String(err));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleDelete(item: MediaItem) {
    Alert.alert("Delete this photo?", "This is permanent.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingId(item.id);
          try {
            await deleteMedia(item.id);
            setViewerKey(null);
            await load();
          } catch (err: any) {
            Alert.alert("Delete failed", err?.message ?? String(err));
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {items?.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => openViewer(item)}
            style={({ pressed }) => [
              styles.thumb,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Image source={{ uri: item.url }} style={styles.thumbImg} />
            {item.caption ? (
              <View style={styles.thumbCaptionBadge}>
                <Text numberOfLines={1} style={styles.thumbCaptionText}>
                  {item.caption}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ))}

        <Pressable
          onPress={handleAddPhotos}
          disabled={uploading}
          style={({ pressed }) => [
            styles.addBtn,
            uploading && { opacity: 0.7 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {uploading ? (
            <View style={{ alignItems: "center" }}>
              <ActivityIndicator color={colors.primaryDeep} size="small" />
              <Text style={styles.addBtnTextSmall}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.addBtnPlus}>+</Text>
              <Text style={styles.addBtnText}>Photos</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* Fullscreen viewer */}
      <Modal
        visible={viewerKey !== null}
        transparent
        animationType="fade"
        onRequestClose={closeViewer}
      >
        <KeyboardAvoidingView
          style={styles.viewer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.viewerBackdrop} onPress={closeViewer} />
          {viewerKey ? (
            <View style={styles.viewerContent}>
              <Image
                source={{ uri: viewerKey.url }}
                style={styles.viewerImg}
                resizeMode="contain"
              />

              <View style={styles.captionBlock}>
                {editingCaption ? (
                  <>
                    <TextInput
                      value={captionDraft}
                      onChangeText={setCaptionDraft}
                      placeholder="Add a caption…"
                      placeholderTextColor="#FFFFFF77"
                      style={styles.captionInput}
                      multiline
                      maxLength={200}
                      autoFocus
                    />
                    <View style={styles.captionEditRow}>
                      <Pressable
                        onPress={() => {
                          setEditingCaption(false);
                          setCaptionDraft(viewerKey.caption ?? "");
                        }}
                        disabled={savingCaption}
                        style={styles.captionCancel}
                      >
                        <Text style={styles.captionCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={saveCaption}
                        disabled={savingCaption}
                        style={styles.captionSave}
                      >
                        {savingCaption ? (
                          <ActivityIndicator
                            color={colors.primaryDeep}
                            size="small"
                          />
                        ) : (
                          <Text style={styles.captionSaveText}>Save</Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable
                    onPress={() => {
                      setCaptionDraft(viewerKey.caption ?? "");
                      setEditingCaption(true);
                    }}
                    style={styles.captionDisplay}
                  >
                    <Text
                      style={
                        viewerKey.caption
                          ? styles.captionText
                          : styles.captionPlaceholder
                      }
                    >
                      {viewerKey.caption ?? "Tap to add a caption"}
                    </Text>
                    <Text style={styles.captionEditHint}>Edit</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.viewerActions}>
                <Pressable onPress={closeViewer} style={styles.viewerClose}>
                  <Text style={styles.viewerCloseText}>Close</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(viewerKey)}
                  disabled={deletingId === viewerKey.id}
                  style={styles.viewerDelete}
                >
                  {deletingId === viewerKey.id ? (
                    <ActivityIndicator color={colors.pinkDeep} size="small" />
                  ) : (
                    <Text style={styles.viewerDeleteText}>Delete</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const THUMB_SIZE = 78;

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  strip: { gap: 8, paddingRight: 4 },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    ...shadow.card,
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  addBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnPlus: {
    fontSize: 24,
    color: colors.primaryDeep,
    fontWeight: "700",
    lineHeight: 26,
  },
  addBtnText: {
    fontSize: 11,
    color: colors.primaryDeep,
    fontWeight: "700",
    marginTop: 2,
  },
  addBtnTextSmall: {
    fontSize: 10,
    color: colors.primaryDeep,
    fontWeight: "600",
    marginTop: 4,
  },
  viewer: { flex: 1, backgroundColor: "#000000DD" },
  viewerBackdrop: { ...StyleSheet.absoluteFillObject },
  viewerContent: {
    flex: 1,
    padding: 24,
    paddingTop: 80,
    paddingBottom: 60,
  },
  viewerImg: {
    flex: 1,
    width: "100%",
    borderRadius: radii.card,
    backgroundColor: "#222",
  },
  viewerActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    justifyContent: "space-between",
  },
  viewerClose: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFF22",
    borderWidth: 1,
    borderColor: "#FFFFFF55",
  },
  viewerCloseText: { color: "#FFFFFFEE", fontWeight: "700", fontSize: 14 },
  viewerDelete: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFF22",
    borderWidth: 1,
    borderColor: colors.pinkSoft,
  },
  viewerDeleteText: { color: colors.pinkSoft, fontWeight: "700", fontSize: 14 },
  thumbCaptionBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "#000000AA",
  },
  thumbCaptionText: {
    color: "#FFFFFFEE",
    fontSize: 10,
    fontWeight: "600",
  },
  captionBlock: { marginTop: 12 },
  captionDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF18",
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#FFFFFF33",
  },
  captionText: {
    color: "#FFFFFFEE",
    fontSize: 14,
    flex: 1,
    paddingRight: 10,
  },
  captionPlaceholder: {
    color: "#FFFFFF99",
    fontSize: 14,
    fontStyle: "italic",
    flex: 1,
    paddingRight: 10,
  },
  captionEditHint: {
    color: colors.pinkSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  captionInput: {
    backgroundColor: "#FFFFFFEE",
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 60,
    fontSize: 14,
    color: "#222",
  },
  captionEditRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    justifyContent: "flex-end",
  },
  captionCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFF22",
    borderWidth: 1,
    borderColor: "#FFFFFF55",
  },
  captionCancelText: { color: "#FFFFFFEE", fontWeight: "700", fontSize: 13 },
  captionSave: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 72,
    alignItems: "center",
  },
  captionSaveText: { color: colors.primaryDeep, fontWeight: "800", fontSize: 13 },
});
