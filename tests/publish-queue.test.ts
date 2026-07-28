import { describe, expect, it, beforeEach } from "vitest"
import "fake-indexeddb/auto"
import {
  enqueuePublish,
  listPublishQueue,
  removePublishQueueItem,
} from "@/lib/offline/publish-queue"

describe("publish-queue offline", () => {
  beforeEach(async () => {
    const items = await listPublishQueue("user-1")
    for (const i of items) await removePublishQueueItem(i.id)
  })

  it("enqueue et list par user", async () => {
    await enqueuePublish("user-1", "product", {
      name: "Cacao",
      price: 1000,
      ville: "Abidjan",
      origin_country: "CI",
      category_id: "cat",
    })
    await enqueuePublish("user-2", "post", { content: "Hello" })
    const mine = await listPublishQueue("user-1")
    expect(mine).toHaveLength(1)
    expect(mine[0].kind).toBe("product")
    expect(mine[0].payload.name).toBe("Cacao")
  })

  it("remove item", async () => {
    const item = await enqueuePublish("user-1", "post", { content: "x" })
    await removePublishQueueItem(item.id)
    expect(await listPublishQueue("user-1")).toHaveLength(0)
  })
})
