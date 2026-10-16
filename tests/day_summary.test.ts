/**
 * Deterministic day helpers: urgency labels, end-of-day summary,
 * morning briefing and energy mode.
 * Run: npx tsx tests/day_summary.test.ts
 */
process.env.TZ = "Asia/Baku";
import { getUrgency, sortByUrgency, buildDaySummary, buildMorningBriefing, planForEnergy } from "../src/services/daySummary";
import type { Reminder } from "../src/types";

let passed = 0;
let failed = 0;
function check(ok: boolean, msg: string) {
  if (ok) { passed++; process.stdout.write(`✅ [PASS] ${msg}\n`); }
  else { failed++; process.stdout.write(`❌ [FAIL] ${msg}\n`); }
}

const now = new Date(2026, 9, 16, 9, 0, 0); // 16 Oct 2026, 09:00 local (Baku)
const at = (h: number, m = 0, dayOffset = 0) => new Date(2026, 9, 16 + dayOffset, h, m).toISOString();
let n = 0;
function rem(over: Partial<Reminder>): Reminder {
  return {
    id: `r${++n}`, title: "Tapşırıq", dueDateTime: at(12), category: "personal", recurrence: "none",
    priority: "medium", isCompleted: false, createdAt: now.toISOString(), ...over,
  } as Reminder;
}

// Urgency
check(getUrgency(rem({ priority: "high", dueDateTime: at(10) }), now) === "urgent", "high priority within 2h → Təcili");
check(getUrgency(rem({ priority: "high", dueDateTime: at(18) }), now) === "important", "high priority later → Vacib");
check(getUrgency(rem({ priority: "low" }), now) === "later", "low priority → Gözləyə bilər");
const sorted = sortByUrgency([rem({ title: "A", priority: "low" }), rem({ title: "B", priority: "high", dueDateTime: at(10) })], now);
check(sorted[0].title === "B", "urgent item sorted first");

// End-of-day summary
const today = [
  rem({ isCompleted: true }), rem({ isCompleted: true }), rem({ isCompleted: true }),
  rem({ isCompleted: true }), rem({ isCompleted: true }), rem({}), rem({}),
];
const s = buildDaySummary(today, now);
check(s.total === 7 && s.done === 5 && s.leftover === 2, "7 tasks, 5 done, 2 leftover");
check(s.message === "Bu gün 7 işdən 5 tamamladın, 2 iş sabaha qaldı.", `summary message: "${s.message}"`);
check(buildDaySummary([], now).message === "Bu gün üçün plan yox idi.", "empty day message");
check(buildDaySummary(today.filter((r) => r.isCompleted), now).message.includes("hamısını"), "all done message");

// Morning briefing
const morning = [
  rem({ category: "work", title: "Layihə görüşü", dueDateTime: at(11) }),
  rem({ title: "Kirayə ödə", dueDateTime: at(13) }),
  rem({ title: "Həkimə zəng", dueDateTime: at(15) }),
  rem({ title: "Görüş Anara", dueDateTime: at(16) }),
  rem({ title: "Sabahkı iş", dueDateTime: at(9, 0, 1) }),
];
const b = buildMorningBriefing(morning, now, 1);
check(b.meetings === 2 && b.tasks === 2 && b.routines === 1, "2 meetings, 2 tasks, 1 routine (tomorrow excluded)");
check(b.message === "Bu gün 2 görüşün, 2 tapşırığın, 1 rutin var.", `briefing message: "${b.message}"`);
check(buildMorningBriefing([], now, 0).message.includes("boşdur"), "empty briefing message");

// Energy mode
const work = rem({ title: "Hesabat", category: "work", priority: "high", dueDateTime: at(10) });
const light = rem({ title: "Su iç", priority: "low", dueDateTime: at(14) });
const plan = planForEnergy([work, light], now, true);
check(plan.ordered[0].title === "Su iç", "tired: light task comes first");
check(plan.moveLater.length === 1 && plan.moveLater[0].title === "Hesabat", "tired: heavy task offered for later");
check(planForEnergy([work, light], now, false).ordered[0].title === "Hesabat", "normal: urgent task stays first");
check(planForEnergy([work, light], now, false).moveLater.length === 0, "normal: nothing is moved");

process.stdout.write(`\nTEST SUMMARY: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
