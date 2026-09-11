import { spawn } from "child_process";

async function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process ${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function main() {
  console.log("==================================================");
  console.log("STARTING FULL UNUTMA AI TEST SUITE");
  console.log("==================================================\n");

  try {
    console.log(">>> Running OpenAI Migration Tests...");
    await runCommand("npx", ["tsx", "tests/openai_migration.test.ts"]);

    console.log("\n>>> Running Audio Transcription Tests...");
    await runCommand("npx", ["tsx", "tests/transcription.test.ts"]);

    console.log("\n==================================================");
    console.log("ALL TESTS COMPLETED SUCCESSFULLY");
    console.log("==================================================");
  } catch (err: any) {
    console.error("\nTest suite failed:", err.message || err);
    process.exit(1);
  }
}

main();
