
const generateResponse = (intent) => {
    switch (intent.status) {
      case 'requires_action':
        return {
          clientSecret: intent.client_secret,
          requiresAction: true,
          status: intent.status,
        };
      case 'requires_payment_method':
        return {
          error: 'Your card was denied, please provide a new payment method',
        };
      case 'succeeded':
        console.log('💰 Payment received!');
        return { clientSecret: intent.client_secret, status: intent.status };
      default:
        return {
          error: 'Failed',
        };
    }
  };
  

  module.exports = generateResponse;