import logging
import boto3
import time
from boto3.session import Session
import sys
import traceback
import json
import uuid
import requests
from botocore.config import Config
from utils.innovation_sbx_helpers import *
import traceback
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


def create_scp_sbx(client, name, tb, scp_name):
    try:
        response = requests.get(
            tb+scp_name)
        scp = response.json()
        scp = str(scp).replace("'", "\"")
        response = client.create_policy(
            Content=scp,
            Description=name,
            Name=name,
            Type='SERVICE_CONTROL_POLICY'
        )
    except Exception as e:
        message = {'MESSAGE': 'Exception while creating Service Control Policy',
                              'FILE': __file__.split('/')[-1], 'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)
        raise
    return response['Policy']['PolicySummary']['Id']


def create(event, context):

    logger.info("Attaching SCPs")
    

    try:

        props = event["ResourceProperties"]

        sbx_ou = props['Sandbox_OU']
        ids = props['SPC_IDs']

        client = boto3.client('organizations', config=config)

        
        logger.info("Attaching: "+ids)

        for id in ids.split(","):
            try:
	            client.attach_policy(PolicyId=id.strip(), TargetId=sbx_ou)
            except Exception as ex:
                logger.info(id+" already attached.")
            
        
        logger.info("Attached Service Control Policies")

        responseData = {
            "Message": "Sandbox SCPs Attached"
        }

        send(event, context, SUCCESS, responseData, "Sbx_Attach_SCPs")

    except Exception as e:
        message = {'MESSAGE': 'Exception occurred while creating and attaching SCPs',
                              'FILE': __file__.split('/')[-1], 'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)
        errorResponseData = {
            "Message": "Sandbox SCP Attachment Failed"
        }
        send(event, context, FAILED, errorResponseData, "Sbx_Attach_SCPs")


def main(event, context):

    if event['RequestType'] == 'Create':
        create(event, context)
        return
    elif event['RequestType'] == 'Update':
        responseData = {"message": "No updates were made"}
        send(event, context, SUCCESS, responseData, "Sbx_Attach_SCPs")
        return
    elif event['RequestType'] == 'Delete':
        responseData = {"message": "SCPs were not deleted. Please delete them manually"}
        send(event, context, SUCCESS, responseData, "Sbx_Attach_SCPs")
        return
    else:
        responseData = {"message": "Unsupported opration"}
        send(event, context, FAILED, responseData, "Sbx_Attach_SCPs")
