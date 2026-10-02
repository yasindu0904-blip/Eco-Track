import * as Location from "expo-location";

// Call only after foreground permission has been granted by a user action.
// Reuse a recent fix for neighbourhood searches instead of waiting for GPS
// each time. Keep both the cached lookup and fresh fix within one deadline.
export async function getForegroundPosition(): Promise<Location.LocationObject> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const position = async () => {
    const recent = await Location.getLastKnownPositionAsync({
      maxAge: 30_000,
      requiredAccuracy: 100,
    }).catch(() => null);
    if (expired) throw new Error("Location request timed out.");
    return recent ?? Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  };
  try {
    return await Promise.race([
      position(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error("Location request timed out."));
        }, 15_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
