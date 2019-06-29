import AWS from 'aws-sdk';
import ping from 'ping';

import { Configuration } from '../../configuration';
import { PingResponse } from '../common/interface/Ping';
import { enumerateError } from '../common/ObjectUtil';
import { getTimestamp } from '../common/Time';
import Task from './Task';

export interface State {
  running: boolean;
}

export class PingCheckerTask extends Task {
  private static interval = 300000;

  public state: State;
  private addressesToPing: { [name: string]: string; };
  private cloudWatch: AWS.CloudWatch;

  constructor(configuration: Configuration) {
    super();
    this.addressesToPing = configuration.addressesToPing;
    this.cloudWatch = new AWS.CloudWatch();
    this.state = { running: false };
  }

  public async start() {
    this.state.running = true;

    console.log(`${getTimestamp()} - Collecting ping data...`);
    const rawResponses = await Promise.all(Object.keys(this.addressesToPing)
      .map(async (siteName) => {
        try {
          const siteAddress = this.addressesToPing[siteName];
          const pingResponse: PingResponse =
            await ping.promise.probe(siteAddress);
          return pingResponse;
        } catch (error) {
          console.log(`${getTimestamp()} - Error ocurred while pinging site:`);
          console.log(`${JSON.stringify(enumerateError(error), null, 2)}`);
          return;
        }
      }));
    const responses = rawResponses.filter((response) => {
      return response !== undefined;
    });

    console.log(`Submitting ping data...`);
    const metricDataInput = this.buildMetricData(responses);
    try {
      await this.cloudWatch.putMetricData(metricDataInput).promise();
    } catch (error) {
      console.log(`${getTimestamp()} - Failed to send cloudwatch metrics.`);
      console.log(`${getTimestamp()} - Error: ${error}`);
      console.log(`${getTimestamp()} - Error: ${JSON.stringify(error, null, 2)}`);
    }

    this.state.running = false;
    this.restart();
  }

  public restart() {
    if (!this.state.running) {
      setTimeout(() => { this.start(); }, PingCheckerTask.interval);
    } else {
      console.log(`PingChecker already running, will not restart`);
    }
  }

  private buildMetricData(responses: PingResponse[]) {
    const datums: AWS.CloudWatch.MetricDatum[] = responses.map((response) => {
      return {
        Dimensions: [
          {
            Name: 'Hostname',
            Value: response.host,
          }, {
            Name: 'IP',
            Value: response.numeric_host,
          },
        ],
        MetricName: 'Response Time',
        Unit: 'Milliseconds',
        Value: response.time,
      };
    });
    const dataInput: AWS.CloudWatch.PutMetricDataInput = {
      MetricData: datums,
      Namespace: 'home-monitor-ping',
    };
    return dataInput;
  }

}
