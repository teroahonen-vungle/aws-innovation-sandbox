#!/usr/bin/env node

import * as cdk from '@aws-cdk/core';

import { SandboxManagementAccount } from '../lib/SandboxManagementAccount';
import { SandboxManagement } from '../lib/SandboxManagement';

const SOLUTION_VERSION = process.env['DIST_VERSION'] || '%%VERSION%%';
const SOLUTION_NAME = process.env['SOLUTION_NAME'];
const SOLUTION_ID = process.env['SOLUTION_ID'];
const SOLUTION_BUCKET = process.env['DIST_OUTPUT_BUCKET'];
const SOLUTION_TMN = process.env['SOLUTION_TRADEMARKEDNAME'];
const SOLUTION_PROVIDER = 'Vungle DevOps';

const app = new cdk.App();

new SandboxManagementAccount(app, 'SandboxManagementAccount');
new SandboxManagement(app, 'SandboxManagement', {
    description: '(' + SOLUTION_ID + ') - ' + SOLUTION_NAME + ', version ' + SOLUTION_VERSION,
    solutionId: SOLUTION_ID,
    solutionTradeMarkName: SOLUTION_TMN,
    solutionProvider: SOLUTION_PROVIDER,
    solutionBucket: SOLUTION_BUCKET,
    solutionName: SOLUTION_NAME,
    solutionVersion: SOLUTION_VERSION
});
