import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { CitizenDrawer, type DrawerItem } from "../features/citizen/CitizenDrawer";
import { NotificationButton } from "../features/notifications/NotificationInboxScreen";
import { AppHeaderContext, SafeAreaHandledContext, type HeaderOptions } from "./appHeaderContext";
import { NavigationIcon } from "./NavigationIcon";

type Props = {
  children: ReactNode;
  title: string;
  accessToken?: string;
  onBack?: () => void;
  onHome?: () => void;
  onNotifications?: () => void;
  onSignOut: () => void;
  community?: DrawerItem[];
  organizations?: DrawerItem[];
};

export function AppShell({ children, title, accessToken, onBack, onHome, onNotifications, onSignOut, community = [], organizations = [] }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headers, setHeaders] = useState<Map<symbol, HeaderOptions>>(() => new Map());
  const register = useCallback((id: symbol, options: HeaderOptions) => {
    setHeaders((current) => new Map(current).set(id, options));
  }, []);
  const unregister = useCallback((id: symbol) => {
    setHeaders((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }, []);
  const context = useMemo(() => ({ register, unregister }), [register, unregister]);
  // Nested detail screens take precedence over their workspace's header.
  const orderedHeaders = [...headers.values()].sort((a, b) => b.depth - a.depth);
  const active = orderedHeaders[0];
  const backHeader = orderedHeaders.find((header) => header.onBack);
  const currentTitle = active?.title ?? title;
  const back = backHeader?.onBack ?? onBack;

  return (
    <AppHeaderContext.Provider value={context}>
      <SafeAreaHandledContext.Provider value>
        <View style={styles.shell}>
          <StatusBar style="light" />
          <SafeAreaView edges={["top", "left", "right"]} style={styles.headerArea} importantForAccessibility={drawerOpen ? "no-hide-descendants" : "auto"}>
            <View style={styles.header}>
              {back && <Pressable accessibilityRole="button" accessibilityLabel={backHeader?.backLabel ?? "Back"} onPress={back} style={styles.iconButton}>
                <NavigationIcon name="back" color="#FFFFFF" size={26} />
              </Pressable>}
              <Pressable accessibilityRole="button" accessibilityLabel="Open navigation menu" accessibilityState={{ expanded: drawerOpen }} onPress={() => setDrawerOpen(true)} style={styles.iconButton}>
                <NavigationIcon name="menu" color="#FFFFFF" size={27} />
              </Pressable>
              <Pressable accessibilityRole={onHome ? "button" : "header"} accessibilityLabel={onHome ? "Go to dashboard" : currentTitle} onPress={onHome} disabled={!onHome} style={styles.titleGroup}>
                {currentTitle !== "EcoTrack" && <Text style={styles.brand}>EcoTrack</Text>}
                <Text numberOfLines={2} style={[styles.title, currentTitle === "EcoTrack" && styles.homeTitle]}>{currentTitle}</Text>
              </Pressable>
              {accessToken && onNotifications ? <NotificationButton accessToken={accessToken} onOpen={onNotifications} compact inverse /> : <View style={styles.iconButton} />}
            </View>
          </SafeAreaView>
          <SafeAreaView edges={["bottom", "left", "right"]} style={styles.content} importantForAccessibility={drawerOpen ? "no-hide-descendants" : "auto"}>
            {children}
          </SafeAreaView>
          <CitizenDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} community={community} organizations={organizations} onNotifications={onNotifications} onSignOut={onSignOut} />
        </View>
      </SafeAreaHandledContext.Provider>
    </AppHeaderContext.Provider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#F5F7F4" },
  headerArea: { backgroundColor: "#195F38" },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titleGroup: { flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  brand: { color: "#D3E7D7", fontSize: 11, fontWeight: "600", marginBottom: 2 },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "800", textAlign: "center" },
  homeTitle: { fontSize: 25 },
  content: { flex: 1, backgroundColor: "#F5F7F4" },
});
