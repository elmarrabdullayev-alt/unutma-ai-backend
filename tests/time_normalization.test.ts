import {
  extractSingleExplicitTime,
  normalizeDueDateTimeForTimezone,
} from "../src/server/timeNormalization";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`✅ [PASS] ${message}`);
  } else {
    failed++;
    console.log(`❌ [FAIL] ${message}`);
  }
}

function t(text: string) {
  const r = extractSingleExplicitTime(text);
  return r ? `${String(r.hour).padStart(2, "0")}:${String(r.minute).padStart(2, "0")}` : null;
}

console.log("\n--- extractSingleExplicitTime ---");
assert(t("Sabah saat 10-da Anara zəng et") === "10:00", "'saat 10-da' -> 10:00");
assert(t("axşam 8-də dərmanı al") === "20:00", "'axşam 8-də' -> 20:00");
assert(t("günorta saat 2-də iclas") === "14:00", "'günorta saat 2' -> 14:00");
assert(t("gecə 1-də yat") === "01:00", "'gecə 1' -> 01:00");
assert(t("gecə saat 10-da") === "22:00", "'gecə saat 10' -> 22:00");
assert(t("sabah 14:30 görüş") === "14:30", "'14:30' -> 14:30");
assert(t("səhər 7:15 idman") === "07:15", "'səhər 7:15' -> 07:15");

// Durations / intervals are NOT clock times
assert(t("2 saat sonra xatırlat") === null, "'2 saat sonra' is a duration, not 02:00");
assert(t("30 dəqiqə sonra su iç") === null, "'30 dəqiqə sonra' is ignored");
assert(t("hər 3 gündən bir saat 10:00 iclasım var") === "10:00", "'hər 3 gündən bir saat 10:00' -> 10:00, not 03:00");
assert(t("ayın 15-də kirayəni ödə") === null, "'ayın 15-də' is a date, not 15:00");

// Several different times -> unknown which belongs to which reminder
assert(
  t("Sabah saat 10-da Anara zəng et, günorta 2-də maşını ustaya apar, axşam dərmanı al") === null,
  "multi-time sentence returns null (no single time forced on every reminder)"
);

console.log("\n--- normalizeDueDateTimeForTimezone (Asia/Baku, UTC+4) ---");
// Model returned 10:00 UTC (= 14:00 Baku) but the user said "saat 10"
assert(
  normalizeDueDateTimeForTimezone("2026-10-15T10:00:00.000Z", "Sabah saat 10-da zəng et", "Asia/Baku") ===
    "2026-10-15T06:00:00.000Z",
  "10:00 UTC corrected to 10:00 Baku (06:00 UTC)"
);
// Already correct -> unchanged
assert(
  normalizeDueDateTimeForTimezone("2026-10-15T06:00:00.000Z", "Sabah saat 10-da zəng et", "Asia/Baku") ===
    "2026-10-15T06:00:00.000Z",
  "already-correct time is left unchanged"
);
// "2 saat sonra" must keep the model's relative time
const relative = "2026-10-14T07:00:00.000Z";
assert(
  normalizeDueDateTimeForTimezone(relative, "2 saat sonra xatırlat", "Asia/Baku") === relative,
  "'2 saat sonra' keeps the model's relative time"
);

console.log(`\nTEST SUMMARY: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
