import { ArrayMinSize, IsArray, ValidateNested } from "class-validator"
import { Type } from "class-transformer"
import { OrderItemDto } from "./order-item.dto"

export class CreateOrderDto {
    /* Se cambia todo el DTO anterior porque ahora
       vamos a incluir el order item.
       En github se pueden ver los cambios en el history
    */
   @IsArray()
   @ArrayMinSize(1)
   @ValidateNested({each: true})
   @Type(()=>OrderItemDto)
   items: OrderItemDto[]
}
