import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ErrorBodyDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code: string;

  @ApiProperty({ example: 'Mensagem de erro explicativa' })
  message: string;

  @ApiPropertyOptional({ description: 'Detalhes opcionais (ex.: erros de campo)' })
  details?: any;

  @ApiPropertyOptional({ example: 'e4f0c9a2-3b07-4a7e-9c17-1b2d0e5a7f2a' })
  requestId?: string;
}

export class ErrorResponseDto {
  @ApiProperty({ type: ErrorBodyDto })
  error: ErrorBodyDto;
}

