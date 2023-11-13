import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as redshift from 'aws-cdk-lib/aws-redshift';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

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

    }
}
