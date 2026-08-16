import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Button, LoadingState, Notice, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { getMyIncident, listMyIncidents } from "./incident.api";
import type { IncidentDetail, IncidentStatus, IncidentSummary } from "./incident.types";

type Props = {
  accessToken: string;
  submittedIncident?: IncidentDetail | null;
  onBack: () => void;
  onNewReport: () => void;
};

function label(value: string): string {
  return value.toLowerCase().split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

function date(value: string): string {
  return new Date(value).toLocaleString();
}

export function MyReportsScreen({ accessToken, submittedIncident, onBack, onNewReport }: Props) {
  const [reports, setReports] = useState<IncidentSummary[]>([]);
  const [detail, setDetail] = useState<IncidentDetail | null>(submittedIncident ?? null);
  const [loading, setLoading] = useState(!submittedIncident);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (submittedIncident) return;
    let active = true;
    void listMyIncidents(accessToken)
      .then((items) => { if (active) setReports(items); })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load reports."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accessToken, submittedIncident]);

  async function open(id: string) {
    setLoading(true);
    setError(null);
    try { setDetail(await getMyIncident(accessToken, id)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load the report."); }
    finally { setLoading(false); }
  }

  if (loading) return <LoadingState message="Loading incident reports…" />;

  if (detail) {
    return (
      <Screen>
        <Pressable onPress={() => { setDetail(null); if (submittedIncident) onBack(); }}><Text style={styles.back}>← {submittedIncident ? "Dashboard" : "My Reports"}</Text></Pressable>
        <View style={styles.detailHero}><Text style={styles.eyebrow}>{detail.category.name}</Text><Text style={styles.detailTitle}>{detail.title}</Text><View style={styles.status}><Text style={styles.statusText}>{label(detail.status)}</Text></View><Text style={styles.heroMeta}>Reported {date(detail.reportedAt)}</Text></View>
        {error ? <Notice tone="error" message={error} /> : null}
        <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Description</Text><Text style={styles.body}>{detail.description}</Text></View>
        <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Location</Text><Text style={styles.body}>{detail.addressText ?? "No address supplied"}</Text><Text style={styles.coordinates}>{detail.latitude.toFixed(6)}, {detail.longitude.toFixed(6)}</Text></View>
        {detail.photos.length > 0 ? <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Photo evidence</Text>{detail.photos.map((photo) => <Image key={photo.id} source={{ uri: photo.url }} style={styles.detailPhoto} />)}</View> : null}
        <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Status history</Text>{detail.statusHistory.map((history) => <View key={history.id} style={styles.history}><View style={styles.dot} /><View style={styles.historyText}><Text style={styles.historyTitle}>{label(history.toStatus)}</Text><Text style={styles.historyDate}>{date(history.changedAt)}</Text>{history.reason ? <Text style={styles.body}>{history.reason}</Text> : null}</View></View>)}</View>
        <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Lifecycle</Text><Text style={styles.metaLabel}>Severity</Text><Text style={styles.metaValue}>{label(detail.severity)}</Text><Text style={styles.metaLabel}>Highlighted until</Text><Text style={styles.metaValue}>{date(detail.highlightUntil)}</Text><Text style={styles.metaLabel}>Archive after</Text><Text style={styles.metaValue}>{date(detail.archiveAfter)}</Text></View>
        <Button label="Report another incident" onPress={onNewReport} />
        <Button label="Back to dashboard" variant="secondary" onPress={onBack} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.top}><Pressable onPress={onBack}><Text style={styles.back}>← Dashboard</Text></Pressable><Button label="New report" onPress={onNewReport} /></View>
      <View style={styles.intro}><Text style={styles.eyebrow}>YOUR ACTIVITY</Text><Text style={styles.title}>My Reports</Text><Text style={sharedStyles.sectionSubtitle}>Follow the shared status of incidents you submitted.</Text></View>
      {error ? <Notice tone="error" message={error} /> : null}
      {reports.length === 0 ? <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>No reports yet</Text><Text style={sharedStyles.sectionSubtitle}>Your submitted environmental incidents will appear here.</Text><Button label="Report an incident" onPress={onNewReport} /></View> : reports.map((report) => <Pressable key={report.id} onPress={() => void open(report.id)} style={sharedStyles.card}>{report.thumbnailUrl ? <Image source={{ uri: report.thumbnailUrl }} style={styles.thumbnail} /> : null}<View style={styles.reportHeading}><Text style={styles.category}>{report.category.name}</Text><Text style={styles.reportStatus}>{label(report.status as IncidentStatus)}</Text></View><Text style={styles.reportTitle}>{report.title}</Text><Text style={styles.body}>{report.addressText ?? `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`}</Text><View style={sharedStyles.spacedRow}><Text style={styles.date}>{date(report.reportedAt)}</Text><Text style={styles.open}>View →</Text></View></Pressable>)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: spacing.md }, back: { color: colors.primary, fontWeight: "800", paddingVertical: 8 }, intro: { gap: spacing.xs, paddingVertical: spacing.md }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 }, title: { color: colors.text, fontSize: 34, fontWeight: "900" },
  thumbnail: { width: "100%", height: 180, borderRadius: 14 }, reportHeading: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }, category: { color: colors.primary, fontSize: 12, fontWeight: "900" }, reportStatus: { color: colors.primaryDark, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.primarySoft, fontSize: 11, fontWeight: "800" }, reportTitle: { color: colors.text, fontSize: 20, fontWeight: "900" }, body: { color: colors.textMuted, fontSize: 14, lineHeight: 21 }, date: { color: colors.textMuted, fontSize: 11 }, open: { color: colors.primary, fontWeight: "900" },
  detailHero: { gap: spacing.sm, padding: spacing.lg, borderRadius: 20, backgroundColor: colors.primaryDark }, detailTitle: { color: colors.surface, fontSize: 30, fontWeight: "900" }, heroMeta: { color: "#cde5d4" }, status: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.primarySoft }, statusText: { color: colors.primaryDark, fontWeight: "900" }, coordinates: { color: colors.text, fontWeight: "900" }, detailPhoto: { width: "100%", aspectRatio: 4 / 3, borderRadius: 12 },
  history: { flexDirection: "row", gap: spacing.md, minHeight: 74 }, dot: { width: 14, height: 14, marginTop: 3, borderWidth: 3, borderColor: "#b9dcc4", borderRadius: 7, backgroundColor: colors.primary }, historyText: { flex: 1 }, historyTitle: { color: colors.text, fontWeight: "900" }, historyDate: { color: colors.textMuted, fontSize: 11, marginBottom: 4 }, metaLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase" }, metaValue: { color: colors.text, fontWeight: "800", marginBottom: spacing.sm },
});
