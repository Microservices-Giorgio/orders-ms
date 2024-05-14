import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChangeOrderStatusDto, CreateOrderDto, OrderPaginationDto } from './dto/index';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaClient } from '@prisma/client';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit{
  private readonly logger = new Logger('OrdersService')

  async onModuleInit() {
   await this.$connect()
   this.logger.log('Database connected')
  }



  create(createOrderDto: CreateOrderDto) {
    return this.order.create({
      data: createOrderDto
    });
  }

  async findAll(orderPaginationDto:OrderPaginationDto) {
    const totalPage = await this.order.count({
      where: {
        status: orderPaginationDto.status
      }
    })
    
    const currentPage = orderPaginationDto.page
    const perPage = orderPaginationDto.limit

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPage,
        take: perPage,
        where: {
          status: orderPaginationDto.status
        }
      }),
      meta: {
        total: totalPage,
        page: currentPage,
        lastPage: Math.ceil(totalPage/perPage)
      }
    }
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: {
        id
      }
    });

    if(!order){
      throw new RpcException({
        message: 'This order not found',
        status: HttpStatus.NOT_FOUND
      })
    }

    return order
  }

  async changeStatus(changerOrderStatusDto: ChangeOrderStatusDto){
    const {id, status} = changerOrderStatusDto
    const order = await this.findOne(id)
    
    if(order.status === status){
      return order
    }

    return this.order.update({
      where: {id},
      data: {
        status
      }
    })
  }
}
