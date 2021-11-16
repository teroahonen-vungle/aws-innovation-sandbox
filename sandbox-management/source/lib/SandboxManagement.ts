import cfn = require("@aws-cdk/aws-cloudformation");
import lambda = require("@aws-cdk/aws-lambda");
import cdk = require("@aws-cdk/core");
import iam = require("@aws-cdk/aws-iam");
import s3 = require("@aws-cdk/aws-s3");
import { CfnParameter, CfnResource } from '@aws-cdk/core';


export class SandboxManagement extends cdk.Stack {
  public readonly response: string;
  constructor(
    scope: cdk.App,
    id: string,
    props?: any,
    s?: string
  ) {
    super(scope, id, props);
    const solutionsBucket = s3.Bucket.fromBucketAttributes(this, 'SolutionsBucket', {
      bucketName: props["solutionBucket"] + '-' + this.region
    });

    
    


    const mgmt_account_name = new cdk.CfnParameter(
      this,
      "Sandbox Management Account Name",
      {
        type: "String",
        description: "Account Name for Appstream Management Account",
      }
    );

    const mgmt_email = new cdk.CfnParameter(
      this,
      "Sandbox Management Account Email",
      {
        type: "String",
        description: "Email for Sandbox Management Account",
      }
    );
    const mgmt_ou_name = new cdk.CfnParameter(
      this,
      "Sandbox Management OU Name",
      {
        type: "String",
        description: "OU Name for Sandbox Management Account",
      }
    );

    const mgmt_cidr = new cdk.CfnParameter(
      this,
      "Sandbox Management VPC CIDR",
      {
        type: "String",
        description: "VPC CIDR for Appstream Management Account",
      }
    );

    const mgmt_account_id = new cdk.CfnParameter(
      this,
      "MgmtAccountID",
      {
        type: "String",
        description: "Mgmt Account id, if account already created",
      }
    );

    const mgmt_ou_id = new cdk.CfnParameter(
      this,
      "MgmtOUID",
      {
        type: "String",
        description: "Mgmt OU id, if OU already created",
      }
    );
    const tag_eng_team = new cdk.CfnParameter(
      this,
      "TagEngTeam",
      {
        type: "String",
        description: "Eng_Team tag value.",
      }
    );

    // Create Accounts, OUs
    const l0_role_policy = new iam.Policy(this, "Create_Account_OU_Role_Policy", {
      statements:[ 
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: [cdk.Fn.sub("arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}*:*")],
          actions: ["logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents" ]
        })
        ,new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["arn:aws:iam::*:role/SandboxAdminExecutionRole"],
        actions: ["sts:AssumeRole"]
      }),
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: ["organizations:ListRoots",
        "organizations:MoveAccount",
        "organizations:DescribeCreateAccountStatus",
        "organizations:ListParents",
        "organizations:ListAccounts",
        "organizations:ListOrganizationalUnitsForParent",
        "organizations:CreateOrganizationalUnit",
        "organizations:CreateAccount"]
      })
      
    ]
    });

    const l0_cfn_role_policy = l0_role_policy.node.defaultChild as iam.CfnPolicy;

    l0_cfn_role_policy.addMetadata('cfn_nag', {
      rules_to_suppress: [
        {
          id: 'W12',
          reason: 'Specified actions do not apply to specific resources'
        }
      ]
    });


    const l0_role = new iam.Role(this, "l0role",{
      assumedBy:new iam.ServicePrincipal('lambda.amazonaws.com')
    });

    l0_role.attachInlinePolicy(l0_role_policy);

    l0_role_policy.node.addDependency(l0_role);


    const l0 = new lambda.Function(this, "Create_Account_OU_Function", {
      code: lambda.Code.fromBucket(solutionsBucket, props["solutionTradeMarkName"] + '/' + props["solutionVersion"] + '/SandboxManagement.zip'),
      handler: "create_account_ou.main",
      timeout: cdk.Duration.minutes(15),
      runtime: lambda.Runtime.PYTHON_3_8,
      role: l0_role
    });

    const l0_cfn = l0.node.defaultChild as lambda.CfnFunction;

    l0_cfn.addMetadata('cfn_nag', {
      rules_to_suppress: [
        {
          id: 'W58',
          reason: 'Lambda function already has permission to write CloudWatch Logs'
        },
        {
          id: 'W89',
          reason: 'VPC Not setup yet - Default VPC is deleted'
        },
        {
          id: 'W92',
          reason: 'Setup Lambda - Concurrent executions not needed'
        }
      ]
    });

    l0.node.addDependency(l0_role_policy);

    const create_account_ou = new cfn.CustomResource(
      this,
      "Create_Account_OU",
      {
        provider: cfn.CustomResourceProvider.lambda(l0),
        properties: {
          Mgmt_Name: mgmt_account_name.valueAsString,
          Mgmt_Email: mgmt_email.valueAsString,
          Mgmt_OU_Name: mgmt_ou_name.valueAsString,
          Mgmt_CIDR: mgmt_cidr.valueAsString,
          Mgmt_Id: mgmt_account_id.valueAsString,
          Mgmt_OU_Id: mgmt_ou_id.valueAsString
        },
      }
    );

   
  
   
    var _Mgmt = create_account_ou.getAtt("Management_Account_ID").toString();
    var _MgmtCIDR = mgmt_cidr.valueAsString;

    var S3_Templates_Base_Path = "https://"+props["solutionBucket"] + '-' + this.region+".s3.amazonaws.com/"+props["solutionTradeMarkName"] + '/' + props["solutionVersion"]+"/";



    const l1_role = new iam.Role(this, "l1role",{
      assumedBy:new iam.ServicePrincipal('lambda.amazonaws.com')
    });

    l1_role.addToPolicy(  new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [cdk.Fn.sub("arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}*:*")],
      actions: ["logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents" ]
    }));

    l1_role.addToPolicy( 
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["arn:aws:iam::*:role/SandboxAdminExecutionRole"],
        actions: ["sts:AssumeRole"]
      })
    );

    // Delete default VPCs

    const l1 = new lambda.Function(this, "Delete_Default_VPCs_Function", {
      code: lambda.Code.fromBucket(solutionsBucket, props["solutionTradeMarkName"] + '/' + props["solutionVersion"] + '/SandboxManagement.zip'),
      handler: "delete_default_vpcs.main",
      timeout: cdk.Duration.minutes(15),
      runtime: lambda.Runtime.PYTHON_3_8,
      role:l1_role
    });

    const l1_cfn = l1.node.defaultChild as lambda.CfnFunction;

    l1_cfn.addMetadata('cfn_nag', {
      rules_to_suppress: [
        {
          id: 'W58',
          reason: 'Lambda function already has permission to write CloudWatch Logs'
        },
        {
          id: 'W89',
          reason: 'VPC Not setup yet - Default VPC is deleted'
        },
        {
          id: 'W92',
          reason: 'Setup Lambda - Concurrent executions not needed'
        }
      ]
    });

    const delete_default_vpcs = new cfn.CustomResource(
      this,
      "Delete_Default_VPCs",
      {
        provider: cfn.CustomResourceProvider.lambda(l1),
        properties: {
          Management_Account_ID: _Mgmt
          
        },
      }
    );

    delete_default_vpcs.node.addDependency(create_account_ou);

    // Run Mgmt Stack

    const l2_role = new iam.Role(this, "l2role",{
      assumedBy:new iam.ServicePrincipal('lambda.amazonaws.com')
    });

    l2_role.addToPolicy(  new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [cdk.Fn.sub("arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}*:*")],
      actions: ["logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents" ]
    }));

    l2_role.addToPolicy( 
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["arn:aws:iam::*:role/SandboxAdminExecutionRole"],
        actions: ["sts:AssumeRole"]
      })
    );

    const l2 = new lambda.Function(this, "Run_Mgmt_Stack_Function", {
      code: lambda.Code.fromBucket(solutionsBucket, props["solutionTradeMarkName"] + '/' + props["solutionVersion"] + '/SandboxManagement.zip'),
      handler: "run_mgmt_stack.main",
      timeout: cdk.Duration.minutes(15),
      runtime: lambda.Runtime.PYTHON_3_8,
      role: l2_role
    });

    const l2_cfn = l2.node.defaultChild as lambda.CfnFunction;

    l2_cfn.addMetadata('cfn_nag', {
      rules_to_suppress: [
        {
          id: 'W58',
          reason: 'Lambda function already has permission to write CloudWatch Logs'
        },
        {
          id: 'W89',
          reason: 'VPC Not setup yet - Default VPC is deleted'
        },
        {
          id: 'W92',
          reason: 'Setup Lambda - Concurrent executions not needed'
        }
      ]
    });


    
    const run_mgmt_stack = new cfn.CustomResource(
      this,
      "Run_Mgmt_Stack",
      {
        provider: cfn.CustomResourceProvider.lambda(l2),
        properties: {
          Management_Account_ID: _Mgmt,
          Management_Account_Name: mgmt_account_name.valueAsString,
          Mgmt_CIDR: _MgmtCIDR,
          Template_Base_Path: S3_Templates_Base_Path,
          Tag_Eng_Team: tag_eng_team.valueAsString
        },
      }
    );

    run_mgmt_stack.node.addDependency(delete_default_vpcs);
  }
}
