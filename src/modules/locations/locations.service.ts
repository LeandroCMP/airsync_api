import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Location, LocationDocument } from './location.schema';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(@InjectModel(Location.name) private readonly locationModel: Model<LocationDocument>) {}

  async create(tenantId: string, dto: CreateLocationDto, userId: string) {
    const location = await this.locationModel.create({
      tenantId,
      clientId: dto.clientId,
      label: dto.label,
      address: dto.address,
      geo: dto.geo,
      notes: dto.notes,
      updatedBy: userId,
      deletedAt: null
    });
    return location.toObject();
  }

  async findAll(tenantId: string, clientId?: string) {
    const query: any = { tenantId, deletedAt: null };
    if (clientId) query.clientId = clientId;
    return this.locationModel.find(query).lean();
  }

  async findById(tenantId: string, id: string) {
    const location = await this.locationModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!location) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Location not found' });
    }
    return location;
  }

  async update(tenantId: string, id: string, dto: UpdateLocationDto, userId: string) {
    const location = await this.findById(tenantId, id);
    if (dto.label) location.label = dto.label;
    if (dto.address) location.address = dto.address;
    if (dto.geo) location.geo = dto.geo;
    if (dto.notes !== undefined) location.notes = dto.notes;
    location.updatedBy = userId;
    await location.save();
    return location.toObject();
  }
}
