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

export const memberColors = {
  canvas: "#F5F7F4",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAF7",
  primary: "#195F38",
  primaryPressed: "#124B2B",
  primarySoft: "#EAF3EC",
  accent: "#B5DF7B",
  text: "#17251D",
  textMuted: "#6A776F",
  border: "#DCE4DC",
  borderStrong: "#B8C9BB",
  danger: "#A43A32",
  dangerSoft: "#FFF3F1",
  warning: "#7A5B16",
  warningSoft: "#FBF5E5",
  success: "#246B42",
  successSoft: "#EAF5ED",
} as const;

export const memberSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

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

export function AppMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.mark, compact && styles.markCompact]} accessibilityElementsHidden>
      <View style={[styles.markLeaf, styles.markLeafLeft]} />
      <View style={[styles.markLeaf, styles.markLeafRight]} />
      <Text style={[styles.markLetter, compact && styles.markLetterCompact]}>E</Text>
    </View>
  );
}

type BrandHeaderProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  align?: "left" | "center";
};

export function BrandHeader({
  eyebrow,
  title = "EcoTrack",
  subtitle = "Community-driven environmental action",
  compact = false,
  align = "center",
}: BrandHeaderProps) {
  const left = align === "left";
  return (
    <View style={[styles.brandHeader, compact && styles.brandHeaderCompact, left && styles.alignLeft]}>
      <AppMark compact={compact} />
      {eyebrow ? <Text style={[styles.eyebrow, left && styles.textLeft]}>{eyebrow}</Text> : null}
      <Text style={[styles.brandTitle, compact && styles.brandTitleCompact, left && styles.textLeft]}>{title}</Text>
      <Text style={[styles.brandSubtitle, left && styles.textLeft]}>{subtitle}</Text>
    </View>
  );
}

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  backLabel?: string;
  action?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  backLabel = "Back",
  action,
}: PageHeaderProps) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderTop}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [styles.backButton, pressed && styles.controlPressed]}
          >
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backLabel}>{backLabel}</Text>
          </Pressable>
        ) : <View />}
        {action}
      </View>
      <View style={styles.pageHeaderCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  compact = false,
}: ButtonProps) {
  const inactive = disabled || loading;
  const secondary = variant === "secondary";
  const ghost = variant === "ghost";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        secondary && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        ghost && styles.buttonGhost,
        inactive && styles.buttonDisabled,
        pressed && !inactive && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary || ghost ? memberColors.primary : memberColors.surface} />
      ) : (
        <Text style={[
          styles.buttonText,
          (secondary || ghost) && styles.buttonSecondaryText,
          variant === "danger" && styles.buttonDangerText,
        ]}>{label}</Text>
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
        {label}{required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8A958E"
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
    <View style={[
      styles.notice,
      tone === "success" && styles.noticeSuccess,
      tone === "warning" && styles.noticeWarning,
      tone === "error" && styles.noticeError,
    ]}>
      <Text style={[styles.noticeText, tone === "error" && styles.noticeErrorText]}>{message}</Text>
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <Text style={sharedStyles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={sharedStyles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function ActionRow({
  title,
  description,
  symbol,
  onPress,
  tone = "default",
}: {
  title: string;
  description: string;
  symbol: string;
  onPress: () => void;
  tone?: "default" | "primary" | "warm";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        tone === "primary" && styles.actionRowPrimary,
        tone === "warm" && styles.actionRowWarm,
        pressed && styles.actionRowPressed,
      ]}
    >
      <View style={[
        styles.actionSymbol,
        tone === "primary" && styles.actionSymbolPrimary,
        tone === "warm" && styles.actionSymbolWarm,
      ]}>
        <Text style={styles.actionSymbolText}>{symbol}</Text>
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, tone === "primary" && styles.actionTitlePrimary]}>{title}</Text>
        <Text style={[styles.actionDescription, tone === "primary" && styles.actionDescriptionPrimary]}>{description}</Text>
      </View>
      <Text style={[styles.actionArrow, tone === "primary" && styles.actionTitlePrimary]}>›</Text>
    </Pressable>
  );
}

export function LoadingState({ message = "Loading EcoTrack…" }: { message?: string }) {
  return (
    <SafeAreaView style={styles.loadingScreen}>
      <AppMark />
      <ActivityIndicator size="large" color={memberColors.primary} />
      <Text style={styles.loadingText}>{message}</Text>
    </SafeAreaView>
  );
}

export const sharedStyles = StyleSheet.create({
  card: {
    backgroundColor: memberColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: memberColors.border,
    padding: memberSpacing.lg,
    gap: memberSpacing.md,
    shadowColor: "#1E3C27",
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  sectionTitle: {
    color: memberColors.text,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.35,
  },
  sectionSubtitle: {
    color: memberColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: memberSpacing.sm },
  spacedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: memberSpacing.sm,
  },
  divider: { height: 1, backgroundColor: memberColors.border },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: memberColors.canvas },
  screenContent: {
    paddingHorizontal: memberSpacing.lg,
    paddingTop: memberSpacing.md,
    paddingBottom: 48,
    gap: memberSpacing.lg,
  },
  mark: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: memberColors.primary,
  },
  markCompact: { width: 40, height: 40, borderRadius: 12 },
  markLetter: { color: memberColors.surface, fontSize: 25, fontWeight: "900" },
  markLetterCompact: { fontSize: 19 },
  markLeaf: {
    position: "absolute",
    top: -4,
    width: 15,
    height: 9,
    borderRadius: 10,
    backgroundColor: memberColors.accent,
  },
  markLeafLeft: { left: 12, transform: [{ rotate: "28deg" }] },
  markLeafRight: { right: 10, transform: [{ rotate: "-28deg" }] },
  brandHeader: { alignItems: "center", paddingVertical: memberSpacing.xl, gap: memberSpacing.xs },
  brandHeaderCompact: { paddingVertical: memberSpacing.md },
  alignLeft: { alignItems: "flex-start" },
  textLeft: { textAlign: "left" },
  eyebrow: {
    color: "#477456",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  brandTitle: { color: memberColors.text, fontSize: 36, fontWeight: "900", letterSpacing: -1.1 },
  brandTitleCompact: { fontSize: 28 },
  brandSubtitle: { color: memberColors.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  pageHeader: { gap: memberSpacing.lg, paddingBottom: memberSpacing.lg, borderBottomWidth: 1, borderBottomColor: memberColors.border },
  pageHeaderTop: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageHeaderCopy: { gap: memberSpacing.xs },
  pageTitle: { color: memberColors.text, fontSize: 29, lineHeight: 34, fontWeight: "900", letterSpacing: -0.8 },
  pageSubtitle: { color: memberColors.textMuted, fontSize: 14, lineHeight: 21 },
  backButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: memberColors.borderStrong,
    borderRadius: 10,
    backgroundColor: memberColors.surface,
  },
  backArrow: { color: memberColors.primary, fontSize: 18, lineHeight: 20 },
  backLabel: { color: memberColors.primary, fontSize: 13, fontWeight: "700" },
  controlPressed: { backgroundColor: memberColors.primarySoft },
  button: {
    minHeight: 48,
    borderRadius: 11,
    paddingHorizontal: memberSpacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: memberColors.primary,
    backgroundColor: memberColors.primary,
  },
  buttonCompact: { minHeight: 38, paddingHorizontal: memberSpacing.md },
  buttonSecondary: { backgroundColor: memberColors.surface, borderColor: memberColors.borderStrong },
  buttonDanger: { backgroundColor: memberColors.dangerSoft, borderColor: "#D8AAA6" },
  buttonGhost: { minHeight: 38, backgroundColor: "transparent", borderColor: "transparent" },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { backgroundColor: memberColors.primaryPressed, transform: [{ scale: 0.99 }] },
  buttonText: { color: memberColors.surface, fontSize: 15, fontWeight: "800" },
  buttonSecondaryText: { color: memberColors.primary },
  buttonDangerText: { color: memberColors.danger },
  fieldGroup: { gap: memberSpacing.sm },
  fieldLabel: { color: memberColors.text, fontSize: 13, fontWeight: "700" },
  required: { color: memberColors.danger },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: memberColors.borderStrong,
    borderRadius: 11,
    backgroundColor: memberColors.surface,
    paddingHorizontal: 13,
    color: memberColors.text,
    fontSize: 15,
  },
  multilineInput: { minHeight: 108, paddingTop: 13 },
  notice: { borderLeftWidth: 3, borderLeftColor: memberColors.primary, borderRadius: 3, backgroundColor: memberColors.surfaceMuted, padding: memberSpacing.md },
  noticeSuccess: { backgroundColor: memberColors.successSoft, borderLeftColor: memberColors.success },
  noticeWarning: { backgroundColor: memberColors.warningSoft, borderLeftColor: memberColors.warning },
  noticeError: { backgroundColor: memberColors.dangerSoft, borderLeftColor: memberColors.danger },
  noticeText: { color: memberColors.textMuted, fontSize: 13, lineHeight: 20 },
  noticeErrorText: { color: memberColors.danger },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: memberSpacing.md },
  sectionHeaderCopy: { flex: 1, gap: 2 },
  actionRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: memberSpacing.md,
    padding: memberSpacing.md,
    borderWidth: 1,
    borderColor: memberColors.border,
    borderRadius: 13,
    backgroundColor: memberColors.surface,
  },
  actionRowPrimary: { borderColor: memberColors.primary, backgroundColor: memberColors.primary },
  actionRowWarm: { borderColor: "#D8D0B7", backgroundColor: "#FBFAF4" },
  actionRowPressed: { opacity: 0.9, transform: [{ scale: 0.992 }] },
  actionSymbol: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: memberColors.primarySoft },
  actionSymbolPrimary: { backgroundColor: "rgba(255,255,255,0.12)" },
  actionSymbolWarm: { backgroundColor: "#F1EAD3" },
  actionSymbolText: { fontSize: 18 },
  actionCopy: { flex: 1, gap: 3 },
  actionTitle: { color: memberColors.text, fontSize: 15, fontWeight: "800" },
  actionTitlePrimary: { color: memberColors.surface },
  actionDescription: { color: memberColors.textMuted, fontSize: 12, lineHeight: 18 },
  actionDescriptionPrimary: { color: "rgba(255,255,255,0.7)" },
  actionArrow: { color: "#839087", fontSize: 25, fontWeight: "400" },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", gap: memberSpacing.lg, backgroundColor: memberColors.canvas, padding: memberSpacing.xl },
  loadingText: { color: memberColors.textMuted, fontSize: 15, textAlign: "center" },
});
