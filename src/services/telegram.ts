import { env } from '../config/env.js';
import logger from '../observability/logger.js';

export interface TelegramMessageOptions {
  /** Override the default TELEGRAM_ALERTS_CHAT_ID. */
  chatId?: string;
  /** Override the default TELEGRAM_ALERTS_CHAT_MESSAGE_THREAD_ID (group topic/thread). */
  messageThreadId?: string;
}

/** Signature line appended to every message so recipients know the source. */
const MESSAGE_FOOTER = '👉 Inviato da scraper.airelite.it';

/**
 * Send a plain-text message to the configured Telegram alerts chat via the bot.
 *
 * Standalone, fire-and-forget helper usable from any scenario or service (e.g. to report
 * errors). It never throws, so it is safe to call from error-handling paths.
 *
 * Returns `false` (and logs a warning) without sending when the Telegram env vars are not
 * configured, or (and logs an error) when the send fails. Returns `true` on success.
 */
export async function sendTelegramMessage(
  text: string,
  options: TelegramMessageOptions = {}
): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId ?? env.TELEGRAM_ALERTS_CHAT_ID;
  const messageThreadId = options.messageThreadId ?? env.TELEGRAM_ALERTS_CHAT_MESSAGE_THREAD_ID;

  if (!token || !chatId) {
    logger.warn(
      'Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_ALERTS_CHAT_ID missing); skipping message'
    );
    return false;
  }

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: `${text}\n\n${MESSAGE_FOOTER}`,
    };
    // Telegram requires the numeric thread id to post into a specific group topic.
    if (messageThreadId) {
      body.message_thread_id = Number(messageThreadId);
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      logger.error({ status: response.status, responseBody }, 'Telegram sendMessage failed');
      return false;
    }

    logger.info({ chatId }, 'Telegram message sent');
    return true;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Telegram sendMessage error'
    );
    return false;
  }
}
