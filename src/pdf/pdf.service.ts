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

  async generateEquipmentHistoryPdf(equipment: any, orders: any[], history: any[], newOwner?: string) {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    doc.fontSize(20).text(`Relatório do Equipamento ${equipment._id}`, { align: 'center' });
    doc.moveDown();
    if (newOwner) doc.fontSize(14).text(`Novo proprietário: ${newOwner}`);
    doc.fontSize(12).text(`Cliente atual: ${equipment.clientId}`);
    doc.text(`Local atual: ${equipment.locationId}`);
    if (equipment.room) doc.text(`Cômodo: ${equipment.room}`);
    if (equipment.brand) doc.text(`Marca/Modelo: ${equipment.brand || ''} ${equipment.model || ''}`.trim());
    if (equipment.btus) doc.text(`BTUs: ${equipment.btus}`);
    if (equipment.serial) doc.text(`Serial: ${equipment.serial}`);
    if (equipment.installDate) doc.text(`Instalação: ${new Date(equipment.installDate).toLocaleDateString()}`);

    doc.moveDown().fontSize(16).text('Histórico de OS', { underline: true });
    orders.forEach((o) => {
      const sch = o.scheduledAt ? new Date(o.scheduledAt).toLocaleString() : '-';
      const fin = o.finishedAt ? new Date(o.finishedAt).toLocaleString() : '-';
      doc.fontSize(12).text(`OS ${o._id} | Status: ${o.status} | Agendada: ${sch} | Finalizada: ${fin}`);
    });

    doc.moveDown().fontSize(16).text('Eventos do Equipamento', { underline: true });
    history.forEach((h) => {
      doc.fontSize(12).text(
        `${new Date(h.at).toLocaleString()} - ${h.type}${h.notes ? ' - ' + h.notes : ''}`
      );
    });

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
