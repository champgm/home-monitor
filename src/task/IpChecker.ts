export interface State {
  running: boolean;
}

export class IpCheckerTask {
  private static fiveMinutes = 300000;
  // private static tenSeconds = 10000;
  public state: State;

  constructor() {
    this.state = {
      running: false,
    };
  }

  public start() {
    this.state.running = true;
    console.log(`Running IChecker`);

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
