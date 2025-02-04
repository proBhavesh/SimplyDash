// pages/api/verify-subscription.ts

import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { db } from '../../src/lib/firebase-admin';
import { errorLogger } from '../../src/utils/errorLogger';
import { DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-09-30.acacia',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ message: 'Missing session_id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id as string);

    if (session.payment_status === 'paid') {
      const assistantId = session.metadata?.assistantId;
      const assistantType = session.metadata?.assistantType;

      if (!assistantId || !assistantType) {
        errorLogger.error('Missing assistantId or assistantType in session metadata', { session_id });
        return res.status(400).json({ message: 'Missing assistantId or assistantType in session metadata' });
      }

      let assistantRef: DocumentReference;

      if (assistantType === 'vapi') {
        assistantRef = db.collection('assistants').doc(assistantId);
      } else if (assistantType === 'openai-realtime') {
        assistantRef = db.collection('openaiAssistants').doc(assistantId);
      } else {
        errorLogger.error('Invalid assistantType in session metadata', { assistantType });
        return res.status(400).json({ message: 'Invalid assistantType in session metadata' });
      }

      await db.runTransaction(async (transaction) => {
        const assistantDoc = (await transaction.get(assistantRef)) as DocumentSnapshot;

        if (!assistantDoc.exists) {
          throw new Error(`Assistant document ${assistantId} not found`);
        }

        transaction.update(assistantRef, {
          isSubscribed: true,
          updatedAt: new Date().toISOString(),
        });
      });

      errorLogger.info('Assistant subscription status updated', { assistantId, assistantType });

      return res.status(200).json({ message: 'Subscription verified and updated', assistantId });
    } else {
      return res.status(400).json({ message: 'Subscription not completed' });
    }
  } catch (error) {
    errorLogger.error('Error verifying subscription:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
