const json = require("../package.json");
const fs = require("fs");
fs.writeFileSync(
  "src/version.ts",
  "export const ONLINE_PYTHON_VERSION_WITHOUT_V = " +
    JSON.stringify(json.version) +
    ";\n"
);
console.log("Version copied to src/version.ts");
