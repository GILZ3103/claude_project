import { chromium } from 'playwright'

const BASE = 'http://localhost:5175'
const UID = 'USER-WDT1ZY0K'
const PASS = '1234567890'
const SCREENSHOTS = []

async function shot(page, name) {
  const path = `verify_${name}.png`
  await page.screenshot({ path, fullPage: false })
  SCREENSHOTS.push(path)
  console.log(`📸 ${name}: ${path}`)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(10000)

  console.log('\n=== STEP 1: Login ===')
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')
  await shot(page, '01_login_page')

  const uidInput = await page.$('input[placeholder*="UID"], input[placeholder*="uid"], input[type="text"]')
  const passInput = await page.$('input[type="password"]')
  if (!uidInput || !passInput) {
    console.error('❌ Login form not found')
    await shot(page, '01_login_fail')
    await browser.close()
    return
  }
  await uidInput.fill(UID)
  await passInput.fill(PASS)
  await passInput.press('Enter')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  await shot(page, '02_after_login')
  console.log('✅ Logged in — URL:', page.url())

  console.log('\n=== STEP 2: Info page → Weight-Based Items button ===')
  await page.click('nav a:has-text("Info")')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  await shot(page, '03_info_page')

  const weightBtn = await page.$('button:has-text("Weight-Based")')
  if (!weightBtn) {
    console.error('❌ Weight-Based Items button not found on Info page')
  } else {
    console.log('✅ Weight-Based Items button found')
    await weightBtn.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    await shot(page, '04_menu_page')
    console.log('✅ Navigated to menu — URL:', page.url())
  }

  console.log('\n=== STEP 3: Add weight-based item on Menu page ===')
  const addBtn = await page.$('button:has-text("Add Item")')
  if (!addBtn) {
    console.error('❌ + Add Item button not found')
    await shot(page, '04_menu_no_add')
  } else {
    await addBtn.click()
    await page.waitForTimeout(500)
    await shot(page, '05_add_item_form')

    const nameInput = await page.$('input[placeholder="Item name"]')
    const calInput = await page.$('input[placeholder*="Calories per 100g"]')
    const priceInput = await page.$('input[placeholder*="Price per 100g"]')

    if (nameInput && calInput && priceInput) {
      await nameInput.fill('Kacang Putih Pao Pao')
      await calInput.fill('200')
      await priceInput.fill('8.50')
      await shot(page, '06_form_filled')

      const saveBtn = await page.$('button[type="submit"]:has-text("Save")')
      await saveBtn.click()
      await page.waitForTimeout(1500)
      await shot(page, '07_after_save')
      console.log('✅ Weight-based item submitted')
    } else {
      console.error('❌ Form fields not found')
      await shot(page, '05_form_missing')
    }
  }

  console.log('\n=== STEP 4: Settings → Terminal Calibration ===')
  await page.click('nav a:has-text("Settings")')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  await shot(page, '08_settings_page')

  const calBtn = await page.$('button:has-text("Terminal Calibration")')
  if (!calBtn) {
    console.error('❌ Terminal Calibration button not found')
  } else {
    console.log('✅ Terminal Calibration button found')
    await calBtn.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    await shot(page, '09_calibration_page')
    console.log('✅ Navigated to calibration — URL:', page.url())

    console.log('\n=== STEP 5: Save calibration values ===')
    const sfInput = await page.$('input[placeholder*="0.004132"]')
    const toInput = await page.$('input[placeholder*="1024"]')

    if (sfInput && toInput) {
      await sfInput.fill('0.004132')
      await toInput.fill('1024')
      await shot(page, '10_calibration_filled')

      const saveCalBtn = await page.$('button[type="submit"]:has-text("Save Calibration")')
      await saveCalBtn.click()
      await page.waitForTimeout(1500)
      await shot(page, '11_calibration_saved')
      console.log('✅ Calibration save submitted')

      console.log('\n=== STEP 6: Probe — negative scale_factor should be blocked ===')
      await sfInput.fill('-1')
      await saveCalBtn.click()
      await page.waitForTimeout(800)
      await shot(page, '12_probe_negative_sf')
      const bodyText = await page.textContent('body')
      console.log('🔍 Negative scale_factor probe:', bodyText.includes('positive') ? '✅ blocked by validation' : '⚠️  no client-side block detected')
    } else {
      console.error('❌ Calibration form inputs not found')
      await shot(page, '10_calibration_inputs_missing')
    }
  }

  await browser.close()
  console.log('\n📋 All screenshots:', SCREENSHOTS.join(', '))
}

run().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
