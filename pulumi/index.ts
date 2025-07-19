import * as azure from '@pulumi/azure-native'
import * as pulumi from '@pulumi/pulumi'

// Match Dockerfile EXPOSE

// Environment variables configuration - auto-generated from src/lib/env.ts
import {
  envKeyToConfigKey,
  envKeyToSecretName,
  getEnvSchema,
} from './lib/env-config.ts'

// Configuration
const config = new pulumi.Config()
const infraStackRef = config.require('infraStackRef')

// Application configuration - A1D Agent specific
const appName = config.get('appName') || 'a1d-agent'
const containerImage =
  config.get('containerImage') || 'a1dazureacr.azurecr.io/a1d-agent:latest'
const cpu = config.getNumber('cpu') || 0.5 // Sufficient for LLM chat app (mainly API forwarding)
const memory = config.getNumber('memory') || 1 // 1GB memory, sufficient for Node.js chat app
const port = config.getNumber('port') || 4111

const { required: requiredEnvVars, optional: optionalEnvVars } = getEnvSchema()
const allEnvVars = [...requiredEnvVars, ...optionalEnvVars]

// Get environment variable values from config
const getEnvVarValue = (envVar: {
  key: string
  required: boolean
  defaultValue?: string
}) => {
  const configKey = envKeyToConfigKey(envVar.key)
  if (envVar.required) {
    return config.requireSecret(configKey)
  } else {
    const value = config.getSecret(configKey)
    return (
      value ||
      (envVar.defaultValue ? pulumi.output(envVar.defaultValue) : undefined)
    )
  }
}

// Scaling configuration - Minimal scaling for LLM chat app
const minReplicas = config.getNumber('minReplicas') || 1 // Always keep 1 running for availability
const maxReplicas = config.getNumber('maxReplicas') || 2 // Max 2 instances (mainly for zero-downtime deployment)
const scaleToZero = config.getBoolean('scaleToZero') ?? false // Disable scale-to-zero for always-on service
const usesEnvironmentLevelDomains =
  config.getBoolean('usesEnvironmentLevelDomains') ?? true

// Reference the shared infrastructure stack
const infraStack = new pulumi.StackReference(infraStackRef)

// Get shared resources from infrastructure stack
const resourceGroupName = infraStack.getOutput('resourceGroupName')
const containerAppsEnvironmentId = infraStack.getOutput(
  'containerAppsEnvironmentId',
)

const acrLoginServer = infraStack.getOutput('acrLoginServer')
const acrName = infraStack.getOutput('acrName')

// Get ACR admin credentials
const acrCredentials = resourceGroupName.apply((rgName) =>
  azure.containerregistry.listRegistryCredentialsOutput({
    resourceGroupName: rgName,
    registryName: acrName,
  }),
)

// Create Container App - with environment-level domains, no custom domain setup needed
const containerApp = new azure.app.ContainerApp(appName, {
  resourceGroupName: resourceGroupName,
  containerAppName: appName,
  managedEnvironmentId: containerAppsEnvironmentId,
  configuration: {
    registries: [
      {
        server: acrLoginServer,
        username: acrCredentials.apply((creds) => creds.username!),
        passwordSecretRef: 'acr-password',
      },
    ],
    secrets: [
      {
        name: 'acr-password',
        value: acrCredentials.apply((creds) => creds.passwords![0]!.value!),
      },
      // Generate secrets for all environment variables
      ...allEnvVars
        .map((envVar) => {
          const value = getEnvVarValue(envVar)
          return value
            ? {
                name: envKeyToSecretName(envVar.key),
                value: value,
              }
            : null
        })
        .filter(
          (secret): secret is NonNullable<typeof secret> => secret !== null,
        ),
    ],
    ingress: {
      external: true,
      targetPort: port,
      transport: azure.app.IngressTransportMethod.Http,
      // No custom domain needed - app will automatically get <appName>.whiteboardanimation.ai
      traffic: [
        {
          weight: 100,
          latestRevision: true,
        },
      ],
    },
  },
  template: {
    // Minimal scaling for LLM chat app (mainly for availability, not performance)
    scale: {
      minReplicas: minReplicas, // Keep 1 replica for availability
      maxReplicas: maxReplicas, // Max 2 replicas (for zero-downtime deployment)
      rules: [
        {
          name: 'http-scaling-rule',
          http: {
            metadata: {
              concurrentRequests: '50', // Scale up only when > 50 concurrent requests (chat apps can handle many concurrent connections)
            },
          },
        },
        // Removed CPU scaling rule - not needed for LLM chat apps since computation is external
      ],
    },
    containers: [
      {
        name: appName,
        image: containerImage,
        resources: {
          cpu: cpu,
          memory: `${memory}Gi`,
        },
        env: [
          {
            name: 'NODE_ENV',
            value: 'production',
          },
          // Generate environment variables for all configured secrets
          ...allEnvVars
            .map((envVar) => {
              const value = getEnvVarValue(envVar)
              return value
                ? {
                    name: envVar.key,
                    secretRef: envKeyToSecretName(envVar.key),
                  }
                : null
            })
            .filter((env): env is NonNullable<typeof env> => env !== null),
        ],
        probes: [
          {
            type: azure.app.Type.Liveness,
            httpGet: {
              path: '/health',
              port: port,
              scheme: azure.app.Scheme.HTTP,
            },
            initialDelaySeconds: 30, // Standard startup time for chat app
            periodSeconds: 30,
            timeoutSeconds: 5, // Standard timeout
            failureThreshold: 3, // Standard failure threshold
          },
          {
            type: azure.app.Type.Readiness,
            httpGet: {
              path: '/health',
              port: port,
              scheme: azure.app.Scheme.HTTP,
            },
            initialDelaySeconds: 10, // Standard readiness check
            periodSeconds: 15,
            timeoutSeconds: 5, // Standard timeout
            failureThreshold: 3,
          },
          {
            type: azure.app.Type.Startup,
            httpGet: {
              path: '/health',
              port: port,
              scheme: azure.app.Scheme.HTTP,
            },
            initialDelaySeconds: 5,
            periodSeconds: 10,
            timeoutSeconds: 5,
            failureThreshold: 6, // Allow up to 1 minute for startup
          },
        ],
      },
    ],
  },
  tags: {
    Project: 'a1d-agent',
    Environment: config.get('environment') || 'development',
    Component: 'ai-agent-service',
    Platform: 'azure',
    Service: 'mastra-ai-agent',
    AlwaysOn: 'true',
  },
})

// Exports - simplified for environment-level domains
export const containerAppName = containerApp.name
export const containerAppFqdn = containerApp.configuration?.apply(
  (c) => c?.ingress?.fqdn,
)
export const environmentDomainUrl = pulumi.interpolate`https://${appName}.whiteboardanimation.ai`
export const environmentHealthCheck = pulumi.interpolate`https://${appName}.whiteboardanimation.ai/health`
export const environmentMastraEndpoint = pulumi.interpolate`https://${appName}.whiteboardanimation.ai/mastra`
export const environmentApiEndpoint = pulumi.interpolate`https://${appName}.whiteboardanimation.ai/api`

// Export application info
export const applicationInfo = {
  name: appName,
  automaticDomain: pulumi.interpolate`${appName}.whiteboardanimation.ai`,
  containerImage: containerImage,
  minReplicas: minReplicas, // Always-on AI agent service
  maxReplicas: maxReplicas, // Allow scaling for AI workloads
  cpu: cpu,
  memory: memory,
  port: port,
  usesEnvironmentLevelDomains: usesEnvironmentLevelDomains,
  scaleToZero: scaleToZero, // Disabled for always-on AI service
  serviceType: 'ai-agent',
  framework: 'mastra',
  alwaysOn: true,
}

// Export default Azure Container Apps URL as backup
export const defaultAppUrl = containerApp.configuration?.apply((c) =>
  c?.ingress?.fqdn ? `https://${c.ingress.fqdn}` : undefined,
)
