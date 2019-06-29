import ping from 'ping';

import { Configuration } from '../../configuration';
import { getPlugState, PLUG_OFF, PLUG_ON, setPlugState } from '../common/Plug';
import { getTimestamp } from '../common/Time';
import Task from './Task';

export interface State {
  running: boolean;
}

export interface IpStatus {
  plugOff: boolean;
  inRecovery: boolean;
  offlineTooLong: boolean;
  recoveryTooLong: boolean;
  timesSeenInRecovery: number;
  timesSeenOffline: number;
}

export class IpCheckingPlugToggler extends Task {
  private static interval = 30000;
  private static offlineThreshold = 4;
  private static recoveryThreshold = 10;
  public state: State;
  private addressesAndPlugs: {
    [ip: string]: string,
  };
  private currentStatus: { [name: string]: IpStatus };

  constructor(configuration: Configuration) {
    super();
    this.state = { running: false };
    this.addressesAndPlugs = configuration.addressesToPingAndPlugsToToggle;
    this.currentStatus = {};
  }

  public async start() {
    this.state.running = true;
    const pingPromises = Object.keys(this.addressesAndPlugs).map(async (ipToPing) => {
      const plugIp = this.addressesAndPlugs[ipToPing];
      const probeResult = await ping.promise.probe(ipToPing);
      const addressReachable = probeResult.alive;

      const currentStatus = await this.getStatus(ipToPing, plugIp, addressReachable);
      const plugOff = currentStatus.plugOff;
      const offlineTooLong = currentStatus.offlineTooLong;
      const recoveryTooLong = currentStatus.recoveryTooLong;

      if (addressReachable) {
        console.log(`${getTimestamp()} - I am able to reach ${ipToPing}`);
      } else {
        console.log(`${getTimestamp()} - I have been unable to reach '${ipToPing}' ` +
          `for ${this.getOfflineMinutes(currentStatus)} minutes!`);
      }

      // console.log(`${getTimestamp()} - Current Status: ${JSON.stringify(currentStatus, null, 2)}`);

      if (!currentStatus.inRecovery) {
        if (offlineTooLong && !plugOff && !currentStatus.inRecovery) {
          // console.log(`${getTimestamp()} - Plug status: ${JSON.stringify(currentStatus, null, 2)}`);
          console.log(`${getTimestamp()} - Connectivity has been down too long, turning plug off`);
          await setPlugState(plugIp, PLUG_OFF);
        } else if (offlineTooLong && plugOff && !currentStatus.inRecovery) {
          // console.log(`${getTimestamp()} - Plug status: ${JSON.stringify(currentStatus, null, 2)}`);
          console.log(`${getTimestamp()} - Turning plug on`);
          await setPlugState(plugIp, PLUG_ON);
          currentStatus.inRecovery = true;
        }
      } else {
        console.log(`${getTimestamp()} - Connectivity has been in recovery for ` +
          `${this.getRecoveryMinutes(currentStatus)}`);
        // console.log(`${getTimestamp()} - Plug status: ${JSON.stringify(currentStatus, null, 2)}`);
        if (!recoveryTooLong) {
          console.log(`${getTimestamp()} - Plug is in recovery, waiting for connectivity...`);
        } else {
          console.log(`${getTimestamp()} - Connectivity recovery is taking too long, turning plug off`);
          await setPlugState(plugIp, PLUG_OFF);
          currentStatus.inRecovery = false;
        }
      }
      this.currentStatus[ipToPing] = currentStatus;
    });
    await Promise.all(pingPromises);
    this.state.running = false;
    this.restart();
  }

  public restart() {
    if (!this.state.running) {
      setTimeout(
        () => { this.start(); },
        IpCheckingPlugToggler.interval,
      );
    } else {
      console.log(`${getTimestamp()} - IpCheckingPlugToggler already running, will not restart`);
    }
  }

  private async getStatus(ipToPing: string, plugIp: string, online: boolean) {
    if (!this.currentStatus[ipToPing]) {
      this.currentStatus[ipToPing] = {
        inRecovery: false,
        offlineTooLong: false,
        plugOff: false,
        recoveryTooLong: false,
        timesSeenInRecovery: 0,
        timesSeenOffline: 0,
      };
    }

    const plugIsOff = !(await getPlugState(plugIp)).on;
    this.currentStatus[ipToPing].plugOff = plugIsOff;

    if (online) {
      await setPlugState(plugIp, PLUG_ON);
      this.currentStatus[ipToPing].inRecovery = false;
      this.currentStatus[ipToPing].offlineTooLong = false;
      this.currentStatus[ipToPing].recoveryTooLong = false;
      this.currentStatus[ipToPing].timesSeenInRecovery = 0;
      this.currentStatus[ipToPing].timesSeenOffline = 0;
      return this.currentStatus[ipToPing];
    }
    this.currentStatus[ipToPing].timesSeenOffline += 1;

    if (this.currentStatus[ipToPing].inRecovery) {
      this.currentStatus[ipToPing].timesSeenInRecovery += 1;
    }

    this.currentStatus[ipToPing].offlineTooLong =
      this.currentStatus[ipToPing].timesSeenOffline > IpCheckingPlugToggler.offlineThreshold;
    this.currentStatus[ipToPing].recoveryTooLong =
      this.currentStatus[ipToPing].timesSeenInRecovery > IpCheckingPlugToggler.recoveryThreshold;

    return this.currentStatus[ipToPing];
  }

  private getOfflineMinutes(currentStatus: IpStatus) {
    const multiplier = currentStatus.timesSeenOffline;
    const milliseconds = multiplier * IpCheckingPlugToggler.interval;
    return milliseconds / 60000;
  }

  private getRecoveryMinutes(currentStatus: IpStatus) {
    const multiplier = currentStatus.timesSeenInRecovery;
    const milliseconds = multiplier * IpCheckingPlugToggler.interval;
    return milliseconds / 60000;
  }
}
