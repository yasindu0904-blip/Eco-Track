import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../components/theme";
import {
  BrandHeader,
  Button,
  Field,
  Notice,
  Screen,
  sharedStyles,
} from "../components/ui";
import { completeCurrentUserProfile } from "./auth.api";
import type { AuthenticatedUserProfile } from "./auth.types";

type Props = {
  accessToken: string;
  profile: AuthenticatedUserProfile;
  onCompleted: (profile: AuthenticatedUserProfile) => void;
  onSignOut: () => void;
};

export function ProfileOnboardingScreen({
  accessToken,
  profile,
  onCompleted,
  onSignOut,
}: Props) {
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function saveProfile() {
    setSaving(true);
    setErrorMessage(null);

    try {
      const completedProfile = await completeCurrentUserProfile(accessToken, {
        fullName,
        phoneNumber,
      });
      onCompleted(completedProfile);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "EcoTrack could not save your profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen contentStyle={styles.screen}>
      <BrandHeader compact eyebrow="One last step" />

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Complete your profile</Text>
        <Text style={sharedStyles.sectionSubtitle}>
          Add the contact details needed for cleanup-event coordination. You
          only need to do this once.
        </Text>

        <View style={styles.emailBox}>
          <Text style={styles.emailLabel}>Verified email</Text>
          <Text style={styles.emailValue}>{profile.email}</Text>
        </View>

        <Field
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your full name"
          autoCapitalize="words"
          required
        />
        <Field
          label="Phone number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="+94 77 123 4567"
          keyboardType="phone-pad"
          required
        />

        <Notice message="Your phone number is private. It may be shown only to an authorized organization admin or event coordinator after you join their event." />
        {errorMessage ? <Notice message={errorMessage} tone="error" /> : null}

        <Button
          label="Continue to dashboard"
          onPress={() => void saveProfile()}
          loading={saving}
          disabled={!fullName.trim() || !phoneNumber.trim()}
        />
        <Button
          label="Sign out"
          variant="secondary"
          onPress={onSignOut}
          disabled={saving}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center", minHeight: "100%" },
  emailBox: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
  },
  emailLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  emailValue: { color: colors.text, fontSize: 15, fontWeight: "700" },
});
