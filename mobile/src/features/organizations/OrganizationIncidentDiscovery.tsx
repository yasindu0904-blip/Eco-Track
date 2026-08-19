import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { listIncidentCategories } from "../incidents/incident.api";
import type { IncidentCategory } from "../incidents/incident.types";
import {
  EcoMap,
  type MapBoundaryFeatureCollection,
  type MapMarkerFeature,
  type MapViewport,
  type MapViewportChangeHandler,
} from "../map";
import {
  getOrganizationIncidentDetail,
  listOrganizationIncidents,
  listOrganizationServiceAreaBoundaries,
  updateOrganizationIncidentReview,
} from "./organizationIncidentDiscovery.api";
import type {
  OrganizationIncidentDetail,
  OrganizationIncidentFalseReasonCode,
  OrganizationIncidentReviewStatus,
  OrganizationIncidentSummary,
} from "./organizationIncidentDiscovery.types";

type Props = {
  accessToken: string;
  organizationId: string;
  canReview: boolean;
  onMapInteractionChange: (interacting: boolean) => void;
  onCreateDraftFromIncident?: (incidentId: string) => void;
};

const statuses = [
  { value: "", label: "All current" },
  { value: "ACTIVE", label: "Active" },
  { value: "CLEANUP_ORGANIZED", label: "Organized" },
  { value: "RESOLVED", label: "Resolved" },
] as const;

const times = [
  { value: "", label: "Any time", milliseconds: 0 },
  { value: "24h", label: "24 hours", milliseconds: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7 days", milliseconds: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "30 days", milliseconds: 30 * 24 * 60 * 60 * 1000 },
] as const;

const reviewReasons: Array<{
  value: OrganizationIncidentFalseReasonCode;
  label: string;
}> = [
  { value: "INSUFFICIENT_EVIDENCE", label: "Insufficient evidence" },
  { value: "LOCATION_INCORRECT", label: "Location is incorrect" },
  { value: "DUPLICATE_REPORT", label: "Duplicate report" },
  { value: "NOT_AN_ENVIRONMENTAL_INCIDENT", label: "Not an environmental incident" },
  { value: "OUTSIDE_SERVICE_SCOPE", label: "Outside service scope" },
  { value: "OTHER", label: "Other" },
];

type DiscoveryFilters = {
  status: (typeof statuses)[number]["value"];
  categoryId: string;
  timeRange: (typeof times)[number]["value"];
};

function reportedAfterFor(value: DiscoveryFilters["timeRange"]): string | undefined {
  const option = times.find((candidate) => candidate.value === value);
  return option?.milliseconds
    ? new Date(Date.now() - option.milliseconds).toISOString()
    : undefined;
}

function mergeUnique(
  current: OrganizationIncidentSummary[],
  incoming: OrganizationIncidentSummary[],
): OrganizationIncidentSummary[] {
  const byId = new Map(current.map((incident) => [incident.id, incident]));
  incoming.forEach((incident) => byId.set(incident.id, incident));
  return [...byId.values()];
}

function readable(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function OrganizationIncidentDiscovery({
  accessToken,
  organizationId,
  canReview,
  onMapInteractionChange,
  onCreateDraftFromIncident,
}: Props) {
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [boundaries, setBoundaries] =
    useState<MapBoundaryFeatureCollection>();
  const [incidents, setIncidents] = useState<OrganizationIncidentSummary[]>([]);
  const [viewport, setViewport] = useState<MapViewport>();
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] =
    useState<(typeof statuses)[number]["value"]>("");
  const [categoryId, setCategoryId] = useState("");
  const [timeRange, setTimeRange] =
    useState<(typeof times)[number]["value"]>("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [detail, setDetail] = useState<OrganizationIncidentDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<OrganizationIncidentReviewStatus>("VIEWED");
  const [reasonCode, setReasonCode] = useState<OrganizationIncidentFalseReasonCode>();
  const [privateNotes, setPrivateNotes] = useState("");
  const [reviewError, setReviewError] = useState<string>();
  const [reviewNotice, setReviewNotice] = useState<string>();
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const detailRequest = useRef<AbortController | undefined>(undefined);
  const selectedIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    void listIncidentCategories(accessToken)
      .then((loaded) => {
        if (active) setCategories(loaded);
      })
      .catch((requestError: unknown) =>
        active && setError(
          describeApiFailure(
            requestError,
            "Unable to load incident categories.",
          ).message,
        ),
      );
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    detailRequest.current?.abort();
    setDetail(undefined);
    setDetailLoading(false);
    setReviewError(undefined);
    setReviewNotice(undefined);
    setReviewStatus("VIEWED");
    setReasonCode(undefined);
    setPrivateNotes("");

    if (!selectedId || !canReview) {
      return;
    }

    const controller = new AbortController();
    detailRequest.current = controller;
    setDetailLoading(true);
    void getOrganizationIncidentDetail(
      accessToken,
      organizationId,
      selectedId,
      controller.signal,
    )
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setDetail(loaded);
        setReviewStatus(loaded.currentReview?.status ?? "VIEWED");
        setReasonCode(
          (loaded.currentReview?.reasonCode as OrganizationIncidentFalseReasonCode | null) ?? undefined,
        );
        setPrivateNotes(loaded.currentReview?.privateNotes ?? "");
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setReviewError(
            describeApiFailure(requestError, "Unable to load the incident details.").message,
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });

    return () => controller.abort();
  }, [accessToken, canReview, organizationId, selectedId]);

  const loadDiscovery = useCallback(
    async (
      nextViewport: MapViewport,
      filters: DiscoveryFilters,
      options: {
        append?: boolean;
        cursor?: string;
        includeBoundaries?: boolean;
        externalSignal?: AbortSignal;
      } = {},
    ) => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      const abortFromExternal = () => controller.abort();
      options.externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
      if (options.externalSignal?.aborted) controller.abort();

      if (options.append) setLoadingMore(true);
      else {
        setLoading(true);
        setNextCursor(null);
      }
      setError(undefined);
      try {
        const page = await listOrganizationIncidents(
          accessToken,
          organizationId,
          {
            ...nextViewport,
            limit: 100,
            cursor: options.cursor,
            status: filters.status || undefined,
            categoryId: filters.categoryId || undefined,
            reportedAfter: reportedAfterFor(filters.timeRange),
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setIncidents((current) =>
          options.append ? mergeUnique(current, page.items) : page.items,
        );
        setNextCursor(page.nextCursor);
        setSelectedId((current) =>
          options.append && current
            ? current
            :
          page.items.some((incident) => incident.id === current)
            ? current
            : page.items[0]?.id,
        );

        if (options.includeBoundaries) {
          const overlay = await listOrganizationServiceAreaBoundaries(
            accessToken,
            organizationId,
            { ...nextViewport, limit: 100 },
            controller.signal,
          );
          if (!controller.signal.aborted) setBoundaries(overlay);
        }
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          describeApiFailure(
            requestError,
            "Unable to load covered incidents.",
          ).message,
        );
      } finally {
        options.externalSignal?.removeEventListener("abort", abortFromExternal);
        if (activeRequest.current === controller) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [accessToken, organizationId],
  );

  const handleViewportChange = useCallback<MapViewportChangeHandler>(
    (nextViewport, context) => {
      setViewport(nextViewport);
      return loadDiscovery(
        nextViewport,
        { status, categoryId, timeRange },
        { includeBoundaries: true, externalSignal: context.signal },
      );
    },
    [categoryId, loadDiscovery, status, timeRange],
  );

  const changeStatus = (nextStatus: (typeof statuses)[number]["value"]) => {
    setStatus(nextStatus);
    if (viewport) void loadDiscovery(viewport, { status: nextStatus, categoryId, timeRange });
  };

  const changeCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    if (viewport) void loadDiscovery(viewport, { status, categoryId: nextCategoryId, timeRange });
  };

  const changeTimeRange = (nextTimeRange: DiscoveryFilters["timeRange"]) => {
    setTimeRange(nextTimeRange);
    if (viewport) void loadDiscovery(viewport, { status, categoryId, timeRange: nextTimeRange });
  };

  const markers = useMemo<MapMarkerFeature[]>(
    () => incidents.map((incident) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [incident.longitude, incident.latitude],
      },
      properties: {
        id: incident.id,
        kind: "INCIDENT",
        title: incident.title,
        status: readable(incident.status),
        category: incident.category.name,
        occurredAt: incident.reportedAt,
      },
    })),
    [incidents],
  );
  const selected = incidents.find((incident) => incident.id === selectedId);
  const selectedDetail = detail?.id === selectedId ? detail : undefined;

  const submitReview = async () => {
    if (!canReview || !selectedId || selectedDetail?.id !== selectedId) return;
    if (reviewStatus === "FALSE" && !reasonCode) {
      setReviewError("Choose a reason before marking this incident false.");
      return;
    }
    if (reviewStatus === "FALSE" && reasonCode === "OTHER" && privateNotes.trim().length < 10) {
      setReviewError("Explain an OTHER reason in at least 10 characters.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError(undefined);
    setReviewNotice(undefined);
    try {
      const result = await updateOrganizationIncidentReview(
        accessToken,
        organizationId,
        selectedId,
        {
          status: reviewStatus,
          ...(reviewStatus === "FALSE" && reasonCode ? { reasonCode } : {}),
          privateNotes: privateNotes.trim() || null,
        },
      );
      setDetail((current) => {
        if (!current || current.id !== selectedId) return current;
        const wasFalse = current.currentReview?.status === "FALSE";
        const isFalse = result.review.status === "FALSE";
        return {
          ...current,
          currentReview: result.review,
          falseReviewCount: Math.max(
            0,
            current.falseReviewCount + (isFalse && !wasFalse ? 1 : wasFalse && !isFalse ? -1 : 0),
          ),
        };
      });
      setIncidents((current) => current.map((incident) =>
        incident.id === selectedId
          ? {
              ...incident,
              falseReviewCount: Math.max(
                0,
                incident.falseReviewCount +
                  (result.review.status === "FALSE" && incident.currentReviewStatus !== "FALSE"
                    ? 1
                    : result.review.status !== "FALSE" && incident.currentReviewStatus === "FALSE"
                      ? -1
                      : 0),
              ),
              currentReviewStatus: result.review.status,
            }
          : incident,
      ));
      if (selectedIdRef.current === selectedId) {
        setReviewNotice(
          result.rewardAwarded
            ? "Review saved. Contribution recorded."
            : result.idempotentReplay
              ? "This review was already saved."
              : "Review saved.",
        );
      }
    } catch (requestError) {
      if (selectedIdRef.current === selectedId) {
        setReviewError(
          describeApiFailure(requestError, "Unable to save this review.").message,
        );
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={sharedStyles.spacedRow}>
        <View>
          <Text style={styles.eyebrow}>COVERED INCIDENTS</Text>
          <Text style={styles.count}>
            {loading
              ? "Loading incidents in this view"
              : nextCursor
                ? `Showing the first ${incidents.length} incidents in view`
                : `${incidents.length} incidents in view`}
          </Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
      </View>

      <View style={styles.filters}>
        {statuses.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: status === option.value }}
            onPress={() => changeStatus(option.value)}
            style={[
              styles.filter,
              status === option.value && styles.filterSelected,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                status === option.value && styles.filterTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.filterLabel}>CATEGORY</Text>
      <View style={styles.filters}>
        {[{ id: "", name: "All categories" }, ...categories].map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityState={{ selected: categoryId === category.id }}
            onPress={() => changeCategory(category.id)}
            style={[styles.filter, categoryId === category.id && styles.filterSelected]}
          >
            <Text style={[styles.filterText, categoryId === category.id && styles.filterTextSelected]}>
              {category.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.filterLabel}>REPORTED</Text>
      <View style={styles.filters}>
        {times.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: timeRange === option.value }}
            onPress={() => changeTimeRange(option.value)}
            style={[styles.filter, timeRange === option.value && styles.filterSelected]}
          >
            <Text style={[styles.filterText, timeRange === option.value && styles.filterTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Notice tone="error" message={error} /> : null}
      {boundaries?.truncated ? (
        <Notice tone="warning" message="The service-area overlay reached its 100-feature display limit. Zoom in to view the remaining boundaries." />
      ) : null}

      <EcoMap
        markers={markers}
        boundaries={boundaries}
        selectedMarkerId={selectedId}
        showListFallback={false}
        showCurrentLocation={false}
        height={430}
        accessibleLabel="Organization incident discovery map"
        onMarkerSelect={(marker) => setSelectedId(marker.properties.id)}
        onViewportChange={handleViewportChange}
        onInteractionChange={onMapInteractionChange}
      />

      {incidents.length === 0 && !loading ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>No covered incidents in this view</Text>
          <Text style={sharedStyles.sectionSubtitle}>
            Use the map focus control to return to your service areas.
          </Text>
        </View>
      ) : (
        incidents.map((incident) => (
          <Pressable
            key={incident.id}
            accessibilityRole="button"
            onPress={() => setSelectedId(incident.id)}
            style={[
              sharedStyles.card,
              styles.incidentCard,
              incident.id === selectedId && styles.incidentCardSelected,
            ]}
          >
            <Text style={styles.category}>{incident.category.name}</Text>
            <Text style={styles.incidentTitle}>{incident.title}</Text>
            <Text style={styles.meta}>
              {readable(incident.severity)} severity · {readable(incident.status)}
            </Text>
          </Pressable>
        ))
      )}

      {nextCursor && viewport ? (
        <Button
          label={loadingMore ? "Loading more..." : "Load more incidents"}
          loading={loadingMore}
          disabled={loadingMore}
          variant="secondary"
          onPress={() =>
            void loadDiscovery(
              viewport,
              { status, categoryId, timeRange },
              { append: true, cursor: nextCursor },
            )
          }
        />
      ) : null}

      {selected ? (
        <View style={[sharedStyles.card, styles.detail]}>
          <Text style={sharedStyles.sectionTitle}>{selected.title}</Text>
          <Text style={sharedStyles.sectionSubtitle}>
            {selected.addressText ?? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`}
          </Text>
          <View style={sharedStyles.divider} />
          <View style={sharedStyles.spacedRow}>
            <Text style={styles.detailLabel}>YOUR REVIEW</Text>
            <Text style={styles.detailValue}>
              {selected.currentReviewStatus
                ? readable(selected.currentReviewStatus)
                : "Not reviewed"}
            </Text>
          </View>
          <View style={sharedStyles.spacedRow}>
            <Text style={styles.detailLabel}>PUBLIC FALSE COUNT</Text>
            <Text style={styles.detailValue}>{selected.falseReviewCount}</Text>
          </View>
          {canReview && detailLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {!canReview ? (
            <Notice
              tone="info"
              message="Incident review actions require Organization Admin access."
            />
          ) : selectedDetail ? (
            <View style={styles.reviewForm}>
              <Text style={styles.reviewEyebrow}>ORGANIZATION REVIEW</Text>
              <Text style={styles.reviewContext}>{readable(selectedDetail.accessSource)}</Text>
              <Text style={styles.reviewDescription}>{selectedDetail.description}</Text>
              {selectedDetail.photos.length > 0 ? (
                <View style={styles.evidenceGrid} accessibilityLabel="Incident evidence">
                  {selectedDetail.photos.map((photo, index) => (
                    <View key={photo.id} style={styles.evidenceItem}>
                      <Image
                        source={{ uri: photo.url }}
                        accessibilityLabel={photo.caption || `Incident evidence ${index + 1}`}
                        style={styles.evidencePhoto}
                      />
                      {photo.caption ? <Text style={styles.evidenceCaption}>{photo.caption}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.reviewDescription}>No photo evidence was submitted.</Text>
              )}
              <Text style={styles.reviewLabel}>REVIEW STATUS</Text>
              <View style={styles.reviewChoices}>
                {(["VIEWED", "VALID", "FALSE"] as OrganizationIncidentReviewStatus[]).map((statusOption) => (
                  <Pressable
                    key={statusOption}
                    accessibilityRole="button"
                    accessibilityState={{ selected: reviewStatus === statusOption }}
                    disabled={reviewSubmitting}
                    onPress={() => {
                      setReviewStatus(statusOption);
                      if (statusOption !== "FALSE") setReasonCode(undefined);
                    }}
                    style={[styles.reviewChoice, reviewStatus === statusOption && styles.reviewChoiceSelected]}
                  >
                    <Text style={[styles.reviewChoiceText, reviewStatus === statusOption && styles.reviewChoiceTextSelected]}>
                      {readable(statusOption)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {reviewStatus === "FALSE" ? (
                <>
                  <Text style={styles.reviewLabel}>FALSE REASON</Text>
                  <View style={styles.reviewChoices}>
                    {reviewReasons.map((reason) => (
                      <Pressable
                        key={reason.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected: reasonCode === reason.value }}
                        disabled={reviewSubmitting}
                        onPress={() => setReasonCode(reason.value)}
                        style={[styles.reviewChoice, reasonCode === reason.value && styles.reviewChoiceSelected]}
                      >
                        <Text style={[styles.reviewChoiceText, reasonCode === reason.value && styles.reviewChoiceTextSelected]}>
                          {reason.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.reviewLabel}>PRIVATE NOTES</Text>
                  <TextInput
                    multiline
                    value={privateNotes}
                    editable={!reviewSubmitting}
                    maxLength={2000}
                    onChangeText={setPrivateNotes}
                    placeholder="Visible only to authorized organization users."
                    style={styles.reviewInput}
                  />
                </>
              ) : null}
              {reviewError ? <Notice tone="error" message={reviewError} /> : null}
              {reviewNotice ? <Notice tone="success" message={reviewNotice} /> : null}
              <Button
                label={reviewSubmitting ? "Saving review..." : "Save review"}
                loading={reviewSubmitting}
                disabled={reviewSubmitting || !selectedDetail}
                onPress={() => void submitReview()}
              />
            </View>
          ) : null}
          {onCreateDraftFromIncident ? (
            <Button
              label="Create cleanup-event draft"
              onPress={() => onCreateDraftFromIncident(selected.id)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  count: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 4 },
  filterLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  filter: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  filterSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  filterTextSelected: { color: colors.primary },
  incidentCard: { borderRadius: 8 },
  incidentCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  category: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  incidentTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  meta: { color: colors.textMuted, fontSize: 13 },
  detail: { borderRadius: 8 },
  detailLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900" },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: "900" },
  reviewForm: { gap: spacing.sm, marginTop: spacing.sm },
  reviewEyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  reviewContext: { color: colors.text, fontSize: 15, fontWeight: "900" },
  reviewDescription: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  evidenceGrid: { gap: spacing.sm },
  evidenceItem: { gap: spacing.xs },
  evidencePhoto: { width: "100%", height: 180, borderRadius: 8, backgroundColor: colors.border },
  evidenceCaption: { color: colors.textMuted, fontSize: 12 },
  reviewLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  reviewChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  reviewChoice: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  reviewChoiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  reviewChoiceText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  reviewChoiceTextSelected: { color: colors.primary },
  reviewInput: {
    minHeight: 100,
    padding: spacing.sm,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    textAlignVertical: "top",
  },
});
