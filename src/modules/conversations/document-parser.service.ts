import { Injectable, BadRequestException } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class DocumentParserService {
  async parseBuffer(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
    const ext = filename.split('.').pop()?.toLowerCase();

    if (mimetype === 'application/pdf' || ext === 'pdf') {
      return this.parsePdf(buffer, filename);
    }

    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword' ||
      ext === 'docx' ||
      ext === 'doc'
    ) {
      return this.parseDocx(buffer, filename);
    }

    throw new BadRequestException('Formato de arquivo não suportado. Envie apenas arquivos PDF ou DOCX.');
  }

  private async parsePdf(buffer: Buffer, filename: string): Promise<string> {
    try {
      // pdf-parse com limite zero (ilimitado)
      const data = await pdfParse(buffer, { max: 0 });
      if (data && data.text && data.text.trim().length > 0) {
        return data.text.trim();
      }
      return `[Arquivo PDF "${filename}" anexado - PDF digitalizado/imagem sem camada de texto extraível]`;
    } catch (e: any) {
      console.warn(`Aviso na extração do PDF ${filename}:`, e?.message || e);
      
      // Tentativa de extração alternativa via regex no stream do PDF
      try {
        const rawString = buffer.toString('latin1');
        const matches = rawString.match(/\(([^()]+)\)/g);
        if (matches && matches.length > 10) {
          const extracted = matches
            .map((m) => m.replace(/[()]/g, ''))
            .filter((t) => t.length > 2)
            .join(' ');
          if (extracted.length > 50) {
            return extracted;
          }
        }
      } catch (fallbackErr) {
        console.warn('Fallback PDF extraction failed:', fallbackErr);
      }

      return `[Arquivo PDF "${filename}" anexado com sucesso - Conteúdo PDF em formato protegido/complexo]`;
    }
  }

  private async parseDocx(buffer: Buffer, filename: string): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result && result.value && result.value.trim().length > 0) {
        return result.value.trim();
      }
      return `[Arquivo DOCX "${filename}" anexado - Sem conteúdo textual identificável]`;
    } catch (e: any) {
      console.warn(`Aviso na extração do DOCX ${filename}:`, e?.message || e);
      return `[Arquivo DOCX "${filename}" anexado com sucesso]`;
    }
  }
}
