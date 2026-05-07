import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { devSignIn } from "../api";
import { saveTokens, saveUserEmail } from "../storage";
import { colors, radii, shadow } from "../theme";

type Props = { onSignedIn: () => void };

export default function SignInScreen({ onSignedIn }: Props) {
  const [idToken, setIdToken] = useState("olivia-trying-it:olivia@example.com");
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    try {
      const trimmed = idToken.trim();
      const resp = await devSignIn(trimmed);
      await saveTokens(resp.access_token, resp.refresh_token, resp.user_id);
      // Backend stores email_hash, so we stash the email locally for display.
      // Dev id_token format is "<external_id>:<email>"; later providers will
      // surface the email via OAuth userinfo and we'll save that instead.
      const colonIdx = trimmed.indexOf(":");
      const email = colonIdx > -1 ? trimmed.slice(colonIdx + 1) : trimmed;
      if (email) await saveUserEmail(email);
      onSignedIn();
    } catch (err: any) {
      Alert.alert("Sign in failed", err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient
      colors={[colors.pinkSoft, colors.bgAlt, colors.primarySoft]}
      style={styles.gradientBg}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroEmoji}>🏡</Text>
          </View>

          <Text style={styles.title}>Apartment Tour Tracker</Text>
          <Text style={styles.subtitle}>Tier 1 · dev sign-in</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Identity (dev)</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              value={idToken}
              onChangeText={setIdToken}
              placeholder="external_id:email@example.com"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.hint}>
              Format: anything-as-id:your@email — backend treats this as a fake
              Apple id_token. Different ids create different users.
            </Text>
          </View>

          <Pressable
            onPress={handleSignIn}
            disabled={busy}
            style={({ pressed }) => [
              styles.buttonWrap,
              pressed && { opacity: 0.85 },
              busy && { opacity: 0.6 },
            ]}
          >
            <LinearGradient
              colors={colors.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              {busy ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  heroBadge: {
    alignSelf: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FFFFFFCC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    ...shadow.card,
  },
  heroEmoji: { fontSize: 36 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 18,
    ...shadow.card,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDeep,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.input,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.bgAlt,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 10,
    lineHeight: 17,
  },
  buttonWrap: { marginTop: 20 },
  button: {
    paddingVertical: 16,
    borderRadius: radii.button,
    alignItems: "center",
  },
  buttonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
