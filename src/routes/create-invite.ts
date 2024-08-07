import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { link } from "fs";
import { z } from 'zod';
import { dayjs } from '../lib/dayjs';
import { getMailClient } from "../lib/mail";
import { prisma } from "../lib/prisma";
import nodemailer from 'nodemailer'

export async function createInvite(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/trips/:tripId/invites', 
    {
      schema: {
        params: z.object({
          tripId: z.string().uuid(),
        }),
        body: z.object({
          email: z.string().email(),
        })
      }
    },
    async (request) => {
      const { tripId  } = request.params
      const { email } = request.body

      const trip = await prisma.trip.findUnique({
        where: {
          id: tripId
        }
      })

      if (!trip) {
        throw new Error('Trip not found.')
      }

      const participant = await prisma.participant.create({
        data: {
          email,
          trip_id: tripId
        }
      })

      const formattedStartDate = dayjs(trip.starts_at).format('LL')
      const formattedEndDate = dayjs(trip.ends_at).format('LL')
  
      const mail = await getMailClient()

      const confirmationLink = `
        http://localhost:3333/participants/${participant.id}/confirm
      `

      const message = await mail.sendMail({
        from: {
          name: 'Equipe Plann.er',
          address: 'oi@plann.er'
        },
        to: participant.email,
        subject: `Confirme a sua presença na viagem para para: ${trip.destination} em ${formattedStartDate}`,
        html: `
          <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
            <p>Você foi convidado para participar de uma viagem para ${trip.destination}</p>
            <p></p>
            <p>Para confirmar sua presença na viagem clique no link abaixo:</p>
            <p></p>
            <p>
              <a href="${confirmationLink}">Confirmar viagem</a>
            </p>
          </div>
        `.trim()
      })

      console.log(nodemailer.getTestMessageUrl(message))
  
      return { participantId: participant.id }
    }
  )
}
