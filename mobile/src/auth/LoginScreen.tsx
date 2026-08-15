import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrandHeader, Button, Field, Notice, Screen, sharedStyles } from "../components/ui";
import { colors, spacing } from "../components/theme";
import { mobileAuthRedirectUrl, requestMagicLink } from "./auth.service";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sendLink = async () => {
    setSending(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await requestMagicLink(email);
      setMessage(
        "Magic link sent. Open the email on this phone and tap the link to return to EcoTrack.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The magic link could not be sent.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <BrandHeader />

      <View style={[sharedStyles.card, styles.loginCard]}>
        <View style={styles.headingGroup}>
          <Text style={sharedStyles.sectionTitle}>Welcome to EcoTrack</Text>
          <Text style={sharedStyles.sectionSubtitle}>
            Enter your email. We will send a secure, passwordless sign-in link.
          </Text>
        </View>

        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          required
        />

        {message ? <Notice message={message} tone="success" /> : null}
        {errorMessage ? <Notice message={errorMessage} tone="error" /> : null}

        <Button label="Send magic link" onPress={() => void sendLink()} loading={sending} />

        <Text style={styles.helper}>
          No password is stored. Your Supabase session is encrypted in Android secure storage.
        </Text>
      </View>

      {__DEV__ ? (
        <Text selectable style={styles.developmentLink}>
          Callback: {mobileAuthRedirectUrl}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center", minHeight: "100%" },
  loginCard: { gap: spacing.lg },
  headingGroup: { gap: spacing.xs },
  helper: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  developmentLink: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
});
