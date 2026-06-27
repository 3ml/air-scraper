import { BaseScenario, type ScenarioConfig, type ScenarioContext } from '../BaseScenario.js';
import type { ScraperEngine } from '../../scraper/ScraperEngine.js';
import logger from '../../observability/logger.js';
import { VIKEY_COUNTRY_ISO } from './vikey-country-iso.js';

const RESERVATION_UNAVAILABLE_TEXT = 'La prenotazione richiesta non è più disponibile';

/** Thrown when the reservation page renders the "no longer available" state. */
class ReservationUnavailableError extends Error {}

interface VikeyInput {
  vikeyId: string;
  credentials: {
    username: string;
    password: string;
  };
}

interface GuestFilledData {
  nome: string | null;
  cognome: string | null;
  email: string | null;
}

interface BillingData {
  nome: string | null;
  partitaIvaCf: string | null;
  passaporto: string | null;
  paese: string | null; // ISO 3166-1 alpha-2 country code (e.g. "IT", "GB", "SA"), or null
  codiceUnivocoSid: string | null;
  pec: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  indirizzo: string | null;
}

interface IdentityDocument {
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  rilasciatoDa: string | null;
  dataRilascio: string | null;
  dataScadenza: string | null;
}

interface GuestDocument {
  nome: string | null;
  cognome: string | null;
  sesso: string | null;
  dataNascita: string | null;
  luogoNascita: string | null;
  cittadinanza: string | null;
  residenza: string | null;
  indirizzoResidenza: string | null;
  identityDocument: IdentityDocument;
}

interface VikeyOutput {
  success: boolean;
  vikeyId: string;
  telefonoOspite: string | null;
  numeroOspiti: string | null;
  linguaOspite: string | null;
  guestFilledData: GuestFilledData;
  billingData: BillingData;
  contractStatus: string | null;
  contractSigned: boolean;
  cityTaxStatus: string | null;
  guests: GuestDocument[];
  timestamp: string;
  reservationUnavailable: boolean;
  error?: string;
}

/**
 * VikeyScenario - Scrape reservation data from Vikey (my.vikey.it)
 */
export class VikeyScenario extends BaseScenario<VikeyInput, VikeyOutput> {
  readonly config: ScenarioConfig = {
    action: 'vikey',
    name: 'Vikey Reservation',
    description: 'Extract reservation data from Vikey including guest info, billing data, and documents',
    maxConcurrent: 2,
    cooldownSeconds: 5,
    timeout: 180000,
    retries: 2,
    inputSchema: {
      type: 'object',
      required: ['vikeyId', 'credentials'],
      properties: {
        vikeyId: { type: 'string', description: 'Vikey reservation ID (e.g., F5G84USP)' },
        credentials: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', description: 'Vikey login email' },
            password: { type: 'string', description: 'Vikey login password' },
          },
        },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['success', 'vikeyId', 'timestamp'],
      properties: {
        success: { type: 'boolean', description: 'Whether extraction was successful' },
        vikeyId: { type: 'string', description: 'Vikey reservation ID' },
        telefonoOspite: { type: ['string', 'null'], description: 'Guest phone number' },
        numeroOspiti: { type: ['string', 'null'], description: 'Number of guests' },
        linguaOspite: { type: ['string', 'null'], description: 'Guest language' },
        guestFilledData: {
          type: 'object',
          description: 'Data filled by guest',
          properties: {
            nome: { type: ['string', 'null'] },
            cognome: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
          },
        },
        billingData: {
          type: 'object',
          description: 'Billing information',
          properties: {
            nome: { type: ['string', 'null'] },
            partitaIvaCf: { type: ['string', 'null'] },
            passaporto: { type: ['string', 'null'] },
            paese: { type: ['string', 'null'], description: 'Billing country as ISO 3166-1 alpha-2 (e.g. IT, GB, SA)' },
            codiceUnivocoSid: { type: ['string', 'null'] },
            pec: { type: ['string', 'null'] },
            cap: { type: ['string', 'null'] },
            citta: { type: ['string', 'null'] },
            provincia: { type: ['string', 'null'] },
            indirizzo: { type: ['string', 'null'] },
          },
        },
        contractStatus: { type: ['string', 'null'], description: 'Contract acceptance status text' },
        contractSigned: { type: 'boolean', description: 'Whether contract is signed by guest' },
        cityTaxStatus: { type: ['string', 'null'], description: 'City tax status' },
        guests: {
          type: 'array',
          description: 'List of guest documents',
          items: {
            type: 'object',
            properties: {
              nome: { type: ['string', 'null'] },
              cognome: { type: ['string', 'null'] },
              sesso: { type: ['string', 'null'] },
              dataNascita: { type: ['string', 'null'] },
              luogoNascita: { type: ['string', 'null'] },
              cittadinanza: { type: ['string', 'null'] },
              residenza: { type: ['string', 'null'] },
              indirizzoResidenza: { type: ['string', 'null'] },
              identityDocument: {
                type: 'object',
                description: 'Identity document details',
                properties: {
                  tipoDocumento: { type: ['string', 'null'] },
                  numeroDocumento: { type: ['string', 'null'] },
                  rilasciatoDa: { type: ['string', 'null'] },
                  dataRilascio: { type: ['string', 'null'] },
                  dataScadenza: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
        timestamp: { type: 'string', format: 'date-time', description: 'Extraction timestamp' },
        reservationUnavailable: {
          type: 'boolean',
          description: 'True when the reservation no longer exists on Vikey',
        },
        error: { type: 'string', description: 'Error message if success is false' },
      },
    },
    exampleInput: {
      vikeyId: 'F5G84USP',
      credentials: {
        username: 'user@example.com',
        password: 'your-password',
      },
    },
  };

  protected async run(
    engine: ScraperEngine,
    input: VikeyInput,
    _context: ScenarioContext
  ): Promise<VikeyOutput> {
    const { vikeyId, credentials } = input;
    const baseUrl = 'https://my.vikey.it';

    try {
      const page = engine.rawPage;
      if (!page) {
        throw new Error('Browser page not available');
      }

      // NOTE: This scenario targets my.vikey.it, a login-protected SPA backed by a
      // JSON API. It deliberately bypasses the engine's humanized methods (navigate/
      // type/click/delay) and drives the raw Playwright page directly, using
      // event-driven waits instead of fixed delays. This keeps the heavy anti-detection
      // behavior intact for OTHER scenarios while making Vikey fast. See getWarmupUrl
      // below: warmup is intentionally disabled for the same reason.

      // 1. Navigate to reservation page (no pageLoadDelay / cookie-consent overhead)
      await page.goto(`${baseUrl}/reservations/${vikeyId}#general`, { waitUntil: 'domcontentloaded' });

      // 2. Check if login is needed (redirected to login page)
      const emailFieldVisible = await page
        .getByRole('textbox', { name: 'Email' })
        .isVisible()
        .catch(() => false);

      if (emailFieldVisible) {
        // Fill login form instantly (no humanized typing)
        await page.fill('input[type="email"], input[type="text"], input[name="email"]', credentials.username);
        await page.fill('input[type="password"]', credentials.password);

        // Submit. Wait for the login form to go away (reliable "authenticated" signal).
        // NOTE: do NOT use waitForLoadState('networkidle') here — this SPA keeps the
        // network busy (polling/sockets) so networkidle never fires and hangs the task.
        await page.click('button:has-text("Accedi")');
        await page
          .getByRole('textbox', { name: 'Email' })
          .waitFor({ state: 'detached', timeout: 30000 })
          .catch(() => {});

        // After login, ensure we are on the reservation page (login may land on dashboard)
        if (!page.url().includes(`/reservations/${vikeyId}`)) {
          await page.goto(`${baseUrl}/reservations/${vikeyId}#general`, { waitUntil: 'domcontentloaded' });
        }
      }

      // 3. Wait for the reservation data API to load — or detect the "not available" state and fail
      // fast. An unavailable reservation never returns 200 from /api/v3/resv/resv and the page renders
      // an explicit error; the old "wait for 200" burned its full 30s timeout and the later element
      // waits then ran their own timeouts (~5 min total). Race the API response against the error text.
      // The response carries the billing country code (invdata_country) and the guest documents
      // (ndocs), both of which the DOM only renders asynchronously later.
      const resvOrError = await Promise.race([
        page
          .waitForResponse((response) => response.url().includes('/api/v3/resv/resv'), {
            timeout: 30000,
          })
          .catch(() => null),
        page
          .getByText(RESERVATION_UNAVAILABLE_TEXT)
          .first()
          .waitFor({ timeout: 30000 })
          .then(() => 'UNAVAILABLE' as const)
          .catch(() => null),
      ]);

      if (resvOrError === 'UNAVAILABLE') {
        throw new ReservationUnavailableError(`Reservation ${vikeyId} is no longer available`);
      }
      if (resvOrError && resvOrError.status() !== 200) {
        throw new ReservationUnavailableError(`Reservation ${vikeyId} is no longer available`);
      }
      const resvResults: Record<string, unknown> | null = resvOrError
        ? ((await resvOrError.json().catch(() => null))?.results ?? null)
        : null;

      // 4. Wait for page content to render
      await page.getByText('Informazioni generali').first().waitFor({ timeout: 15000 }).catch(() => {});

      // 5. Extract general page data
      const generalData = await this.extractGeneralPageData(engine);

      // 5b. Resolve the billing country. The "Paese" cell renders only after a later
      // /api/v3/pa/countries lookup resolves, so DOM scraping races and misses it. Resolve it
      // deterministically from the resv payload's numeric country code and emit ISO 3166-1
      // alpha-2 (e.g. "GB", "SA", "IT").
      const countryCode =
        resvResults?.invdata_country != null ? String(resvResults.invdata_country) : null;
      const paeseIso = countryCode ? (VIKEY_COUNTRY_ISO[countryCode] ?? null) : null;
      if (countryCode && !paeseIso) {
        logger.warn({ countryCode, vikeyId }, 'Vikey: unmapped country code, paese set to null');
      }
      generalData.billingData.paese = paeseIso;

      // 6. Navigate to documents tab using exact text match (bounded: reaching here implies the
      // reservation is available, so a missing tab is a real failure — fail fast, never hang 5 min).
      await page.getByText('Documenti e Burocrazia', { exact: true }).click({ timeout: 15000 });

      // Wait for documents section to load (event-driven)
      await page.getByText('Burocrazia').first().waitFor({ timeout: 15000 }).catch(() => {});

      // The guest cards render asynchronously after the tab mounts, so extracting immediately
      // races and returns []. The resv payload's `ndocs` (a JSON-encoded array) tells us how
      // many guests to expect; wait until that many cards are present before extracting. Skip
      // the wait entirely when there are no documents (avoids a needless timeout).
      let expectedGuests = 0;
      try {
        const ndocs = resvResults?.ndocs;
        const parsed = Array.isArray(ndocs) ? ndocs : JSON.parse(typeof ndocs === 'string' ? ndocs : '[]');
        expectedGuests = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        expectedGuests = 0;
      }
      if (expectedGuests > 0) {
        await page
          .waitForFunction(
            (n) =>
              Array.from(document.querySelectorAll('div')).filter((d) =>
                (d.textContent || '').includes('Nome ospite:')
              ).length >= n,
            expectedGuests,
            { timeout: 15000 }
          )
          .catch(() => {});
      }

      // 7. Extract guest documents
      const guests = await this.extractGuestDocuments(engine);

      return {
        success: true,
        vikeyId,
        telefonoOspite: generalData.telefonoOspite,
        numeroOspiti: generalData.numeroOspiti,
        linguaOspite: generalData.linguaOspite,
        guestFilledData: generalData.guestFilledData,
        billingData: generalData.billingData,
        contractStatus: generalData.contractStatus,
        contractSigned: generalData.contractSigned,
        cityTaxStatus: generalData.cityTaxStatus,
        guests,
        timestamp: new Date().toISOString(),
        reservationUnavailable: false,
      };
    } catch (error) {
      return {
        success: false,
        vikeyId,
        telefonoOspite: null,
        numeroOspiti: null,
        linguaOspite: null,
        guestFilledData: { nome: null, cognome: null, email: null },
        billingData: {
          nome: null,
          partitaIvaCf: null,
          passaporto: null,
          paese: null,
          codiceUnivocoSid: null,
          pec: null,
          cap: null,
          citta: null,
          provincia: null,
          indirizzo: null,
        },
        contractStatus: null,
        contractSigned: false,
        cityTaxStatus: null,
        guests: [],
        timestamp: new Date().toISOString(),
        reservationUnavailable: error instanceof ReservationUnavailableError,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async extractGeneralPageData(engine: ScraperEngine): Promise<{
    telefonoOspite: string | null;
    numeroOspiti: string | null;
    linguaOspite: string | null;
    guestFilledData: GuestFilledData;
    billingData: BillingData;
    contractStatus: string | null;
    contractSigned: boolean;
    cityTaxStatus: string | null;
  }> {
    return await engine.evaluate(() => {
      // Helper function to normalize "Non compilato" to null
      const normalize = (value: string | null | undefined): string | null => {
        if (!value) return null;
        const trimmed = value.trim();
        if (trimmed === 'Non compilato' || trimmed === '') return null;
        return trimmed;
      };

      // Build a map of all label-value pairs from the page
      // The structure is: container div > label div + value div (as siblings)
      const fieldMap: Record<string, string> = {};
      const allElements = document.querySelectorAll('div');

      for (const el of allElements) {
        const children = Array.from(el.children);
        // Look for containers with exactly 2 div children (label + value pattern)
        if (children.length === 2 &&
            children[0].tagName === 'DIV' &&
            children[1].tagName === 'DIV') {
          const label = children[0].textContent?.trim();
          const value = children[1].textContent?.trim();
          if (label && value && !label.includes('\n') && label.length < 50) {
            fieldMap[label] = value;
          }
        }
      }

      // Extract general info from the map
      const telefonoOspite = normalize(fieldMap['Telefono ospite']);
      const numeroOspiti = normalize(fieldMap['Numero ospiti']);
      const linguaOspite = normalize(fieldMap['Lingua ospite']);

      // Find "Dati riempiti dall'ospite" section
      const guestFilledData: GuestFilledData = {
        nome: null,
        cognome: null,
        email: null,
      };

      // Look for section header and extract from its parent container
      const findSectionData = (sectionTitle: string): Record<string, string> => {
        const data: Record<string, string> = {};
        for (const el of allElements) {
          if (el.textContent?.trim() === sectionTitle && el.children.length === 0) {
            // Found the header, now look at parent's siblings or children
            const section = el.parentElement;
            if (section) {
              const sectionDivs = section.querySelectorAll('div');
              for (const div of sectionDivs) {
                const divChildren = Array.from(div.children);
                if (divChildren.length === 2 &&
                    divChildren[0].tagName === 'DIV' &&
                    divChildren[1].tagName === 'DIV') {
                  const label = divChildren[0].textContent?.trim();
                  const value = divChildren[1].textContent?.trim();
                  if (label && value) {
                    data[label] = value;
                  }
                }
              }
            }
            break;
          }
        }
        return data;
      };

      const guestSection = findSectionData("Dati riempiti dall'ospite");
      guestFilledData.nome = normalize(guestSection['Nome']);
      guestFilledData.cognome = normalize(guestSection['Cognome']);
      guestFilledData.email = normalize(guestSection['Email']);

      // Find "Dati di fatturazione" section
      const billingData: BillingData = {
        nome: null,
        partitaIvaCf: null,
        passaporto: null,
        paese: null,
        codiceUnivocoSid: null,
        pec: null,
        cap: null,
        citta: null,
        provincia: null,
        indirizzo: null,
      };

      const billingSection = findSectionData('Dati di fatturazione');
      billingData.nome = normalize(billingSection['Nome']);
      billingData.partitaIvaCf = normalize(billingSection['Partita Iva/Codice fiscale']);
      billingData.passaporto = normalize(billingSection['Passaporto']);
      billingData.paese = normalize(billingSection['Paese']);
      billingData.codiceUnivocoSid = normalize(billingSection['Codice univoco SID']);
      billingData.pec = normalize(billingSection['PEC']);
      billingData.cap = normalize(billingSection['CAP']);
      billingData.citta = normalize(billingSection['Città']);
      billingData.provincia = normalize(billingSection['Provincia']);
      billingData.indirizzo = normalize(billingSection['Indirizzo']);

      // Extract contract status - look for "Contratto firmato" text anywhere in the page
      let contractStatus: string | null = null;
      let contractSigned = false;

      const pageText = document.body.textContent || '';
      if (pageText.includes('Contratto firmato dall\'ospite') || pageText.includes("Contratto firmato dall'ospite")) {
        contractStatus = "Contratto firmato dall'ospite";
        contractSigned = true;
      } else if (pageText.includes('Non hai richiesto la firma')) {
        contractStatus = 'Non richiesto';
      } else {
        // Check for other contract-related text
        const contractSection = findSectionData('Accettazione contratto');
        if (Object.keys(contractSection).length > 0) {
          contractStatus = Object.values(contractSection).join(' ');
        }
      }

      // Extract city tax status
      let cityTaxStatus: string | null = null;
      const taxValue = fieldMap['Tassa di soggiorno'];
      if (taxValue) {
        cityTaxStatus = normalize(taxValue);
      } else {
        // Look for tax-related text in the page
        if (pageText.includes('Non hai richiesto il pagamento della tassa di soggiorno')) {
          cityTaxStatus = 'Non richiesto';
        }
      }

      return {
        telefonoOspite,
        numeroOspiti,
        linguaOspite,
        guestFilledData,
        billingData,
        contractStatus,
        contractSigned,
        cityTaxStatus,
      };
    });
  }

  private async extractGuestDocuments(engine: ScraperEngine): Promise<GuestDocument[]> {
    return await engine.evaluate(() => {
      const guests: GuestDocument[] = [];

      // Helper to normalize values
      const normalize = (value: string | null | undefined): string | null => {
        if (!value) return null;
        const trimmed = value.trim();
        if (trimmed === 'Non compilato' || trimmed === '') return null;
        return trimmed;
      };

      // The guest card structure is:
      // - Container div
      //   - Header div with "Nome ospite: XXX" and "Cognome ospite: YYY" as text nodes
      //   - Data div containing all field pairs (Sesso, Data di nascita, etc.)

      const allDivs = document.querySelectorAll('div');
      const processedCards = new Set<Element>();

      for (const div of allDivs) {
        // Skip already processed
        if (processedCards.has(div)) continue;

        const directText = div.textContent || '';

        // Look for divs containing the guest header pattern
        // The header contains text like "Nome ospite: Laura" and "Cognome ospite: Di Fabio"
        if (directText.includes('Nome ospite:') && directText.includes('Cognome ospite:')) {
          // Find the smallest container that has both the header and Sesso field
          if (!directText.includes('Sesso')) continue;

          // Check if this is a leaf card (doesn't contain other cards)
          let isLeafCard = true;
          const childDivs = div.querySelectorAll('div');
          for (const child of childDivs) {
            if (child !== div &&
                child.textContent?.includes('Nome ospite:') &&
                child.textContent?.includes('Cognome ospite:') &&
                child.textContent?.includes('Sesso')) {
              isLeafCard = false;
              break;
            }
          }

          if (!isLeafCard) continue;
          processedCards.add(div);

          // Extract nome and cognome from header text
          let nome: string | null = null;
          let cognome: string | null = null;

          // Find the header element with "Nome ospite:" text
          for (const el of childDivs) {
            const elText = el.textContent || '';
            if (elText.includes('Nome ospite:') && elText.includes('Cognome ospite:') && !elText.includes('Sesso')) {
              // Parse "Nome ospite: Laura" and "Cognome ospite: Di Fabio"
              const nomeMatch = elText.match(/Nome ospite:\s*([^C]+)/);
              const cognomeMatch = elText.match(/Cognome ospite:\s*(.+?)$/);
              if (nomeMatch) nome = normalize(nomeMatch[1]);
              if (cognomeMatch) cognome = normalize(cognomeMatch[1]);
              break;
            }
          }

          // Build field map from the card
          const fieldMap: Record<string, string> = {};
          for (const el of childDivs) {
            const children = Array.from(el.children);
            if (children.length === 2 &&
                children[0].tagName === 'DIV' &&
                children[1].tagName === 'DIV') {
              const label = children[0].textContent?.trim();
              const value = children[1].textContent?.trim();
              if (label && value && !label.includes('\n')) {
                fieldMap[label] = value;
              }
            }
          }

          guests.push({
            nome,
            cognome,
            sesso: normalize(fieldMap['Sesso']),
            dataNascita: normalize(fieldMap['Data di nascita']),
            luogoNascita: normalize(fieldMap['Luogo di nascita']),
            cittadinanza: normalize(fieldMap['Cittadinanza']),
            residenza: normalize(fieldMap['Residenza']),
            indirizzoResidenza: normalize(fieldMap['Indirizzo di residenza']),
            identityDocument: {
              tipoDocumento: normalize(fieldMap['Tipo documento']),
              numeroDocumento: normalize(fieldMap['Numero documento']),
              rilasciatoDa: normalize(fieldMap['Rilasciato da']),
              dataRilascio: normalize(fieldMap['Data di rilascio']),
              dataScadenza: normalize(fieldMap['Data di scadenza']),
            },
          });
        }
      }

      return guests;
    });
  }

  // Warmup intentionally disabled for Vikey: the homepage redirects to login and the
  // warmup (random scroll + delays) wastes ~5-25s with no benefit. Falling back to the
  // BaseScenario default (returns undefined) skips warmup entirely for this scenario only.
}

export default VikeyScenario;
