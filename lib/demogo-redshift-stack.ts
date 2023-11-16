import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as redshift from 'aws-cdk-lib/aws-redshift';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

import {
    Role,
    ManagedPolicy,
    ServicePrincipal
} from 'aws-cdk-lib/aws-iam';

const redshift_managed_policy = "arn:aws:iam::aws:policy/service-role/AWSServiceRoleForRedshift";
const redshift_service_url = "redshift.amazonaws.com";

export class DemogoRedshiftStack extends cdk.Stack {
    
  
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);

    //create VPC
    // const vpc = new ec2.Vpc(this, 'Vpc', {
    //     ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16')
    // });
    
    //create public subnet
    const vpc = new ec2.Vpc(this, 'ProductionVPC', {
        cidr: '10.0.0.0/16',
        enableDnsHostnames: true,
        enableDnsSupport: true,
        availabilityZones:['us-east-1a'],
        // natGateways: 1,
        subnetConfiguration: [
            {
                cidrMask: 24,
                name: 'PublicSubnet1',
                subnetType: ec2.SubnetType.PUBLIC
            },
        ]
    });

    const publicSubnet = vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
        availabilityZones: ['us-east-1a']
    }).subnetIds[0];

    const securityGroup = new ec2.SecurityGroup(this, 'security-group-id', {
        vpc,
    });

    
    // const availablePublicSubnets = vpc.publicSubnets.map( subnet => subnet.subnetId );
    const subnetGroup = new redshift.CfnClusterSubnetGroup(this, 'RedshiftSubnetGroup', {
        description: 'Redshift provisioned cluster subnet group',
        subnetIds: [publicSubnet]
    })

    const freetipservicecluster = new redshift.CfnCluster(this, "dmg_freetipservicecluster", {
        clusterType: 'single-node',
        dbName: 'freetipservice_db',
        masterUsername: 'admin',
        masterUserPassword: 'Admin1234!',
        nodeType: 'ra3.xlplus',

        availabilityZone:'us-east-1a',
        clusterSubnetGroupName: subnetGroup.ref
    });

    const financecluster = new redshift.CfnCluster(this, "dmg_financecluster", {
        clusterType: 'single-node',
        dbName: 'finance_db',
        masterUsername: 'admin',
        masterUserPassword: 'Admin1234!',
        nodeType: 'ra3.xlplus',

        availabilityZone:'us-east-1a',
        clusterSubnetGroupName: subnetGroup.ref
    });

    const redshift_role = new Role(this, "redshift_role-role", {
        roleName: "AWSRedshiftServiceRole-AccessS3Bucket",
        description:
          "Assigns the managed policy AWSRedshiftServiceRole to S3",
        managedPolicies: [
          ManagedPolicy.fromManagedPolicyArn(
            this,
            "redshift-service-policy",
            redshift_managed_policy
          ),
        ],
        assumedBy: new ServicePrincipal(redshift_service_url),
      });
      redshift_role.attachInlinePolicy(
        new iam.Policy(this, 'rs-logs', {
          statements: [
            new iam.PolicyStatement({
              actions: [
                "s3:GetObject",
                "s3:PutObject",
                ""
              ],
              resources: ["arn:aws:s3:::hvfhs-source-bucket*"]
            })
          ]
        })
      );//확인

    }
}
