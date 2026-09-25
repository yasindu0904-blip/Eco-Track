import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { BrandHeader, Button, Screen, sharedStyles } from "../components/ui";
import { colors, spacing } from "../components/theme";
import { NavigationIcon } from "../components/NavigationIcon";
import { requestMagicLink } from "./auth.service";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sendLink = async () => {
    if (sending) return;
    setSending(true);
    setErrorMessage(null);

    try {
      await requestMagicLink(email);
      setEmail(email.trim().toLowerCase());
      setSent(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to send the magic link.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.card}>
        <View style={styles.brand}>
          <BrandHeader subtitle="Community-Driven Environmental Action" />
        </View>
        {sent ? (
          <View style={styles.loginCard} accessibilityLiveRegion="polite">
            <View style={styles.successIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <NavigationIcon name="check" size={30} color="#2e7d32" />
            </View>
            <View style={styles.headingGroup}>
              <Text style={[sharedStyles.sectionTitle, styles.centered]}>Check your email</Text>
              <Text style={[sharedStyles.sectionSubtitle, styles.centered]}>
                We sent a secure sign-in link to <Text style={styles.strong}>{email}</Text>.
              </Text>
            </View>
            <View style={styles.steps}>
              {["Check your inbox", "Open the link on this phone"].map((step, index) => (
                <View key={step} style={styles.step}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
            <Button label="Use another email" variant="secondary" onPress={() => {
              setSent(false);
              setErrorMessage(null);
            }} />
            <Text style={styles.helper}>
              Didn't receive it? Check your spam folder before trying again.
            </Text>
          </View>
        ) : (
          <View style={styles.loginCard}>
            <View style={styles.headingGroup}>
              <Text style={sharedStyles.sectionTitle}>Sign in</Text>
              <Text style={sharedStyles.sectionSubtitle}>Enter your email.</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.mailIcon} accessibilityElementsHidden importantForAccessibility="no">✉</Text>
                <TextInput
                  accessibilityLabel="Email address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!sending}
                  returnKeyType="send"
                  onSubmitEditing={() => void sendLink()}
                  style={styles.input}
                />
              </View>
              {errorMessage ? (
                <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                  {errorMessage}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: sending, busy: sending }}
              disabled={sending}
              onPress={() => void sendLink()}
              style={({ pressed }) => [styles.submit, (sending || pressed) && styles.submitInactive]}
            >
              {sending ? <ActivityIndicator color={colors.surface} /> : null}
              <Text style={styles.submitText}>{sending ? "Sending secure link..." : "Send magic link"}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center", minHeight: "100%" },
  card: { width: "100%", maxWidth: 510, alignSelf: "center", borderRadius: 24, borderWidth: 3, borderColor: colors.primary, backgroundColor: colors.surface, overflow: "hidden" },
  brand: { paddingHorizontal: spacing.lg, backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.border },
  loginCard: { padding: spacing.lg, gap: spacing.lg },
  headingGroup: { gap: spacing.xs },
  field: { gap: spacing.sm },
  label: { color: colors.text, fontSize: 14, fontWeight: "600" },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: spacing.md },
  mailIcon: { color: colors.textMuted, fontSize: 22, marginRight: spacing.sm },
  input: { flex: 1, minHeight: 52, color: colors.text, fontSize: 16, paddingVertical: spacing.sm },
  error: { color: colors.danger, fontSize: 14 },
  submit: { minHeight: 52, padding: spacing.md, borderRadius: 11, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  submitInactive: { opacity: 0.7 },
  submitText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
  helper: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  centered: { textAlign: "center" },
  strong: { fontWeight: "700" },
  successIcon: { alignSelf: "center", width: 58, height: 58, borderRadius: 29, backgroundColor: "#e8f5e9", alignItems: "center", justifyContent: "center" },
  steps: { padding: spacing.md, gap: spacing.sm, borderRadius: 13, backgroundColor: colors.surfaceMuted },
  step: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, color: colors.surface, textAlign: "center", lineHeight: 30, fontWeight: "700" },
  stepText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
});
