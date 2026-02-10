import { IsNotEmpty, IsString } from 'class-validator';

export class FleetChatDto {
  @IsString()
  @IsNotEmpty()
  question: string;
}

