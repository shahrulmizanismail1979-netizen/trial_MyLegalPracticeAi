import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Only initialize if keys are present so the server doesn't crash on boot without them
export const twilioClient = (accountSid && authToken) ? twilio(accountSid, authToken) : null;

export async function sendWhatsApp(phone: string, message: string): Promise<{ sid: string } | null> {
  if (!twilioClient) return null;
  try {
    const response = await twilioClient.messages.create({
      body: message,
      from: 'whatsapp:+14155238886', // Twilio's default sandbox number. Update if you have a dedicated WhatsApp sender.
      to: `whatsapp:${phone}`
    });
    return { sid: response.sid };
  } catch (error) {
    console.error("WhatsApp send failed:", error);
    throw error;
  }
}

export async function sendSms(phone: string, message: string): Promise<{ sid: string } | null> {
  if (!twilioClient) return null;
  try {
    const response = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER || '+1234567890', // Add TWILIO_PHONE_NUMBER to your Vercel env later
      to: phone
    });
    return { sid: response.sid };
  } catch (error) {
    console.error("SMS send failed:", error);
    throw error;
  }
}