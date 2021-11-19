from __future__ import print_function
import boto3
import time
from boto3.session import Session
import sys, traceback
import json
import requests
import botocore
from botocore.config import Config
from utils.innovation_sbx_helpers import *
import logging
import inspect


SUCCESS = "SUCCESS"
FAILED = "FAILED"

config = Config(
   retries = {
      'max_attempts': 10,
      'mode': 'standard'
   }
)


logger = logging.getLogger()
logger.setLevel(logging.INFO)


def delete(event, context):
    props = event["ResourceProperties"]
    
    account = props['Account_ID']
    
    credentials = assume_role(account)

    try:
        delete_stack('MissionCloudStack', credentials)
    except Exception as e:
        raise

    return


def create(event, context):

    logger.info(event)

    try:
        props = event["ResourceProperties"]
    
        account = props['Account_ID']
        template = props['Template']
        tag_engteam = props['Tag_Eng_Team']
        costs_bucket = props['CostsBucketName']
        credentials = assume_role(account)
        
        tags = {"Sandbox_Account_ID": account, "Eng_Team": tag_engteam }


        logger.info("Running Mission Cloud Stack")
        run_stack( account, template, credentials, [
            {
                'ParameterKey': 'CURS3BillingBucket',
                'ParameterValue': costs_bucket+"-"+account
            }],'MissionCloudStack', tags )
    
        responseData = {"Message":"Successfly Deployed Innovation Architecture"}
    
        send(event, context, SUCCESS,
                         responseData, "Mission_Cloud_Stack")

    except Exception as e:
        message = {'MESSAGE': 'Exception occurred while creating/attaching SCPs',
                              'FILE': __file__.split('/')[-1], 'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)
        errorResponseData = {
            "Message":"Mission Cloud Stack failed"
        }
        send(event, context, FAILED,
                             errorResponseData, "Mission_Cloud_Stack")

def main(event, context):

    try:

        if event['RequestType'] == 'Create':
            create(event, context)
            return
        elif event['RequestType'] == 'Update':
            responseData = {"message": "No updates were made"}
            send(event, context, SUCCESS, responseData, "Mission_Cloud_Stack")
            return
        elif event['RequestType'] == 'Delete':
            delete(event, context)
            responseData = {"message":"Deleted Transit Gateway Setup."}
            send(event, context, SUCCESS,responseData, "Mission_Cloud_Stack")
            return
        else:
            responseData = {"message": "Unsupported operation"}
            send(event, context, FAILED, responseData, "Mission_Cloud_Stack")

    except Exception as e:

        message = {'MESSAGE': 'Exception occurred during '+event['RequestType']+' stack action while setting up TGW',
                              'FILE': __file__.split('/')[-1], 'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)

        errorResponseData = {
            "Message": "Mission Cloud Stack failed"
        }
        send(event, context, FAILED,
             errorResponseData, "Mission_Cloud_Stack")
