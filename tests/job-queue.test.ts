import { describe, it, expect } from "vitest"
import {
  enqueueChatJob,
  dequeueChatJob,
  chatQueueDepth,
} from "@/lib/security/job-queue"

describe("chat job queue (memory fallback)", () => {
  it("enqueue / dequeue FIFO sans Upstash", async () => {
    const a = await enqueueChatJob("ai_advice", { q: "prix" })
    expect(a.ok).toBe(true)
    expect(a.backend).toBe("memory")
    const depth = await chatQueueDepth("ai_advice")
    expect(depth).toBeGreaterThanOrEqual(1)
    const job = await dequeueChatJob("ai_advice")
    expect(job?.kind).toBe("ai_advice")
    expect(job?.payload.q).toBe("prix")
  })
})
