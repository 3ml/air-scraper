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

interface GuestDocument {
  nome: string | null;
  cognome: string | null;
  sesso: string | null;
  dataNascita: string | null;
  luogoNascita: string | null;
  cittadinanza: string | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  rilasciatoDa: string | null;
  dataRilascio: string | null;
  dataScadenza: string | null;
  residenza: string | null;
  indirizzoResidenza: string | null;
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
              tipoDocumento: { type: ['string', 'null'] },
              numeroDocumento: { type: ['string', 'null'] },
              rilasciatoDa: { type: ['string', 'null'] },
              dataRilascio: { type: ['string', 'null'] },
              dataScadenza: { type: ['string', 'null'] },
              residenza: { type: ['string', 'null'] },
              indirizzoResidenza: { type: ['string', 'null'] },
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
        await engine.type('input[type="text"], input[name="email"]', credentials.username);
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
      await page.waitForSelector('div:has-text("Informazioni generali")', { timeout: 15000 }).catch(() => {});
      await engine.delay();

      // 5. Extract general page data
      const generalData = await this.extractGeneralPageData(engine);

      // 6. Navigate to documents tab
      await page.click('div:has-text("Documenti e Burocrazia")');
      await engine.delay();

      // Wait for documents section to load
      await page.waitForSelector('div:has-text("Documenti")', { timeout: 15000 }).catch(() => {});
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

      // Helper function to extract label-value pairs
      const extractLabelValue = (labelText: string): string | null => {
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
          if (div.textContent?.trim() === labelText && div.children.length === 0) {
            // Check next sibling
            const nextEl = div.nextElementSibling;
            if (nextEl) {
              return normalize(nextEl.textContent);
            }
            // Check parent's next child
            const parent = div.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children);
              const idx = siblings.indexOf(div);
              if (idx >= 0 && idx < siblings.length - 1) {
                return normalize(siblings[idx + 1].textContent);
              }
            }
          }
        }
        return null;
      };

      // Extract general info
      const telefonoOspite = extractLabelValue('Telefono ospite');
      const numeroOspiti = extractLabelValue('Numero ospiti');
      const linguaOspite = extractLabelValue('Lingua ospite');

      // Find "Dati riempiti dall'ospite" section and extract
      const guestFilledData: GuestFilledData = {
        nome: null,
        cognome: null,
        email: null,
      };

      const guestSectionHeader = Array.from(document.querySelectorAll('div')).find(
        (d) => d.textContent?.trim() === "Dati riempiti dall'ospite"
      );
      if (guestSectionHeader) {
        const section = guestSectionHeader.parentElement;
        if (section) {
          const findInSection = (label: string): string | null => {
            const divs = section.querySelectorAll('div');
            for (const div of divs) {
              if (div.textContent?.trim() === label && div.children.length === 0) {
                const next = div.nextElementSibling;
                if (next) return normalize(next.textContent);
              }
            }
            return null;
          };
          guestFilledData.nome = findInSection('Nome');
          guestFilledData.cognome = findInSection('Cognome');
          guestFilledData.email = findInSection('Email');
        }
      }

      // Find "Dati di fatturazione" section and extract
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

      const billingSectionHeader = Array.from(document.querySelectorAll('div')).find(
        (d) => d.textContent?.trim() === 'Dati di fatturazione'
      );
      if (billingSectionHeader) {
        const section = billingSectionHeader.parentElement;
        if (section) {
          const findInSection = (label: string): string | null => {
            const divs = section.querySelectorAll('div');
            for (const div of divs) {
              if (div.textContent?.trim() === label && div.children.length === 0) {
                const next = div.nextElementSibling;
                if (next) return normalize(next.textContent);
              }
            }
            return null;
          };
          billingData.nome = findInSection('Nome');
          billingData.partitaIvaCf = findInSection('Partita Iva/Codice fiscale');
          billingData.passaporto = findInSection('Passaporto');
          billingData.paese = findInSection('Paese');
          billingData.codiceUnivocoSid = findInSection('Codice univoco SID');
          billingData.pec = findInSection('PEC');
          billingData.cap = findInSection('CAP');
          billingData.citta = findInSection('Città');
          billingData.provincia = findInSection('Provincia');
          billingData.indirizzo = findInSection('Indirizzo');
        }
      }

      // Extract contract status
      let contractStatus: string | null = null;
      let contractSigned = false;

      const contractLabel = Array.from(document.querySelectorAll('div')).find(
        (d) => d.textContent?.trim() === 'Accettazione contratto'
      );
      if (contractLabel) {
        const section = contractLabel.parentElement;
        if (section) {
          const fullText = section.textContent || '';
          if (fullText.includes('Contratto firmato')) {
            contractStatus = 'Contratto firmato dall\'ospite';
            contractSigned = true;
          } else if (fullText.includes('Non hai richiesto')) {
            contractStatus = 'Non richiesto';
          } else {
            // Extract any status text
            const statusText = fullText.replace('Accettazione contratto', '').trim();
            contractStatus = statusText || null;
          }
        }
      }

      // Extract city tax status
      let cityTaxStatus: string | null = null;
      const taxLabel = Array.from(document.querySelectorAll('div')).find(
        (d) => d.textContent?.trim() === 'Tassa di soggiorno'
      );
      if (taxLabel) {
        const section = taxLabel.parentElement;
        if (section) {
          const next = taxLabel.nextElementSibling;
          if (next) {
            cityTaxStatus = normalize(next.textContent);
          }
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

      // Find all guest cards - they have "Nome ospite:" text
      const allDivs = document.querySelectorAll('div');
      const guestCards: Element[] = [];

      for (const div of allDivs) {
        const text = div.textContent || '';
        // Look for divs that contain guest name headers like "Nome ospite: XXX" and "Cognome ospite: YYY"
        if (text.includes('Nome ospite:') && text.includes('Cognome ospite:') && text.includes('Sesso')) {
          // Check this is a card container (not a parent that contains multiple)
          const childCards = div.querySelectorAll('div');
          let isLeafCard = true;
          for (const child of childCards) {
            if (child !== div && child.textContent?.includes('Nome ospite:') && child.textContent?.includes('Sesso')) {
              isLeafCard = false;
              break;
            }
          }
          if (isLeafCard) {
            guestCards.push(div);
          }
        }
      }

      // If no cards found with full structure, try alternative approach
      if (guestCards.length === 0) {
        // Look for sections with "Nome ospite:" header
        for (const div of allDivs) {
          if (div.textContent?.trim().startsWith('Nome ospite:')) {
            const parent = div.parentElement?.parentElement;
            if (parent && parent.textContent?.includes('Sesso') && !guestCards.includes(parent)) {
              guestCards.push(parent);
            }
          }
        }
      }

      // Extract data from each guest card
      for (const card of guestCards) {
        const extractField = (label: string): string | null => {
          const divs = card.querySelectorAll('div');
          for (const div of divs) {
            if (div.textContent?.trim() === label && div.children.length === 0) {
              const next = div.nextElementSibling;
              if (next) return normalize(next.textContent);
            }
          }
          return null;
        };

        // Extract name from header
        let nome: string | null = null;
        let cognome: string | null = null;
        const cardText = card.textContent || '';
        const nomeMatch = cardText.match(/Nome ospite:\s*([^\n]+)/);
        const cognomeMatch = cardText.match(/Cognome ospite:\s*([^\n]+)/);
        if (nomeMatch) nome = normalize(nomeMatch[1].split('Cognome')[0]);
        if (cognomeMatch) cognome = normalize(cognomeMatch[1].split('Sesso')[0]);

        guests.push({
          nome,
          cognome,
          sesso: extractField('Sesso'),
          dataNascita: extractField('Data di nascita'),
          luogoNascita: extractField('Luogo di nascita'),
          cittadinanza: extractField('Cittadinanza'),
          tipoDocumento: extractField('Tipo documento'),
          numeroDocumento: extractField('Numero documento'),
          rilasciatoDa: extractField('Rilasciato da'),
          dataRilascio: extractField('Data di rilascio'),
          dataScadenza: extractField('Data di scadenza'),
          residenza: extractField('Residenza'),
          indirizzoResidenza: extractField('Indirizzo di residenza'),
        });
      }

      return guests;
    });
  }

  protected getWarmupUrl(_input: VikeyInput): string | undefined {
    return 'https://my.vikey.it';
  }
}

export default VikeyScenario;
