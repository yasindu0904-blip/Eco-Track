import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { colors, spacing } from "./theme";

type ScreenProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
};

export function Screen({ children, contentStyle, scrollEnabled = true }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          scrollEnabled={scrollEnabled}
          contentContainerStyle={[styles.screenContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type HeaderProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function BrandHeader({
  eyebrow,
  title = "EcoTrack",
  subtitle = "Community-Driven Environmental Action",
  compact = false,
}: HeaderProps) {
  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      <Text style={[styles.sprout, compact && styles.sproutCompact]}>🌱</Text>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={[styles.brandTitle, compact && styles.brandTitleCompact]}>
        {title}
      </Text>
      <Text style={styles.brandSubtitle}>{subtitle}</Text>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: ButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        inactive && styles.buttonDisabled,
        pressed && !inactive && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "secondary" ? colors.primary : colors.surface}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "secondary" && styles.buttonSecondaryText,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  multiline?: boolean;
  required?: boolean;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline = false,
  required = false,
}: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8a9791"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

type NoticeProps = {
  message: string;
  tone?: "info" | "success" | "warning" | "error";
};

export function Notice({ message, tone = "info" }: NoticeProps) {
  return (
    <View
      style={[
        styles.notice,
        tone === "success" && styles.noticeSuccess,
        tone === "warning" && styles.noticeWarning,
        tone === "error" && styles.noticeError,
      ]}
    >
      <Text
        style={[
          styles.noticeText,
          tone === "error" && styles.noticeErrorText,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

export function LoadingState({ message = "Loading EcoTrack…" }: { message?: string }) {
  return (
    <SafeAreaView style={styles.loadingScreen}>
      <Text style={styles.loadingSprout}>🌱</Text>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>{message}</Text>
    </SafeAreaView>
  );
}

export const sharedStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  spacedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  screenContent: {
    padding: spacing.md,
    paddingBottom: 48,
    gap: spacing.md,
  },
  header: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  headerCompact: { paddingVertical: spacing.md },
  sprout: { fontSize: 45 },
  sproutCompact: { fontSize: 34 },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  brandTitle: {
    color: colors.primaryDark,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  brandTitleCompact: { fontSize: 30 },
  brandSubtitle: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
  },
  button: {
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { transform: [{ scale: 0.985 }] },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: "800" },
  buttonSecondaryText: { color: colors.primary },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  required: { color: colors.danger },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  multilineInput: { minHeight: 112, paddingTop: 14 },
  notice: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  noticeSuccess: { backgroundColor: colors.successSoft, borderLeftColor: colors.success },
  noticeWarning: { backgroundColor: colors.warningSoft, borderLeftColor: colors.warning },
  noticeError: { backgroundColor: colors.dangerSoft, borderLeftColor: colors.danger },
  noticeText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  noticeErrorText: { color: colors.danger },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.canvas,
    padding: spacing.lg,
  },
  loadingSprout: { fontSize: 50 },
  loadingText: { color: colors.textMuted, fontSize: 16, textAlign: "center" },
});
