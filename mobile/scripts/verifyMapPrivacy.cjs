const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const mobileRoot = path.resolve(__dirname, "..");
const targets = [
  path.join(mobileRoot, "src", "features", "map"),
  path.join(mobileRoot, "src", "features", "incidents", "CitizenIncidentDiscoveryScreen.tsx"),
  path.join(mobileRoot, "src", "features", "organizations", "OrganizationIncidentDiscovery.tsx"),
];
const forbiddenApis = [
  "watchPositionAsync(",
  "startLocationUpdatesAsync(",
  "requestBackgroundPermissionsAsync(",
  "startGeofencingAsync(",
];
const consoleMethods = new Set(["log", "info", "warn", "error"]);
const allowedConsoleErrorMessage = "EcoTrack mobile map viewport request failed.";

function stringPropertyName(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  return undefined;
}

function isConsoleObject(node) {
  if (ts.isIdentifier(node)) return node.text === "console";
  if (ts.isPropertyAccessExpression(node)) return node.name.text === "console";
  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    return stringPropertyName(node.argumentExpression) === "console";
  }
  return false;
}

function consoleMethod(node) {
  if (ts.isPropertyAccessExpression(node) && isConsoleObject(node.expression)) {
    return consoleMethods.has(node.name.text) ? node.name.text : undefined;
  }
  if (
    ts.isElementAccessExpression(node) &&
    isConsoleObject(node.expression) &&
    node.argumentExpression
  ) {
    const method = stringPropertyName(node.argumentExpression);
    return method && consoleMethods.has(method) ? method : undefined;
  }
  return undefined;
}

function unsafeConsoleUsages(source, fileName = "map-flow.tsx") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const usages = [];

  const addUsage = (node, detail) => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    usages.push(`${line + 1}:${character + 1} ${detail}`);
  };

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const method = consoleMethod(node.expression);
      if (method) {
        const allowed =
          method === "error" &&
          node.arguments.length === 1 &&
          ts.isStringLiteralLike(node.arguments[0]) &&
          node.arguments[0].text === allowedConsoleErrorMessage;
        if (!allowed) addUsage(node, `uses console.${method}`);
        node.arguments.forEach(visit);
        return;
      }
    }

    const referencedMethod = consoleMethod(node);
    if (referencedMethod) {
      addUsage(node, `aliases console.${referencedMethod}`);
      return;
    }
    if (ts.isIdentifier(node) && node.text === "console") {
      addUsage(node, "references console directly");
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return usages;
}

function verifyGuardContract() {
  const cases = [
    { source: "console.log(marker);", unsafe: true },
    { source: "console.error(response);", unsafe: true },
    { source: 'console.warn("map failed", data);', unsafe: true },
    { source: 'console["log"](marker);', unsafe: true },
    { source: "const leak = console.log; leak(marker);", unsafe: true },
    { source: "const logger = console; logger.log(marker);", unsafe: true },
    { source: "globalThis.console.log(marker);", unsafe: true },
    { source: `console.error("${allowedConsoleErrorMessage}");`, unsafe: false },
    { source: 'const label = "console.log(marker)";', unsafe: false },
  ];
  for (const testCase of cases) {
    if ((unsafeConsoleUsages(testCase.source).length > 0) !== testCase.unsafe) {
      throw new Error(`Map privacy console guard failed its self-test: ${testCase.source}`);
    }
  }
}

function sourceFiles(target) {
  if (fs.statSync(target).isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [child] : [];
  });
}

const violations = [];
verifyGuardContract();
for (const file of targets.flatMap(sourceFiles)) {
  const source = fs.readFileSync(file, "utf8");
  for (const forbiddenApi of forbiddenApis) {
    if (source.includes(forbiddenApi)) {
      violations.push(`${path.relative(mobileRoot, file)} uses ${forbiddenApi}`);
    }
  }

  const unsafeUsages = unsafeConsoleUsages(source, file);
  if (unsafeUsages.length > 0) {
    violations.push(
      ...unsafeUsages.map((usage) => `${path.relative(mobileRoot, file)}:${usage}`),
    );
  }
}

if (violations.length > 0) {
  console.error("EcoTrack mobile map privacy verification failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("EcoTrack mobile map uses one-shot foreground location and payload-safe logging.");
}
