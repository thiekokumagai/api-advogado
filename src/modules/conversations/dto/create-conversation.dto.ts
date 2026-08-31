import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecione o assistente' })
  assistantId: string;

  @IsString()
  @IsOptional()
  title?: string;
}
