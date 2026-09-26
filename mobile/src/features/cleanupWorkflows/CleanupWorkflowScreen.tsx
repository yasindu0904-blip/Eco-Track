import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, PageHeader, Screen, sharedStyles } from "../../components/ui";
import { fetchCleanupWorkflow } from "./cleanupWorkflow.api";
import { cleanupLifecycleLabel, type CleanupWorkflow } from "./cleanupWorkflow.types";

type Props = { accessToken: string; organizationId: string; onBack: () => void };
export function CleanupWorkflowScreen({ accessToken, organizationId, onBack }: Props) {
  const [workflow, setWorkflow] = useState<CleanupWorkflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setWorkflow(await fetchCleanupWorkflow(accessToken, organizationId));
    } catch (reason) {
      setError(describeApiFailure(reason, "Unable to load the cleanup workflow.").message);
    }
  }, [accessToken, organizationId]);
  useEffect(() => {
    let active = true;
    void fetchCleanupWorkflow(accessToken, organizationId).then((value) => { if (active) setWorkflow(value); }).catch((reason) => { if (active) setError(describeApiFailure(reason, "Unable to load the cleanup workflow.").message); });
    return () => { active = false; };
  }, [accessToken, organizationId]);
  return <Screen onRefresh={load}><PageHeader eyebrow="Organization settings" title="Cleanup workflow"  onBack={onBack} backLabel="Workspace" />{error && <><Notice tone="error" message={error}/><Button label="Try again" onPress={() => void load()}/></>}{!error && !workflow && <Text>Loading workflow…</Text>}{workflow?.statuses.map((status) => <View key={status.id} style={[sharedStyles.card, !status.isActive && styles.inactive]}><Text style={styles.title}>{status.label}</Text><Text>{cleanupLifecycleLabel(status.mappedLifecycleStatus)}</Text><Text style={styles.meta}>{status.isInitial ? "Initial status" : status.isFinal ? "Final status" : "Organization workflow status"}</Text></View>)}</Screen>;
}
const styles = StyleSheet.create({ intro: { color: "#527061", marginBottom: 16 }, title: { color: "#173d2d", fontSize: 17, fontWeight: "700" }, meta: { color: "#527061", marginTop: 6 }, inactive: { opacity: .55 } });

