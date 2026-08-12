require("../metro.config.js");

const imageSize = require("image-size");

function writeUInt32BE(buffer, offset, value) {
  buffer.writeUInt32BE(value, offset);
}

const icns = Buffer.alloc(16);
icns.write("icns", 0);
writeUInt32BE(icns, 4, 16);
icns.write("ic07", 8);
writeUInt32BE(icns, 12, 0);

const heif = Buffer.alloc(16);
writeUInt32BE(heif, 0, 16);
heif.write("ftyp", 4);
heif.write("avif", 8);

const jxl = Buffer.alloc(24);
writeUInt32BE(jxl, 0, 12);
jxl.write("JXL ", 4);
writeUInt32BE(jxl, 12, 12);
jxl.write("ftyp", 16);
jxl.write("jxl ", 20);

const affectedInputs = [
  ["icns", icns],
  ["heif", heif],
  ["jxl", jxl],
];

for (const [type, input] of affectedInputs) {
  try {
    imageSize(input);
    throw new Error(`${type} input reached its image parser.`);
  } catch (error) {
    if (!error.message.includes(`disabled file type: ${type}`)) {
      throw error;
    }

    console.log(`${type}: safely disabled`);
  }
}
