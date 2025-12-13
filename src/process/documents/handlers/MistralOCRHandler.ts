import { readFile } from 'fs/promises';
import fetch from 'node-fetch';

export class MistralOCRHandler {
  constructor(private apiKey: string) {}

  async extractText(filePath: string): Promise<{
    text: string;
    pageCount: number;
    wordCount: number;
  }> {
    const fileBuffer = await readFile(filePath);
    const responseText = await this.callMistralAPI(fileBuffer);

    // Assuming one page for now, Mistral API doesn't give page count
    const pageCount = 1;
    const textWithBreaks = this.addPageBreaks(responseText, pageCount);
    const wordCount = textWithBreaks.split(/\s+/).length;

    return { text: textWithBreaks, pageCount, wordCount };
  }

  private async callMistralAPI(fileBuffer: Buffer): Promise<string> {
    const base64Image = fileBuffer.toString('base64');
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'pixtral-large-latest',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
              {
                type: 'text',
                text: 'Extract all text content from this document image. Preserve the original formatting as much as possible.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral API request failed with status ${response.status}`);
    }

    const data = (await response.json()) as any;
    return data.choices[0].message.content;
  }

  private addPageBreaks(text: string, pageCount: number): string {
    if (pageCount <= 1) {
      return text;
    }
    // A simple way to add page breaks, assuming the API returns text for all pages concatenated.
    // A more sophisticated approach would be needed if the API gave per-page text.
    const lines = text.split('\n');
    const linesPerPage = Math.ceil(lines.length / pageCount);
    let result = '';
    for (let i = 0; i < pageCount; i++) {
      result += `--- Page ${i + 1} ---\n`;
      result += lines.slice(i * linesPerPage, (i + 1) * linesPerPage).join('\n');
      result += '\n';
    }
    return result;
  }
}
