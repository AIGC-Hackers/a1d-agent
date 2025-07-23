import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Configuration
const config = new pulumi.Config();
const infraStackRef = config.require("infraStackRef");

// Application configuration - A1D Agent specific
const appName = config.get("appName") || "a1d-agent";
const containerImage = config.get("containerImage") || "a1d-agent:latest";
const cpu = config.getNumber("cpu") || 512; // CPU units (1024 = 1 vCPU)
const memory = config.getNumber("memory") || 1024; // Memory in MB
const port = config.getNumber("port") || 4111;

// Environment variables
const dotenvPrivateKey = config.requireSecret("dotenvPrivateKey");

// Scaling configuration
const minCapacity = config.getNumber("minCapacity") || 1;
const maxCapacity = config.getNumber("maxCapacity") || 3;
const targetCpuUtilization = config.getNumber("targetCpuUtilization") || 70;

// Reference the shared infrastructure stack
const infraStack = new pulumi.StackReference(infraStackRef);

// Get shared resources from infrastructure stack
const vpcId = infraStack.getOutput("vpcId");
const privateSubnetIds = infraStack.getOutput("privateSubnetIds");
const fargateSecurityGroupId = infraStack.getOutput("fargateSecurityGroupId");
const ecsClusterArn = infraStack.getOutput("ecsClusterArn");
const hostedZoneId = infraStack.getOutput("hostedZoneId");
const baseDomainName = infraStack.getOutput("baseDomainName");

// Create IAM role for ECS task execution
const executionRole = new aws.iam.Role(`${appName}-execution-role`, {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "ecs-tasks.amazonaws.com",
  }),
  managedPolicyArns: [
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
  ],
  tags: {
    Project: "a1d-agent",
    Component: "execution-role",
  },
});

// Create IAM role for ECS task
const taskRole = new aws.iam.Role(`${appName}-task-role`, {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "ecs-tasks.amazonaws.com",
  }),
  tags: {
    Project: "a1d-agent",
    Component: "task-role",
  },
});

// Create CloudWatch log group
const logGroup = new aws.cloudwatch.LogGroup(`${appName}-logs`, {
  retentionInDays: 7,
  tags: {
    Project: "a1d-agent",
    Component: "logs",
  },
});

// Create ECS task definition
const taskDefinition = new aws.ecs.TaskDefinition(`${appName}-task`, {
  family: appName,
  requiresCompatibilities: ["FARGATE"],
  networkMode: "awsvpc",
  cpu: cpu.toString(),
  memory: memory.toString(),
  runtimePlatform: {
    cpuArchitecture: "ARM64",
    operatingSystemFamily: "LINUX",
  },
  executionRoleArn: executionRole.arn,
  taskRoleArn: taskRole.arn,
  containerDefinitions: pulumi.jsonStringify([
    {
      name: appName,
      image: containerImage,
      essential: true,
      portMappings: [
        {
          containerPort: port,
          protocol: "tcp",
        },
      ],
      environment: [
        {
          name: "NODE_ENV",
          value: "production",
        },
        {
          name: "PORT",
          value: port.toString(),
        },
      ],
      secrets: [
        {
          name: "DOTENV_PRIVATE_KEY_PRODUCTION",
          valueFrom: dotenvPrivateKey,
        },
      ],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": logGroup.name,
          "awslogs-region": aws.getRegionOutput().name,
          "awslogs-stream-prefix": "ecs",
        },
      },
      healthCheck: {
        command: [
          "CMD-SHELL",
          `curl -f http://localhost:${port}/health || exit 1`,
        ],
        interval: 30,
        timeout: 5,
        retries: 3,
        startPeriod: 60,
      },
    },
  ]),
  tags: {
    Project: "a1d-agent",
    Component: "task-definition",
  },
});

// Create ALB target group
const targetGroup = new aws.lb.TargetGroup(`${appName}-tg`, {
  port: port,
  protocol: "HTTP",
  vpcId: vpcId,
  targetType: "ip",
  healthCheck: {
    enabled: true,
    path: "/health",
    protocol: "HTTP",
    port: "traffic-port",
    healthyThreshold: 2,
    unhealthyThreshold: 3,
    timeout: 10,
    interval: 30,
    matcher: "200",
  },
  tags: {
    Project: "a1d-agent",
    Component: "target-group",
  },
});

// Create ECS service
const service = new aws.ecs.Service(`${appName}-service`, {
  cluster: ecsClusterArn,
  taskDefinition: taskDefinition.arn,
  launchType: "FARGATE",
  desiredCount: minCapacity,
  networkConfiguration: {
    subnets: privateSubnetIds,
    securityGroups: [fargateSecurityGroupId],
    assignPublicIp: false,
  },
  loadBalancers: [
    {
      targetGroupArn: targetGroup.arn,
      containerName: appName,
      containerPort: port,
    },
  ],
  enableExecuteCommand: true,
  tags: {
    Project: "a1d-agent",
    Component: "ecs-service",
  },
});

// Create auto scaling target
const scalingTarget = new aws.appautoscaling.Target(`${appName}-scaling-target`, {
  maxCapacity: maxCapacity,
  minCapacity: minCapacity,
  resourceId: pulumi.interpolate`service/${ecsClusterArn.apply(arn => arn.split("/")[1])}/${service.name}`,
  scalableDimension: "ecs:service:DesiredCount",
  serviceNamespace: "ecs",
});

// Create auto scaling policy for CPU utilization
new aws.appautoscaling.Policy(`${appName}-scaling-policy`, {
  name: `${appName}-cpu-scaling`,
  policyType: "TargetTrackingScaling",
  resourceId: scalingTarget.resourceId,
  scalableDimension: scalingTarget.scalableDimension,
  serviceNamespace: scalingTarget.serviceNamespace,
  targetTrackingScalingPolicyConfiguration: {
    targetValue: targetCpuUtilization,
    predefinedMetricSpecification: {
      predefinedMetricType: "ECSServiceAverageCPUUtilization",
    },
    scaleOutCooldown: 300,
    scaleInCooldown: 300,
  },
});

// Create ALB listener rule for this application
const appDomain = pulumi.interpolate`${appName}.${baseDomainName}`;

// Get the HTTPS listener ARN from infrastructure stack
const httpsListenerArn = infraStack.getOutput("httpsListenerArn");

new aws.lb.ListenerRule(`${appName}-listener-rule`, {
  listenerArn: httpsListenerArn,
  priority: 100, // Adjust priority as needed
  actions: [
    {
      type: "forward",
      targetGroupArn: targetGroup.arn,
    },
  ],
  conditions: [
    {
      hostHeader: {
        values: [appDomain],
      },
    },
  ],
  tags: {
    Project: "a1d-agent",
    Component: "listener-rule",
  },
});

// Create Route 53 record for the application domain
new aws.route53.Record(`${appName}-dns`, {
  zoneId: hostedZoneId,
  name: appDomain,
  type: "A",
  aliases: [
    {
      name: infraStack.getOutput("albDnsName"),
      zoneId: infraStack.getOutput("albZoneId"),
      evaluateTargetHealth: true,
    },
  ],
});

// Exports
export const serviceName = service.name;
export const taskDefinitionArn = taskDefinition.arn;
export const targetGroupArn = targetGroup.arn;
export const applicationUrl = pulumi.interpolate`https://${appDomain}`;
export const healthCheckUrl = pulumi.interpolate`https://${appDomain}/health`;
export const mastraEndpoint = pulumi.interpolate`https://${appDomain}/mastra`;
export const apiEndpoint = pulumi.interpolate`https://${appDomain}/api`;

// Export application info
export const applicationInfo = {
  name: appName,
  domain: appDomain,
  containerImage: containerImage,
  minCapacity: minCapacity,
  maxCapacity: maxCapacity,
  cpu: cpu,
  memory: memory,
  port: port,
  targetCpuUtilization: targetCpuUtilization,
  serviceType: "ai-agent",
  framework: "mastra",
  platform: "aws-fargate",
};