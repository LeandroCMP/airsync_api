import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FleetVehicle, FleetVehicleDocument } from './fleet-vehicle.schema';
import { OpenAiService } from '../../core/openai/openai.service';

@Injectable()
export class FleetInsightsService {
  constructor(
    @InjectModel(FleetVehicle.name) private readonly fleetModel: Model<FleetVehicleDocument>,
    private readonly openAi: OpenAiService
  ) {}

  async maintenanceRecommendations(tenantId: string) {
    const payload = await this.buildFleetSummary(tenantId);
    const prompt = `You are a fleet maintenance assistant. Analyze the following vehicles and list prioritized maintenance recommendations, referencing vehicle plates. If data is missing, highlight it.\n\n${payload}`;
    const text = await this.generate(prompt);
    return { recommendations: text };
  }

  async chat(tenantId: string, question: string) {
    const payload = await this.buildFleetSummary(tenantId);
    const prompt = `You are a fleet operations assistant. Use the fleet data below to answer the user question clearly.\n\nFleet data:\n${payload}\n\nQuestion: ${question}`;
    const text = await this.generate(prompt);
    return { answer: text };
  }

  private async buildFleetSummary(tenantId: string) {
    const vehicles = await this.fleetModel.find({ tenantId, deletedAt: null }).lean();
    if (!vehicles.length) {
      return 'No vehicles registered.';
    }
    return vehicles
      .map((vehicle) => {
        const lastFuel = this.getLastEntry(vehicle.fuelLogs);
        const lastMaintenance = this.getLastEntry(vehicle.maintenances);
        const lastCheck = this.getLastEntry(vehicle.checks);
        return [
          `Plate: ${vehicle.plate}`,
          `Model: ${vehicle.model || 'n/a'}`,
          `Odometer: ${vehicle.odometer || 0}`,
          `Last fuel: ${lastFuel ? `${lastFuel.liters}L @ ${lastFuel.km}km on ${this.fmt(lastFuel.at)}` : 'none'}`,
          `Last maintenance: ${lastMaintenance ? `${lastMaintenance.type} at ${lastMaintenance.atKm}km on ${this.fmt(lastMaintenance.at)} (R$${lastMaintenance.cost})` : 'none'}`,
          `Last check: ${lastCheck ? `${lastCheck.notes || 'ok'} on ${this.fmt(lastCheck.at)}` : 'none'}`
        ].join(' | ');
      })
      .join('\n');
  }

  private getLastEntry(entries?: any[]) {
    if (!entries?.length) return null;
    return entries
      .slice()
      .sort((a, b) => new Date(b.at || b.km || 0).getTime() - new Date(a.at || a.km || 0).getTime())[0];
  }

  private fmt(date?: any) {
    if (!date) return 'n/a';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return 'n/a';
    return d.toISOString().slice(0, 10);
  }

  private async generate(prompt: string) {
    if (!this.openAi.isEnabled) {
      throw new InternalServerErrorException({
        code: 'OPENAI_DISABLED',
        message: 'OpenAI API key not configured'
      });
    }
    return this.openAi.generateInsight(prompt);
  }
}

