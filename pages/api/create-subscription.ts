// pages/api/create-subscription.ts

import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { adminAuth } from '../../src/lib/firebase-admin';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-09-30.acacia',
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);

    const { assistantId, assistantType } = req.body;
    if (!assistantId || !assistantType) {
      return res.status(400).json({ message: 'Assistant ID and assistant type are required' });
    }

    console.log(
      'Creating subscription for user:',
      decodedToken.uid,
      'and assistant:',
      assistantId,
      'of type:',
      assistantType
    );

    // Check if the user already has a Stripe customer ID
    const customerList = await stripe.customers.list({
      email: decodedToken.email || undefined,
    });
    let customerId: string;

    if (customerList.data.length === 0) {
      // Create a new customer if one doesn't exist
      const newCustomer = await stripe.customers.create({
        email: decodedToken.email || undefined,
        metadata: { firebaseUID: decodedToken.uid },
      });
      customerId = newCustomer.id;
    } else {
      customerId = customerList.data[0].id;
    }

    // Determine the price ID based on assistant type
    let priceId: string;
    if (assistantType === 'vapi') {
      priceId = process.env.STRIPE_PRICE_ID_VAPI!;
    } else if (assistantType === 'openai-realtime') {
      priceId = process.env.STRIPE_PRICE_ID_OPENAI_REALTIME!;
    } else {
      return res.status(400).json({ message: 'Invalid assistant type' });
    }

    if (!priceId) {
      return res.status(500).json({ message: 'Price ID not configured for this assistant type' });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin}/assistant/${assistantId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/dashboard`,
      metadata: {
        assistantId: assistantId,
        assistantType: assistantType,
      },
    });

    console.log('Stripe session created:', session.id);

    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating subscription:', error);

    if (error instanceof Error) {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    } else {
      res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
  }
}
