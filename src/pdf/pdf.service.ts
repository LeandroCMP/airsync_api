import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { FilesService } from '../core/files/files.service';

@Injectable()
export class PdfService {
  constructor(private readonly filesService: FilesService) {}

  async generateOrderPdf(order: any, type: 'report' | 'budget' | 'warranty') {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    doc.fontSize(20).text(`Ordem de Serviço ${order._id}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Tipo de documento: ${type}`);
    doc.text(`Cliente: ${order.clientId}`);
    doc.text(`Local: ${order.locationId}`);
    if (order.equipmentId) doc.text(`Equipamento: ${order.equipmentId}`);
    doc.text(`Status: ${order.status}`);
    if (order.scheduledAt) doc.text(`Agendada para: ${new Date(order.scheduledAt).toLocaleString()}`);
    if (order.finishedAt) doc.text(`Finalizada em: ${new Date(order.finishedAt).toLocaleString()}`);
    doc.moveDown();
    doc.fontSize(16).text('Materiais', { underline: true });
    order.materials?.forEach((m) => {
      doc.fontSize(12).text(`- Item ${m.itemId}: ${m.qty}`);
    });
    doc.moveDown();
    doc.fontSize(16).text('Faturamento', { underline: true });
    order.billing?.items?.forEach((item) => {
      doc.fontSize(12).text(`${item.type} - ${item.name} x${item.qty} = R$ ${(item.qty * item.unitPrice).toFixed(2)}`);
    });
    doc.text(`Subtotal: R$ ${order.billing?.subtotal?.toFixed(2)}`);
    doc.text(`Desconto: R$ ${order.billing?.discount?.toFixed(2)}`);
    doc.text(`Total: R$ ${order.billing?.total?.toFixed(2)}`);
    doc.end();

    return new Promise((resolve) => {
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        const url = await this.filesService.saveBuffer(buffer, 'pdf');
        resolve({ url });
      });
    });
  }
}
