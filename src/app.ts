import bodyParser from 'body-parser';
import express from 'express';
// import path from 'path';
import { configuration } from '../configuration';
import { enumerateError } from './common/ObjectUtil';
import { IpCheckerTask } from './task/IpChecker';
import { IpCheckingPlugToggler } from './task/IpCheckingPlugToggler';
import { PageCheckerTask } from './task/PageChecker';
import { PingCheckerTask } from './task/PingChecker';
import Task from './task/Task';
import { Smser } from './common/Smser';
import AWS from 'aws-sdk';

process.on('unhandledRejection', (error) => {
  console.log(`Unhandled error ocurred`);
  console.log(`${error}`);
  console.log(`${JSON.stringify(error)}`);
  console.log(`${JSON.stringify(enumerateError(error), null, 2)}`);
});

export function asyncHandler(handler: (request, response) => Promise<any>) {
  return async (request, response, next) => {
    try {
      const responseObject = await handler(request, response);
      response.status(responseObject.code).json(responseObject.payload);
      next();
    } catch (error) {
      next(error);
    } finally {
      console.log(`Request handling complete.`);
    }
  };
}

const router = express.Router();
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

// Health Check endpoint
router.get(
  '/status',
  asyncHandler(async () => {
    const ok = {
      code: 200,
      payload: { status: 'ok' },
    };
    return ok;
  }),
);

export const expressApp = express();
expressApp.use('/', router);

// Start the local server
console.log(`Starting API...`);
try {
  const port = configuration.port;
  expressApp.listen(port, () => {
    console.log(`API Listening on port: ${port}`);
  });
} catch (error) {
  console.log(`Error caught!`);
  console.log(`${JSON.stringify(enumerateError(error), null, 2)}`);
}

console.log(`Starting tasks...`);
const tasks: Task[] = [
  new IpCheckerTask(configuration, new Smser(configuration)),
  // new PingCheckerTask(configuration),
  // new IpCheckingPlugToggler(configuration),
  // new PageCheckerTask(configuration, new Smser(configuration), new AWS.S3(), new AWS.Textract({region:configuration.defaultRegion})),
];
tasks.forEach((task) => {
  task.start();
});
