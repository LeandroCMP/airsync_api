import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleCheckDto } from './dto/vehicle-check.dto';
import { VehicleFuelDto } from './dto/vehicle-fuel.dto';
import { VehicleMaintenanceDto } from './dto/vehicle-maintenance.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';
import { ApiBadRequestResponse, ApiBody, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { FleetVehicleDto, PagedFleetVehiclesDto } from './dto/fleet-vehicle.dto';

@Controller('fleet/vehicles')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Post()
  @Permissions('fleet.write')
  @ApiOperation({ summary: 'Criar veículo' })
  @ApiBadRequestResponse({ description: 'Erro de validação', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  @ApiBody({
    type: CreateVehicleDto,
    examples: {
      basico: {
        summary: 'Exemplo básico',
        value: { plate: 'ABC1D23', model: 'Fiorino', year: 2021 }
      },
      comEquipe: {
        summary: 'Com equipe e centro de custo',
        value: { plate: 'XYZ4E56', model: 'Ducato', year: 2022, teamId: 'TEAM123', costCenter: 'OPERACOES' }
      }
    }
  })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateVehicleDto
  ) {
    const vehicle = await this.fleetService.create(tenantId, dto, user.id);
    return withAudit(vehicle, {
      tenantId,
      entity: 'fleet_vehicles',
      entityId: vehicle._id,
      action: 'create',
      after: vehicle,
      by: user.id
    });
  }

  @Get()
  @Permissions('fleet.read')
  @ApiOperation({ summary: 'Listar veículos (com filtros e paginação)' })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  @ApiQuery({ name: 'text', required: false, description: 'Busca por placa/modelo' })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date (createdAt >= from)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date (createdAt <= to)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Campo de ordenação',
    enum: ['createdAt', 'odometer', 'plate']
  })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiOkResponse({ description: 'Lista paginada de veículos', type: PagedFleetVehiclesDto })
  async list(
    @TenantId() tenantId: string,
    @Query('text') text?: string,
    @Query('teamId') teamId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: 'createdAt' | 'odometer' | 'plate',
    @Query('order') order?: 'asc' | 'desc'
  ) {
    return this.fleetService.list(tenantId, {
      text,
      teamId,
      from,
      to,
      page: Number(page),
      limit: Number(limit),
      sort,
      order
    });
  }

  @Get(':id')
  @Permissions('fleet.read')
  @ApiOperation({ summary: 'Detalhar veículo' })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Veículo não encontrado', type: ErrorResponseDto })
  @ApiOkResponse({ description: 'Veículo', type: FleetVehicleDto })
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    const vehicle = await this.fleetService.findById(tenantId, id);
    return vehicle.toObject();
  }

  @Post(':id/check')
  @Permissions('fleet.write')
  @ApiOperation({ summary: 'Registrar vistoria (check) do veículo' })
  @ApiBadRequestResponse({ description: 'Validação/odômetro', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  @ApiBody({
    schema: {
      example: {
        at: '2025-10-31T10:00:00.000Z',
        km: 12345,
        fuelLevel: 80,
        notes: 'Vistoria diária OK'
      }
    }
  })
  async check(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: VehicleCheckDto
  ) {
    const vehicle = await this.fleetService.addCheck(tenantId, id, dto);
    return withAudit(vehicle, {
      tenantId,
      entity: 'fleet_vehicles',
      entityId: id,
      action: 'update',
      after: vehicle,
      by: user.id
    });
  }

  @Post(':id/fuel')
  @Permissions('fleet.write')
  @ApiOperation({ summary: 'Registrar abastecimento' })
  @ApiBadRequestResponse({ description: 'Validação/odômetro', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  @ApiBody({
    schema: {
      example: {
        at: '2025-10-31T11:15:00.000Z',
        km: 12400,
        liters: 30,
        fuelType: 'diesel',
        cost: 210.5
      }
    }
  })
  async fuel(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: VehicleFuelDto
  ) {
    const vehicle = await this.fleetService.addFuel(tenantId, id, dto);
    return withAudit(vehicle, {
      tenantId,
      entity: 'fleet_vehicles',
      entityId: id,
      action: 'update',
      after: vehicle,
      by: user.id
    });
  }

  @Post(':id/maintenance')
  @Permissions('fleet.write')
  @ApiOperation({ summary: 'Registrar manutenção' })
  @ApiBadRequestResponse({ description: 'Validação/odômetro', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  @ApiBody({
    schema: {
      example: {
        type: 'Troca de óleo',
        at: '2025-10-31T12:00:00.000Z',
        atKm: 12500,
        cost: 180,
        notes: 'Óleo 5W30 e filtro'
      }
    }
  })
  async maintenance(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: VehicleMaintenanceDto
  ) {
    const vehicle = await this.fleetService.addMaintenance(tenantId, id, dto);
    return withAudit(vehicle, {
      tenantId,
      entity: 'fleet_vehicles',
      entityId: id,
      action: 'update',
      after: vehicle,
      by: user.id
    });
  }

  @Patch(':id')
  @Permissions('fleet.write')
  @ApiOperation({ summary: 'Atualizar veículo' })
  @ApiBadRequestResponse({ description: 'Validação/odômetro', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  @ApiBody({
    schema: {
      example: {
        teamId: 'TEAM123',
        costCenter: 'OPERACOES'
      }
    }
  })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: Partial<{ plate: string; model?: string; year?: number; teamId?: string; odometer?: number; costCenter?: string }>
  ) {
    const before = await this.fleetService.findById(tenantId, id);
    const updated = await this.fleetService.update(tenantId, id, dto, user.id);
    return withAudit(updated, {
      tenantId,
      entity: 'fleet_vehicles',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: updated,
      by: user.id
    });
  }

  @Delete(':id')
  @Permissions('fleet.write')
  @ApiOperation({ summary: 'Excluir veículo (soft delete)' })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    const before = await this.fleetService.findById(tenantId, id);
    const removed = await this.fleetService.remove(tenantId, id, user.id);
    return withAudit({ success: true }, {
      tenantId,
      entity: 'fleet_vehicles',
      entityId: id,
      action: 'delete',
      before: before.toObject(),
      after: removed,
      by: user.id
    });
  }

  @Get(':id/events')
  @Permissions('fleet.read')
  @ApiOperation({ summary: 'Listar histórico de eventos do veículo (check/fuel/maintenance)' })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date (at >= from)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date (at <= to)' })
  @ApiQuery({ name: 'type', required: false, enum: ['check', 'fuel', 'maintenance'] })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async events(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: 'check' | 'fuel' | 'maintenance',
    @Query('order') order?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.fleetService.events(tenantId, id, { from, to, type, order, page: Number(page), limit: Number(limit) });
  }
}
