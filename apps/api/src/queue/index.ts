/**
 * Queue System Exports
 *
 * Email notification queue and worker using BullMQ
 */

export { emailQueue, queueEmailJob, closeEmailQueue } from "./email-queue";
export type { EmailJobData } from "./email-queue";
export { emailWorker, closeEmailWorker } from "./email-worker";
export {
  redisConnection,
  isRedisEnabled,
  closeRedisConnection,
} from "./redis-connection";
