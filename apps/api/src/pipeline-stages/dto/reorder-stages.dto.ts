import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  ValidateNested,
} from 'class-validator';

class StageOrderItem {
  @IsString()
  id: string;

  @IsInt()
  order: number;
}

export class ReorderStagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StageOrderItem)
  stages: StageOrderItem[];
}
