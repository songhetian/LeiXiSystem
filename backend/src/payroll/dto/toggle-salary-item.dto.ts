import { IsBoolean } from 'class-validator';

export class ToggleSalaryItemDto {
  @IsBoolean()
  enabled!: boolean;
}
