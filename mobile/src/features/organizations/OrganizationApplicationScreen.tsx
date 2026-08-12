import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ApiRequestError } from "../../api/apiClient";
import { BrandHeader, Button, Field, Notice, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import {
  createOrganizationApplication,
  listAdministrativeAreas,
} from "./organizationApplication.api";
import type {
  AdministrativeArea,
  CreateOrganizationApplicationInput,
  OrganizationApplication,
} from "./organizationApplication.types";

type OrganizationApplicationScreenProps = {
  accessToken: string;
  initialEmail: string;
  onBack: () => void;
  onSubmitted: (application: OrganizationApplication) => void;
};

type FormState = {
  name: string;
  registrationNumber: string;
  description: string;
  officialEmail: string;
  officialPhone: string;
  officialAddress: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError || error instanceof Error) {
    return error.message;
  }

  return "The request could not be completed.";
}

export function OrganizationApplicationScreen({
  accessToken,
  initialEmail,
  onBack,
  onSubmitted,
}: OrganizationApplicationScreenProps) {
  const [form, setForm] = useState<FormState>({
    name: "",
    registrationNumber: "",
    description: "",
    officialEmail: initialEmail,
    officialPhone: "",
    officialAddress: "",
  });
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AdministrativeArea[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<AdministrativeArea[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => new Set(selectedAreas.map((area) => area.id)),
    [selectedAreas],
  );

  const updateForm = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const searchAreas = async () => {
    setSearching(true);
    setError(null);

    try {
      setResults(await listAdministrativeAreas(accessToken, search));
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setSearching(false);
    }
  };

  const toggleArea = (area: AdministrativeArea) => {
    setSelectedAreas((current) => {
      if (current.some((selected) => selected.id === area.id)) {
        return current.filter((selected) => selected.id !== area.id);
      }

      if (current.length >= 500) {
        setError("An organization request can contain at most 500 GN Divisions.");
        return current;
      }

      return [...current, area];
    });
  };

  const submit = async () => {
    setError(null);

    if (
      !form.name.trim() ||
      !form.officialEmail.trim() ||
      !form.officialPhone.trim() ||
      !form.officialAddress.trim()
    ) {
      setError("Complete every required organization field.");
      return;
    }

    if (selectedAreas.length === 0) {
      setError("Select at least one official GN Division.");
      return;
    }

    const application: CreateOrganizationApplicationInput = {
      name: form.name.trim(),
      officialEmail: form.officialEmail.trim().toLowerCase(),
      officialPhone: form.officialPhone.trim(),
      officialAddress: form.officialAddress.trim(),
      administrativeAreaIds: selectedAreas.map((area) => area.id),
    };

    if (form.registrationNumber.trim()) {
      application.registrationNumber = form.registrationNumber.trim();
    }

    if (form.description.trim()) {
      application.description = form.description.trim();
    }

    setSubmitting(true);

    try {
      const createdApplication = await createOrganizationApplication(
        accessToken,
        application,
      );
      onSubmitted(createdApplication);
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <BrandHeader eyebrow="Organization onboarding" title="Create a request" compact />
      <Notice message="This request is for an existing real environmental organization. A Super Admin must review it before its workspace and service areas become active." />

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Organization details</Text>
        <Field label="Organization name" value={form.name} onChangeText={(value) => updateForm("name", value)} required />
        <Field label="Registration number" value={form.registrationNumber} onChangeText={(value) => updateForm("registrationNumber", value)} />
        <Field label="Description" value={form.description} onChangeText={(value) => updateForm("description", value)} multiline />
        <Field label="Official email" value={form.officialEmail} onChangeText={(value) => updateForm("officialEmail", value)} keyboardType="email-address" autoCapitalize="none" required />
        <Field label="Official phone" value={form.officialPhone} onChangeText={(value) => updateForm("officialPhone", value)} keyboardType="phone-pad" required />
        <Field label="Official address" value={form.officialAddress} onChangeText={(value) => updateForm("officialAddress", value)} multiline required />
      </View>

      <View style={sharedStyles.card}>
        <View style={sharedStyles.spacedRow}>
          <Text style={sharedStyles.sectionTitle}>GN service areas</Text>
          <Text style={styles.selectionCount}>{selectedAreas.length}/500</Text>
        </View>
        <Text style={sharedStyles.sectionSubtitle}>
          Search by GN Division, GN number, Divisional Secretariat, district, province, or official code.
        </Text>
        <Field
          label="Search official areas"
          value={search}
          onChangeText={setSearch}
          placeholder="Example: Polgasowita or Kesbewa"
        />
        <Button label="Search GN Divisions" onPress={() => void searchAreas()} loading={searching} />

        {selectedAreas.length > 0 ? (
          <View style={styles.selectedGroup}>
            <Text style={styles.groupTitle}>Selected areas</Text>
            {selectedAreas.map((area) => (
              <Pressable key={area.id} onPress={() => toggleArea(area)} style={styles.selectedArea}>
                <View style={styles.areaCopy}>
                  <Text style={styles.areaName}>{area.name}</Text>
                  <Text style={styles.areaMeta}>{area.officialCode} · {area.divisionalSecretariatName ?? "DS not listed"}</Text>
                </View>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {results.length > 0 ? (
          <View style={styles.resultsGroup}>
            <Text style={styles.groupTitle}>Search results</Text>
            {results.map((area) => {
              const selected = selectedIds.has(area.id);

              return (
                <Pressable
                  key={area.id}
                  onPress={() => toggleArea(area)}
                  style={[styles.resultArea, selected && styles.resultAreaSelected]}
                >
                  <View style={styles.areaCopy}>
                    <Text style={styles.areaName}>{area.name}</Text>
                    <Text style={styles.areaMeta}>
                      {area.gnNumber ? `GN ${area.gnNumber} · ` : ""}
                      {area.divisionalSecretariatName ?? "Unknown DS"} · {area.districtName ?? "Unknown district"}
                    </Text>
                  </View>
                  <Text style={[styles.selectMark, selected && styles.selectMarkSelected]}>
                    {selected ? "✓" : "+"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {error ? <Notice message={error} tone="error" /> : null}
      <Button label="Submit for Super Admin review" onPress={() => void submit()} loading={submitting} />
      <Button label="Back to dashboard" variant="secondary" onPress={onBack} disabled={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectionCount: { color: colors.primary, fontWeight: "900" },
  selectedGroup: { gap: spacing.sm },
  resultsGroup: { gap: spacing.sm },
  groupTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  selectedArea: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: spacing.sm,
    backgroundColor: colors.primarySoft,
    gap: spacing.sm,
  },
  resultArea: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  resultAreaSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  areaCopy: { flex: 1, gap: 3 },
  areaName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  areaMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  selectMark: { color: colors.primary, fontSize: 22, fontWeight: "900" },
  selectMarkSelected: { color: colors.success },
});
