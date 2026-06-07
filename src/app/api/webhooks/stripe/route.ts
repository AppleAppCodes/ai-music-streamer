import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// We need to use the service role key to bypass RLS in the webhook
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string // Fallback for now if service key isn't provided yet
);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe keys missing' }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16' as any,
  });

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error(`Webhook signature verification failed.`, err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    const userId = session.metadata?.userId || session.client_reference_id;
    
    if (userId) {
      console.log(`Payment successful for user ${userId}. Upgrading to PRO tier.`);
      
      // Update the user's subscription tier in Supabase
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ subscription_tier: 'pro' })
        .eq('id', userId);

      if (error) {
        console.error('Error updating user subscription:', error);
        return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
      }
    }
  }

  // Handle subscription cancellations if needed in the future
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.userId;
    
    if (userId) {
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_tier: 'free' })
        .eq('id', userId);
    }
  }

  return NextResponse.json({ received: true });
}
