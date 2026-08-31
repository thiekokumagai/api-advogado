import { Injectable, BadRequestException } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class DocumentParserService {
  async parseBuffer(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
    const ext = filename.split('.').pop()?.toLowerCase();

    if (mimetype === 'application/pdf' || ext === 'pdf') {
      return this.parsePdf(buffer);
    }

    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword' ||
      ext === 'docx' ||
      ext === 'doc'
    ) {
      return this.parseDocx(buffer);
    }

    throw new BadRequestException('Formato de arquivo não suportado. Envie apenas arquivos PDF ou DOCX.');
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (e) {
      console.error('Erro ao extrair PDF:', e);
      throw new BadRequestException('Não foi possível ler o arquivo PDF informado.');
    }
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (e) {
      console.error('Erro ao extrair DOCX:', e);
      throw new BadRequestException('Não foi possível ler o arquivo DOCX informado.');
    }
  }
}
