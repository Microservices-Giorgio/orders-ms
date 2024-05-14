import 'dotenv/config'
import * as Joi from 'joi'

interface EnvVars {
    PORT: number;
    PRODUCTS_MS_HOST: string;
    PRODUCTS_MS_PORT: number;

    NATS_SERVERS: string[]
}

const envsSchema = Joi.object({
    PORT: Joi.number().required(),
    PRODUCTS_MS_HOST: Joi.string().required(),
    PRODUCTS_MS_PORT: Joi.number().required(),

    NATS_SERVERS: Joi.array().items(Joi.string()).required()
})
.unknown(true)

const {error, value} = envsSchema.validate({
    ...process.env,
    NATS_SERVERS: process.env.NATS_SERVERS?.split(',')
})

if(error){
    throw new Error(`Config validation error: ${error.message}`)
}

const envVars: EnvVars = value

export const envs = {
    port: envVars.PORT,
    productsMsHost: envVars.PRODUCTS_MS_HOST,
    productsMsPort: envVars.PRODUCTS_MS_PORT,
    natsServers: envVars.NATS_SERVERS
}