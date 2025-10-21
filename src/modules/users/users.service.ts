import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  sanitize(user: any) {
    if (!user) return user;
    const obj = user.toObject ? user.toObject() : user;
    delete obj.passwordHash;
    return obj;
  }

  async create(tenantId: string, dto: CreateUserDto, by: string) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.userModel.create({
      tenantId,
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash,
      role: dto.role,
      permissions: dto.permissions || [],
      hourlyCost: dto.hourlyCost,
      active: dto.active ?? true,
      updatedBy: by,
      deletedAt: null
    });
    return this.sanitize(created);
  }

  async findByEmail(tenantId: string, email: string) {
    return this.userModel.findOne({ tenantId, email: email.toLowerCase(), deletedAt: null });
  }

  async findAll(tenantId: string, role?: string) {
    const query: any = { tenantId, deletedAt: null };
    if (role) {
      query.role = role;
    }
    const users = await this.userModel.find(query).lean();
    return users.map((user) => this.sanitize(user));
  }

  async findById(tenantId: string, id: string) {
    return this.userModel.findOne({ tenantId, _id: id, deletedAt: null });
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto, by: string) {
    const user = await this.findById(tenantId, id);
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }
    if (dto.permissions) {
      user.permissions = dto.permissions;
    }
    if (dto.name) user.name = dto.name;
    if (dto.role) user.role = dto.role;
    if (dto.hourlyCost !== undefined) user.hourlyCost = dto.hourlyCost;
    if (dto.active !== undefined) user.active = dto.active;
    user.updatedBy = by;
    await user.save();
    return this.sanitize(user);
  }
}
