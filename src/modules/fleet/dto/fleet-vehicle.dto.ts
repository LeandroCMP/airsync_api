import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class FleetCheckDtoDoc {
  @ApiProperty({ example: '2025-10-31T10:00:00.000Z' }) at: Date;
  @ApiProperty({ example: 12345 }) km: number;
  @ApiProperty({ example: 80 }) fuelLevel: number;
  @ApiPropertyOptional({ type: [String], example: [] }) photos?: string[];
  @ApiPropertyOptional({ example: 'Vistoria diária OK' }) notes?: string;
}

class FuelLogDtoDoc {
  @ApiProperty({ example: '2025-10-31T11:15:00.000Z' }) at: Date;
  @ApiProperty({ example: 12400 }) km: number;
  @ApiProperty({ example: 30 }) liters: number;
  @ApiProperty({ example: 'diesel', description: 'gasoline | ethanol | diesel | gnv' }) fuelType: string;
  @ApiProperty({ example: 210.5 }) cost: number;
}

class MaintenanceEntryDtoDoc {
  @ApiProperty({ example: 'Troca de óleo' }) type: string;
  @ApiProperty({ example: '2025-10-31T12:00:00.000Z' }) at: Date;
  @ApiProperty({ example: 12500 }) atKm: number;
  @ApiProperty({ example: 180 }) cost: number;
  @ApiPropertyOptional({ example: 'Óleo 5W30 e filtro' }) notes?: string;
}

export class FleetVehicleDto {
  @ApiProperty({ example: '665f1a2b3c4d5e6f7a8b9c0d' }) _id: string;
  @ApiProperty({ example: 'ABC1D23' }) plate: string;
  @ApiPropertyOptional({ example: 'Fiorino' }) model?: string;
  @ApiPropertyOptional({ example: 2021 }) year?: number;
  @ApiPropertyOptional({ example: 'TEAM123' }) teamId?: string;
  @ApiProperty({ example: 12500 }) odometer: number;
  @ApiPropertyOptional({ type: [FleetCheckDtoDoc] }) checks?: FleetCheckDtoDoc[];
  @ApiPropertyOptional({ type: [FuelLogDtoDoc] }) fuelLogs?: FuelLogDtoDoc[];
  @ApiPropertyOptional({ type: [MaintenanceEntryDtoDoc] }) maintenances?: MaintenanceEntryDtoDoc[];
  @ApiPropertyOptional({ example: '2025-10-31T09:00:00.000Z' }) createdAt?: Date;
  @ApiPropertyOptional({ example: '2025-10-31T12:05:00.000Z' }) updatedAt?: Date;
}

export class PagedFleetVehiclesDto {
  @ApiProperty({
    type: [FleetVehicleDto],
    example: [
      {
        _id: '665f1a2b3c4d5e6f7a8b9c0d',
        plate: 'ABC1D23',
        model: 'Fiorino',
        year: 2021,
        teamId: 'TEAM123',
        odometer: 12500,
        checks: [
          { at: '2025-10-31T10:00:00.000Z', km: 12345, fuelLevel: 80, photos: [], notes: 'Vistoria diária OK' }
        ],
        fuelLogs: [
          { at: '2025-10-31T11:15:00.000Z', km: 12400, liters: 30, fuelType: 'diesel', cost: 210.5 }
        ],
        maintenances: [
          { type: 'Troca de óleo', at: '2025-10-31T12:00:00.000Z', atKm: 12500, cost: 180 }
        ],
        createdAt: '2025-10-31T09:00:00.000Z',
        updatedAt: '2025-10-31T12:05:00.000Z'
      }
    ]
  })
  items: FleetVehicleDto[];
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 10 }) limit: number;
  @ApiProperty({ example: 1 }) total: number;
}
