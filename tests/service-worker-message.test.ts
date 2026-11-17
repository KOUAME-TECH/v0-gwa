import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

describe.each(["sw.js", "OneSignalSDKWorker.js", "OneSignalSDKUpdaterWorker.js"])(
  "%s",
  (worker) => {
    it("enregistre le traitement de déconnexion pendant l'évaluation initiale", async () => {
      const listeners: Record<string, (event: any) => void> = {}
      const evaluationOrder: string[] = []
      const remove = vi.fn().mockResolvedValue(true)
      const caches = { keys: vi.fn().mockResolvedValue(["gwa-test"]), delete: remove }
      const self = {
        addEventListener: (name: string, handler: (event: any) => void) => {
          evaluationOrder.push(`listener:${name}`)
          listeners[name] = handler
        },
      }

      runInNewContext(readFileSync(resolve(process.cwd(), "public", worker), "utf8"), {
        self,
        caches,
        importScripts: () => evaluationOrder.push("importScripts"),
      })

      expect(listeners.message).toBeTypeOf("function")
      expect(evaluationOrder.indexOf("listener:message")).toBeLessThan(
        evaluationOrder.indexOf("importScripts"),
      )
      let pending: Promise<unknown> | undefined
      listeners.message({
        data: { type: "GWA_LOGOUT" },
        waitUntil: (promise: Promise<unknown>) => { pending = promise },
      })
      await pending
      expect(remove).toHaveBeenCalledWith("gwa-test")
    })
  },
)
