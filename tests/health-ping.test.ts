import { describe, it, expect } from "vitest"
import { GET } from "@/app/api/health/ping/route"

describe("GET /api/health/ping", () => {
  it("répond 200 avec mot-clé pong (UptimeRobot)", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ok")
    expect(body.ping).toBe("pong")
    expect(body.app).toBe("GWA Platform")
    expect(typeof body.ts).toBe("string")
  })
})
