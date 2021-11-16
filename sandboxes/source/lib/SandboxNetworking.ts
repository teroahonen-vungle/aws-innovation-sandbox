
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ram = require('@aws-cdk/aws-ram');
import cloudtrail = require("@aws-cdk/aws-cloudtrail");
import s3 = require("@aws-cdk/aws-s3");
import iam = require("@aws-cdk/aws-iam");
import { App, Stack, StackProps } from '@aws-cdk/core';
export interface imgprops {

  instanceType: "stream.standard.medium"

}

class MgmtStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

  }
}

export class SandboxNetworking extends cdk.Stack {
  public readonly response: string;
  constructor(scope: cdk.App, id: string, props?: any, s?: string) {
    super(scope, id);


    const SbxAccountId = new cdk.CfnParameter(this, "SbxAccountId", {
      type: "String",
      description: "SbxAccountId"
    });

    const SbxCidr = new cdk.CfnParameter(this, "SbxCidr", {
      type: "String",
      description: "SbxCidr"
    });

    const _uuid = new cdk.CfnParameter(this, "UUID", {
      type: "String",
      description: "UUID",
    });

    const VpcId = new cdk.CfnParameter(this, "VpcId", {
      type: "String",
      description: "VpcId",
    });

    //for (let subnet of vpc.publicSubnets) {
    //  new CfnRoute(this, subnet.node.uniqueId, {
    //    routeTableId: subnet.routeTable.routeTableId,
    //    destinationCidrBlock: SbxCidr.valueAsString,
    //    transitGatewayId: TgwId.valueAsString,
    //  });
    //};
    const TransitGateway = new ec2.CfnTransitGateway(this, 'IS_Transit_Gateway', {
      description: "IS Transit Gateway",
      vpnEcmpSupport: 'disable',
      defaultRouteTableAssociation: 'disable',
      defaultRouteTablePropagation: 'disable',
      autoAcceptSharedAttachments: 'enable',
      tags: [
        {
        key: 'Name',
        value: SbxAccountId.valueAsString+" - IS Transit Gateway"
        },{
          key: 'Sandbox_Account_ID',
          value: SbxAccountId.valueAsString
        }],
    });
    //attach VPCs to gateway
    const TransitGatewayAttachmentEgress = new ec2.CfnTransitGatewayAttachment(this, 'ISTransitGatewayAttachmentEgress', {
      transitGatewayId: TransitGateway.ref,
      vpcId: VpcId.valueAsString,
      subnetIds: ['subnet-02671088b1cb403c9','subnet-06f42087ee51e2ffe'],
      tags: [{
        key: 'Name',
        value: SbxAccountId.valueAsString+" - IS-TG-Egress-VPC-Private_SubNet-Attachment"
      },{
        key: 'Sandbox_Account_ID',
        value: SbxAccountId.valueAsString
      }],
    });
    TransitGatewayAttachmentEgress.addDependsOn(TransitGateway);
   

    new ec2.CfnRoute(this, 'subnet-05a5c57968ae95f23', {
        routeTableId: 'rtb-0cca9bd213291d9de',
        destinationCidrBlock: SbxCidr.valueAsString,
        transitGatewayId: TransitGateway.ref,
    }).addDependsOn(TransitGatewayAttachmentEgress);
    new ec2.CfnRoute(this, 'subnet-08aa3a168dd04115b', {
      routeTableId: 'rtb-08554b81f58b2b189',
      destinationCidrBlock: SbxCidr.valueAsString,
      transitGatewayId: TransitGateway.ref,
    }).addDependsOn(TransitGatewayAttachmentEgress);

    const res_share = new ram.CfnResourceShare(this, "ISTGWShareAppStream", {
      principals: [SbxAccountId.valueAsString],
      resourceArns: [cdk.Fn.sub("arn:aws:ec2:${AWS::Region}:${AWS::AccountId}:transit-gateway/${ISTransitGateway}")],
      name: "ISTGWShareAppStream"
    })


  }

}
