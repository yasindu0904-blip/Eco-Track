const projectPackage = require("../package.json");
const metroPackage = require("metro/package.json");

const projectDependencies = {
  ...projectPackage.dependencies,
  ...projectPackage.devDependencies,
};

if (projectDependencies["image-size"]) {
  throw new Error("EcoTrack must not directly install the vulnerable image-size parser package.");
}

if (metroPackage.dependencies?.["image-size"]) {
  throw new Error("The installed Metro release still exposes the vulnerable image-size parser package.");
}

console.log("Metro image security: image-size parsers are not installed or reachable.");
