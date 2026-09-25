import { StyleSheet, View } from "react-native";

type Props = {
  name: "menu" | "close" | "bell" | "report" | "location" | "check" | "back";
  size?: number;
  color?: string;
};

// Native shapes keep these small UI icons crisp without a font or native dependency.
export function NavigationIcon({ name, size = 26, color = "#195F38" }: Props) {
  const stroke = { borderColor: color };
  const fill = { backgroundColor: color };
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.canvas, { transform: [{ scale: size / 28 }], left: (size - 28) / 2, top: (size - 28) / 2 }]}>
        {name === "menu" && [6, 13, 20].map((top) => <View key={top} style={[styles.line, fill, { top }]} />)}
        {name === "back" && <View style={{ position: "absolute", left: 9, top: 6, width: 15, height: 15, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: color, transform: [{ rotate: "45deg" }] }} />}
        {name === "check" && [[5, 12, 9, 16], [9, 16, 19, 6]].map(([x1 = 0, y1 = 0, x2 = 0, y2 = 0], index) => {
          // Match the web SVG's m5 12 4 4L19 6 path and rounded 2.4px stroke.
          const scale = 28 / 24;
          const thickness = 2.4 * scale;
          const length = Math.hypot(x2 - x1, y2 - y1) * scale + thickness;
          return <View key={index} style={{
            position: "absolute", backgroundColor: color, borderRadius: thickness / 2,
            height: thickness, width: length,
            left: (x1 + x2) / 2 * scale - length / 2,
            top: (y1 + y2) / 2 * scale - thickness / 2,
            transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }],
          }} />;
        })}
        {name === "close" && <>
          <View style={[styles.line, fill, { top: 13, transform: [{ rotate: "45deg" }] }]} />
          <View style={[styles.line, fill, { top: 13, transform: [{ rotate: "-45deg" }] }]} />
        </>}
        {name === "bell" && <>
          <View style={[styles.bell, stroke]} />
          <View style={[styles.bellLip, fill]} />
          <View style={[styles.bellTop, fill]} />
          <View style={[styles.bellClapper, stroke]} />
        </>}
        {name === "report" && <>
          <View style={[styles.circle, stroke]} />
          <View style={[styles.exclamation, fill]} />
          <View style={[styles.dot, fill]} />
        </>}
        {name === "location" && <>
          <View style={[styles.target, stroke]} />
          <View style={[styles.targetCenter, stroke]} />
          {[0, 90, 180, 270].map((rotation) => (
            <View key={rotation} style={[styles.canvas, { transform: [{ rotate: `${rotation}deg` }] }]}>
              <View style={[styles.targetTick, fill]} />
            </View>
          ))}
        </>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: "absolute", width: 28, height: 28 },
  line: { position: "absolute", left: 3, width: 22, height: 2.5, borderRadius: 2 },
  bell: { position: "absolute", left: 6, top: 5, width: 16, height: 15, borderWidth: 2, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomWidth: 0 },
  bellLip: { position: "absolute", left: 4, top: 19, width: 20, height: 2, borderRadius: 1 },
  bellTop: { position: "absolute", left: 12, top: 2, width: 4, height: 4, borderRadius: 2 },
  bellClapper: { position: "absolute", left: 11, top: 21, width: 6, height: 4, borderWidth: 2, borderTopWidth: 0, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  circle: { position: "absolute", inset: 2, borderWidth: 2, borderRadius: 14 },
  exclamation: { position: "absolute", top: 7, left: 13, width: 2.5, height: 9, borderRadius: 2 },
  dot: { position: "absolute", top: 19, left: 13, width: 2.5, height: 2.5, borderRadius: 2 },
  target: { position: "absolute", inset: 5, borderWidth: 2, borderRadius: 10 },
  targetCenter: { position: "absolute", inset: 10, borderWidth: 2, borderRadius: 5 },
  targetTick: { position: "absolute", left: 13, top: 1, width: 2, height: 6, borderRadius: 1 },
});
