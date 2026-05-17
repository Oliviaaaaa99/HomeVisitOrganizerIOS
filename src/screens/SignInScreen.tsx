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
import { useT } from "../i18n";
import { saveTokens, saveUserEmail } from "../storage";
import { colors, radii, shadow } from "../theme";

type Props = { onSignedIn: () => void };

export default function SignInScreen({ onSignedIn }: Props) {
  const { t, lang, setLang } = useT();
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);

  // Chip shows the *current* language (matches the Apple/Google/Nori
  // pattern — the indicator reflects "you're seeing this language now").
  // Tap switches to the other one.
  const currentLangLabel = lang === "zh" ? "中" : "EN";
  const otherLang = lang === "en" ? "zh" : "en";

  const canSubmit = email.trim().length > 0 && passcode.trim().length > 0 && !busy;

  async function handleSignIn() {
    setBusy(true);
    try {
      const trimmedEmail = email.trim();
      const trimmedCode = passcode.trim();
      // The dev verifier still parses "<id>:<email>" if a colon is present,
      // but in invitation mode we just send the email — external_id ends up
      // being the email, which is also the key in the backend's ALLOWED_USERS.
      const resp = await devSignIn(trimmedEmail, trimmedCode);
      await saveTokens(resp.access_token, resp.refresh_token, resp.user_id);
      await saveUserEmail(trimmedEmail);
      onSignedIn();
    } catch (err: any) {
      Alert.alert(t("signIn.signInFailed"), err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient
      colors={[colors.surface, colors.bg]}
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

          <Text style={styles.title}>{t("signIn.title")}</Text>
          <Text style={styles.subtitle}>{t("signIn.subtitle")}</Text>

          <View style={styles.card}>
            <Text style={styles.label}>{t("signIn.emailLabel")}</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              placeholder={t("signIn.emailPlaceholder")}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.label, styles.labelStacked]}>
              {t("signIn.passcodeLabel")}
            </Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              value={passcode}
              onChangeText={setPasscode}
              placeholder={t("signIn.passcodePlaceholder")}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.hint}>{t("signIn.inviteHint")}</Text>
          </View>

          <Pressable
            onPress={handleSignIn}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.buttonWrap,
              pressed && { opacity: 0.85 },
              !canSubmit && { opacity: 0.6 },
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
                <Text style={styles.buttonText}>{t("signIn.signInBtn")}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* Rendered AFTER the inner View so it stacks on top — both in RN
            (later sibling wins) and on web (zIndex needs the layered DOM
            tree to actually receive pointer events). */}
        <Pressable
          onPress={() => setLang(otherLang)}
          hitSlop={10}
          accessibilityLabel={`Current language: ${currentLangLabel}. Tap to switch.`}
          style={({ pressed }) => [
            styles.langChip,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.langChipIcon}>🌐</Text>
          <Text style={styles.langChipText}>{currentLangLabel}</Text>
        </Pressable>
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
  // Top-margin for the second field's label so the email + passcode rows
  // don't collide visually.
  labelStacked: {
    marginTop: 14,
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
  // Language toggle chip in the top-right of the screen. Position absolute
  // so it sits over the centered content without shifting it. Padding-top
  // accounts for the notch / dynamic island.
  langChip: {
    position: "absolute",
    top: 60,
    right: 22,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    // Matches the Preferences button style — soft purple background, deep
    // purple text + thin primary border — so secondary actions read as
    // "themed" without competing with the gradient Sign-in CTA.
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadow.card,
  },
  langChipIcon: {
    fontSize: 13,
  },
  langChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryDeep,
    letterSpacing: 0.3,
  },
});
