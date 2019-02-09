import ping from 'ping';
import Twilio from 'twilio';
import AWS from 'aws-sdk';
import clone from 'lodash.clonedeep';

import { Configuration } from '../../configuration';
import { PingResponse } from '../common/interface/Ping';
import Task from './Task';
import { enumerateError } from '../common/ObjectUtil';

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

    console.log(`Collecting ping data...`);
    const rawResponses = await Promise.all(Object.keys(this.addressesToPing)
      .map(async (siteName) => {
        try {
          const siteAddress = this.addressesToPing[siteName];
          const pingResponse: PingResponse =
            await ping.promise.probe(siteAddress);
          return pingResponse;
        } catch (error) {
          console.log(`Error ocurred while pinging site:`);
          console.log(`${JSON.stringify(enumerateError(error), null, 2)}`);
          return;
        }
      }));
    const responses = rawResponses.filter((response)=>{
      return response !==undefined;
    });

    console.log(`Submitting ping data...`);
    const metricDataInput = this.buildMetricData(responses);
    await this.cloudWatch.putMetricData(metricDataInput).promise();

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
        MetricName: 'Response Time',
        Dimensions: [
          {
            Name: 'Hostname',
            Value: response.host,
          }, {
            Name: 'IP',
            Value: response.numeric_host,
          },
        ],
        Unit: 'Milliseconds',
        Value: response.time,
      };
    });
    const dataInput: AWS.CloudWatch.PutMetricDataInput = {
      Namespace: 'home-monitor-ping',
      MetricData: datums,
    };
    return dataInput;
  }

}