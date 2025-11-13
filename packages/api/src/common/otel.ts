import type { EnvVars } from "@nildb/env";
import { metrics } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { Resource } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import {
  MeterProvider,
  type MetricReader,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  BatchSpanProcessor,
  NodeTracerProvider,
} from "@opentelemetry/sdk-trace-node";
import {
  ATTR_CLOUD_PLATFORM,
  ATTR_CLOUD_PROVIDER,
  ATTR_CLOUD_REGION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_INSTANCE_ID,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions/incubating";
import packageJson from "../../package.json";

export type MetricsOnlyProviders = {
  meterProvider: MeterProvider;
  prometheusExporter: PrometheusExporter;
};

export type OtelProviders = {
  tracerProvider: NodeTracerProvider;
  meterProvider: MeterProvider;
  loggerProvider: LoggerProvider;
};

/**
 * Check if OpenTelemetry should emit telemetry to OTLP endpoint.
 * Returns false for local development to avoid noise in platform observability.
 */
export function shouldEmitTelemetry(deploymentEnv: string): boolean {
  return deploymentEnv.toLowerCase() !== "local";
}

/**
 * Create OpenTelemetry resource.
 */
export function createOtelResource(config: EnvVars): Resource {
  const attributes: Record<string, string> = {
    [ATTR_SERVICE_NAME]: config.otelServiceName,
    [ATTR_SERVICE_VERSION]: packageJson.version,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.otelDeploymentEnv,
    [ATTR_SERVICE_INSTANCE_ID]: process.env.HOSTNAME || "unknown",
    "team.name": config.otelTeamName,
  };

  // Optional cloud attributes (if running in AWS)
  if (process.env.AWS_REGION) {
    attributes[ATTR_CLOUD_PROVIDER] = "aws";
    attributes[ATTR_CLOUD_PLATFORM] = "aws_fargate";
    attributes[ATTR_CLOUD_REGION] = process.env.AWS_REGION;
  }

  return new Resource(attributes);
}

/**
 * Initialize metrics-only mode with Prometheus exporter.
 * This is used when only the 'metrics' feature flag is enabled (not 'otel').
 * Metrics are served on /metrics endpoint for scraping, not pushed to OTLP.
 */
export function initializeMetricsOnly(config: EnvVars): MetricsOnlyProviders {
  const resource = createOtelResource(config);

  // Prometheus exporter serves metrics on /metrics endpoint
  const prometheusExporter = new PrometheusExporter({
    port: config.metricsPort,
    endpoint: "/metrics",
  });

  const meterProvider = new MeterProvider({
    resource,
    readers: [prometheusExporter as unknown as MetricReader],
  });
  metrics.setGlobalMeterProvider(meterProvider);

  // Register automatic instrumentations ONLY for metrics (no traces)
  // We only want HTTP metrics, not traces, so we disable tracing
  registerInstrumentations({
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
        // Disable tracing but keep metrics
        "@opentelemetry/instrumentation-http": {
          enabled: true,
        },
      }),
    ],
  });

  return {
    meterProvider,
    prometheusExporter,
  };
}

/**
 * Initialize OpenTelemetry providers for metrics, logs, and traces.
 * This is used when the 'otel' feature flag is enabled.
 * All telemetry is pushed to OTLP endpoint, no /metrics endpoint is served.
 */
export function initializeOtel(config: EnvVars): OtelProviders | null {
  const shouldEmit = shouldEmitTelemetry(config.otelDeploymentEnv);

  if (!shouldEmit) {
    // For local development, return null to signal fallback to Pino
    return null;
  }

  const resource = createOtelResource(config);

  // Configure tracing
  const traceExporter = new OTLPTraceExporter({
    url: `${config.otelEndpoint}/v1/traces`,
  });
  const tracerProvider = new NodeTracerProvider({ resource });
  tracerProvider.addSpanProcessor(new BatchSpanProcessor(traceExporter));
  tracerProvider.register();

  // Configure metrics with OTLP exporter only (no Prometheus endpoint)
  const metricExporter = new OTLPMetricExporter({
    url: `${config.otelEndpoint}/v1/metrics`,
  });
  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: config.otelMetricsExportIntervalMs,
  });

  const meterProvider = new MeterProvider({
    resource,
    readers: [metricReader],
  });
  metrics.setGlobalMeterProvider(meterProvider);

  // Configure logging
  const logExporter = new OTLPLogExporter({
    url: `${config.otelEndpoint}/v1/logs`,
  });
  const loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(
    new BatchLogRecordProcessor(logExporter),
  );

  // Register automatic instrumentations for HTTP, MongoDB, etc.
  registerInstrumentations({
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation to reduce noise
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
      }),
    ],
  });

  return {
    tracerProvider,
    meterProvider,
    loggerProvider,
  };
}

/**
 * Gracefully shutdown metrics-only providers.
 */
export async function shutdownMetricsOnly(
  providers: MetricsOnlyProviders,
): Promise<void> {
  await Promise.all([
    providers.meterProvider.shutdown(),
    providers.prometheusExporter.shutdown(),
  ]);
}

/**
 * Gracefully shutdown all OpenTelemetry providers.
 */
export async function shutdownOtel(providers: OtelProviders): Promise<void> {
  await Promise.all([
    providers.tracerProvider.shutdown(),
    providers.meterProvider.shutdown(),
    providers.loggerProvider.shutdown(),
  ]);
}
