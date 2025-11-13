import { IsNotEmpty, IsString } from 'class-validator';

export class SalesChatDto {
  @IsString()
  @IsNotEmpty()
  question: string;
}

