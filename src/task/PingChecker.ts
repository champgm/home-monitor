import ping from 'ping';
import Twilio from 'twilio';
import { enumerateError } from '../common/ObjectUtil';
import { getTimestamp } from '../common/Time';
import { Configuration } from '../../configuration';

export interface State {
  running: boolean;
}

export class PingCheckerTask {
  private static interval = 30000;
  public state: State;

  constructor(configuration: Configuration) {
  }

  public async start() {
    this.state.running = true;

    // Do things

    this.state.running = false;
    this.restart();
  }

  public restart() {
    if (!this.state.running) {
      setTimeout(() => {
        this.start();
      },         PingCheckerTask.interval);
    } else {
      console.log(`PingChecker already running, will not restart`);
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
