import { describe, expect, it, beforeEach, afterEach } from "vitest"
import {
  hasAfricasTalkingProvider,
  hasAfricasTalkingSenderId,
  isAfricasTalkingLiveUsername,
} from "@/lib/auth/sms"

describe("Africa's Talking config flags", () => {
  const keys = [
    "AT_API_KEY",
    "AT_USERNAME",
    "AT_SENDER_ID",
    "AT_SANDBOX",
    "AFRICASTALKING_API_KEY",
    "AFRICASTALKING_USERNAME",
  ]
  const prev: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of keys) {
      prev[k] = process.env[k]
      delete process.env[k]
    }
  })
  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k]
      else process.env[k] = prev[k]
    }
  })
  it("detects live username vs sandbox", () => {
    process.env.AT_USERNAME = "sandbox"
    expect(isAfricasTalkingLiveUsername()).toBe(false)
    process.env.AT_USERNAME = "gwaCorp"
    expect(isAfricasTalkingLiveUsername()).toBe(true)
  })
  it("detects key and sender", () => {
    expect(hasAfricasTalkingProvider()).toBe(false)
    process.env.AT_API_KEY = "key"
    expect(hasAfricasTalkingProvider()).toBe(true)
    expect(hasAfricasTalkingSenderId()).toBe(false)
    process.env.AT_SENDER_ID = "GWA"
    expect(hasAfricasTalkingSenderId()).toBe(true)
  })
})
