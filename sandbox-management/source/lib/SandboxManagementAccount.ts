
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ram = require('@aws-cdk/aws-ram');
import cloudtrail = require("@aws-cdk/aws-cloudtrail");
import s3 = require("@aws-cdk/aws-s3");
import iam = require("@aws-cdk/aws-iam");


export interface imgprops {

  instanceType: "stream.standard.medium"

}

export class SandboxManagementAccount extends cdk.Stack {

  public readonly response: string;
  constructor(scope: cdk.App, id: string, props?: any, s?: string) {
    super(scope, id);

    const MgmtCidr = new cdk.CfnParameter(this, "MgmtCidr", {
      type: "String",
      description: "MgmtCidr"
    });

    // TODO: Add descriptions

    const _uuid = new cdk.CfnParameter(this, "UUID", {
      type: "String",
      description: "UUID",
    });

    const CostsBucketName = new cdk.CfnParameter(this, "CostsBucketName", {
      type: "String",
      description: "CostsBucketName"
    });

    

   

    const vpc = new ec2.Vpc(this, 'ISAppStreamMgmtVPC', {
      cidr: "10.10.0.0/22",
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public_mgmt',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private_mgmt',
          subnetType: ec2.SubnetType.PRIVATE,
        }
      ]
    });

    const trail_bucket_access_logs = new s3.Bucket(this, "mgmt-bucket-al", {
      bucketName: "mgmt" + "-ct-" + _uuid.valueAsString+"-al",
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls:true
      })
    });


    const trail_bucket = new s3.Bucket(this, "mgmt-bucket", {
      bucketName: "mgmt" + "-ct-" + _uuid.valueAsString,
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: trail_bucket_access_logs,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls:true
      })
    });

    trail_bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: ["s3:*"],
      principals: [ new iam.AnyPrincipal],
      resources:  ["arn:aws:s3:::" + trail_bucket.bucketName, "arn:aws:s3:::" + trail_bucket.bucketName+"/*"],
      conditions:{
        "Bool": {
          "aws:SecureTransport": "false"
      }
      }                          
        }));

    const fl_bucket_access_logs = new s3.Bucket(this, "mgmt-flowlogs-bucket-al", {
      bucketName: "mgmt" + "-fl-" + _uuid.valueAsString+"-al",
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls:true
      })
    });

    const fl_bucket = new s3.Bucket(this, "mgmt-flowlogs-bucket", {
      bucketName: "mgmt" + "-fl-" + _uuid.valueAsString,
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: fl_bucket_access_logs,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls:true
      })
    });

    fl_bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: ["s3:*"],
      principals: [ new iam.AnyPrincipal],
      resources:  ["arn:aws:s3:::" + fl_bucket.bucketName, "arn:aws:s3:::" + fl_bucket.bucketName+"/*"],
      conditions:{
        "Bool": {
          "aws:SecureTransport": "false"
      }
      }                          
        }));

    const trail = new cloudtrail.Trail(this, "CloudTrail", {
      bucket: trail_bucket,
      trailName: "mgmt-cloudtrail",
    });

    const flow_logs = new ec2.FlowLog(this, "FlowLogs", {
      flowLogName: "mgmt-vpc-flowlogs",
      resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
      destination: ec2.FlowLogDestination.toS3(fl_bucket),
    });

    const costs_bucket = new s3.Bucket(this, "sandbox-costs", {
      bucketName: CostsBucketName.valueAsString,
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: fl_bucket_access_logs,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls:true
      })
    });

    costs_bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: ["s3:*"],
      principals: [ new iam.AnyPrincipal],
      resources:  ["arn:aws:s3:::" + costs_bucket.bucketName, "arn:aws:s3:::" + costs_bucket.bucketName+"/*"],
      conditions:{
        "Bool": {
          "aws:SecureTransport": "false"
      }
      }                          
        }));
  }
}
