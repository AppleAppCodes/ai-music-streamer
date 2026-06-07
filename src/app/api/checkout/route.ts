import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured yet. The admin needs to provide the API keys.' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16' as any,
    });

    const origin = request.headers.get('origin') || 'https://www.yoriax.com';

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'paypal'], // Configure in Stripe dashboard
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'YORIAX Pro',
              description: 'Werbefrei streamen, MP3s herunterladen und exklusive Premium-Playlists freischalten.',
              images: [`${origin}/brand/yoriax-app-icon-192.png`],
            },
            unit_amount: 499, // 4.99 EUR
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/?success=true`,
      cancel_url: `${origin}/pro?canceled=true`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        userId: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
