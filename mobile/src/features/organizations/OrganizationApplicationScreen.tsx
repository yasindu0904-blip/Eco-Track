import { useInvalidateLists } from "../../components/lists/usePagedList";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ApiRequestError } from "../../api/apiClient";
import { Button, Field, Notice, PageHeader, Screen, sharedStyles } from "../../components/ui";
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
  const invalidateLists = useInvalidateLists();
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
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [selectedExpanded, setSelectedExpanded] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<AdministrativeArea[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchGeneration = useRef(0);
  useEffect(() => () => { searchGeneration.current += 1; }, []);

  const selectedIds = useMemo(
    () => new Set(selectedAreas.map((area) => area.id)),
    [selectedAreas],
  );

  const updateForm = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const searchAreas = async () => {
    Keyboard.dismiss();
    const request = ++searchGeneration.current;
    setSearching(true);
    setError(null);

    try {
      const areas = await listAdministrativeAreas(accessToken, search);
      if (request !== searchGeneration.current) return;
      setResults(areas);
      setResultsExpanded(true);
    } catch (caughtError) {
      if (request === searchGeneration.current) setError(errorMessage(caughtError));
    } finally {
      if (request === searchGeneration.current) setSearching(false);
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
    Keyboard.dismiss();
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
      invalidateLists("applications:");
      onSubmitted(createdApplication);
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboardAware>
      <PageHeader
        eyebrow="Organization onboarding"
        title="Request a workspace"

        onBack={onBack}
        backLabel="Dashboard"
      />

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

        <Field
          label="Search official areas"
          value={search}
          onChangeText={value => {
            searchGeneration.current += 1;
            setSearch(value);
            setSearching(false);
            setResults([]);
            setResultsExpanded(false);
          }}
          placeholder="Example: Polgasowita or Kesbewa"
          returnKeyType="search"
          onSubmitEditing={() => void searchAreas()}
        />
        <Button label="Search GN Divisions" onPress={() => void searchAreas()} loading={searching} />

        {selectedAreas.length > 0 ? (
          <View style={styles.selectedGroup}>
            <Pressable
              style={styles.groupHeader}
              accessibilityRole="button"
              accessibilityLabel={`${selectedExpanded ? "Hide" : "Show"} selected GN Divisions`}
              accessibilityState={{ expanded: selectedExpanded }}
              onPress={() => { Keyboard.dismiss(); setSelectedExpanded(value => !value); }}
            >
              <Text style={styles.groupTitle}>Selected areas ({selectedAreas.length})</Text>
              <View style={[styles.chevron, selectedExpanded && styles.chevronExpanded]} />
            </Pressable>
            {selectedExpanded && <ScrollView style={styles.areaList} contentContainerStyle={styles.areaListContent} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {selectedAreas.map((area) => (
              <Pressable key={area.id} onPress={() => toggleArea(area)} style={styles.selectedArea} accessibilityRole="button" accessibilityLabel={`Remove ${area.name} from selected GN Divisions`}>
                <View style={styles.areaCopy}>
                  <Text style={styles.areaName}>{area.name}</Text>
                  <Text style={styles.areaMeta}>{area.officialCode} · {area.divisionalSecretariatName ?? "DS not listed"}</Text>
                </View>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ))}
            </ScrollView>}
          </View>
        ) : null}

        {results.length > 0 ? (
          <View style={styles.resultsGroup}>
            <Pressable
              style={styles.groupHeader}
              accessibilityRole="button"
              accessibilityLabel={`${resultsExpanded ? "Hide" : "Show"} GN Division search results`}
              accessibilityState={{ expanded: resultsExpanded }}
              onPress={() => { Keyboard.dismiss(); setResultsExpanded(value => !value); }}
            >
              <Text style={styles.groupTitle}>Search results ({results.length})</Text>
              <View style={[styles.chevron, resultsExpanded && styles.chevronExpanded]} />
            </Pressable>
            {resultsExpanded && <ScrollView style={styles.areaList} contentContainerStyle={styles.areaListContent} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {results.map((area) => {
              const selected = selectedIds.has(area.id);

              return (
                <Pressable
                  key={area.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Select ${area.name}, ${area.divisionalSecretariatName ?? "Unknown DS"}, ${area.districtName ?? "Unknown district"}`}
                  accessibilityState={{ checked: selected }}
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
            </ScrollView>}
          </View>
        ) : null}
      </View>

      {error ? <Notice message={error} tone="error" /> : null}
      <Button label="Submit for Super Admin review" onPress={() => void submit()} loading={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectionCount: { color: colors.primary, fontWeight: "900" },
  selectedGroup: { gap: spacing.sm },
  resultsGroup: { gap: spacing.sm },
  groupTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  groupHeader: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  chevron: { width: 10, height: 10, marginRight: 6, borderRightWidth: 2, borderBottomWidth: 2, borderColor: colors.primary, transform: [{ rotate: "45deg" }] },
  chevronExpanded: { transform: [{ rotate: "225deg" }] },
  areaList: { maxHeight: 240 },
  areaListContent: { gap: spacing.sm, paddingBottom: spacing.sm },
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
