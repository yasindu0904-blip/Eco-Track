import { useEffect } from "react";
import { BackHandler } from "react-native";

import {
  mobileDashboard,
  parentDestination,
  type MobileDestination,
} from "./navigation";

export function useAndroidBackNavigation(
  destination: MobileDestination,
  navigate: (destination: MobileDestination) => void,
) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        const parent = parentDestination(destination);
        if (!parent) return false;
        navigate(parent ?? mobileDashboard);
        return true;
      },
    );

    return () => subscription.remove();
  }, [destination, navigate]);
}
