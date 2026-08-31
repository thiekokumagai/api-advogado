import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAssistantDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome do assistente é obrigatório' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Ícone é obrigatório' })
  icon: string;

  @IsString()
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  description: string;

  @IsString()
  @IsNotEmpty({ message: 'Prompt do sistema é obrigatório' })
  systemPrompt: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  order?: number;
}
