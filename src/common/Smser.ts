import Twilio from 'twilio';

import { enumerateError } from './ObjectUtil';
import { Configuration } from '../../configuration';

export class Smser {
  private twilioClient: Twilio.Twilio;
  private twilioNumber: string;
  constructor(private configuration: Configuration) {
    this.twilioClient = Twilio(configuration.twilio.accountSid, configuration.twilio.authToken);
    this.twilioNumber = configuration.twilio.number;
  }

  public async sendSms(
    number: string,
    message: string,
    mediaUrl?:string,
  ) {
    try {
      console.log(`Sending SMS to ${number}...`);
      await this.twilioClient.messages.create({
        body: message,
        from: this.twilioNumber,
        to: number,
        mediaUrl,
      });
    } catch (error) {
      console.log(`Error ocurred while sending Twilio SMS`);
      console.log(`${JSON.stringify(enumerateError(error), null, 2)}`);
    }
  }
}
