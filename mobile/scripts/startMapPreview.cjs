const { spawn } = require("node:child_process");

const expoCli = require.resolve("expo/bin/cli");
const child = spawn(
  process.execPath,
  [expoCli, "start", "--dev-client", "--clear"],
  {
    env: {
      ...process.env,
      EXPO_PUBLIC_MAP_PREVIEW: "true",
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
