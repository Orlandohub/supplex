import { db } from "@supplex/db";
import { processInstance, stepInstance, taskInstance, formSubmission } from "@supplex/db";
import { eq } from "drizzle-orm";

const processId = "28731ccb-254b-4b52-87e0-6878a3f155bd";

async function main() {
  const [proc] = await db.select().from(processInstance).where(eq(processInstance.id, processId));
  console.log("PROCESS:", JSON.stringify({ status: proc.status, currentStepInstanceId: proc.currentStepInstanceId, completedSteps: proc.completedSteps, totalSteps: proc.totalSteps }, null, 2));

  const steps = await db.select().from(stepInstance).where(eq(stepInstance.processInstanceId, processId));
  steps.sort((a, b) => a.stepOrder - b.stepOrder);
  for (const s of steps) {
    console.log(`STEP ${s.stepOrder} ${s.stepName}:`, JSON.stringify({ id: s.id, status: s.status, stepType: s.stepType, completedDate: s.completedDate, validationRound: s.validationRound }));
  }

  const step3 = steps.find(s => s.stepOrder === 3);
  if (step3) {
    const tasks = await db.select().from(taskInstance).where(eq(taskInstance.stepInstanceId, step3.id));
    console.log("\nTASKS FOR STEP 3:");
    for (const t of tasks) {
      console.log(JSON.stringify({ id: t.id.slice(0, 8), taskType: t.taskType, status: t.status, outcome: t.outcome, assigneeRole: t.assigneeRole, assigneeUserId: t.assigneeUserId?.slice(0, 8), validationRound: t.validationRound, completedAt: t.completedAt }));
    }

    const forms = await db.select().from(formSubmission).where(eq(formSubmission.stepInstanceId, step3.id));
    console.log("\nFORM SUBMISSIONS FOR STEP 3:");
    for (const f of forms) {
      console.log(JSON.stringify({ id: f.id.slice(0, 8), status: f.status, submittedAt: f.submittedAt }));
    }
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
