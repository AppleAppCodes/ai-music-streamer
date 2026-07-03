import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: 'Webhook configuration missing' }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);

  // The webhook must bypass user RLS, so it must fail closed when the
  // service-role key is absent instead of falling back to a public key.
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid webhook signature';
    console.error(`Webhook signature verification failed.`, message);
    return NextResponse.json({ error: message }, { status: 400 });
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

      // Revenue time series: log the event (best effort, never blocks the webhook).
      const { error: eventError } = await supabaseAdmin.from('subscription_events').insert({
        user_id: userId,
        event_type: 'subscribed',
        tier: 'pro',
        stripe_details: {
          session_id: session.id,
          amount_total: session.amount_total,
          currency: session.currency,
          subscription: session.subscription,
        },
      });
      if (eventError) console.error('Failed to log subscription event:', eventError);
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

      const { error: eventError } = await supabaseAdmin.from('subscription_events').insert({
        user_id: userId,
        event_type: 'canceled',
        tier: 'free',
        stripe_details: { subscription_id: subscription.id },
      });
      if (eventError) console.error('Failed to log cancellation event:', eventError);
    }
  }

  return NextResponse.json({ received: true });
}
