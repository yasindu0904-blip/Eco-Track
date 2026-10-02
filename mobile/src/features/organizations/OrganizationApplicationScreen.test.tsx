import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { OrganizationApplicationScreen } from "./OrganizationApplicationScreen";
import { createOrganizationApplication, listAdministrativeAreas } from "./organizationApplication.api";
import type { AdministrativeArea } from "./organizationApplication.types";

const mocks = vi.hoisted(() => ({ dismiss: vi.fn() }));
vi.mock("react-native", () => ({
  Keyboard: { dismiss: mocks.dismiss }, Pressable: "Pressable", ScrollView: "ScrollView",
  StyleSheet: { create: <T,>(styles: T) => styles }, Text: "Text", View: "View",
}));
vi.mock("../../api/apiClient", () => ({ ApiRequestError: class extends Error {} }));
vi.mock("./organizationApplication.api", () => ({ createOrganizationApplication: vi.fn(), listAdministrativeAreas: vi.fn() }));
vi.mock("../../components/ui", async () => {
  const React = await import("react");
  return {
    Screen: ({ children, ...props }: { children: React.ReactNode }) => React.createElement("Screen", props, children),
    PageHeader: () => null,
    Button: ({ label, ...props }: { label: string }) => React.createElement("Button", { ...props, accessibilityLabel: label }),
    Field: (props: Record<string, unknown>) => React.createElement("Field", props),
    Notice: ({ message }: { message: string }) => React.createElement("Text", null, message),
    sharedStyles: { card: {}, sectionTitle: {}, spacedRow: {} },
  };
});

const areas: AdministrativeArea[] = Array.from({ length: 50 }, (_, index) => ({
  id: `area-${index}`, name: `Division ${index}`, officialCode: `${index}`, gnNumber: null,
  divisionalSecretariatName: "Kesbewa", districtName: "Colombo", provinceName: "Western",
}));
let tree: ReactTestRenderer | undefined;
const onSubmitted = vi.fn();
beforeEach(() => { vi.resetAllMocks(); vi.mocked(listAdministrativeAreas).mockResolvedValue(areas); });
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; });
async function render() {
  await act(async () => { tree = create(<OrganizationApplicationScreen accessToken="test-session" initialEmail="test@example.com" onBack={vi.fn()} onSubmitted={onSubmitted} />); });
}
async function press(label: string) {
  await act(async () => { await tree!.root.findByProps({ accessibilityLabel: label }).props.onPress(); });
}
async function change(label: string, value: string) {
  await act(async () => tree!.root.findByProps({ label }).props.onChangeText(value));
}

test("hiding both area lists preserves selections and submits their IDs for approval", async () => {
  await render();
  await change("Search official areas", "Kesbewa");
  await press("Search GN Divisions");
  expect(mocks.dismiss).toHaveBeenCalled();
  await press("Select Division 0, Kesbewa, Colombo");
  await press("Hide GN Division search results");
  expect(tree!.root.findAllByProps({ accessibilityRole: "checkbox" })).toHaveLength(0);
  await press("Show selected GN Divisions");
  expect(tree!.root.findAllByProps({ accessibilityLabel: "Remove Division 0 from selected GN Divisions" })).toHaveLength(1);
  await press("Hide selected GN Divisions");
  await change("Organization name", "Test organization");
  await change("Official phone", "0771234567");
  await change("Official address", "Test address");
  vi.mocked(createOrganizationApplication).mockResolvedValue({ id: "application-1" } as never);
  await press("Submit for Super Admin review");
  expect(createOrganizationApplication).toHaveBeenCalledWith("test-session", expect.objectContaining({ administrativeAreaIds: ["area-0"] }));
  expect(onSubmitted).toHaveBeenCalledOnce();
});

test("a late search response cannot replace results for newly typed text", async () => {
  await render();
  let finish!: (areas: AdministrativeArea[]) => void;
  vi.mocked(listAdministrativeAreas).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await change("Search official areas", "old query");
  let pending!: Promise<void>;
  await act(async () => { pending = tree!.root.findByProps({ accessibilityLabel: "Search GN Divisions" }).props.onPress(); });
  await change("Search official areas", "new query");
  await act(async () => { finish(areas); await pending; });
  expect(tree!.root.findAllByProps({ accessibilityRole: "checkbox" })).toHaveLength(0);
  await act(async () => tree!.root.findByProps({ label: "Search official areas" }).props.onSubmitEditing());
  expect(listAdministrativeAreas).toHaveBeenLastCalledWith("test-session", "new query");
  expect(tree!.root.findAllByProps({ accessibilityRole: "checkbox" })).toHaveLength(50);
});
