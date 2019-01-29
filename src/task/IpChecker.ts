import { Configuration } from 'configuration';
import ping from 'ping';
import Twilio from 'twilio';
import { enumerateError } from '../common/ObjectUtil';
import { getTimestamp } from '../common/Time';

export interface State {
  running: boolean;
}

export class IpCheckerTask {
  private static interval = 300000;
  public state: State;
  private networkDevicesToCheck: { [name: string]: string };
  private twilioClient: Twilio.Twilio;
  private contactNumbers: { [name: string]: string };
  private twilioNumber: string;
  private knownOffline: { [name: string]: boolean };

  constructor(configuration: Configuration) {
    this.state = {
      running: false,
    };
    this.networkDevicesToCheck = configuration.networkDevicesToCheck;
    this.twilioClient = Twilio(configuration.twilio.accountSid, configuration.twilio.authToken);
    this.contactNumbers = configuration.contactNumbers;
    this.twilioNumber = configuration.twilio.number;
    this.knownOffline = {};
  }

  public async start() {
    this.state.running = true;
    const pingPromises = Object.keys(this.networkDevicesToCheck).map(async (deviceName) => {
      const ip = this.networkDevicesToCheck[deviceName];
      const knownOffline = this.knownOffline[deviceName];

      const online = await pingSync(ip);
      const newlyOffline = !online && !knownOffline;
      const backOnline = online && knownOffline;
      const stillOnline = online && !knownOffline;
      const stillOffline = !online && knownOffline;
      if (newlyOffline) {
        const message = `${getTimestamp()} - The device, '${deviceName}' has gone offline!`;
        console.log(message);
        const smsPromises = Object.values(this.contactNumbers).map((phoneNumber) => {
          return this.sendSms(phoneNumber, message);
        });
        await Promise.all(smsPromises);
        this.knownOffline[deviceName] = !online;
      } else if (backOnline) {
        const message = `${getTimestamp()} - The device, '${deviceName}' has come back online!`;
        console.log(message);
        const smsPromises = Object.values(this.contactNumbers).map((phoneNumber) => {
          return this.sendSms(phoneNumber, message);
        });
        await Promise.all(smsPromises);
        this.knownOffline[deviceName] = !online;
      } else if (stillOnline) {
        console.log(`Network device, '${deviceName}' is online.`);
      } else {
        console.log(`Network device, '${deviceName}' is still offline.`);
      }
    });
    await Promise.all(pingPromises);
    this.state.running = false;
    this.restart();
  }

  public restart() {
    if (!this.state.running) {
      setTimeout(() => {
        this.start();
      }, IpCheckerTask.interval);
    } else {
      console.log(`IpChecker already running, will not restart`);
    }
  }

  public async sendSms(number: string, message: string) {
    try {
      console.log(`Sending SMS to ${number}...`);
      await this.twilioClient.messages.create({
        body: message,
        to: number,
        from: this.twilioNumber,
      });
    } catch (error) {
      console.log(`Error ocurred while sending Twilio SMS`);
      console.log(`${JSON.stringify(enumerateError(error), null, 2)}`);
    }
  }
}

export async function pingSync(ip: string): Promise<boolean> {
  const promiseWrapper = (resolve) => {
    const callback = (result: boolean) => {
      resolve(result);
    };
    return ping.sys.probe(ip, callback);
  };
  return new Promise(promiseWrapper);
}
