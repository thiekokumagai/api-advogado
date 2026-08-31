import { Injectable } from '@nestjs/common';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class DocumentExporterService {
  // Generate DOCX buffer from text content
  async generateDocx(title: string, content: string, assistantName: string): Promise<Buffer> {
    const lines = content.split('\n');

    const paragraphs: Paragraph[] = [
      new Paragraph({
        text: title.toUpperCase(),
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Gerado por: ', bold: true }),
          new TextRun({ text: `${assistantName} - Portal IA para Advogados` }),
          new TextRun({ text: ` | Data: ${new Date().toLocaleDateString('pt-BR')}`, italics: true }),
        ],
        spacing: { after: 400 },
      }),
    ];

    for (const line of lines) {
      if (line.trim().startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace('# ', '').trim(),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
        );
      } else if (line.trim().startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace('## ', '').trim(),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 150, after: 80 },
          }),
        );
      } else if (line.trim().length === 0) {
        paragraphs.push(new Paragraph({ text: '', spacing: { after: 100 } }));
      } else {
        // Clean markdown bold tags
        const formattedText = line.replace(/\*\*(.*?)\*\*/g, '$1');
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: formattedText, size: 24 })], // 12pt
            spacing: { after: 120 },
          }),
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  // Generate PDF buffer from text content using PDFKit
  async generatePdf(title: string, content: string, assistantName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Header
      doc.fontSize(16).font('Helvetica-Bold').text(title.toUpperCase(), { align: 'center' });
      doc.moveDown(0.5);

      doc
        .fontSize(9)
        .font('Helvetica-Oblique')
        .fillColor('#666666')
        .text(`Elaborado via Portal IA para Advogados | ${assistantName} | ${new Date().toLocaleDateString('pt-BR')}`, {
          align: 'center',
        });
      doc.moveDown(1.5);
      doc.fillColor('#000000');

      // Body Content
      const lines = content.split('\n');
      for (const line of lines) {
        const cleanLine = line.replace(/\*\*(.*?)\*\*/g, '$1');

        if (line.trim().startsWith('# ') || line.trim().startsWith('## ')) {
          doc.fontSize(13).font('Helvetica-Bold').text(cleanLine.replace(/#/g, '').trim());
          doc.moveDown(0.5);
        } else if (line.trim().length === 0) {
          doc.moveDown(0.3);
        } else {
          doc.fontSize(11).font('Helvetica').text(cleanLine, { align: 'justify' });
          doc.moveDown(0.4);
        }
      }

      doc.end();
    });
  }
}
