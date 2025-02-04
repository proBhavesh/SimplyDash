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

    const customer = await stripe.customers.list({
      email: decodedToken.email,
      limit: 1,
    });

    if (customer.data.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.data[0].id,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
