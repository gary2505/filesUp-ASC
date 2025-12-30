import { runBootFlow } from "../src/taskFlow/flows/bootFlow";

async function runTests() {
  console.log("🧪 Running contract tests...\n");

  try {
    await runBootFlow("0.0.1");
    console.log("✅ All contracts passed!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Contract test failed:", err);
    process.exit(1);
  }
}

runTests();
