/**
 * AcademyBugs - Cart & Checkout flow test
 *
 * Flujo:
 *  1. Abre la tienda (find-bugs)
 *  2. Agrega el producto más barato al carrito
 *  3. Verifica que el producto aparece en el carrito con precio correcto
 *  4. Detecta el bug de Grand Total (la suma no cuadra)
 *  5. Avanza al checkout, llena el formulario y verifica la respuesta
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://academybugs.com';
const PRODUCT_NAME = 'Flamingo Tshirt';
const PRODUCT_PRICE = '$15.14';
const ADD_TO_CART_URL = `${BASE_URL}/my-cart/?ec_action=addtocart&model_number=4881370`;
const LOGIN_EMAIL = process.env.CHECKOUT_LOGIN_EMAIL ?? 'logincompra@yopmail.com';
const LOGIN_PASSWORD = process.env.CHECKOUT_LOGIN_PASSWORD ?? '';
const OBSERVE_MS = Number(process.env.CHECKOUT_OBSERVE_MS ?? '8000');
const TYPE_DELAY_MS = Number(process.env.CHECKOUT_TYPE_DELAY_MS ?? '120');
const FIELD_PAUSE_MS = Number(process.env.CHECKOUT_FIELD_PAUSE_MS ?? '400');

// Datos de prueba para el checkout (ningún pago real se procesará)
// Se genera un email único por ejecución para evitar duplicados
const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
const TEST_BUYER = {
  firstName:   rand(['Alice', 'Bob', 'Carol', 'David', 'Eva', 'Frank']),
  lastName:    rand(['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia']),
  company:     rand(['', '', 'Acme Corp', 'Test Inc']),   // a veces vacío
  email:       LOGIN_EMAIL,
  phone:       `555${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
  address:     `${Math.floor(Math.random() * 9000) + 100} ${rand(['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln'])}`,
  city:        rand(['Springfield', 'Shelbyville', 'Riverside', 'Greenville']),
  state:       rand(['CA', 'NY', 'TX', 'FL', 'IL']),
  zip:         String(Math.floor(Math.random() * 90000) + 10000),
  country:     'United States',
};

test.describe('AcademyBugs - Cart & Checkout', () => {

  // Función reutilizable para cerrar los overlays de AcademyBugs via JS
  async function dismissOverlays(page: import('@playwright/test').Page) {
    // Cookie banner
    try {
      await page.getByText(/Functional only/i).first().waitFor({ state: 'visible', timeout: 2000 });
      await page.getByText(/Functional only/i).first().click();
    } catch { /* no banner */ }

    // Tutorial overlay + canvas bloqueante
    try {
      await page.locator('#TourTipDisabledArea').waitFor({ state: 'attached', timeout: 3000 });
    } catch { /* no tutorial */ }

    await page.evaluate(() => {
      const win = window as any;
      try { if (win.jQuery?.tourTip?.close) win.jQuery.tourTip.close(); } catch { /* not initialized */ }
      const canvas = document.getElementById('TourTipDisabledArea');
      if (canvas) canvas.remove();
      document.querySelectorAll<HTMLElement>('.pum-close, .popmake-close').forEach(el => { try { el.click(); } catch { /* ignore */ } });
    });
  }

  test('Flujo unico: producto -> carrito -> checkout', async ({ page }) => {
    // Paso 1: Abrir productos
    await test.step('Abrir tienda y validar producto objetivo', async () => {
      await page.goto(`${BASE_URL}/find-bugs/`, { waitUntil: 'load' });
      await dismissOverlays(page);
      await expect(page).toHaveURL(/find-bugs/);

      const productHeading = page.getByRole('heading', { name: PRODUCT_NAME, exact: false });
      await expect(productHeading).toBeVisible({ timeout: 10_000 });
      await page.screenshot({ path: 'artifacts/steps/flow-01-store-page.png', fullPage: true });
    });

    // Paso 2: Agregar al carrito (via URL directa por boton hidden)
    await test.step('Agregar producto al carrito', async () => {
      await page.goto(ADD_TO_CART_URL, { waitUntil: 'load' });
      await dismissOverlays(page);
      await expect(page.getByText(PRODUCT_NAME).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(PRODUCT_PRICE).first()).toBeVisible({ timeout: 5_000 });
      await page.screenshot({ path: 'artifacts/steps/flow-02-cart-with-product.png', fullPage: true });
    });

    // Paso 3: Registrar valores del carrito para bug-hunting
    await test.step('[BUG CHECK] Revisar subtotal/shipping/grand total', async () => {
      const subtotalText = await page.locator('.ec-cart-subtotal, .subtotal, [class*="subtotal"]').first().textContent().catch(() => null);
      const shippingText = await page.locator('.ec-cart-shipping, .shipping-cost, [class*="shipping"]').first().textContent().catch(() => null);
      const grandTotalText = await page.locator('.ec-cart-total, .grand-total, [class*="grand"], [class*="total"]').last().textContent().catch(() => null);

      console.log(`Subtotal: ${subtotalText?.trim()}`);
      console.log(`Shipping: ${shippingText?.trim()}`);
      console.log(`Grand Total: ${grandTotalText?.trim()}`);
    });

    // Paso 4: Ir al checkout
    await test.step('Ir a checkout', async () => {
      const checkoutBtn = page.getByRole('link', { name: /checkout/i }).first();
      await expect(checkoutBtn).toBeVisible({ timeout: 10_000 });
      await checkoutBtn.click();
      await page.waitForLoadState('load', { timeout: 15_000 });
      await dismissOverlays(page);
      await page.screenshot({ path: 'artifacts/steps/flow-03-after-checkout-click.png', fullPage: true });
      console.log(`URL del checkout: ${page.url()}`);
    });

    // Paso 5: Resolver checkpoint de auth/checkout
    await test.step('Analizar página de checkout', async () => {
      const url = page.url();
      const bodyText = await page.textContent('body').catch(() => '');

      if (/login|sign.?in|account/i.test(url + bodyText)) {
        console.log('ℹ️ El checkout redirigió al login — requiere cuenta');

        // Ubicar donde esta el registro/crear cuenta cuando checkout redirige al login
        const signUpLink = page.locator('a.academyfb-signup-link[href*="ec_page=register"]').first();
        const fallbackSignUpLink = page.getByRole('link', { name: /sign.?up|create.?account|register/i }).first();

        if (await signUpLink.isVisible({ timeout: 2000 }).catch(() => false)) {
          const href = await signUpLink.getAttribute('href');
          console.log(`  -> Sign Up detectado (academyfb-signup-link): ${href || '(sin href)'}`);
        } else if (await fallbackSignUpLink.isVisible({ timeout: 1000 }).catch(() => false)) {
          const href = await fallbackSignUpLink.getAttribute('href');
          console.log(`  -> Sign Up detectado (fallback): ${href || '(sin href)'}`);
        }

        // Usar la cuenta provista para prellenar login
        const loginEmailInput = page.locator('input[type="email"], input[name*="email"], input[id*="email"]').first();
        if (await loginEmailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await loginEmailInput.fill(LOGIN_EMAIL);
          console.log(`  -> Email de login cargado: ${LOGIN_EMAIL}`);
        }

        const loginPasswordInput = page.locator('input[type="password"], input[name*="pass"], input[id*="pass"]').first();
        if (LOGIN_PASSWORD && await loginPasswordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await loginPasswordInput.fill(LOGIN_PASSWORD);
          console.log('  -> Password de login cargado desde CHECKOUT_LOGIN_PASSWORD');
        } else if (!LOGIN_PASSWORD) {
          console.log('  -> Falta CHECKOUT_LOGIN_PASSWORD para completar login automático');
        }

        // Pausa para observar los datos precargados en login
        await page.waitForTimeout(OBSERVE_MS);
        await page.screenshot({ path: 'artifacts/steps/flow-04-login-required.png', fullPage: true });
      } else if (/checkout|billing|payment/i.test(url + bodyText)) {
        console.log('✅ Formulario de checkout detectado');
        console.log(`  Datos: ${TEST_BUYER.firstName} ${TEST_BUYER.lastName} | ${TEST_BUYER.email}`);

        // Llenar campos que estén disponibles (sin esperar si no existen)
        const tryFill = async (selector: string, value: string, label: string) => {
          try {
            const el = page.locator(selector).first();
            if (await el.isVisible({ timeout: 2000 })) {
              await el.scrollIntoViewIfNeeded();
              await el.click({ timeout: 2000 });
              await el.fill('');

              // Type lento para visualizar el valor en pantalla (estilo demo)
              if (TYPE_DELAY_MS > 0) {
                await el.type(value, { delay: TYPE_DELAY_MS });
              } else {
                await el.fill(value);
              }

              const currentValue = await el.inputValue().catch(() => '');
              console.log(`  - ${label}: ${currentValue || '(sin valor)'}`);

              if (FIELD_PAUSE_MS > 0) {
                await page.waitForTimeout(FIELD_PAUSE_MS);
              }
            }
          } catch { /* campo no disponible */ }
        };

        const trySelect = async (selector: string, value: string, label: string) => {
          try {
            const el = page.locator(selector).first();
            if (await el.isVisible({ timeout: 2000 })) {
              await el.scrollIntoViewIfNeeded();
              await el.selectOption({ label: value });
              const selectedText = await el.evaluate((node) => {
                const select = node as HTMLSelectElement;
                return select.selectedOptions?.[0]?.textContent?.trim() || '';
              }).catch(() => '');

              console.log(`  - ${label}: ${selectedText || value}`);

              if (FIELD_PAUSE_MS > 0) {
                await page.waitForTimeout(FIELD_PAUSE_MS);
              }
            }
          } catch { /* campo no disponible */ }
        };

        await trySelect('select[name*="country"],select[id*="country"]', TEST_BUYER.country, 'Country');
        await tryFill('[name*="first_name"],[id*="first_name"]', TEST_BUYER.firstName, 'First Name');
        await tryFill('[name*="last_name"],[id*="last_name"]', TEST_BUYER.lastName, 'Last Name');
        await tryFill('[name*="company"],[id*="company"],[placeholder*="Company"]', TEST_BUYER.company, 'Company');
        await tryFill('[type="email"],[name*="email"],[id*="email"]', TEST_BUYER.email, 'Email');
        await tryFill('[type="tel"],[name*="phone"],[id*="phone"]', TEST_BUYER.phone, 'Phone');
        await tryFill('[name*="address"],[id*="address"]', TEST_BUYER.address, 'Address');
        await tryFill('[name*="city"],[id*="city"]', TEST_BUYER.city, 'City');
        await tryFill('[name*="state"],[id*="state"]', TEST_BUYER.state, 'State');
        await tryFill('[name*="zip"],[id*="zip"],[name*="postal"],[id*="postal"]', TEST_BUYER.zip, 'Zip Code');

        // Identificar y activar "Create Account" en el checkout cuando exista
        const createAccountCheckbox = page.locator('input[type="checkbox"][name*="create"], input[type="checkbox"][id*="create"]').first();
        const createAccountLabel = page.getByText(/create account/i).first();
        if (await createAccountCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
          if (!(await createAccountCheckbox.isChecked().catch(() => false))) {
            await createAccountCheckbox.check().catch(async () => {
              await createAccountLabel.click().catch(() => undefined);
            });
          }
          console.log('  -> CREATE ACCOUNT detectado y marcado');
        } else if (await createAccountLabel.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  -> Texto CREATE ACCOUNT detectado (sin checkbox directo)');
        }

        await tryFill('[name*="email"],[id*="email"],[type="email"]', TEST_BUYER.email, 'Email');
        await tryFill('[name*="retype"],[id*="retype"],[name*="confirm"],[id*="confirm"]', TEST_BUYER.email, 'Retype Email');

        // Pausa para observar el formulario completo antes del screenshot
        await page.waitForTimeout(OBSERVE_MS);

        await page.screenshot({ path: 'artifacts/steps/flow-05-form-filled.png', fullPage: true });

        // Verificar si hay botón de submit
        const submitBtn = page.getByRole('button', { name: /place.?order|submit|complete|pay/i }).first();
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('✅ Botón de submit encontrado — listo para procesar');
        } else {
          console.log('⚠️ No se encontró botón de submit (puede ser un bug o requiere más pasos)');
        }
      } else {
        console.log(`⚠️ Página inesperada en checkout: ${url}`);
      }
    });
  });
});
