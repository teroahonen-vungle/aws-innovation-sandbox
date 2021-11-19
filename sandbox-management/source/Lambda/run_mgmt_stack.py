import boto3
import time
from boto3.session import Session
import sys, traceback
import json
import uuid
import requests
import botocore
from botocore.config import Config
import logging
from utils.innovation_sbx_helpers import *
import inspect


SUCCESS = "SUCCESS"
FAILED = "FAILED"

config = Config(
    retries={
        'max_attempts': 10,
        'mode': 'standard'
    }
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def get_transit_gateway_id_mgmt(credentials):
    try:
        ec2 = boto3.client('ec2'
                       ,
                       aws_access_key_id=credentials['AccessKeyId'],
                       aws_secret_access_key=credentials['SecretAccessKey'],
                       aws_session_token=credentials['SessionToken'],
                       region_name=boto3.session.Session().region_name + "",
                       config=config
                       )
        tgws = ec2.describe_transit_gateways(
            Filters=[{
            'Name': 'state',
            'Values': [
                'available'
            ]},
            ],
        )

        tgw = tgws['TransitGateways'][0]['TransitGatewayId']
        tgw_attchs = ec2.describe_transit_gateway_attachments()
        tgw_attch_id = tgw_attchs['TransitGatewayAttachments'][0]['TransitGatewayAttachmentId']
    except Exception as e:
        message = {'MESSAGE': 'Exception while fetching transit gateway IDs',
                              'FILE': __file__.split('/')[-1], 'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)
        raise

    return (tgw, tgw_attch_id)


def get_elastic_ip_mgmt(credentials):
    try:
        ec2 = boto3.client('ec2',
                       aws_access_key_id=credentials['AccessKeyId'],
                       aws_secret_access_key=credentials['SecretAccessKey'],
                       aws_session_token=credentials['SessionToken'],
                       region_name=boto3.session.Session().region_name + "",
                       config=config)
        addresses = ec2.describe_addresses()
        eip = []
        for eip_dict in addresses['Addresses']:
            eip.append(eip_dict['PublicIp'])
        if len(eip) != 2:
            raise Exception("Could not find 2 Elastic IP addresses. This solution needs 2 EIPs to be created.")
    except Exception as e:
        message = {'MESSAGE': 'Exception while fetching Elastic IPs',
                              'FILE': __file__.split('/')[-1], 'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)
        raise
    
    return eip


def create(event, context):

    logger.info(event)

    try:
        props = event["ResourceProperties"]

        management_act_id = props['Management_Account_ID']
        management_act_name = props['Management_Account_Name']
        tag_engteam = props['Tag_Eng_Team']
        tb = props['Template_Base_Path']
        mgmt_cidr = props['Mgmt_CIDR']
        costs_bucket = props['CostsBucketName']
        tags = {"Management_Account_ID": management_act_id, "Management_Account_Name": management_act_name,"Eng_Team": tag_engteam }
        
        credentials = assume_role(management_act_id)

        s3_public_settings(management_act_id, credentials)

        logger.info("Running Management Stack")
        run_stack(
            management_act_id, tb + "SandboxManagementAccount.template", credentials, [{
                'ParameterKey': 'MgmtCidr',
                'ParameterValue': mgmt_cidr
            },
            {
                'ParameterKey': 'UUID',
                'ParameterValue': str(uuid.uuid4()).replace('-', '')
            },
            {
                'ParameterKey': 'ManagementAccountID',
                'ParameterValue': management_act_id
            },
            {
                'ParameterKey': 'CostsBucketName',
                'ParameterValue': costs_bucket
            }
            ], 'SbxMgmtStack', tags)

        eip = get_elastic_ip_mgmt(credentials)

        responseData = {
            "EIP": eip[0],
            "EIP2": eip[1]
        }
        logger.info(responseData)
        send(event, context, SUCCESS,
             responseData, "AppStream_Account_Network_Setup")
    except Exception as e:
        message = {'MESSAGE': 'Error while launching the stack in the AppStream Account',
                              'FILE': __file__.split('/')[-1], 'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)
        raise


def delete(event, context):
    props = event["ResourceProperties"]
    _management_act_id = props['Management_Account_ID']
    credentials = assume_role(_management_act_id)

    try:
        delete_stack('SbxMgmtStack', credentials)
    except Exception as e:
        raise

    return


def main(event, context):

    try:
        if event['RequestType'] == 'Create':
            create(event, context)
        elif event['RequestType'] == 'Update':
            responseData = {"message": "No updates were made"}
            send(event, context, SUCCESS, responseData, "AppStream_Account_Network_Setup")
        elif event['RequestType'] == 'Delete':
            delete(event, context)
            responseData = {"message": "Deleted Appstream resources."}
            send(event, context, SUCCESS, responseData, "AppStream_Account_Network_Setup")
        else:
            responseData = {"message": "Unsupported opration"}
            send(event, context, FAILED,
                 responseData, "AppStream_Account_Network_Setup")
    except Exception as e:
        message = {'MESSAGE': 'Exception occurred during '+event['RequestType']+' stack action on AppStream account',
                          'FILE': __file__.split('/')[-1], 'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)
        errorResponseData = {
            "Message": "Appstream stack creation failed"
        }
        send(event, context, FAILED,
             errorResponseData, "AppStream_Account_Network_Setup")
