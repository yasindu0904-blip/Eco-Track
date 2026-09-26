import { ListWindow } from "../../components/lists/ListControls";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Notice, PageHeader, Screen, sharedStyles } from "../../components/ui";
import { memberColors } from "../../components/memberUi";
import type { ActiveOrganizationMembership } from "../memberships/administration/membershipAdministration.types";

type Props = {
  memberships: ActiveOrganizationMembership[];
  loading: boolean;
  error: boolean;
  onRetry: () => void | Promise<void>;
  onBack: () => void;
  onSelect: (organizationId: string) => void;
  onManageMembership: () => void;
};

export function OrganizationWorkspacesScreen({ memberships, loading, error, onRetry, onBack, onSelect, onManageMembership }: Props) {
  return (
    <Screen onRefresh={onRetry}>
      <PageHeader title="Organization workspaces" onBack={onBack} backLabel="Dashboard" />
      {loading ? <Notice message="Loading your workspaces…" /> : error ? (
        <View style={sharedStyles.card}>
          <Notice tone="error" message="Your workspaces could not be loaded." />
          <Button label="Try again" onPress={onRetry} />
        </View>
      ) : memberships.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>No active workspaces yet</Text>
          <Button label="Manage membership" onPress={onManageMembership} />
        </View>
      ) : <ListWindow items={memberships} >{visible => visible.map((membership) => (
        <Pressable key={membership.organization.id} accessibilityRole="button" onPress={() => onSelect(membership.organization.id)} style={({ pressed }) => [styles.workspace, pressed && styles.pressed]}>
          <Text style={styles.name}>{membership.organization.name}</Text>
          <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
        </Pressable>
      ))}</ListWindow>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  workspace: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 64, padding: 18, backgroundColor: memberColors.surface, borderWidth: 1, borderColor: memberColors.border, borderRadius: 14 },
  name: { flex: 1, color: memberColors.text, fontSize: 16, fontWeight: "700" },
  arrow: { color: memberColors.primary, fontSize: 24 },
  pressed: { backgroundColor: memberColors.primarySoft },
});
