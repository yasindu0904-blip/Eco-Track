import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AuthenticatedUserProfile } from "../../auth/auth.types";
import { Screen, memberColors, memberSpacing } from "../../components/memberUi";
import { NavigationIcon } from "../../components/NavigationIcon";
import { getCitizenSummary } from "../dashboards/dashboard.api";
import { Metric, SummaryCards, total } from "../dashboards/SummaryCards";

type CitizenDashboardProps = {
  profile: AuthenticatedUserProfile;
  accessToken: string;
  onReportIncident: () => void;
  onFindCleanupActivity: () => void;
};

export function CitizenDashboard({ profile, accessToken, onReportIncident, onFindCleanupActivity }: CitizenDashboardProps) {
  const displayName = profile.fullName?.trim() || "EcoTrack member";
  const firstName = displayName.split(/\s+/)[0];
  const loadSummary = useCallback(() => getCitizenSummary(accessToken), [accessToken]);

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.welcome}>
        <Text style={styles.welcomeEyebrow}>Welcome back</Text>
        <Text style={styles.welcomeTitle}>{firstName}</Text>
      </View>

      <SummaryCards load={loadSummary} label="Your activity" compact>
        {(summary) => (
          <View style={styles.metricGrid}>
            <Metric compact label="Reports" value={total(summary.reportsByState)} />
            <Metric compact label="Upcoming" value={summary.upcomingEvents} />
            <Metric compact label="Impact points" value={summary.contributions.points} />
            <Metric compact label="Unread" value={summary.unreadNotifications} />
          </View>
        )}
      </SummaryCards>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Start here</Text>
        <Pressable accessibilityRole="button" onPress={onReportIncident} style={({ pressed }) => [styles.action, styles.primaryAction, pressed && styles.pressed]}>
          <View style={[styles.iconBox, styles.primaryIcon]}>
            <NavigationIcon name="report" size={34} color="#FFFFFF" />
          </View>
          <View style={styles.actionCopy}>
            <Text style={[styles.actionTitle, styles.primaryTitle]}>Report an incident</Text>
            <Text style={[styles.actionDescription, styles.primaryDescription]}>Pin the location and share what you found.</Text>
          </View>
          <Text style={[styles.arrow, styles.primaryTitle]} accessibilityElementsHidden>›</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onFindCleanupActivity} style={({ pressed }) => [styles.action, styles.warmAction, pressed && styles.pressed]}>
          <View style={[styles.iconBox, styles.warmIcon]}>
            <NavigationIcon name="location" size={34} color="#7A5B16" />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Find cleanup activity</Text>
            <Text style={styles.actionDescription}>Use your location to find published cleanup events nearby.</Text>
          </View>
          <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 22, paddingBottom: 32 },
  welcome: { paddingTop: 2, gap: 4 },
  welcomeEyebrow: { color: "#477456", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  welcomeTitle: { color: memberColors.text, fontSize: 32, fontWeight: "800", letterSpacing: -0.8 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap" },
  section: { gap: 12 },
  sectionTitle: { color: memberColors.text, fontSize: 19, fontWeight: "800", marginBottom: 2 },
  action: { minHeight: 98, flexDirection: "row", alignItems: "center", gap: 12, padding: memberSpacing.md, borderRadius: 18, borderWidth: 1, shadowColor: "#15351E", shadowOpacity: 0.07, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 2 },
  primaryAction: { backgroundColor: memberColors.primary, borderColor: memberColors.primary },
  warmAction: { backgroundColor: "#FBFAF4", borderColor: "#D8D0B7" },
  iconBox: { width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  primaryIcon: { backgroundColor: "rgba(255,255,255,0.14)" },
  warmIcon: { backgroundColor: "#F1EAD3" },
  actionCopy: { flex: 1, gap: 4 },
  actionTitle: { color: memberColors.text, fontSize: 16, fontWeight: "800" },
  primaryTitle: { color: "#FFFFFF" },
  actionDescription: { color: memberColors.textMuted, fontSize: 12, lineHeight: 18 },
  primaryDescription: { color: "#DAE9DD" },
  arrow: { color: "#7D8A80", fontSize: 27 },
  pressed: { opacity: 0.8 },
});
