import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { devSignIn } from "../api";
import { saveTokens } from "../storage";

type Props = { onSignedIn: () => void };

export default function SignInScreen({ onSignedIn }: Props) {
  const [idToken, setIdToken] = useState("olivia-trying-it:olivia@example.com");
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    try {
      const resp = await devSignIn(idToken.trim());
      await saveTokens(resp.access_token, resp.refresh_token, resp.user_id);
      onSignedIn();
    } catch (err: any) {
      Alert.alert("Sign in failed", err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Apartment Tour Tracker</Text>
        <Text style={styles.subtitle}>Tier 1 walking-skeleton (dev sign-in)</Text>

        <Text style={styles.label}>Identity (dev)</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          value={idToken}
          onChangeText={setIdToken}
          placeholder="external_id:email@example.com"
        />
        <Text style={styles.hint}>
          format: anything-as-id:your@email — backend treats this as a fake Apple
          id_token. Different ids create different users.
        </Text>

        <TouchableOpacity
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 6, color: "#111" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 36 },
  label: { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  hint: { fontSize: 12, color: "#888", marginTop: 8, marginBottom: 24 },
  button: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
