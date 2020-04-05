import AWS, { S3, config, Textract } from 'aws-sdk';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import requestPromise from 'request-promise-native';
import pixelmatch from 'pixelmatch';

import { Configuration } from '../../configuration';
import { PingResponse } from '../common/interface/Ping';
import { enumerateError } from '../common/ObjectUtil';
import { getTimestamp, sleep } from '../common/Time';
import { Smser } from '../common/Smser';

import Task from './Task';
import { PNG } from 'pngjs';

export interface State {
  running: boolean;
}

export class PageCheckerTask extends Task {
  private static thirtyMinutes = 1800 * 1000;
  private static interval = PageCheckerTask.thirtyMinutes;

  public state: State;
  private pagesToCheck: { [key: string]: string };
  private chromiumPath: string;
  private bucketName: string;
  private contactNumbers: { [key: string]: string; };

  constructor(
    configuration: Configuration,
    private smser: Smser,
    private s3: AWS.S3,
    private textract: AWS.Textract,
  ) {
    super();
    this.pagesToCheck = configuration.pagesToCheck;
    this.chromiumPath = configuration.chromiumPath;
    this.state = { running: false };
    this.bucketName = configuration.bucketName;
    this.contactNumbers = configuration.contactNumbers;
  }

  public async start() {
    this.state.running = true;

    console.log(`${getTimestamp()} - Collecting page data...`);
    for (const pageName of Object.keys(this.pagesToCheck)) {
      const url = this.pagesToCheck[pageName];

      const retailer = pageName.split('-')[0];
      const screenshotPath = path.join(__dirname, 'screenshots', `${pageName}.png`);
      const textPath = path.join(__dirname, 'screenshots', `${pageName}.txt`);

      // https://dev.to/benjaminmock/how-to-take-a-screenshot-of-a-page-with-javascript-1e7c
      console.log(`${getTimestamp()} - Opening browser for ${pageName}...`);
      const browser = await puppeteer.launch({ executablePath: this.chromiumPath, headless: false });
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 1000 });


      console.log(`${getTimestamp()} - Navigating to ${retailer}: ${url}`);
      await page.goto(url);
      await page.reload()

      await page.screenshot({ path: screenshotPath });

      switch (retailer) {
        case 'Amazon':
          await this.detectTextOnPage(
            url,
            pageName,
            screenshotPath,
            textPath,
            ['UNAVAILABLE']
          );
          break;
        case 'Costco':
          await this.detectTextOnPage(
            url,
            pageName,
            screenshotPath,
            textPath,
            ['OUT OF STOCK', '$--.--', '$-.--', '$ -']
          );
          break;
        default:
          console.log(`${getTimestamp()} - Handler for retailer, ${retailer}, not found.`);
          break;
      }

      await browser.close();
    };


    this.state.running = false;
    this.restart();
  }

  public restart() {
    if (!this.state.running) {
      setTimeout(() => { this.start(); }, PageCheckerTask.interval);
    } else {
      console.log(`PageChecker already running, will not restart`);
    }
  }

  private getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
  }

  private async detectTextOnPage(
    url: string,
    pageName: string,
    newScreenshotPath: string,
    textSavePath: string,
    stringsToDetect: string[],
  ) {
    // console.log(`${getTimestamp()} - Detecting text on page, '${pageName}'...`);
    const textractRequest: Textract.Types.DetectDocumentTextRequest = {
      Document: {
        Bytes: fs.readFileSync(newScreenshotPath),
      }
    }
    const documentText = await this.textract.detectDocumentText(textractRequest).promise();
    const textBlocksChecked: string[] = [];
    const isUnavailable = documentText.Blocks.some((block: Textract.Block) => {
      if (block.Text) {
        textBlocksChecked.push(block.Text)
        for (const stringToDetect of stringsToDetect) {
          return block.Text.toLocaleUpperCase().includes(stringToDetect.toLocaleUpperCase());
        }
      }
      return false;
    })
    fs.writeFileSync(textSavePath, JSON.stringify(textBlocksChecked, null, 2))
    if (isUnavailable) {
      console.log(`${getTimestamp()} - Found indication that item is unavailable on page, '${pageName}'...`);
    } else {
      console.log(`${getTimestamp()} - Found indication that item is available on page, '${pageName}'...`);
      console.log(`${getTimestamp()} - Uploading screenshot for page, '${pageName}'...`);
      const newKey = `page-checker-pictures/${pageName}-new.png`;
      const newImageUrl = `https://s3.us-east-1.amazonaws.com/${this.bucketName}/${newKey}`
      await this.s3.putObject({
        Bucket: this.bucketName,
        Key: newKey,
        Body: fs.readFileSync(newScreenshotPath),
        ContentType: 'image/png',
      }).promise();

      console.log(`${getTimestamp()} - Sending alerts for page, '${pageName}'...`);
      const smsPromises = Object.values(this.contactNumbers).map(async (phoneNumber) => {
        const messageText = `A page, '${pageName}', now has items available.
URL: ${url}

Screenshot: ${newImageUrl}`;
        console.log(messageText);
        await this.smser.sendSms(phoneNumber, messageText);
        return;
      });
      await Promise.all(smsPromises);
    }
  }
}
