// Server code from https://github.com/stripe-samples/accept-a-card-payment/tree/master/using-webhooks/server/node-typescript

// Replace if using a different env file or config.
require('dotenv').config();

const bodyParser = require('body-parser');
const express = require('express');
const Stripe = require('stripe');

const { generateResponse } = require ('./utils');

const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
const stripeSecretKey =process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

const app = express();

app.use(function(req, res, next) {
    if (req.originalUrl === '/webhook') {
      next();
    } else {
      bodyParser.json()(req, res, next);
    }
  });
  

// tslint:disable-next-line: interface-name
const itemIdToPrice = {
    'id-1': 1400,
    'id-2': 2000,
    'id-3': 3000,
    'id-4': 4000,
    'id-5': 5000
  };
  

  function calculateOrderAmount(itemIds) {
    const total = itemIds
      .map((id) => itemIdToPrice[id])
      .reduce((prev, curr) => prev + curr, 0);
  
    return total;
  }
  

function getKeys(payment_method) {
  let secret_key = stripeSecretKey;
  let publishable_key = stripePublishableKey;

  switch (payment_method) {
    case 'grabpay':
    case 'fpx':
      publishable_key = stripePublishableKey;
      secret_key = stripeSecretKey;
      break;
    case 'au_becs_debit':
      publishable_key = stripePublishableKey;
      secret_key = stripeSecretKey;
      break;
    case 'oxxo':
      publishable_key = stripePublishableKey;
      secret_key = stripeSecretKey;
      break;
    case 'wechat_pay':
      publishable_key = stripePublishableKey;
      secret_key = stripeSecretKey;
      break;
    case 'paypal':
      publishable_key = stripePublishableKey;
      secret_key = stripeSecretKey;
      break;
    default:
      publishable_key = stripePublishableKey;
      secret_key = stripeSecretKey;
  }

  return { secret_key, publishable_key };
}

app.get('/stripe-key', (req, res) => {
    const paymentMethod = req.query.paymentMethod;
    const keys = getKeys(paymentMethod);
    const publishable_key = keys.publishable_key;
    res.send({ publishableKey: publishable_key });
  });
  
  app.post('/create-payment-intent', async (req, res) => {
    try {
    const {
      email,
      items,
      currency,
      request_three_d_secure,
      payment_method_types = [],
      client = 'ios',
    } = req.body;
  
    const { secret_key } = getKeys(payment_method_types[0]);
  
    const stripe = new Stripe(secret_key, {
      apiVersion: '2023-08-16',
      typescript: true,
    });
  
    const customer = await stripe.customers.create({ email });
  
    const params= {
      amount: calculateOrderAmount(items),
      currency,
      customer: customer.id,
      payment_method_options: {
        card: {
          request_three_d_secure: request_three_d_secure || 'automatic',
        },
        sofort: {
          preferred_language: 'en',
        },
        wechat_pay: {
          app_id: 'wx65907d6307c3827d',
          client: client,
        },
      },
      payment_method_types: payment_method_types,
    };
  
    
      const paymentIntent = await stripe.paymentIntents.create(params);
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error) {
      res.send({
        error: error.message,
      });
    }
  });
  

  app.post('/create-payment-intent-with-payment-method', async (req, res) => {
    try {
    const {
      items,
      currency,
      request_three_d_secure,
      email,
    } = req.body;
    const { secret_key } = getKeys();
  
    const stripe = new Stripe(secret_key, {
      apiVersion: '2023-08-16',
      typescript: true,
    });
    const customers = await stripe.customers.list({
      email,
    });
  
    if (!customers.data[0]) {
      return res.send({
        error: 'There is no associated customer object to the provided e-mail',
      });
    }
  
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customers.data[0].id,
      type: 'card',
    });
  
    if (!paymentMethods.data[0]) {
      return res.send({
        error: `There is no associated payment method to the provided customer's e-mail`,
      });
    }
  
    const params = {
      amount: calculateOrderAmount(items),
      currency,
      payment_method_options: {
        card: {
          request_three_d_secure: request_three_d_secure || 'automatic',
        },
      },
      payment_method: paymentMethods.data[0].id,
      customer: customers.data[0].id,
    };
  
    const paymentIntent = await stripe.paymentIntents.create(params);
  
    return res.send({
      clientSecret: paymentIntent.client_secret,
      paymentMethodId: paymentMethods.data[0].id,
    });

  } catch (error) {
    res.send({
      error: error.message,
    });
  }
  });
  

app.post(
  '/pay-without-webhooks',
  async (
    req,
    res
  ) => {
    const {
      paymentMethodId,
      paymentIntentId,
      items,
      currency,
      useStripeSdk,
      cvcToken,
      email,
    } = req.body;

    const orderAmount = calculateOrderAmount(items);
    const { secret_key } = getKeys();

    const stripe = new Stripe(secret_key, {
      apiVersion: '2023-08-16',
      typescript: true,
    });

    try {
      if (cvcToken && email) {
        const customers = await stripe.customers.list({
          email,
        });

        // The list all Customers endpoint can return multiple customers that share the same email address.
        // For this example we're taking the first returned customer but in a production integration
        // you should make sure that you have the right Customer.
        if (!customers.data[0]) {
          return res.send({
            error:
              'There is no associated customer object to the provided e-mail',
          });
        }

        const paymentMethods = await stripe.paymentMethods.list({
          customer: customers.data[0].id,
          type: 'card',
        });

        if (!paymentMethods.data[0]) {
          return res.send({
            error: `There is no associated payment method to the provided customer's e-mail`,
          });
        }

        const params = {
          amount: orderAmount,
          confirm: true,
          confirmation_method: 'manual',
          currency,
          payment_method: paymentMethods.data[0].id,
          payment_method_options: {
            card: {
              cvc_token: cvcToken,
            },
          },
          use_stripe_sdk: useStripeSdk,
          customer: customers.data[0].id,
          return_url: 'stripe-example://stripe-redirect',
        };
        const intent = await stripe.paymentIntents.create(params);
        return res.send(generateResponse(intent));
      } else if (paymentMethodId) {
        // Create new PaymentIntent with a PaymentMethod ID from the client.
        const params = {
          amount: orderAmount,
          confirm: true,
          confirmation_method: 'manual',
          currency,
          payment_method: paymentMethodId,
          // If a mobile client passes `useStripeSdk`, set `use_stripe_sdk=true`
          // to take advantage of new authentication features in mobile SDKs.
          use_stripe_sdk: useStripeSdk,
          return_url: 'stripe-example://stripe-redirect',
        };
        const intent = await stripe.paymentIntents.create(params);
        // After create, if the PaymentIntent's status is succeeded, fulfill the order.
        return res.send(generateResponse(intent));
      } else if (paymentIntentId) {
        // Confirm the PaymentIntent to finalize payment after handling a required action
        // on the client.
        const intent = await stripe.paymentIntents.confirm(paymentIntentId);
        // After confirm, if the PaymentIntent's status is succeeded, fulfill the order.
        return res.send(generateResponse(intent));
      }

      return res.sendStatus(400);
    } catch (e) {
      // Handle "hard declines" e.g. insufficient funds, expired card, etc
      // See https://stripe.com/docs/declines/codes for more.
      return res.send({ error: e.message });
    }
  }
);

app.post('/create-setup-intent', async (req, res) => {
  try {
  const {
    email,
    payment_method_types = [],
  } = req.body;
  const { secret_key } = getKeys(payment_method_types[0]);

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });
  const customer = await stripe.customers.create({ email });

  const payPalIntentPayload = {
    return_url: 'https://example.com/setup/complete',
    payment_method_options: { paypal: { currency: 'eur' } },
    payment_method_data: { type: 'paypal' },
    mandate_data: {
      customer_acceptance: {
        type: 'online',
        online: {
          ip_address: '1.1.1.1',
          user_agent: 'test-user-agent',
        },
      },
    },
    confirm: true,
  };

  //@ts-ignore
  const setupIntent = await stripe.setupIntents.create({
    ...{ customer: customer.id, payment_method_types },
    ...(payment_method_types?.includes('paypal') ? payPalIntentPayload : {}),
  });

  // Send publishable key and SetupIntent details to client
  return res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    clientSecret: setupIntent.client_secret,
  });
} catch (error) {
  res.send({
    error: error.message,
  });
}
});

// Expose a endpoint as a webhook handler for asynchronous events.
// Configure your webhook in the stripe developer dashboard:
// https://dashboard.stripe.com/test/webhooks
app.post(
  '/webhook',
  // Use body-parser to retrieve the raw body as a buffer.
  /* @ts-ignore */
  bodyParser.raw({ type: 'application/json' }),
  (req, res) => {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    const { secret_key } = getKeys();

    const stripe = new Stripe(secret_key, {
      apiVersion: '2023-08-16',
      typescript: true,
    });
    // console.log('webhook!', req);
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'] || [],
        stripeWebhookSecret
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }

    // Extract the data from the event.
    const data = event.data;
    const eventType = event.type;

    if (eventType === 'payment_intent.succeeded') {
      // Cast the event into a PaymentIntent to make use of the types.
      const pi = data.object;

      // Funds have been captured
      // Fulfill any orders, e-mail receipts, etc
      // To cancel the payment after capture you will need to issue a Refund (https://stripe.com/docs/api/refunds).
      console.log(`🔔  Webhook received: ${pi.object} ${pi.status}!`);
      console.log('💰 Payment captured!');
    }
    if (eventType === 'payment_intent.payment_failed') {
      // Cast the event into a PaymentIntent to make use of the types.
      const pi = data.object;
      console.log(`🔔  Webhook received: ${pi.object} ${pi.status}!`);
      console.log('❌ Payment failed.');
    }

    if (eventType === 'setup_intent.setup_failed') {
      console.log(`🔔  A SetupIntent has failed the to setup a PaymentMethod.`);
    }

    if (eventType === 'setup_intent.succeeded') {
      console.log(
        `🔔  A SetupIntent has successfully setup a PaymentMethod for future use.`
      );
    }

    if (eventType === 'setup_intent.created') {
      const setupIntent = data.object;
      console.log(`🔔  A new SetupIntent is created. ${setupIntent.id}`);
    }

    return res.sendStatus(200);
  }
);

// An endpoint to charge a saved card
// In your application you may want a cron job / other internal process
app.post('/charge-card-off-session', async (req, res) => {
  let paymentIntent, customer;

  const { secret_key } = getKeys();

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });

  try {
    // You need to attach the PaymentMethod to a Customer in order to reuse
    // Since we are using test cards, create a new Customer here
    // You would do this in your payment flow that saves cards
    customer = await stripe.customers.list({
      email: req.body.email,
    });

    // List the customer's payment methods to find one to charge
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.data[0].id,
      type: 'card',
    });

    // Create and confirm a PaymentIntent with the order amount, currency,
    // Customer and PaymentMethod ID
    paymentIntent = await stripe.paymentIntents.create({
      amount: '1099',
      currency: 'usd',
      payment_method: paymentMethods.data[0].id,
      customer: customer.data[0].id,
      off_session: true,
      confirm: true,
    });

    return res.send({
      succeeded: true,
      clientSecret: paymentIntent.client_secret,
      publicKey: stripePublishableKey,
    });
  } catch (err) {
    if (err.code === 'authentication_required') {
      // Bring the customer back on-session to authenticate the purchase
      // You can do this by sending an email or app notification to let them know
      // the off-session purchase failed
      // Use the PM ID and client_secret to authenticate the purchase
      // without asking your customers to re-enter their details
      return res.send({
        error: 'authentication_required',
        paymentMethod: err.raw.payment_method.id,
        clientSecret: err.raw.payment_intent.client_secret,
        publicKey: stripePublishableKey,
        amount: calculateOrderAmount(),
        card: {
          brand: err.raw.payment_method.card.brand,
          last4: err.raw.payment_method.card.last4,
        },
      });
    } else if (err.code) {
      // The card was declined for other reasons (e.g. insufficient funds)
      // Bring the customer back on-session to ask them for a new payment method
      return res.send({
        error: err.code,
        clientSecret: err.raw.payment_intent.client_secret,
        publicKey: stripePublishableKey,
      });
    } else {
      console.log('Unknown error occurred', err);
      return res.sendStatus(500);
    }
  }
});








app.post('/list-setup-intents', async (req, res) => {
  try {
    const { secret_key } = getKeys();

    const stripe = new Stripe(secret_key, {
      apiVersion: '2023-08-16',
      typescript: true,
    });

    const customerId = 'cus_PUjAhuX2HzZ5UJ';

    const setupIntents = await stripe.setupIntents.list(
      {
        customer: customerId,
      }
    );

    return res.json({
      setupIntents: setupIntents.data,
    });
  } catch (error) {
    console.error('Error in payment-sheet endpoint:', error);

    // Handle different types of errors and respond accordingly
    if (error instanceof Stripe.errors.StripeCardError) {
      // Handle card errors
      return res.status(400).json({ error: 'Card error' });
    } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      // Handle invalid request errors
      return res.status(400).json({ error: 'Invalid request' });
    } else {
      // Handle other types of errors
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});




app.post('/retrieve-setup-intent', async (req, res) => {

  try {
    const { secret_key } = getKeys();
    const { setupIntentId } = req.body; // Assuming the parameters are passed in the request body

    const stripe = new Stripe(secret_key, {
      apiVersion: '2023-08-16',
      typescript: true,
    });

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    return res.json({
      setupIntent: setupIntent,
    });
  } catch (error) {
    console.error('Error in payment-sheet endpoint:', error);

    // Handle different types of errors and respond accordingly
    if (error instanceof Stripe.errors.StripeCardError) {
      // Handle card errors
      return res.status(400).json({ error: 'Card error' });
    } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      // Handle invalid request errors
      return res.status(400).json({ error: 'Invalid request' });
    } else {
      // Handle other types of errors
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});



app.post('/cancel-setup-intent', async (req, res) => {

  try {
    const { secret_key } = getKeys();
    const { setupIntentId } = req.body; // Assuming the parameters are passed in the request body

    const stripe = new Stripe(secret_key, {
      apiVersion: '2023-08-16',
      typescript: true,
    });

    const setupIntent = await stripe.setupIntents.cancel(setupIntentId);

    return res.json({
      setupIntent: setupIntent,
    });
  } catch (error) {
    console.error('Error in payment-sheet endpoint:', error);

    // Handle different types of errors and respond accordingly
    if (error instanceof Stripe.errors.StripeCardError) {
      // Handle card errors
      return res.status(400).json({ error: 'Card error' });
    } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      // Handle invalid request errors
      return res.status(400).json({ error: 'Invalid request' });
    } else {
      // Handle other types of errors
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});


app.post('/update-setup-intent', async (req, res) => {

  try {
    const { secret_key } = getKeys();
    const { setupIntentId } = req.body; // Assuming the parameters are passed in the request body

    const stripe = new Stripe(secret_key, {
      apiVersion: '2023-08-16',
      typescript: true,
    });

    const setupIntent = await stripe.setupIntents.cancel(setupIntentId);

    return res.json({
      setupIntent: setupIntent,
    });
  } catch (error) {
    console.error('Error in payment-sheet endpoint:', error);

    // Handle different types of errors and respond accordingly
    if (error instanceof Stripe.errors.StripeCardError) {
      // Handle card errors
      return res.status(400).json({ error: 'Card error' });
    } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      // Handle invalid request errors
      return res.status(400).json({ error: 'Invalid request' });
    } else {
      // Handle other types of errors
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});





// This example sets up an endpoint using the Express framework.
// Watch this video to get started: https://youtu.be/rPR2aJ6XnAc.



app.post('/payment-sheet', async (req, res) => {
  try {
    const { secret_key } = getKeys();
    const { currency, amount } = req.body; // Assuming the parameters are passed in the request body

    if (!currency || !amount) {
      return res.status(400).json({
        error: 'Currency and amount are required parameters',
      });
    }

    const stripe = new Stripe(secret_key, {
      apiVersion: '2023-08-16',
      typescript: true,
    });

    // const customers = await stripe.customers.list();

    // // Here, we're getting the latest customer only for example purposes.
    // const customer = customers.data[0];

    // if (!customer) {
    //   return res.send({
    //     error: 'You have no customer created',
    //   });
    // }
    const customerId = 'cus_PUjAhuX2HzZ5UJ';
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-08-16' }
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      customer: customerId,
      payment_method_types: ['card'],
    });

    return res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
    });
  } catch (error) {
    console.error('Error in payment-sheet endpoint:', error);

    // Handle different types of errors and respond accordingly
    if (error instanceof Stripe.errors.StripeCardError) {
      // Handle card errors
      return res.status(400).json({ error: 'Card error' });
    } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      // Handle invalid request errors
      return res.status(400).json({ error: 'Invalid request' });
    } else {
      // Handle other types of errors
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});









app.post('/payment-sheet-subscription', async (_, res) => {
  try {
    const { secret_key } = getKeys();

    const stripe = new Stripe(secret_key, {
      apiVersion: '2023-08-16',
      typescript: true,
    });

    const customers = await stripe.customers.list();

    // Here, we're getting the latest customer only for example purposes.
    const customer = customers.data[0];

    if (!customer) {
      return res.send({
        error: 'You have no customer created',
      });
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2023-08-16' }
    );

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: 'price_1L3hcFLu5o3P18Zp9GDQEnqe' }],
      trial_period_days: 3,
    });

    if (typeof subscription.pending_setup_intent === 'string') {
      const setupIntent = await stripe.setupIntents.retrieve(
        subscription.pending_setup_intent
      );

      return res.json({
        setupIntent: setupIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customer.id,
      });
    } else {
      throw new Error(
        'Expected response type string, but received: ' +
          typeof subscription.pending_setup_intent
      );
    }
  } catch (error) {
    console.error('Error in payment-sheet-subscription endpoint:', error);

    // Handle different types of errors and respond accordingly
    if (error instanceof Stripe.errors.StripeCardError) {
      // Handle card errors
      return res.status(400).json({ error: 'Card error' });
    } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      // Handle invalid request errors
      return res.status(400).json({ error: 'Invalid request' });
    } else {
      // Handle other types of errors
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});


app.post('/ephemeral-key', async (req, res) => {
  try {
  const { secret_key } = getKeys();

  const stripe = new Stripe(secret_key, {
    apiVersion: req.body.apiVersion,
    typescript: true,
  });

  
    let key = await stripe.ephemeralKeys.create(
      { issuing_card: req.body.issuingCardId },
      { apiVersion: req.body.apiVersion }
    );
    return res.send(key);
  } catch (e) {
    console.log(e);
    return res.send({ error: e });
  }
});

app.post('/issuing-card-details', async (req, res) => {
  try {
  const { secret_key } = getKeys();

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });

  
    let card = await stripe.issuing.cards.retrieve(req.body.id);

    if (!card) {
      console.log('No card with that ID exists.');
      return res.send({ error: 'No card with that ID exists.' });
    } else {
      return res.send(card);
    }
  } catch (e) {
    console.log(e);
    return res.send({ error: e });
  }
});

app.post('/financial-connections-sheet', async (_, res) => {
  try {
  const { secret_key } = getKeys();

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });

  const account = await stripe.accounts.create({
    country: 'US',
    type: 'custom',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  const session = await stripe.financialConnections.sessions.create({
    account_holder: { type: 'account', account: account.id },
    filters: { countries: ['US'] },
    permissions: ['ownership', 'payment_method'],
  });

  return res.send({ clientSecret: session.client_secret });
} catch (error) {
  res.send({
    error: error.message,
  });
}
});

app.post('/payment-intent-for-payment-sheet', async (req, res) => {
  try {
  const { secret_key } = getKeys();

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });


    const paymentIntent = await stripe.paymentIntents.create({
      amount: 5099,
      currency: 'usd',
      payment_method: req.body.paymentMethodId,
      customer: req.body.customerId,
    });

    return res.send({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    return res.send({ error: e });
  }
});


app.post('/create-checkout-session', async (req, res) => {
  try {
  console.log(`Called /create-checkout-session`)
  const {
    port,
  } = req.body;

  const { secret_key } = getKeys();

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });

  var effectivePort = port ?? 8080;
  // Use an existing Customer ID if this is a returning customer.
  const customer = await stripe.customers.create();

  // Use the same version as the SDK
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customer.id },
    { apiVersion: '2020-08-27' }
  );

  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
  });

  const session = await stripe.checkout.sessions.create({
    success_url: `https://checkout.stripe.dev/success`,
    line_items: [
      {
        price: 'price_1Obk3LAcd6N7OZokNUNoJn4Z',
        quantity: 1,
      },
      
    ],
    automatic_tax : {
      enabled: true,
    },
    mode: 'payment',
  });

  res.json({
    sessionId: session.id,
    customer: customer.id,
    ephemeralKeySecret: ephemeralKey.secret,
    setupIntent: setupIntent.client_secret,
  });
} catch (error) {
  res.json({
    error: error.message,
  });
}
});



app.post('/customer-sheet', async (_, res) => {
  try {
  const { secret_key } = getKeys();

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });

  // Use an existing Customer ID if this is a returning customer.
  // const customer = await stripe.customers.create();
  const customerId = 'cus_PUjAhuX2HzZ5UJ';
  // Use the same version as the SDK
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: '2020-08-27' }
  );

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
  });

  res.json({
    customer: customerId,
    ephemeralKeySecret: ephemeralKey.secret,
    setupIntent: setupIntent.client_secret,
  });
} catch (error) {
  res.json({
    error: error.message,
  });
}
});

app.post('/fetch-payment-methods', async (req, res) => {
  try {
  const { secret_key } = getKeys();

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });

  const paymentMethods = await stripe.customers.listPaymentMethods(
    req.body.customerId
  );

  res.json({
    paymentMethods: paymentMethods.data,
  });
} catch (error) {
  res.json({
    error: error.message,
  });
}
});

app.post('/create-payment-method', async (req, res) => {
  try {
  const { secret_key } = getKeys();
  const { params } = req.body;

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });

  const paymentMethod = await stripe.paymentMethods.create(params);

  res.json({
    paymentMethod: paymentMethod,
  });
} catch (error) {
  res.json({
    error: error.message,
  });
}
});

app.post('/attach-payment-method', async (req, res) => {
  try {
  const { secret_key } = getKeys();

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });
  console.log({ customer: req.body.customerId });
  const paymentMethod = await stripe.paymentMethods.attach(
    req.body.paymentMethodId,
    { customer: req.body.customerId }
  );
  console.log('got here');
  res.json({
    paymentMethod,
  });
} catch (error) {
  res.json({
    error: error.message,
  });
}
});

app.post('/detach-payment-method', async (req, res) => {
  try {
  const { secret_key } = getKeys();

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });

  const paymentMethod = await stripe.paymentMethods.detach(
    req.body.paymentMethodId
  );

  res.json({
    paymentMethod,
  });
} catch (error) {
  res.json({
    error: error.message,
  });
}
});

// Mocks a Database. In your code, you should use a persistent database.
let savedPaymentOptions = new Map();

app.post('/set-payment-option', async (req, res) => {
  try {
  savedPaymentOptions.set(req.body.customerId, req.body.paymentOption);
  res.json({});
} catch (error) {
  res.json({
    error: error.message,
  });
}
});

app.post('/get-payment-option', async (req, res) => {
  try {
  const { secret_key } = getKeys();

  const stripe = new Stripe(secret_key, {
    apiVersion: '2023-08-16',
    typescript: true,
  });

  const customerPaymentOption = savedPaymentOptions.get(req.body.customerId);
  res.json({
    savedPaymentOption: customerPaymentOption ?? null,
  });
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Stubborn Attachments',
            images: ['https://i.imgur.com/EHyR2nP.png'],
          },
          unit_amount: 2000,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `https://checkout.stripe.dev/success`,
    cancel_url: `https://checkout.stripe.dev/cancel`,

  });
  return res.json({ id: session.id });
} catch (error) {
  return res.json({
    error: error.message,
  });
}
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('An error occurred:', err);
  res.status(500).json({ error: 'Internal server error' });
});


app.listen(4242, () =>
  console.log(`Node server listening on port ${4242}!`)
);
