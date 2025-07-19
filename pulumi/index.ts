import * as azure from '@pulumi/azure-native'
import * as pulumi from '@pulumi/pulumi'

// Configuration
const config = new pulumi.Config()
const infraStackRef = config.require('infraStackRef')

// Application configuration - simplified for environment-level domains
const appName = config.get('appName') || 'backend-sample'
const containerImage =
  config.get('containerImage') ||
  'a1dazureacr.azurecr.io/azure-backend-app:latest'
// replicas not needed for scale-to-zero configuration
const cpu = config.getNumber('cpu') || 0.5
const memory = config.getNumber('memory') || 1
const port = config.getNumber('port') || 3000

// Scaling configuration
const minReplicas = config.getNumber('minReplicas') || 0 // Default to scale-to-zero
const maxReplicas = config.getNumber('maxReplicas') || 1 // Default to 1 for demo
const scaleToZero = config.getBoolean('scaleToZero') ?? true // Default enabled
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
    // Scale-to-zero configuration for demo apps
    scale: {
      minReplicas: minReplicas, // Scale to zero when no traffic
      maxReplicas: maxReplicas, // Only need 1 replica for demo
      rules: [
        {
          name: 'http-scaling-rule',
          http: {
            metadata: {
              concurrentRequests: '10', // Scale up when > 10 concurrent requests
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
            periodSeconds: 10,
            timeoutSeconds: 3,
            failureThreshold: 3,
          },
        ],
      },
    ],
  },
  tags: {
    Project: 'a1d-azure',
    Environment: 'development',
    Component: 'backend-app',
    Platform: 'azure',
  },
})

// Exports - simplified for environment-level domains
export const containerAppName = containerApp.name
export const containerAppFqdn = containerApp.configuration?.apply(
  (c) => c?.ingress?.fqdn,
)
export const environmentDomainUrl = pulumi.interpolate`https://${appName}.whiteboardanimation.ai`
export const environmentHealthCheck = pulumi.interpolate`https://${appName}.whiteboardanimation.ai/health`
export const environmentRpcEndpoint = pulumi.interpolate`https://${appName}.whiteboardanimation.ai/rpc`

// Export application info
export const applicationInfo = {
  name: appName,
  automaticDomain: pulumi.interpolate`${appName}.whiteboardanimation.ai`,
  containerImage: containerImage,
  minReplicas: minReplicas, // Scale to zero for cost optimization
  maxReplicas: maxReplicas, // Demo only needs 1 replica
  cpu: cpu,
  memory: memory,
  port: port,
  usesEnvironmentLevelDomains: usesEnvironmentLevelDomains,
  scaleToZero: scaleToZero, // This is a cost-optimized demo app
}

// Export default Azure Container Apps URL as backup
export const defaultAppUrl = containerApp.configuration?.apply((c) =>
  c?.ingress?.fqdn ? `https://${c.ingress.fqdn}` : undefined,
)
