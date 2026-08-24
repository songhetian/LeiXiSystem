import { IsString, IsNotEmpty, IsOptional, IsArray, IsInt } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  roleIds?: number[];

  // 所有用户都是员工：创建账号时须指定其所属部门（员工档案）
  @IsInt()
  departmentId!: number;

  @IsInt()
  @IsOptional()
  positionId?: number;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  password?: string;
}

export class AssignUserRolesDto {
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  roleIds?: number[];
}
