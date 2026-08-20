import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  createIncident,
  getMyIncident,
  listIncidentCategories,
  listMyIncidents,
} from "./incident.api";
import { IncidentReportScreen } from "./IncidentReportScreen";
import { MyReportsScreen } from "./MyReportsScreen";

vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: vi.fn(),
}));

vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
}));

vi.mock("react-native", () => ({
  Image: "Image",
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  View: "View",
}));

vi.mock("../../components/ui", async () => {
  const React = await import("react");
  return {
    Button: ({ label, onPress, disabled, loading }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
      loading?: boolean;
    }) => React.createElement("Button", {
      accessibilityLabel: label,
      disabled: Boolean(disabled || loading),
      onPress,
    }, label),
    Field: ({ label, value, onChangeText }: {
      label: string;
      value: string;
      onChangeText: (value: string) => void;
    }) => React.createElement("Field", { label, value, onChangeText }),
    LoadingState: ({ message }: { message: string }) => React.createElement("Text", null, message),
    Notice: ({ message }: { message: string }) => React.createElement("Text", null, message),
    Screen: ({ children }: { children: React.ReactNode }) => React.createElement("View", null, children),
    sharedStyles: {
      card: {}, divider: {}, sectionSubtitle: {}, sectionTitle: {}, spacedRow: {},
    },
  };
});

vi.mock("../../components/theme", () => ({
  colors: {
    border: "gray", primary: "green", primaryDark: "darkgreen",
    primarySoft: "lightgreen", surface: "white", surfaceMuted: "whitesmoke",
    text: "black", textMuted: "gray",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
}));

vi.mock("../map", async () => {
  const React = await import("react");
  return {
    COLOMBO_MAP_CENTER: { latitude: 6.9271, longitude: 79.8612 },
    LocationPicker: (props: Record<string, unknown>) =>
      React.createElement("LocationPicker", props),
  };
});

vi.mock("./incident.api", () => ({
  createIncident: vi.fn(),
  getMyIncident: vi.fn(),
  listIncidentCategories: vi.fn(),
  listMyIncidents: vi.fn(),
  uploadEvidence: vi.fn(),
}));

const category = { id: "waste", name: "Waste", description: "Waste incident" };
const summary = {
  id: "incident-mobile-workflow",
  title: "Mobile canal report",
  category,
  severity: "HIGH" as const,
  status: "ACTIVE" as const,
  latitude: 6.96,
  longitude: 79.92,
  addressText: "Community canal",
  reportedAt: "2026-08-20T08:00:00.000Z",
  thumbnailUrl: null,
};
const detail = {
  ...summary,
  status: "CLEANUP_ORGANIZED" as const,
  description: "Plastic waste is blocking the community canal.",
  highlightUntil: "2026-08-22T08:00:00.000Z",
  archiveAfter: "2026-08-29T08:00:00.000Z",
  resolvedAt: null,
  archivedAt: null,
  photos: [],
  statusHistory: [
    {
      id: "active-history",
      fromStatus: null,
      toStatus: "ACTIVE" as const,
      reason: "Incident report submitted.",
      changedAt: "2026-08-20T08:00:00.000Z",
    },
    {
      id: "organized-history",
      fromStatus: "ACTIVE" as const,
      toStatus: "CLEANUP_ORGANIZED" as const,
      reason: "A cleanup event was published for this incident.",
      changedAt: "2026-08-20T10:00:00.000Z",
    },
  ],
};

function textContent(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root
    .findAll((node) => typeof node.children[0] === "string")
    .map((node) => node.children.join(""))
    .join("\n");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listIncidentCategories).mockResolvedValue([category]);
  vi.mocked(listMyIncidents).mockResolvedValue([summary]);
  vi.mocked(getMyIncident).mockResolvedValue(detail);
});

describe("mobile incident workflow scenarios", () => {
  test("weak-network retry preserves the report and reuses one submission id", async () => {
    const onSubmitted = vi.fn();
    vi.mocked(createIncident)
      .mockRejectedValueOnce(new Error("weak network"))
      .mockResolvedValueOnce(detail);
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <IncidentReportScreen
          accessToken="token"
          onBack={vi.fn()}
          onSubmitted={onSubmitted}
        />,
      );
    });
    await act(async () => {
      renderer!.root.findByType("LocationPicker" as never).props.onConfirm({
        latitude: 6.96,
        longitude: 79.92,
      });
      renderer!.root.findByProps({ label: "Incident title" }).props.onChangeText(
        "Mobile canal report",
      );
      renderer!.root.findByProps({ label: "Description" }).props.onChangeText(
        "Plastic waste is blocking the community canal.",
      );
    });

    const submit = () => renderer!.root.findByProps({
      accessibilityLabel: "Submit incident report",
    }).props.onPress();
    await act(async () => { submit(); });
    expect(textContent(renderer!)).toContain("weak network");
    await act(async () => { submit(); });

    expect(createIncident).toHaveBeenCalledTimes(2);
    const firstInput = vi.mocked(createIncident).mock.calls[0]?.[1];
    const retryInput = vi.mocked(createIncident).mock.calls[1]?.[1];
    expect(retryInput?.submissionId).toBe(firstInput?.submissionId);
    expect(retryInput?.title).toBe("Mobile canal report");
    expect(retryInput?.latitude).toBe(6.96);
    expect(onSubmitted).toHaveBeenCalledWith(detail);
  });

  test("My Reports reloads the reporter-visible linked-event status history", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <MyReportsScreen
          accessToken="token"
          onBack={vi.fn()}
          onNewReport={vi.fn()}
        />,
      );
    });

    const reportCard = renderer!.root.findAllByType("Pressable" as never).find((node) =>
      node.findAllByType("Text" as never).some((text) =>
        text.children.join("") === "Mobile canal report"),
    );
    await act(async () => { reportCard!.props.onPress(); });

    expect(getMyIncident).toHaveBeenCalledWith("token", summary.id);
    expect(textContent(renderer!)).toContain("Cleanup Organized");
    expect(textContent(renderer!)).toContain(
      "A cleanup event was published for this incident.",
    );
    expect(textContent(renderer!)).not.toContain("privateNotes");
    expect(textContent(renderer!)).not.toContain("Organization private");
  });
});
