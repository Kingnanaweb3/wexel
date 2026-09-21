// For each vulnerable package, find the newest version that is NOT affected
// and stays on the SAME major version (same minor for 0.x), so nothing that
// depends on it breaks. Prints a plan; with --apply, writes npm overrides.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const semver = require(process.env.SEMVER_PATH);

const run = (cmd) => {
  try { return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString(); }
  catch (e) { return e.stdout ? e.stdout.toString() : ""; }
};

const vulns = (JSON.parse(run("npm audit --json") || "{}").vulnerabilities) || {};
const plan = {};

for (const [name, v] of Object.entries(vulns)) {
  const ranges = v.via.filter((x) => typeof x === "object").map((x) => x.range);
  if (!ranges.length) continue; // only inherits another package's finding

  const installed = new Set();
  for (const n of v.nodes) {
    try { installed.add(JSON.parse(fs.readFileSync(path.join(n, "package.json"))).version); } catch {}
  }
  const inst = [...installed];
  if (inst.length !== 1) { console.log(`  ${name.padEnd(16)} skip — several versions installed (${inst.join(", ")})`); continue; }

  const cur = inst[0];
  const all = JSON.parse(run(`npm view ${name} versions --json`) || "[]");
  const compatible = all.filter((x) =>
    !semver.prerelease(x) &&
    !ranges.some((r) => semver.satisfies(x, r)) &&
    semver.major(x) === semver.major(cur) &&
    (semver.major(cur) !== 0 || semver.minor(x) === semver.minor(cur)) &&
    semver.gte(x, cur));

  const pick = compatible.sort(semver.rcompare)[0];
  if (pick) { plan[name] = pick; console.log(`  ${name.padEnd(16)} ${cur} -> ${pick}  (safe fix)`); }
  else console.log(`  ${name.padEnd(16)} ${cur}  no fix without a breaking upgrade`);
}

if (process.argv.includes("--apply") && Object.keys(plan).length) {
  const pkg = JSON.parse(fs.readFileSync("package.json"));
  pkg.overrides = { ...(pkg.overrides || {}), ...plan };
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
}
