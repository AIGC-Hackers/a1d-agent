import * as azure from '@pulumi/azure-native'
import * as pulumi from '@pulumi/pulumi'

// Configuration
const config = new pulumi.Config()
const infraStackRef = config.require('infraStackRef')

// Application configuration - A1D Agent specific
const appName = config.get('appName') || 'a1d-agent'
const containerImage =
  config.get('containerImage') || 'a1dazureacr.azurecr.io/a1d-agent:latest'
const cpu = config.getNumber('cpu') || 0.5
const memory = config.getNumber('memory') || 1
const port = config.getNumber('port') || 4111

// Only DOTENV_PRIVATE_KEY is needed since .env.production is bundled in Docker image
const dotenvPrivateKey = config.requireSecret('dotenvPrivateKey')

// Scaling configuration
const minReplicas = config.getNumber('minReplicas') || 1
const maxReplicas = config.getNumber('maxReplicas') || 2
const scaleToZero = config.getBoolean('scaleToZero') ?? false
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

// Create Container App - simplified environment variables
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
      {
        name: 'dotenv-private-key',
        value: dotenvPrivateKey,
      },
    ],
    ingress: {
      external: true,
      targetPort: port,
      transport: azure.app.IngressTransportMethod.Http,
      traffic: [
        {
          weight: 100,
          latestRevision: true,
        },
      ],
    },
  },
  template: {
    scale: {
      minReplicas: minReplicas,
      maxReplicas: maxReplicas,
      rules: [
        {
          name: 'http-scaling-rule',
          http: {
            metadata: {
              concurrentRequests: '50',
            },
          },
        },
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
          {
            name: 'DOTENV_PRIVATE_KEY',
            secretRef: 'dotenv-private-key',
          },
        ],
        probes: [
          {
            type: azure.app.Type.Liveness,
            httpGet: {
              path: '/health',
              port: port,
              scheme: azure.app.Scheme.HTTP,
            },
            initialDelaySeconds: 30,
            periodSeconds: 30,
            timeoutSeconds: 5,
            failureThreshold: 3,
          },
          {
            type: azure.app.Type.Readiness,
            httpGet: {
              path: '/health',
              port: port,
              scheme: azure.app.Scheme.HTTP,
            },
            initialDelaySeconds: 10,
            periodSeconds: 15,
            timeoutSeconds: 5,
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
            failureThreshold: 6,
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

// Exports
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
  minReplicas: minReplicas,
  maxReplicas: maxReplicas,
  cpu: cpu,
  memory: memory,
  port: port,
  usesEnvironmentLevelDomains: usesEnvironmentLevelDomains,
  scaleToZero: scaleToZero,
  serviceType: 'ai-agent',
  framework: 'mastra',
  alwaysOn: true,
}

// Export default Azure Container Apps URL as backup
export const defaultAppUrl = containerApp.configuration?.apply((c) =>
  c?.ingress?.fqdn ? `https://${c.ingress.fqdn}` : undefined,
)