import ping from 'ping';
import Twilio from 'twilio';
import { Configuration } from '../../configuration';
import { enumerateError } from '../common/ObjectUtil';
import { getTimestamp } from '../common/Time';
import Task from './Task';
import { Smser } from '../common/Smser';

export interface State {
  running: boolean;
}

export interface DeviceStatus {
  timesOffline: number;
  alreadyAlerted: boolean;
}

export class IpCheckerTask extends Task {
  private static interval = 30000;
  private static offlineThreshold = 4;
  public state: State;
  private networkDevicesToCheck: {
    [name: string]: {
      ip: string,
      onlineMessage?: string,
      offlineMessage?: string,
    };
  };
  private twilioClient: Twilio.Twilio;
  private contactNumbers: { [name: string]: string };
  private twilioNumber: string;
  private deviceStatus: { [name: string]: DeviceStatus };

  constructor(configuration: Configuration, private smser:Smser) {
    super();
    this.state = {
      running: false,
    };
    this.networkDevicesToCheck = configuration.networkDevicesToCheck;
    this.twilioClient = Twilio(configuration.twilio.accountSid, configuration.twilio.authToken);
    this.contactNumbers = configuration.contactNumbers;
    this.twilioNumber = configuration.twilio.number;
    this.deviceStatus = {};
  }

  public async start() {
    this.state.running = true;
    const pingPromises = Object.keys(this.networkDevicesToCheck).map(async (deviceName) => {
      const ip = this.networkDevicesToCheck[deviceName].ip;

      const probeResult = await ping.promise.probe(ip);
      const online = probeResult.alive;
      const deviceStatus = this.getStatus(deviceName, online);

      const alreadyAlerted = deviceStatus.alreadyAlerted;
      const offlineTooLong = this.offlineTooLong(deviceStatus);

      if (offlineTooLong && !alreadyAlerted) {
        const message = this.networkDevicesToCheck[deviceName].offlineMessage
          ? `${getTimestamp()} - ${this.networkDevicesToCheck[deviceName].offlineMessage} ` +
          `${this.getOfflineMinutes(deviceStatus)} minutes ago`
          : `${getTimestamp()} - The device, '${deviceName}' has been offline for` +
          ` ${this.getOfflineMinutes(deviceStatus)} minutes!`;
        console.log(message);
        const smsPromises = Object.values(this.contactNumbers).map((phoneNumber) => {
          return this.smser.sendSms(phoneNumber, message);
        });
        await Promise.all(smsPromises);
        deviceStatus.alreadyAlerted = true;
      } else if (online && alreadyAlerted) {
        const message = this.networkDevicesToCheck[deviceName].onlineMessage
          ? `${getTimestamp()} - ${this.networkDevicesToCheck[deviceName].onlineMessage}`
          : `${getTimestamp()} - The device, '${deviceName}' has come back online!`;
        console.log(message);
        const smsPromises = Object.values(this.contactNumbers).map((phoneNumber) => {
          return this.smser.sendSms(phoneNumber, message);
        });
        await Promise.all(smsPromises);
        deviceStatus.alreadyAlerted = false;
      } else if (online) {
        console.log(`${getTimestamp()} - Network device, '${deviceName}' is online.`);
      } else {
        console.log(`${getTimestamp()} - Network device, '${deviceName}' is offline.`);
      }
      this.deviceStatus[deviceName] = deviceStatus;
    });
    await Promise.all(pingPromises);
    this.state.running = false;
    this.restart();
  }

  public restart() {
    if (!this.state.running) {
      setTimeout(() => {
        this.start();
      },         IpCheckerTask.interval);
    } else {
      console.log(`IpChecker already running, will not restart`);
    }
  }

  private getStatus(deviceName: string, online: boolean) {
    if (!this.deviceStatus[deviceName]) {
      this.deviceStatus[deviceName] = {
        alreadyAlerted: false,
        timesOffline: 0,
      };
    }
    if (online) {
      this.deviceStatus[deviceName].timesOffline = 0;
    } else {
      this.deviceStatus[deviceName].timesOffline += 1;
    }
    return this.deviceStatus[deviceName];
  }

  private offlineTooLong(deviceStatus: DeviceStatus): boolean {
    return deviceStatus.timesOffline > IpCheckerTask.offlineThreshold;
  }

  private getOfflineMinutes(deviceStatus: DeviceStatus) {
    const offlineMultiplier = deviceStatus.timesOffline;
    const milliseconds = offlineMultiplier * IpCheckerTask.interval;
    return milliseconds / 60000;
  }
}
