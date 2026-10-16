/**
 * Tests for the on-device sentence parser (intelligentRouter) and for how
 * reminders are turned into native notifications.
 * Run: npx tsx tests/router_and_notifications.test.ts
 */
process.env.TZ = process.env.TZ || "Asia/Baku";

// Minimal browser globals so the services can load under Node.
const store = new Map<string, string>();
const g = globalThis as any;
g.window = g.window || globalThis;
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
g.document = g.document || { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" };
g.Notification = g.Notification || { permission: "denied", requestPermission: async () => "denied" };

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    process.stdout.write(`✅ [PASS] ${message}\n`);
  } else {
    failed++;
    process.stdout.write(`❌ [FAIL] ${message}\n`);
  }
}

async function main() {
  // The services log a lot; keep the test output readable.
  console.log = () => {};
  console.warn = () => {};
  const section = (t: string) => process.stdout.write(`\n--- ${t} ---\n`);
  const { intelligentRouter: R, findTargetReminder, hasExplicitCreateVerb } = await import(
    "../src/services/intelligentRouter"
  );
  const { reminderService } = await import("../src/services/reminderService");
  const { CapacitorLocalNotificationProvider } = await import(
    "../src/services/notificationProvider/CapacitorLocalNotificationProvider"
  );
  await reminderService.waitUntilLoaded();

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000).toISOString();
  const existing: any[] = ["Hesabatı tamamla", "Evi təmizlə", "Anara zəng et", "İclas"].map((title, i) => ({
    id: `t${i}`,
    title,
    dueDateTime: tomorrow,
    category: "other",
    recurrence: "none",
    priority: "medium",
    isCompleted: false,
    createdAt: now.toISOString(),
    notificationEnabled: true,
  }));

  const evalP = (p: string) => R.evaluateLocalFastPath(p, existing);

  section("Daily schedule day words (\\b is ASCII-only; Azerbaijani letters need Unicode edges)");
  {
    const dayLabelOf = (p: string) => String((evalP(p) as any)?.payload?.responseMessage ?? "").split(" (")[0];
    assert(dayLabelOf("Sabahkı planımı göstər") === "Sabah", "'Sabahkı planımı göstər' → tomorrow (Sabah), not today");
    assert(dayLabelOf("sabahki planlarım") === "Sabah", "'sabahki planlarım' (no dotless ı) → Sabah");
    assert(dayLabelOf("Birigünkü planlarım") === "Birigün", "'Birigünkü planlarım' → Birigün");
    assert(dayLabelOf("Bugünkü planımı göstər") === "Bu gün", "'Bugünkü planımı göstər' → Bu gün");
  }

  section("Past times are never saved as reminders");
  {
    const isRefused = (p: string) => (evalP(p) as any)?.payload?.action === "clarification_needed";
    const createdDue = (p: string) => (evalP(p) as any)?.payload?.remindersToCreate?.[0]?.dueDateTime;
    assert(isRefused("Dünən saat 10-da zəng et"), "'Dünən saat 10-da zəng et' is refused (yesterday)");
    assert(!isRefused("Saat 10-da zəng et") && new Date(createdDue("Saat 10-da zəng et")).getTime() > Date.now(), "time-only past hour rolls to a future time");
  }
  const first = (p: string) => evalP(p).payload.remindersToCreate?.[0];
  const local = (iso: string) => new Date(iso);

  section("Destructive commands must not fire by accident");
  assert(evalP("Sabah hesabatı tamamlamağı xatırlat").payload.action === "create_reminder",
    "'hesabatı tamamlamağı xatırlat' creates a reminder (did not complete 'Hesabatı tamamla')");
  assert(evalP("Sabah evi təmizləmək işini xatırlat").payload.action === "create_reminder",
    "'evi təmizləmək işini xatırlat' creates a reminder (did not DELETE 'Evi təmizlə')");
  assert(evalP("Xatırlatmanı silmə").payload.action !== "delete_reminder" || !evalP("Xatırlatmanı silmə").payload.targetReminderId,
    "'silmə' (don't delete) never deletes");
  assert(evalP("Anara zəng xatırlatmasını sil").payload.targetReminderId === "t2", "delete targets the named reminder");
  assert(evalP("İclası 30 dəqiqə gecikdir").payload.targetReminderId === "t3",
    "snooze targets the named reminder (İ/ı and suffix tolerant)");
  assert(findTargetReminder("telefonu sil", existing) === null, "no match -> no target (never 'first in list')");

  section("Reminder parsing");
  const rel = first("2 saat sonra su içməyi xatırlat");
  assert(!!rel && Math.abs(local(rel.dueDateTime).getTime() - (now.getTime() + 2 * 3600000)) < 120000,
    "'2 saat sonra' = now + 2h (was tomorrow 10:00)");
  assert(rel?.title === "Su iç", `title 'Su iç' (got '${rel?.title}')`);
  assert(first("Sabah saat 10-da Anara zəng etməyi xatırlat")?.title === "Anara zəng et", "title keeps the verb: 'Anara zəng et'");
  assert(hasExplicitCreateVerb("süd almağı əlavə et"), "'əlavə et' is recognised as a create verb");
  assert(evalP("Bu gün evdə nə edək?").payload.action !== "create_reminder", "a question does not create a reminder");
  assert(evalP("Unutma AI, sabah nə var?").payload.action === "get_daily_schedule", "app name 'Unutma AI' is not a create verb");

  const mon = first("Bazar ertəsi saat 9-da iclas");
  assert(!!mon && local(mon.dueDateTime).getDay() === 1 && local(mon.dueDateTime).getHours() === 9, "'Bazar ertəsi saat 9-da' -> Monday 09:00");
  const thu = first("Cümə axşamı saat 10-da dostla görüş");
  assert(!!thu && local(thu.dueDateTime).getDay() === 4 && local(thu.dueDateTime).getHours() === 10,
    "'Cümə axşamı saat 10-da' -> Thursday 10:00 (not 22:00)");
  const bazar = first("Bazardan çörək almağı xatırlat");
  assert(!!bazar && local(bazar.dueDateTime).getTime() - now.getTime() < 2 * 86400000, "'bazardan' (market) is not Sunday");
  const dom = first("ayın 20-də kirayəni ödəməyi xatırlat");
  assert(!!dom && local(dom.dueDateTime).getDate() === 20 && local(dom.dueDateTime).getHours() === 10,
    "'ayın 20-də' -> the 20th at 10:00 (not 20:00 today)");
  const multi = evalP("Sabah saat 10-da iclas var, cümə günü saat 3-də həkim").payload.remindersToCreate || [];
  assert(multi.length === 2 && local(multi[1].dueDateTime).getDay() === 5, "second segment's weekday wins: 'cümə günü' -> Friday");

  section("Native notifications (iOS/Android)");
  const provider: any = new CapacitorLocalNotificationProvider();
  const at = (days: number, h: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };
  const base = { isCompleted: false, notificationEnabled: true, category: "other", priority: "medium", createdAt: "" };
  // Next time the clock shows h:00 (today or tomorrow), optionally on a weekday (Mon–Fri)
  const nextAt = (h: number, weekdayOnly = false) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    while (d.getTime() <= Date.now() || (weekdayOnly && (d.getDay() === 0 || d.getDay() === 6))) d.setDate(d.getDate() + 1);
    return d.toISOString();
  };
  const daily = provider.buildNotifications({ ...base, id: "d", title: "D", dueDateTime: nextAt(9), recurrence: "daily" });
  assert(daily.length === 1 && daily[0].schema.schedule.on?.hour === 9 && !daily[0].schema.schedule.at,
    "daily uses a calendar repeat (on: 09:00), not at+repeats (which repeats every (at-now) ms)");
  const weekdays = provider.buildNotifications({ ...base, id: "w", title: "W", dueDateTime: nextAt(8, true), recurrence: "weekdays", recurrenceInterval: 1, recurrenceUnit: "day" });
  assert(weekdays.length === 5, "weekdays -> 5 weekly calendar repeats (Mon–Fri)");
  const custom = provider.buildNotifications({ ...base, id: "c", title: "C", dueDateTime: at(-5, 10), recurrence: "custom", recurrenceInterval: 3, recurrenceUnit: "day" });
  assert(custom.length === 3 && custom.every((n: any) => new Date(n.schema.schedule.at).getTime() > Date.now()),
    "every 3 days -> next 3 future occurrences");
  const past = provider.buildNotifications({ ...base, id: "p", title: "P", dueDateTime: at(-1, 9), recurrence: "none" });
  assert(past.length === 0, "past one-time reminder is not scheduled");

  process.stdout.write(`\nTEST SUMMARY: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  process.stdout.write(`Test crashed: ${e?.stack || e}\n`);
  process.exit(1);
});
