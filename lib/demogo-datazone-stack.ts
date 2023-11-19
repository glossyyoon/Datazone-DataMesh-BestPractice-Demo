import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';

import {
  Role,
  ManagedPolicy,
  ServicePrincipal,
  Policy,
  PolicyStatement,
  Effect,
} from 'aws-cdk-lib/aws-iam';
import { CfnPermissionSet } from 'aws-cdk-lib/aws-sso';

declare const sourceBucket: s3.Bucket;
const glue_managed_policy = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole";
const glue_ServiceUrl = "glue.amazonaws.com";

export class DemogoDatazoneStack extends cdk.Stack {
  public readonly glueRole: Role;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // return accountID
    new cdk.CfnOutput(this, "dmgStackAccount", {
      description: "Account of this stack",
      value: this.account
    });

    // Create an S3 bucket
    const s3SourceBucket = new s3.Bucket(this, `hvfhs-source-bucket`, {
      bucketName: `hvfhs-source-bucket-${this.account}`,
      versioned: true
      
    });

    // Upload the source data from local
      const deployment = new s3deploy.BucketDeployment(this, 'syncBucket', {
        sources: [s3deploy.Source.asset('/Users/jiyunp/Desktop/TLCdata.zip')], //물어보기
        destinationBucket: s3SourceBucket,
        memoryLimit: 1024,
      });

    // Create a Glue database
    const glueDatabase = new glue.CfnDatabase(this, 'tlc_glue_database', {
      catalogId: `${this.account}`,
      databaseInput: {
        name: 'tlc_glue_database',
      },
    });

    // create glue cralwer role to access S3 bucket
    const glue_crawler_role = new Role(this, "glue-crawler-role", {
      roleName: "AWSGlueServiceRole-AccessS3Bucket",
      description:
        "Assigns the managed policy AWSGlueServiceRole to AWS Glue Crawler so it can crawl S3 buckets",
      managedPolicies: [
        ManagedPolicy.fromManagedPolicyArn(
          this,
          "glue-service-policy",
          glue_managed_policy
        ),
      ],
      assumedBy: new ServicePrincipal(glue_ServiceUrl),
    });
    glue_crawler_role.attachInlinePolicy(
      new iam.Policy(this, 'cw-logs', {
        statements: [
          new iam.PolicyStatement({
            actions: [
              "s3:GetObject",
              "s3:PutObject",
              "glue:*"
            ],
            resources: ["arn:aws:s3:::hvfhs-source-bucket*"]
          })
        ]
      })
    );
    this.glueRole = glue_crawler_role;

    //add policy to role to grant access to S3 asset bucket and public buckets
    const iam_policy_forAssets = new Policy(this, "iam-policy-forAssets", {
      force: true,
      policyName: "glue-policy-workflowAssetAccess",
      roles: [glue_crawler_role],
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject",
            "s3:ListBucket",
          ],
          resources: ["arn:aws:s3:::" + s3SourceBucket + "/*"]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["s3:GetObject"],
          resources: [
            "arn:aws:s3:::" + s3SourceBucket + "/*"
          ],
        }),
      ],
    });

    const outputPath = "s3://" + s3SourceBucket + "/crawler-result";

    const glue_crawler_s3_parquet_nonhighvolume = new glue.CfnCrawler(
      this,
      "glue_crawler_s3_parquet_nonhighvolume",
      {
        name: "s3-parquet-crawler-nonhighvolume",
        role: glue_crawler_role.roleName,
        targets: {
          s3Targets: [
            {
              path: "s3://" + s3SourceBucket.bucketName + "/TLCdata/nonhighvolume_hvfhs",
            },
          ],
        },
        databaseName: 'tlc_glue_database',
        schemaChangePolicy: {
          updateBehavior: "LOG",
          deleteBehavior: "DEPRECATE_IN_DATABASE",
        },
      }
    );

    const glue_crawler_s3_parquet_green = new glue.CfnCrawler(
      this,
      "glue_crawler_s3_parquet_green",
      {
        name: "s3-parquet-crawler-green",
        role: glue_crawler_role.roleName,
        targets: {
          s3Targets: [
            {
              path: "s3://" + s3SourceBucket.bucketName + "/TLCdata/green_tripdata",
            },
          ],
        },
        databaseName: 'tlc_glue_database',
        schemaChangePolicy: {
          updateBehavior: "LOG",
          deleteBehavior: "DEPRECATE_IN_DATABASE",
        },
      }
    );

    const glue_crawler_s3_parquet_yellow = new glue.CfnCrawler(
      this,
      "glue_crawler_s3_parquet_yellow",
      {
        name: "s3-parquet-crawler-yellow",
        role: glue_crawler_role.roleName,
        targets: {
          s3Targets: [
            {
              path: "s3://" + s3SourceBucket.bucketName + "/TLCdata/yellow_tripdata",
            },
          ],
        },
        databaseName: 'tlc_glue_database',
        schemaChangePolicy: {
          updateBehavior: "LOG",
          deleteBehavior: "DEPRECATE_IN_DATABASE",
        },
      }
    );

    const cfnTrigger_green = new glue.CfnTrigger(this, 'MyCfnTrigger-green', {
      type: 'ON_DEMAND',
      startOnCreation: false,
      actions: [{
        crawlerName: glue_crawler_s3_parquet_green.name,
      }],
    });

    const cfnTrigger_yellow = new glue.CfnTrigger(this, 'MyCfnTrigger-yellow', {
      type: 'ON_DEMAND',
      startOnCreation: false,
      actions: [{
        crawlerName: glue_crawler_s3_parquet_yellow.name,
      }],
    });

    // create a permission set
    const permissionSetExample = new CfnPermissionSet(this, 'permissionSet', {
      instanceArn: process.env.INSTANCE_ARN || "{instance_arn}",
      name: 'AdminPermissionSet',
      description: 'Permission set for Admin.',
      managedPolicies:  [
        "arn:aws:iam::aws:policy/AdministratorAccess"
      ],
    })
  }
}
