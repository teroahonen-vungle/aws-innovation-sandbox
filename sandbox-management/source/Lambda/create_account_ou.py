import boto3
import botocore
import time
from boto3.session import Session
import sys
import traceback
import json
import re  
import requests
from botocore.config import Config
import logging
from utils.innovation_sbx_helpers import *
import inspect



SUCCESS = "SUCCESS"
FAILED = "FAILED"
MAX_ACCOUNT_CHECK_RETRIES = 20

config = Config(
    retries={
        'max_attempts': 10,
        'mode': 'standard'
    }
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def create_account(client, name, email):
    try:
        logger.info("Creating Account: "+name)
        _account = client.create_account(
            Email=email,
            AccountName=name,
            IamUserAccessToBilling='DENY',
            RoleName="SandboxAdminExecutionRole"
        )

    except Exception as e:
        message = {'MESSAGE': 'Exception occurred while creating account','FILE': __file__.split('/')[-1], 
                              'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)
        raise

    _car = _account["CreateAccountStatus"]["Id"]

    account_check_retries = 0

    while account_check_retries < MAX_ACCOUNT_CHECK_RETRIES:
        account_check_retries = account_check_retries + 1
        account_status_response = client.describe_create_account_status(
            CreateAccountRequestId=_car)
        logger.info(account_status_response)
        account_status = account_status_response["CreateAccountStatus"]["State"]
        if account_status == "SUCCEEDED":
            return account_status_response["CreateAccountStatus"]["AccountId"]
        elif account_status == "FAILED":
            logger.error("ERROR: Account creation failed. Failure reason: "
                          + account_status_response["CreateAccountStatus"]["FailureReason"])
            raise Exception(account_status_response["CreateAccountStatus"]["FailureReason"])
        else:
            time.sleep(15)

    
    logger.error("Account creation taking longer than expected")
    raise Exception("Account creation taking longer than expected")


def create_ou_move_act(client, root, name, act):

    try:
        logger.info("Moving Account: "+act+" to OU "+name)
        _ou = client.create_organizational_unit(
            Name=name,
            ParentId=root
        )

    except Exception as e:
        message = {'MESSAGE': 'Exception occurred while creating OU','FILE': __file__.split('/')[-1], 
                           'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)
        raise

    try:
        parents = client.list_parents(
            ChildId=act
        )

        curr_parent = parents["Parents"][0]["Id"]

        client.move_account(
            AccountId=act,
            SourceParentId=curr_parent,
            DestinationParentId=_ou["OrganizationalUnit"]["Id"]
        )
    except Exception as e:
        message = {'MESSAGE': 'Exception occurred while moving account to OU','FILE': __file__.split('/')[-1], 
                              'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)
        raise

    return _ou["OrganizationalUnit"]["Id"]


def validate_inputs(mgmt_name, mgmt_email, mgmt_ou, client, root):

    error_flag = False
    error_reason = ""

    logger.info("Validating input parameters")

    # Validate Email already exists

    response = client.list_accounts()

    all_accounts = response["Accounts"]

    while 'NextToken' in response.keys():
        response = client.list_accounts(NextToken=response["NextToken"])
        all_accounts = all_accounts + response["Accounts"]

    for acct in all_accounts:
        if mgmt_email == acct["Email"]:
            error_reason = error_reason + "Account Email already exists" + " | "
            error_flag = True
            break


    # Validate OU already exists

    response = client.list_organizational_units_for_parent(ParentId=root)

    all_ous = response['OrganizationalUnits']

    while 'NextToken' in response.keys():
        response = client.list_organizational_units_for_parent(
            ParentId=root, NextToken=response["NextToken"])
        all_ous = all_ous + response['OrganizationalUnits']

    for ou in all_ous:
        if mgmt_ou == ou['Name']:
            error_reason = error_reason + "OU already exists under root" + " | "
            error_flag = True
            break

    if error_flag is True:
        message = {'MESSAGE': 'Invalid Inputs :'+ error_reason, 'FILE': __file__.split('/')[-1], 
                           'METHOD': inspect.stack()[0][3]}
        logger.error(message)
        raise Exception(error_reason)


    return


def create(event, context):

    logger.info("Creating Management Account")
    logger.info(event)

    props = event["ResourceProperties"]

    mgmt_name = props["Mgmt_Name"]
    mgmt_email = props["Mgmt_Email"]
    mgmt_ou = props["Mgmt_OU_Name"]
    mgmt_account_id = props['Mgmt_Id']
    mgmt_ou_id = props['Mgmt_OU_Id']

    try:
        logger.info("mgmt_account_id: "+mgmt_account_id)
        logger.info("mgmt_ou_id: "+mgmt_ou_id)
        if mgmt_account_id == '-':
            logger.info("Account and OU not created, creating.")
            organizations = boto3.client('organizations', config=config)

            root = organizations.list_roots()["Roots"][0]["Id"]

            validate_inputs(mgmt_name, mgmt_email, mgmt_ou, organizations, root)

            appstream_act_id = create_account(organizations, mgmt_name, mgmt_email)

            appstream_ou = create_ou_move_act(organizations, root, mgmt_ou, appstream_act_id)

            
            responseData = {
                "Management_Account_ID": appstream_act_id,
                "Managment_OU_ID": appstream_ou
            }
        else:
            logger.info("Account and OU already created")
            responseData = {
                "Management_Account_ID": mgmt_account_id,
                "Managment_OU_ID": mgmt_ou_id
            }
        send(event, context, SUCCESS, responseData, "Create_Accounts_OUs")


    except Exception as e:
        message = {'MESSAGE': 'Account Creation Failed', 'FILE': __file__.split('/')[-1], 
                           'METHOD': inspect.stack()[0][3], 'EXCEPTION': str(e), 'TRACE': traceback.format_exc()}
        logger.exception(message)
        responseData = {
            "Message": "Account Creation Failed"
        }
        send(event, context, FAILED,
             responseData, "Create_Accounts_OUs")


def main(event, context):
    if event['RequestType'] == 'Create':
        create(event, context)
        return
    elif event['RequestType'] == 'Update':
        responseData = {"message": "No updates were made to the accounts"}
        send(event, context, SUCCESS, responseData, "Create_Accounts_OUs")
        return
    elif event['RequestType'] == 'Delete':
        responseData = {"message": "Please delete accounts manually"}
        send(event, context, SUCCESS, responseData, "Create_Accounts_OUs")
        return
    else:
        responseData = {"message": "Unsupported opration"}
        send(event, context, FAILED, responseData, "Create_Accounts_OUs")
