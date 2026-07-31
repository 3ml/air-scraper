import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { screenshotRequestSchema, type ScreenshotResponse } from '../../types/api.types.js';
import { authMiddleware } from '../middleware/auth.js';
import { createRequestLogger } from '../../observability/logger.js';
import { incrementRequestCounter } from '../../observability/metrics.js';
import { ScraperEngine } from '../../scraper/ScraperEngine.js';
import { OverlayDismisser } from '../../scraper/consent/OverlayDismisser.js';

export async function screenshotRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/api/screenshot',
    {
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      const logger = createRequestLogger(request.requestId, 'screenshot');

      // Screenshot is not a registry scenario: scoped tokens need the 'screenshot' pseudo-scope
      const ctx = request.tokenContext;
      if (!ctx.isMaster && !ctx.scenarios.includes('screenshot')) {
        incrementRequestCounter(false);
        logger.warn({ tokenName: ctx.name }, 'Token not allowed for screenshot endpoint');
        return reply.code(403).send({
          error: 'Forbidden',
          code: 'SCREENSHOT_NOT_ALLOWED',
          message: `Token '${ctx.name}' is not allowed to use the screenshot endpoint`,
        });
      }

      try {
        const parseResult = screenshotRequestSchema.safeParse(request.body);
        if (!parseResult.success) {
          incrementRequestCounter(false);
          logger.warn({ errors: parseResult.error.errors }, 'Invalid screenshot request body');
          return reply.code(400).send({
            error: 'Validation Error',
            message: 'Invalid request body structure',
            details: parseResult.error.errors,
          });
        }

        const input = parseResult.data;
        logger.info({ url: input.url, format: input.format }, 'Taking screenshot');

        const engine = new ScraperEngine({ sessionId: `screenshot-${uuidv4()}` });
        let dismissedOverlays: string[] = [];
        const result = await engine.execute(async (eng) => {
          if (input.viewport) {
            await eng.rawPage!.setViewportSize(input.viewport);
          }
          await eng.navigate(input.url);
          // Best-effort: let late XHR-driven content settle before hunting for overlays
          await eng.rawPage!.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          // Close consent dialogs, login walls and other modals covering the page
          dismissedOverlays = await OverlayDismisser.dismissAll(eng.rawPage!);
          // Let modal fade-out animations finish before capturing
          await eng.rawPage!.waitForTimeout(500);
          return eng.rawPage!.screenshot({
            fullPage: input.fullPage,
            type: input.format,
            ...(input.format === 'jpeg' && input.quality ? { quality: input.quality } : {}),
          });
        });
        // One-off session: free the browser context immediately
        await engine.closeSession();

        if (!result.success || !result.data) {
          incrementRequestCounter(false);
          logger.error({ error: result.error, url: input.url }, 'Screenshot failed');
          return reply.code(500).send({
            error: 'Screenshot Error',
            message: result.error || 'Failed to capture screenshot',
          });
        }

        incrementRequestCounter(true);
        logger.info(
          {
            url: input.url,
            fileSize: result.data.length,
            executionMs: result.executionMs,
            dismissedOverlays,
          },
          'Screenshot captured successfully'
        );

        const response: ScreenshotResponse = {
          success: true,
          image: result.data.toString('base64'),
          format: input.format,
          fileSize: result.data.length,
          url: input.url,
          timestamp: new Date().toISOString(),
        };

        return reply.send(response);
      } catch (error) {
        incrementRequestCounter(false);
        logger.error({ error }, 'Failed to take screenshot');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to take screenshot',
        });
      }
    }
  );
}
