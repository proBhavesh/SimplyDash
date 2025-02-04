// pages/api/stripe-webhook.ts

import { buffer } from 'micro';
import Stripe from 'stripe';
import { db } from '../../src/lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';
import { handleError, ErrorResponse } from '../../src/utils/errorHandler';
import { errorLogger } from '../../src/utils/errorLogger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-09-30.acacia',
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Webhook handler started');
  errorLogger.info('Stripe webhook handler started', { timestamp: new Date().toISOString() });
  
  try {
    console.log('Request method:', req.method);
    console.log('Request headers:', JSON.stringify(req.headers));
    errorLogger.info('Stripe webhook received', { method: req.method, headers: req.headers });

    if (req.method !== 'POST') {
      console.log('Invalid method');
      errorLogger.warn('Invalid method for Stripe webhook', { method: req.method });
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    let event: Stripe.Event;

    try {
      const buf = await buffer(req);
      const rawBody = buf.toString('utf8');
      console.log('Raw body length:', rawBody.length);
      errorLogger.debug('Raw body received', { rawBodyLength: rawBody.length });
      const sig = req.headers['stripe-signature'] as string;
      errorLogger.debug('Stripe signature received', { signatureLength: sig?.length });

      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
      console.log('Event constructed:', event.type);
      errorLogger.info('Webhook event constructed successfully', { eventType: event.type });
    } catch (err: any) {
      console.error('Error parsing webhook:', err.message);
      errorLogger.error('Error parsing webhook', { error: err });
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      errorLogger.info('Checkout session completed', { sessionId: session.id });

      const assistantId = session.metadata?.assistantId;
      const assistantType = session.metadata?.assistantType;
      errorLogger.info('Assistant ID and Type from metadata', { assistantId, assistantType });

      if (!assistantId || !assistantType) {
        errorLogger.error('Assistant ID or Type is missing in session metadata');
        return res.status(400).json({ error: 'Missing assistant ID or type in session metadata' });
      }

      try {
        let assistantRef;
        if (assistantType === 'vapi') {
          assistantRef = db.collection('assistants').doc(assistantId);
        } else if (assistantType === 'openai-realtime') {
          assistantRef = db.collection('openaiAssistants').doc(assistantId);
        } else {
          errorLogger.error('Invalid assistant type', { assistantType });
          return res.status(400).json({ error: 'Invalid assistant type in metadata' });
        }

        errorLogger.info(`Updating assistant in Firestore`, { assistantId, assistantType });

        const updateStartTime = Date.now();
        errorLogger.debug('Starting Firestore update operation', { assistantId, assistantType });
        
        await assistantRef.update({
          isSubscribed: true,
          updatedAt: new Date().toISOString(),
        });

        const updateEndTime = Date.now();
        errorLogger.debug('Firestore update operation completed', { 
          assistantId, 
          assistantType,
          duration: updateEndTime - updateStartTime 
        });

        errorLogger.info(`Updated subscription status for assistant`, { assistantId, assistantType });

        const verifyStartTime = Date.now();
        errorLogger.debug('Starting Firestore get operation', { assistantId, assistantType });
        const updatedDoc = await assistantRef.get();
        const verifyEndTime = Date.now();
        errorLogger.debug('Firestore get operation completed', { 
          assistantId,
          assistantType,
          duration: verifyEndTime - verifyStartTime
        });

        const updatedData = updatedDoc.data();
        errorLogger.debug(`Updated assistant data`, { assistantId, assistantType, data: updatedData });

        if (!updatedData?.isSubscribed) {
          errorLogger.error(`Assistant subscription status not updated correctly`, { assistantId, assistantType });
          // Don't return an error, continue to send a 200 response to Stripe
          errorLogger.warn('Subscription status not updated, but continuing');
        }
      } catch (error) {
        errorLogger.error(`Error updating assistant in Firestore`, { assistantId, assistantType, error });
        // Don't return here, continue to send a 200 response to Stripe
        errorLogger.warn('Error occurred during update, but continuing');
      }
    } else {
      console.log('Unhandled event type:', event.type);
      errorLogger.warn(`Unhandled event type`, { eventType: event.type });
    }

    console.log('Sending success response');
    errorLogger.info('Sending success response');
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    errorLogger.error('Unexpected error in webhook handler', { error });
    return res.status(200).json({ received: true, error: 'An unexpected error occurred' });
  }
}
