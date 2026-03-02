import { BaseScenario, type ScenarioConfig, type ScenarioContext } from '../BaseScenario.js';
import type { ScraperEngine } from '../../scraper/ScraperEngine.js';

interface AirEliteTestInput {
  username: string;
  password: string;
  baseUrl?: string;
}

interface PropertyOwner {
  name: string;
  id: number;
}

interface Property {
  id: number;
  name: string;
  address: string;
  owner: PropertyOwner | null;
  smoobuId: string | null;
  vikeyId: string | null;
  city: string | null;
  province: string | null;
  beds: number | null;
  baths: number | null;
  sqm: number | null;
  status: string;
}

interface AirEliteTestOutput {
  success: boolean;
  properties: Property[];
  totalCount: number;
  timestamp: string;
  error?: string;
}

/**
 * AirEliteTestScenario - Login to AirElite and extract properties list
 */
export class AirEliteTestScenario extends BaseScenario<AirEliteTestInput, AirEliteTestOutput> {
  readonly config: ScenarioConfig = {
    action: 'airelite-test',
    name: 'AirElite Test',
    description: 'Login to AirElite dashboard and extract properties list',
    maxConcurrent: 2,
    cooldownSeconds: 5,
    timeout: 120000,
    retries: 2,
  };

  protected async run(
    engine: ScraperEngine,
    input: AirEliteTestInput,
    _context: ScenarioContext
  ): Promise<AirEliteTestOutput> {
    const baseUrl = input.baseUrl || 'https://app.airelite.it';

    try {
      // 1. Navigate to dashboard
      await engine.navigate(`${baseUrl}/dashboard`);
      await engine.delay();

      // 2. Check if login form is present and login if needed
      const page = engine.rawPage;
      if (!page) {
        throw new Error('Browser page not available');
      }

      const emailFieldVisible = await page.getByRole('textbox', { name: 'Email' }).isVisible().catch(() => false);

      if (emailFieldVisible) {
        // Fill login form with humanized typing
        await engine.think();
        await engine.type('input[placeholder="Email"], input[name="email"]', input.username);
        await engine.type('input[placeholder="Password"], input[name="password"], input[type="password"]', input.password);

        // Click login button
        await engine.click('button:has-text("ACCEDI")');
        await engine.waitForNavigation();
        await engine.delay();
      }

      // 3. Navigate to properties page
      await engine.navigate(`${baseUrl}/dashboard/properties`);
      await engine.delay();

      // Wait for properties to load (wait for any link to /dashboard/properties/)
      await page.waitForSelector('a[href*="/dashboard/properties/"]', { timeout: 30000 }).catch(() => {});
      await engine.delay();

      // 4. Extract properties using page.evaluate()
      const properties = await engine.evaluate(() => {
        const results: Property[] = [];

        // Find all property cards - they contain links to /dashboard/properties/{id}
        const propertyLinks = document.querySelectorAll('a[href*="/dashboard/properties/"][href$="/Info"], a[href^="/dashboard/properties/"]:not([href*="/accounting"]):not([href*="/expenses"]):not([href*="/contract"]):not([href*="/docs"])');
        const processedIds = new Set<number>();

        propertyLinks.forEach(link => {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/dashboard\/properties\/(\d+)/);
          if (!match) return;

          const propertyId = parseInt(match[1], 10);
          if (processedIds.has(propertyId)) return;
          processedIds.add(propertyId);

          // Find the parent card container
          let card = link.closest('[class*="card"], [class*="property"], div > div > div') as HTMLElement | null;
          if (!card) {
            // Try to find by traversing up
            let parent = link.parentElement;
            for (let i = 0; i < 10 && parent; i++) {
              if (parent.querySelector('a[href*="/dashboard/owners/"]')) {
                card = parent;
                break;
              }
              parent = parent.parentElement;
            }
          }
          if (!card) return;

          // Extract property name - first substantial text in the card
          let name = '';
          const allText = card.querySelectorAll('div, span');
          for (const el of allText) {
            const text = el.textContent?.trim() || '';
            if (text && text.length > 2 && text.length < 100 && !text.includes(':') && !text.includes('id:')) {
              // Skip known labels
              if (['Dashboard', 'Strutture', 'Info', 'Spese', 'Conteggi', 'Contratto', 'Documentazione', 'ACCEDI', 'AGGIUNGI', 'Cancella', 'Responsabili', 'Attivo', 'TODO', 'letti', 'bagni', 'bagno', 'Mq', 'stato', 'periodi contabili'].some(skip => text.includes(skip))) continue;
              if (text.match(/^\d+$/)) continue;
              if (text.match(/^Del \d/)) continue;
              if (text.match(/^\d{4}-\d+$/)) continue;
              if (text.match(/^[A-Z]{2}$/)) continue; // Initials like MR, GM
              name = text;
              break;
            }
          }

          // Extract address - usually contains via, piazza, etc.
          let address = '';
          const addressPatterns = ['Via ', 'Piazza ', 'Vicolo ', 'Viale ', 'Corso '];
          allText.forEach(el => {
            const text = el.textContent?.trim() || '';
            if (addressPatterns.some(p => text.includes(p)) && text.includes(',')) {
              address = text;
            }
          });

          // Extract owner
          let owner: PropertyOwner | null = null;
          const ownerLink = card.querySelector('a[href*="/dashboard/owners/"]');
          if (ownerLink) {
            const ownerHref = ownerLink.getAttribute('href') || '';
            const ownerMatch = ownerHref.match(/\/dashboard\/owners\/(\d+)/);
            if (ownerMatch) {
              owner = {
                name: ownerLink.textContent?.trim() || 'Unknown',
                id: parseInt(ownerMatch[1], 10),
              };
            }
          }

          // Extract Smoobu ID
          let smoobuId: string | null = null;
          const smoobuText = card.textContent?.match(/Smoobu id:\s*(\d+)/);
          if (smoobuText) {
            smoobuId = smoobuText[1];
          }

          // Extract Vikey ID
          let vikeyId: string | null = null;
          const vikeyText = card.textContent?.match(/Vikey id:\s*([^\s"]+)/);
          if (vikeyText) {
            vikeyId = vikeyText[1];
          }

          // Extract city
          let city: string | null = null;
          const cityText = card.textContent?.match(/Città:\s*([^,\n]+)/);
          if (cityText) {
            city = cityText[1].trim();
          }

          // Extract province
          let province: string | null = null;
          const provinceText = card.textContent?.match(/Provincia:\s*([A-Z]{2})/);
          if (provinceText) {
            province = provinceText[1];
          }

          // Extract beds, baths, sqm
          let beds: number | null = null;
          let baths: number | null = null;
          let sqm: number | null = null;

          const bedsMatch = card.textContent?.match(/(\d+)\s*letti/);
          if (bedsMatch) beds = parseInt(bedsMatch[1], 10);

          const bathsMatch = card.textContent?.match(/(\d+)\s*bagn[io]/);
          if (bathsMatch) baths = parseInt(bathsMatch[1], 10);

          const sqmMatch = card.textContent?.match(/(\d+)\s*Mq/);
          if (sqmMatch) sqm = parseInt(sqmMatch[1], 10);

          // Extract status
          let status = 'Unknown';
          const statusMatch = card.textContent?.match(/stato:\s*(\w+)/);
          if (statusMatch) {
            status = statusMatch[1];
          }

          results.push({
            id: propertyId,
            name: name || `Property ${propertyId}`,
            address,
            owner,
            smoobuId,
            vikeyId,
            city,
            province,
            beds,
            baths,
            sqm,
            status,
          });
        });

        return results;
      });

      return {
        success: true,
        properties: properties as Property[],
        totalCount: (properties as Property[]).length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        properties: [],
        totalCount: 0,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  protected getWarmupUrl(input: AirEliteTestInput): string | undefined {
    return input.baseUrl || 'https://app.airelite.it';
  }
}

export default AirEliteTestScenario;
