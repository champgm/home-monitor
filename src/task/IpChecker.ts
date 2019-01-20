import { Configuration } from 'configuration';
import ping from 'ping';
import Twilio from 'twilio';
import { enumerateError } from '../common/ObjectUtil';
import { promisify } from 'util';
const pingSync = promisify(ping.sys.)

export interface State {
  running: boolean;
}

export class IpCheckerTask {
  // private static interval = 300000;
  private static interval = 10000;
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
    this.twilioClient = Twilio(
      configuration.twilio.accountSid,
      configuration.twilio.authToken,
    );
    this.contactNumbers = configuration.contactNumbers;
    this.twilioNumber = configuration.twilio.number;
    this.knownOffline = {};
  }

  public start() {
    this.state.running = true;
    Object.keys(this.networkDevicesToCheck).forEach((deviceName) => {
      const ip = this.networkDevicesToCheck[deviceName];
      ping.sys.probe(ip, (isAlive) => {
        if (!isAlive) {
          if (!this.knownOffline[deviceName]) {
            Object.values(this.contactNumbers).forEach(async (number) => {
              await this.sendSms(deviceName, number, true);
            });
          } else {
            console.log(`Network device, '${deviceName}' is still offline`);
          }
        } else {
          if (this.knownOffline[deviceName]) {
            Object.values(this.contactNumbers).forEach(async (number) => {
              await this.sendSms(deviceName, number, false);
            });
          } else {
            console.log(`Network device, '${deviceName}' is still online`);
          }
        }
      });
    });
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

  public async sendSms(deviceName: string, number: string, online: boolean) {
    try {
      const body = online
        ? `The device, '${deviceName}' is back online!`
        : `The device, '${deviceName}' is offline!`;
      console.log(body);
      console.log(`Sending SMS...`);
      await this.twilioClient.messages.create({
        body,
        to: number,
        from: this.twilioNumber,
      });
      this.knownOffline[deviceName] = true;
    } catch (error) {
      console.log(`Error ocurred while sending Twilio SMS`);
      console.log(`${JSON.stringify(enumerateError(error), null, 2)}`);
    }
  }
}
