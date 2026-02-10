import { IsNotEmpty, IsString } from 'class-validator';

export class OrderAssistantDto {
  @IsString()
  @IsNotEmpty()
  question: string;
}

