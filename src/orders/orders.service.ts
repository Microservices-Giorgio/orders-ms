import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChangeOrderStatusDto, CreateOrderDto, OrderPaginationDto, PaidOrderDto } from './dto/index';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { NATS_SERVICE} from 'src/config/services';
import { firstValueFrom } from 'rxjs';
import { OrderWithProducts } from './interfaces/order-with-products.interface';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit{
  private readonly logger = new Logger('OrdersService')

  constructor(
    @Inject(NATS_SERVICE) private readonly client: ClientProxy
  ){
    super();
  }

  async onModuleInit() {
   await this.$connect()
   this.logger.log('Database connected')
  }



  async create(createOrderDto: CreateOrderDto) {

    try {
      // Confirmar los ids de los productos
      const productsIds = createOrderDto.items.map(item=>item.productId)

      const products = await firstValueFrom(
        this.client.send({cmd: 'validate_products'},productsIds)
      )

      /* Calculo el precio total basado en la cantidad de elementos comprados
         Ejemplo compro el 2 items del producto 1 cuyo precio es 50 y 1 item del
         producto 5 cuyo precio 100 el total seria 200
      */
      const totalAmount = createOrderDto.items.reduce((acc,orderItem)=>{
        const price = products.find(
          (product) => product.id === orderItem.productId
        ).price

        return (price * orderItem.quantity)+acc

      },0)
      
      // Cantidad de elementos a llevar
      const totalItems = createOrderDto.items.reduce((acc,orderItem)=>{
        return acc + orderItem.quantity
      },0)

      // Crear una transaccion de base de datos
      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map((orderItem)=>({
                price: products.find(
                  (product) => product.id === orderItem.productId).price,
                productId:orderItem.productId,
                quantity: orderItem.quantity
              }))
            }
          }
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true
            }
          }
        }
      })

      return {
        ...order,
        OrderItem: order.OrderItem.map((orderItem)=>({
          ...orderItem,
          name: products.find((product)=>product.id===orderItem.productId).name
        }))
      }
      
    } catch (error) {
      throw new RpcException(error)
    }
    
    
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
      },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true
          }
        }
      }
    });

    if(!order){
      throw new RpcException({
        message: 'This order not found',
        status: HttpStatus.NOT_FOUND
      })
    }

    const productIds = order.OrderItem.map((orderItem)=>orderItem.productId)

    const products = await firstValueFrom(
      this.client.send({cmd: 'validate_products'},productIds)
    )

    return {
      ...order,
      OrderItem: order.OrderItem.map((orderItem)=>({
        ...orderItem,
        name: products.find((product)=>product.id === orderItem.productId).name
      }))
    }
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

  async createPaymentSession(order:OrderWithProducts){
    const paymentSession = await firstValueFrom(
      this.client.send('create.payment.session', {
        orderId: order.id,
        currency: 'usd',
        items: order.OrderItem.map(item=>({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }))
      })
    )

    return paymentSession
  }

  async paidOrder(paidOrderDto:PaidOrderDto){
    this.logger.log('Paid Order')
    this.logger.log(paidOrderDto)

    const order = await this.order.update({
      where: {id: paidOrderDto.orderId},
      data: {
        status: 'PAID',
        paid: true,
        paidAt: new Date(),
        stripeChargeId: paidOrderDto.stripePaymentId,

        // La relación
        OrderReceipt: {
          create: {
            receiptUrl: paidOrderDto.receiptUrl
          }
        }
      }
    })

    return {
      ...order
    }
  }
}
