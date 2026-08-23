import { IsString, IsNotEmpty } from 'class-validator';

export class CreateRunDto {
  @IsString()
  @IsNotEmpty()
  month!: string;
}
