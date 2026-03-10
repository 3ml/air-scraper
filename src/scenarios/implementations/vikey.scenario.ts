import { BaseScenario, type ScenarioConfig, type ScenarioContext } from '../BaseScenario.js';
import type { ScraperEngine } from '../../scraper/ScraperEngine.js';

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
  paese: string | null;
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
            paese: { type: ['string', 'null'] },
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
      // 1. Navigate to reservation page
      await engine.navigate(`${baseUrl}/reservations/${vikeyId}#general`);
      await engine.delay();

      const page = engine.rawPage;
      if (!page) {
        throw new Error('Browser page not available');
      }

      // 2. Check if login is needed (redirected to login page)
      const emailFieldVisible = await page
        .getByRole('textbox', { name: 'Email' })
        .isVisible()
        .catch(() => false);

      if (emailFieldVisible) {
        // Fill login form with humanized typing
        await engine.think();
        await engine.type('input[type="email"], input[type="text"], input[name="email"]', credentials.username);
        await engine.type('input[type="password"]', credentials.password);

        // Click login button
        await engine.click('button:has-text("Accedi")');
        await engine.waitForNavigation();
        await engine.delay();

        // After login, we may be redirected to dashboard - navigate back to reservation
        const currentUrl = page.url();
        if (!currentUrl.includes(`/reservations/${vikeyId}`)) {
          await engine.navigate(`${baseUrl}/reservations/${vikeyId}#general`);
          await engine.delay();
        }
      }

      // 3. Wait for reservation data API to load
      await page
        .waitForResponse(
          (response) =>
            response.url().includes('/api/v3/resv/resv') && response.status() === 200,
          { timeout: 30000 }
        )
        .catch(() => null);

      await engine.delay();

      // 4. Wait for page content to render
      await page.getByText('Informazioni generali').first().waitFor({ timeout: 15000 }).catch(() => {});
      await engine.delay();

      // 5. Extract general page data
      const generalData = await this.extractGeneralPageData(engine);

      // 6. Navigate to documents tab using exact text match
      await page.getByText('Documenti e Burocrazia', { exact: true }).click();
      await engine.delay();

      // Wait for documents section to load
      await page.getByText('Burocrazia').first().waitFor({ timeout: 15000 }).catch(() => {});
      await engine.delay();

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

  protected getWarmupUrl(_input: VikeyInput): string | undefined {
    return 'https://my.vikey.it';
  }
}

export default VikeyScenario;
