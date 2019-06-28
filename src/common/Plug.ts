import requestPromise from 'request-promise-native';

import { configuration } from '../../configuration';

export interface IPlugState {
  body: { on: boolean };
  json: true;
}

export const PLUG_OFF: IPlugState = {
  body: { on: false },
  json: true,
};

export const PLUG_ON: IPlugState = {
  body: { on: true },
  json: true,
};

export async function setPlugState(ip: string, state: IPlugState) {
  const putUrl = `${configuration.plugsEndpoint}/${ip}/state`;
  try {
    const putResult = await requestPromise.put(putUrl, state);
    console.log(`Plug at ip, '${ip}' has been set to state, '${JSON.stringify(state)}'`);
  } catch (error) {
    console.log(`An error ocurred while accessing the endpoint, '${putUrl}'.`);
    console.log(JSON.stringify(error, null, 2));
  }
}

export async function getPlugState(ip: string): Promise<{ on: true }> {
  const getUrl = `${configuration.plugsEndpoint}/${ip}/state`;
  try {
    const getResult = await requestPromise.get(getUrl);
    const state = getResult.payload;
    console.log(`Plug at ip, '${ip}' currently has state, '${JSON.stringify(state)}'`);
    return state;
  } catch (error) {
    console.log(`An error ocurred while accessing the endpoint, '${getUrl}'.`);
    console.log(JSON.stringify(error, null, 2));
  }
}

export async function setPlugStates(ips: string[], state: IPlugState) {
  for (const ip of ips) {
    try {
      setPlugState(ip, state);
    } catch (error) {
      console.log(`Error ocurred while setting plug state:`);
      console.log(JSON.stringify(error, null, 2));
    }
  }
}
