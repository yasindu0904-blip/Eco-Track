import { Image, StyleSheet, Text, View } from "react-native";
import { sharedStyles } from "../../components/ui";
import { colors } from "../../components/theme";
import type { IncidentDetail } from "./incident.types";

export function IncidentEvidence({ incident, awaitingCleanup = false }: { incident: IncidentDetail; awaitingCleanup?: boolean }) {
  return (
    <View style={sharedStyles.card} accessibilityLabel="Incident details">
      <Text style={styles.label}>INCIDENT</Text>
      <Text style={sharedStyles.sectionTitle}>{incident.title}</Text>
      <Text style={styles.copy}>{incident.description}</Text>
      <Text style={styles.copy}>{incident.category.name}{" \u00b7 "}{incident.severity.toLowerCase()}</Text>
      {incident.addressText ? <Text style={styles.copy}>{incident.addressText}</Text> : null}
      {awaitingCleanup ? <Text style={styles.copy}>{incident.status === "CLEANUP_ORGANIZED" ? "A cleanup has been organized. Refresh to see current activity." : "No cleanup event created yet."}</Text> : null}
      {incident.photos.map(photo => (
        <View key={photo.id}>
          <Image source={{ uri: photo.url }} style={styles.photo} resizeMode="contain" accessibilityLabel={photo.caption || "Incident evidence"} />
          {photo.caption ? <Text style={styles.copy}>{photo.caption}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.primary, fontWeight: "700" },
  copy: { color: colors.text, fontSize: 14, lineHeight: 21 },
  photo: { width: "100%", height: 220, borderRadius: 8 },
});
