/**
 * Voice/text commands for energy mode and notes.
 * Run: npx tsx tests/day_commands.test.ts
 */
process.env.TZ = "Asia/Baku";
const g: any = globalThis;
const store = new Map<string, string>();
g.window = g.window || globalThis;
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
g.document = g.document || { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" };

let passed = 0;
let failed = 0;
function check(ok: boolean, msg: string) {
  if (ok) { passed++; process.stdout.write(`✅ [PASS] ${msg}\n`); }
  else { failed++; process.stdout.write(`❌ [FAIL] ${msg}\n`); }
}

async function main() {
  console.log = () => {};
  console.warn = () => {};
  const { intelligentRouter: R } = await import("../src/services/intelligentRouter");
  const { reminderService } = await import("../src/services/reminderService");
  const { isTiredToday } = await import("../src/services/energyMode");
  const { notesService } = await import("../src/services/notesService");
  await reminderService.waitUntilLoaded();

  const act = (p: string) => (R.evaluateLocalFastPath(p, []) as any);

  const tired = act("Bu gün yorğunam");
  check(tired.payload.action === "general_chat", "'Bu gün yorğunam' is a chat answer, not a reminder");
  check(isTiredToday(), "'Bu gün yorğunam' turns energy mode on for today");

  const note = act("Qeyd et: anamın ad günü üçün hədiyyə fikirləri");
  check(note.payload.action === "general_chat" && /Qeyd saxlandı/.test(note.payload.responseMessage), "'Qeyd et: ...' saves a note");
  check(notesService.list().some((n) => n.text.includes("hədiyyə")), "note is stored");
  check(!act("Qeyd et: sabah saat 10-da zəng et").payload.remindersToCreate, "a note with a time still does not become a reminder");

  const list = act("Qeydlərimi göstər");
  check(/hədiyyə/.test(list.payload.responseMessage), "'Qeydlərimi göstər' lists saved notes");

  const rem = act("Sabah saat 10-da zəng et");
  check(rem.payload.action === "create_reminder", "a normal reminder still works");
  check(!/^Qeyd/.test(rem.payload.responseMessage || ""), "normal reminder is not treated as a note");

  process.stdout.write(`\nTEST SUMMARY: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  process.stdout.write(`Test crashed: ${e?.stack || e}\n`);
  process.exit(1);
});
