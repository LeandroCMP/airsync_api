import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not configured. AI insights are disabled.');
    }
  }

  get isEnabled() {
    return !!this.client;
  }

  async generateInsight(prompt: string, model = 'gpt-4o-mini') {
    if (!this.client) {
      throw new InternalServerErrorException({
        code: 'OPENAI_DISABLED',
        message: 'OpenAI API key not configured'
      });
    }
    const completion = await this.client.responses.create({
      model,
      input: prompt
    });
    const outputText: string | string[] | undefined = (completion as any).output_text;
    const text = Array.isArray(outputText)
      ? outputText.join('\n')
      : outputText || '';
    return text.trim() || 'No insight generated.';
  }
}
