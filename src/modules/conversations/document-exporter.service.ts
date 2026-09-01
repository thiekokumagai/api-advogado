import { Injectable } from '@nestjs/common';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  BorderStyle,
} from 'docx';
import * as PDFDocument from 'pdfkit';

export interface OfficeExportInfo {
  name: string;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  headerText?: string | null;
  primaryColor?: string | null;
}

@Injectable()
export class DocumentExporterService {
  // Helper to sanitize/clean content before generating PDF or DOCX
  // Strips AI preamble (conversational intro) and postamble (summaries/notes)
  cleanDocumentContent(rawContent: string): string {
    if (!rawContent) return '';

    let content = rawContent.trim();

    // 1. If content is wrapped in markdown code blocks ```...```, extract content inside code block
    const codeBlockMatch = content.match(/```(?:markdown)?\s*\n([\s\S]*?)\n```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      content = codeBlockMatch[1].trim();
    }

    // 2. Remove postambles / migration summary at the bottom (e.g. "--- Resumo da Migração:", "Resumo da Migração:", "--- Observações:")
    const postambleRegex = /\n\s*(?:---\s*\n\s*)?(?:Resumo d[aeo]|Nota Explicativa|Observaçõ?es|Caso haja necessidade|Qualquer dúvida|Espero ter ajudado)[\s\S]*$/i;
    content = content.replace(postambleRegex, '');

    // 3. Remove conversational preambles at the top (e.g. "Para realizar a migração...", "Com base em...", "Segue o contrato:")
    const lines = content.split('\n');
    let docStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === '---') continue;

      // Check if line looks like a document header/title/clause/qualificação
      const isHeading = line.startsWith('#');
      const isDocumentKeyword = /^(INSTRUMENTO|CONTRATO|TERMO|PETIÇÃO|AO JUÍZO|EXCELENTÍSSIMO|PARECER|PROCURAÇÃO|DECLARAÇÃO|NOTIFICAÇÃO|CLÁUSULA|QUALIFICAÇÃO|CONTRATANTE|CONTRATADO|ACORDO|ADITIVO|DISTRATO|REQUERIMENTO)\b/i.test(line);
      const isAllCapsTitle = line.length >= 6 && line === line.toUpperCase() && /[A-Z]/.test(line);

      if (isHeading || isDocumentKeyword || isAllCapsTitle) {
        docStartIndex = i;
        break;
      }
    }

    if (docStartIndex > 0) {
      content = lines.slice(docStartIndex).join('\n');
    }

    return content.trim();
  }

  // Generate DOCX buffer from text content with Office Timbre and Visual Law layout
  async generateDocx(
    title: string,
    content: string,
    assistantName: string,
    officeInfo?: OfficeExportInfo,
  ): Promise<Buffer> {
    const officeName = officeInfo?.name || 'Escritório de Advocacia';
    const cnpj = officeInfo?.cnpj ? `CNPJ: ${officeInfo.cnpj}` : '';
    const contactParts = [
      officeInfo?.phone ? `Tel: ${officeInfo.phone}` : null,
      officeInfo?.email ? `E-mail: ${officeInfo.email}` : null,
      officeInfo?.address ? `Endereço: ${officeInfo.address}` : null,
    ]
      .filter(Boolean)
      .join(' • ');

    // Timbre Header (Header on top of pages)
    const headerParagraphs: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: officeName.toUpperCase(),
            bold: true,
            size: 24, // 12pt
            color: '1E293B',
          }),
        ],
      }),
    ];

    if (cnpj || contactParts || officeInfo?.headerText) {
      const infoLine = [officeInfo?.headerText, cnpj, contactParts].filter(Boolean).join(' | ');
      headerParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: infoLine,
              size: 16, // 8pt
              color: '64748B',
            }),
          ],
          border: {
            bottom: {
              color: 'F59E0B', // Amber accent line
              space: 4,
              style: BorderStyle.SINGLE,
              size: 12,
            },
          },
        }),
      );
    }

    // Document Body Content
    const cleanedContent = this.cleanDocumentContent(content);
    const lines = cleanedContent.split('\n');
    const bodyParagraphs: Paragraph[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('# ')) {
        // Document Title (# TÍTULO)
        const cleanText = trimmed.replace('# ', '').trim().toUpperCase();
        bodyParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 180 },
            children: [
              new TextRun({
                text: cleanText,
                bold: true,
                size: 28, // 14pt
                color: '0F172A',
              }),
            ],
          }),
        );
      } else if (trimmed.startsWith('## ')) {
        // Section Title / Cláusula (## CLÁUSULA)
        const cleanText = trimmed.replace('## ', '').trim();
        bodyParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: cleanText,
                bold: true,
                size: 24, // 12pt
                color: '1E293B',
              }),
            ],
          }),
        );
      } else if (trimmed.length === 0) {
        bodyParagraphs.push(new Paragraph({ text: '', spacing: { after: 100 } }));
      } else {
        // Process inline Markdown bold (**texto**)
        const runs: TextRun[] = [];
        const parts = trimmed.split(/(\*\*.*?\*\*)/g);

        for (const part of parts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            runs.push(
              new TextRun({
                text: part.slice(2, -2),
                bold: true,
                size: 22, // 11pt
                color: '0F172A',
              }),
            );
          } else {
            runs.push(
              new TextRun({
                text: part,
                size: 22, // 11pt
                color: '1E293B',
              }),
            );
          }
        }

        bodyParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 140, line: 276 }, // 1.15 line spacing
            children: runs,
          }),
        );
      }
    }

    // Create DOCX Document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1134, // ~2cm
                bottom: 1134,
                left: 1417, // ~2.5cm
                right: 1417,
              },
            },
          },
          headers: {
            default: new Header({
              children: headerParagraphs,
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  border: {
                    top: {
                      color: 'E2E8F0',
                      space: 4,
                      style: BorderStyle.SINGLE,
                      size: 6,
                    },
                  },
                  spacing: { before: 100 },
                  children: [
                    new TextRun({
                      text: `Página `,
                      size: 16,
                      color: '94A3B8',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 16,
                      color: '94A3B8',
                    }),
                  ],
                }),
              ],
            }),
          },
          children: bodyParagraphs,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  // Generate PDF buffer from text content with Timbre and Visual Law
  async generatePdf(
    title: string,
    content: string,
    assistantName: string,
    officeInfo?: OfficeExportInfo,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        bufferPages: true,
      });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const officeName = officeInfo?.name || 'Escritório de Advocacia';
      const cnpj = officeInfo?.cnpj ? `CNPJ: ${officeInfo.cnpj}` : '';
      const contactParts = [
        officeInfo?.phone ? `Tel: ${officeInfo.phone}` : null,
        officeInfo?.email ? `E-mail: ${officeInfo.email}` : null,
      ]
        .filter(Boolean)
        .join(' • ');

      // Header Timbre (First Page Header)
      doc.fillColor('#1E293B').fontSize(14).font('Helvetica-Bold').text(officeName.toUpperCase(), {
        align: 'center',
      });

      const infoLine = [officeInfo?.headerText, cnpj, contactParts].filter(Boolean).join(' | ');
      if (infoLine) {
        doc.moveDown(0.2);
        doc.fillColor('#64748B').fontSize(8).font('Helvetica').text(infoLine, { align: 'center' });
      }

      // Amber Dividing Line
      doc.moveDown(0.4);
      const currentY = doc.y;
      doc
        .strokeColor('#F59E0B')
        .lineWidth(1.5)
        .moveTo(50, currentY)
        .lineTo(doc.page.width - 50, currentY)
        .stroke();

      doc.moveDown(1);

      // Body Content
      const cleanedContent = this.cleanDocumentContent(content);
      const lines = cleanedContent.split('\n');

      // Remove trailing empty lines to prevent PDFKit from creating extra blank pages at the end
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
      }

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('# ')) {
          const cleanText = trimmed.replace('# ', '').trim().toUpperCase();
          doc.fillColor('#0F172A').fontSize(13).font('Helvetica-Bold').text(cleanText, {
            align: 'center',
          });
          doc.moveDown(0.6);
        } else if (trimmed.startsWith('## ')) {
          const cleanText = trimmed.replace('## ', '').trim();
          doc.fillColor('#1E293B').fontSize(11).font('Helvetica-Bold').text(cleanText, {
            align: 'left',
          });
          doc.moveDown(0.4);
        } else if (trimmed.length === 0) {
          doc.moveDown(0.3);
        } else {
          const cleanText = trimmed.replace(/\*\*(.*?)\*\*/g, '$1');
          doc.fillColor('#334155').fontSize(10).font('Helvetica').text(cleanText, {
            align: 'justify',
            lineGap: 3,
          });
          doc.moveDown(0.4);
        }
      }

      // Footer and Page Numbers on all buffered pages
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        const footerY = doc.page.height - 35;

        // Footer line
        doc
          .strokeColor('#E2E8F0')
          .lineWidth(0.5)
          .moveTo(50, footerY - 5)
          .lineTo(doc.page.width - 50, footerY - 5)
          .stroke();

        doc
          .fillColor('#94A3B8')
          .fontSize(8)
          .font('Helvetica')
          .text(
            `Página ${i + 1} de ${totalPages}`,
            50,
            footerY,
            { align: 'center', width: doc.page.width - 100, lineBreak: false },
          );
      }

      doc.end();
    });
  }
}
