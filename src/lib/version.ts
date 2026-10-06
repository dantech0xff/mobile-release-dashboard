import fs from "fs";
import path from "path";

export type BumpResult = {
  versionNameBefore: string;
  versionNameAfter: string;
  versionCodeBefore: number;
  versionCodeAfter: number;
  file: string;
};

function bumpSemver(name: string, scheme: string): string {
  const m = name.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!m) return name;
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const suffix = m[4] || "";
  if (scheme === "minor") return `${major}.${minor + 1}.0${suffix}`;
  if (scheme === "major") return `${major + 1}.0.0${suffix}`;
  return `${major}.${minor}.${patch + 1}${suffix}`; // patch (default)
}

const GRADLE_CANDIDATES = [
  "app/build.gradle.kts",
  "app/build.gradle",
  "android/app/build.gradle.kts",
  "android/app/build.gradle",
];

function findGradleFile(ws: string, configured: string | null): string {
  if (configured) {
    const p = path.join(ws, configured);
    if (fs.existsSync(p)) return p;
    throw new Error(`Configured gradle file not found: ${configured}`);
  }
  for (const rel of GRADLE_CANDIDATES) {
    const p = path.join(ws, rel);
    if (fs.existsSync(p) && /versionCode/.test(fs.readFileSync(p, "utf8"))) return p;
  }
  throw new Error(
    `No gradle file with versionCode found (tried: ${GRADLE_CANDIDATES.join(", ")})`
  );
}

// Bumps versionCode (+1) and versionName (per scheme) in an Android Gradle build file.
function bumpGradle(ws: string, gradleFile: string | null, scheme: string): BumpResult {
  const file = findGradleFile(ws, gradleFile);
  const rel = path.relative(ws, file);
  let content = fs.readFileSync(file, "utf8");

  const codeRe = /versionCode\s*=?\s*(\d+)/;
  const nameRe = /versionName\s*=?\s*"([^"]+)"/;
  const codeM = content.match(codeRe);
  const nameM = content.match(nameRe);
  if (!codeM) throw new Error(`versionCode not found in ${rel}`);

  const codeBefore = Number(codeM[1]);
  const codeAfter = codeBefore + 1;
  content = content.replace(codeRe, `versionCode = ${codeAfter}`);

  let nameBefore = "";
  let nameAfter = "";
  if (nameM) {
    nameBefore = nameM[1];
    nameAfter = scheme === "build-only" ? nameBefore : bumpSemver(nameBefore, scheme);
    content = content.replace(nameRe, `versionName = "${nameAfter}"`);
  }

  fs.writeFileSync(file, content);
  return {
    versionNameBefore: nameBefore,
    versionNameAfter: nameAfter,
    versionCodeBefore: codeBefore,
    versionCodeAfter: codeAfter,
    file: rel,
  };
}

// Bumps `version: x.y.z+build` in pubspec.yaml.
function bumpPubspec(ws: string, scheme: string): BumpResult {
  const file = path.join(ws, "pubspec.yaml");
  if (!fs.existsSync(file)) throw new Error("pubspec.yaml not found at repo root");
  let content = fs.readFileSync(file, "utf8");
  const re = /^version:\s*(\d+\.\d+\.\d+[^+\s]*)\+(\d+)\s*$/m;
  const m = content.match(re);
  if (!m) throw new Error("version line `x.y.z+build` not found in pubspec.yaml");

  const nameBefore = m[1];
  const codeBefore = Number(m[2]);
  const codeAfter = codeBefore + 1;
  const nameAfter = scheme === "build-only" ? nameBefore : bumpSemver(nameBefore, scheme);
  content = content.replace(re, `version: ${nameAfter}+${codeAfter}`);
  fs.writeFileSync(file, content);
  return {
    versionNameBefore: nameBefore,
    versionNameAfter: nameAfter,
    versionCodeBefore: codeBefore,
    versionCodeAfter: codeAfter,
    file: "pubspec.yaml",
  };
}

export function bumpProject(
  ws: string,
  type: "android-kotlin" | "flutter",
  gradleFile: string | null,
  scheme: string
): BumpResult {
  if (type === "flutter") return bumpPubspec(ws, scheme);
  return bumpGradle(ws, gradleFile, scheme);
}
