import * as Location from "expo-location";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getForegroundPosition } from "./foregroundPosition";

vi.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getLastKnownPositionAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
}));

const position = {
  coords: { latitude: 6.9271, longitude: 79.8612, accuracy: 20,
    altitude: null, altitudeAccuracy: null, heading: null, speed: null },
  timestamp: Date.now(),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

test("uses a recent accurate position without waiting for another GPS fix", async () => {
  vi.mocked(Location.getLastKnownPositionAsync).mockResolvedValue(position);
  expect(await getForegroundPosition()).toEqual(position);
  expect(Location.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 30_000, requiredAccuracy: 100 });
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

test("requests a fresh position when the cached fix is absent or unsuitable", async () => {
  vi.mocked(Location.getLastKnownPositionAsync).mockResolvedValue(null);
  vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue(position);
  expect(await getForegroundPosition()).toEqual(position);
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
  expect(vi.getTimerCount()).toBe(0);
});

test("a failed cached lookup still permits a fresh fix", async () => {
  vi.mocked(Location.getLastKnownPositionAsync).mockRejectedValue(new Error("cache unavailable"));
  vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue(position);
  expect(await getForegroundPosition()).toEqual(position);
});

test("a stalled GPS provider reaches a deadline rather than spinning forever", async () => {
  vi.mocked(Location.getLastKnownPositionAsync).mockResolvedValue(null);
  vi.mocked(Location.getCurrentPositionAsync).mockReturnValue(new Promise(() => undefined));
  const outcome = expect(getForegroundPosition()).rejects.toThrow("Location request timed out.");
  await vi.advanceTimersByTimeAsync(15_000);
  await outcome;
  expect(vi.getTimerCount()).toBe(0);
});

test("a stalled cached lookup shares the same deadline", async () => {
  vi.mocked(Location.getLastKnownPositionAsync).mockReturnValue(new Promise(() => undefined));
  const outcome = expect(getForegroundPosition()).rejects.toThrow("Location request timed out.");
  await vi.advanceTimersByTimeAsync(15_000);
  await outcome;
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});
