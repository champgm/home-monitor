import { Configuration } from 'configuration';
import ping from 'ping';

export interface State {
  running: boolean;
}

export class IpCheckerTask {
  private static fiveMinutes = 300000;
  // private static tenSeconds = 10000;
  public state: State;
  private networkDevicesToCheck: { name: string; ip: string; }[];

  constructor(configuration:Configuration) {
    this.state = {
      running: false,
    };
    this.networkDevicesToCheck=configuration.networkDevicesToCheck;
  }

  public start() {
    this.state.running = true;
    console.log(`Running IChecker`);

    this.networkDevicesToCheck.forEach((device)=>{
      const ip = device.ip;
      ping.sys.probe(ip,  (isAlive)=>{
        if(!isAlive){
// SEND EMAIL
        }else{
          console.log(`Network device, '${ip}' is alive`);
        }
      });
    });

    this.state.running = false;
    this.restart();
  }

  public restart() {
    if (!this.state.running) {
      console.log(`Restarting IpChecker`);
      setTimeout(() => {
        this.start();
      },         IpCheckerTask.fiveMinutes);
    } else {
      console.log(`IpChecker already running, will not restart`);
    }
  }
}
