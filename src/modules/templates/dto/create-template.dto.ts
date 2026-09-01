import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty({ message: 'Título do modelo é obrigatório' })
  title: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  fileType?: string;

  @IsString()
  @IsNotEmpty({ message: 'Conteúdo do modelo é obrigatório' })
  content: string;
}
