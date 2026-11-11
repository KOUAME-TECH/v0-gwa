import { expect, test } from "@playwright/test"

test("un compte connecté voit son nom sur /profil", async ({ page }) => {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!email || !password) {
    throw new Error("E2E_EMAIL et E2E_PASSWORD sont requis")
  }

  await page.goto("/auth/login?redirect=/profil")
  await page.getByRole("tab", { name: "Email" }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Mot de passe").fill(password)
  await page.getByRole("button", { name: "Se connecter" }).click()

  await page.waitForURL(/\/profil(?:\?|$)/)
  await expect(page.getByRole("heading", { name: "Connectez-vous" })).toHaveCount(0)
  await expect(page.getByText("Connectez-vous", { exact: true })).toHaveCount(0)

  const name = page.getByTestId("profile-name")
  await expect(name).toBeVisible()
  await expect(name).not.toHaveText("")
  await expect(name).not.toHaveText("Connectez-vous")
})
