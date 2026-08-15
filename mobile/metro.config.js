const { getDefaultConfig } = require("expo/metro-config");
const { disableTypes } = require("image-size");

// image-size <= 2.0.2 has no patched upstream release for infinite-loop
// vulnerabilities in its ICNS, JXL, and HEIF parsers. EcoTrack does not use
// those formats, so prevent Metro from invoking the affected calculations.
disableTypes(["icns", "jxl", "heif"]);

module.exports = getDefaultConfig(__dirname);
