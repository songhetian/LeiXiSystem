import { IsInt, IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class AdjustRunDto {
  @IsInt()
  employeeId!: number;

  @IsString()
  @IsNotEmpty()
  itemCode!: string;

  @IsString()
  @IsOptional()
  itemName?: string;

  @IsNumber()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
