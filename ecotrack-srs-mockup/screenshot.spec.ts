import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const BASE_URL = 'http://127.0.0.1:5173'
const OUTPUT_DIR = path.join(process.cwd(), 'output', 'screenshots')

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

test.describe('EcoTrack SRS Screenshots', () => {
  // Mobile screens (390 x 844)
  const mobileScreens = [
    { path: '/01-magic-link-login', name: '01-magic-link-login.png' },
    { path: '/02-citizen-volunteer-map', name: '02-citizen-volunteer-map.png' },
    { path: '/03-incident-reporting', name: '03-incident-reporting.png' },
    { path: '/04-cleanup-event-details', name: '04-cleanup-event-details.png' },
    { path: '/05-multiday-availability', name: '05-multiday-availability.png' },
  ]

  // Desktop screens (1440 x 1000)
  const desktopScreens = [
    { path: '/06-organization-dashboard', name: '06-organization-dashboard.png' },
    { path: '/07-incident-event-scheduling', name: '07-incident-event-scheduling.png' },
    { path: '/08-super-admin-verification', name: '08-super-admin-verification.png' },
  ]

  // Mobile screenshots
  mobileScreens.forEach((screen) => {
    test(`Screenshot: ${screen.name}`, async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 390, height: 844 })

      // Navigate to the screen
      await page.goto(`${BASE_URL}${screen.path}`, { waitUntil: 'networkidle' })

      // Wait a bit for any animations/renders
      await page.waitForTimeout(500)

      // Take screenshot
      const outputPath = path.join(OUTPUT_DIR, screen.name)
      await page.screenshot({
        path: outputPath,
        fullPage: true,
      })

      console.log(`✓ Screenshot saved: ${outputPath}`)

      // Verify file was created
      const fileExists = fs.existsSync(outputPath)
      expect(fileExists).toBe(true)
    })
  })

  // Desktop screenshots
  desktopScreens.forEach((screen) => {
    test(`Screenshot: ${screen.name}`, async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1440, height: 1000 })

      // Navigate to the screen
      await page.goto(`${BASE_URL}${screen.path}`, { waitUntil: 'networkidle' })

      // Wait a bit for any animations/renders
      await page.waitForTimeout(500)

      // Take screenshot
      const outputPath = path.join(OUTPUT_DIR, screen.name)
      await page.screenshot({
        path: outputPath,
        fullPage: true,
      })

      console.log(`✓ Screenshot saved: ${outputPath}`)

      // Verify file was created
      const fileExists = fs.existsSync(outputPath)
      expect(fileExists).toBe(true)
    })
  })
})
