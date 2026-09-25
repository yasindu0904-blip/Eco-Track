import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { NavigationIcon } from "../../components/NavigationIcon";

export type DrawerItem = { label: string; onPress: () => void };
type Props = {
  visible: boolean;
  onClose: () => void;
  community: DrawerItem[];
  organizations: DrawerItem[];
  onNotifications?: () => void;
  onSignOut: () => void;
};

export function CitizenDrawer({ visible, onClose, community, organizations, onNotifications, onSignOut }: Props) {
  const slide = useRef(new Animated.Value(-360)).current;
  useEffect(() => {
    if (!visible) return;
    slide.setValue(-360);
    const animation = Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [slide, visible]);

  const select = (action: () => void) => {
    onClose();
    action();
  };
  const row = (item: DrawerItem) => (
    <Pressable key={item.label} accessibilityRole="button" onPress={() => select(item.onPress)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text style={styles.rowLabel}>{item.label}</Text>
      <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaProvider>
        {visible && <StatusBar style="light" />}
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close navigation menu" onPress={onClose} />
          <Animated.View style={[styles.drawer, { transform: [{ translateX: slide }] }]} accessibilityViewIsModal>
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.header}>
                <Text style={styles.brand}>EcoTrack</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} style={styles.close}>
                  <NavigationIcon name="close" color="#FFFFFF" />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.links}>
                {community.length > 0 && <Text style={styles.section}>Community action</Text>}
                {community.map(row)}
                {organizations.length > 0 && <Text style={styles.section}>Organizations</Text>}
                {organizations.map(row)}
                <View style={styles.divider} />
                {onNotifications && row({ label: "Notifications", onPress: onNotifications })}
                <Pressable accessibilityRole="button" onPress={() => select(onSignOut)} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
                  <Text style={styles.signOutLabel}>Sign out</Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(7,25,15,0.48)" },
  drawer: { width: "84%", maxWidth: 360, height: "100%", backgroundColor: "#123E28" },
  safeArea: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.12)" },
  brand: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  links: { padding: 14, paddingBottom: 32 },
  section: { color: "#B5DF7B", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 20, marginBottom: 8, paddingHorizontal: 12 },
  row: { minHeight: 49, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10 },
  rowLabel: { flex: 1, color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  arrow: { color: "#9DBCAB", fontSize: 22 },
  pressed: { opacity: 0.7, backgroundColor: "rgba(255,255,255,0.1)" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 16 },
  signOut: { borderRadius: 24, backgroundColor: "#B4232C", padding: 13, marginTop: 16, marginHorizontal: 10, alignItems: "center" },
  signOutLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
