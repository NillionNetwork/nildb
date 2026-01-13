import type { EnvVars } from "@nildb/env";
import { metrics } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HostMetrics } from "@opentelemetry/host-metrics";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { envDetector, processDetector, Resource } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { MeterProvider, type MetricReader, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  ATTR_CLOUD_PLATFORM,
  ATTR_CLOUD_PROVIDER,
  ATTR_CLOUD_REGION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_INSTANCE_ID,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions/incubating";

import { BUILD_COMMIT } from "./buildinfo.js";

export type MetricsOnlyProviders = {
  meterProvider: MeterProvider;
  prometheusExporter: PrometheusExporter;
  hostMetrics: HostMetrics;
};

export type OtelProviders = {
  tracerProvider: NodeTracerProvider;
  meterProvider: MeterProvider;
  loggerProvider: LoggerProvider;
  hostMetrics: HostMetrics;
};

/**
 * Create OpenTelemetry resource.
 *
 * This creates a base resource with application-specific attributes and merges
 * it with environment-detected attributes (from OTEL_RESOURCE_ATTRIBUTES).
 *
 * You can set or override any resource attributes via OTEL_RESOURCE_ATTRIBUTES:
 *   OTEL_RESOURCE_ATTRIBUTES=key1=value1,key2=value2
 *
 * Example:
 *   OTEL_RESOURCE_ATTRIBUTES=service.instance.id=nildb-r5nw
 *
 * Environment variables take precedence over programmatically set values.
 */
export async function createOtelResource(config: EnvVars): Promise<Resource> {
  const attributes: Record<string, string> = {
    [ATTR_SERVICE_NAME]: config.otelServiceName,
    [ATTR_SERVICE_VERSION]: BUILD_COMMIT,
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

  const baseResource = new Resource(attributes);

  // Detect resource attributes from environment (OTEL_RESOURCE_ATTRIBUTES)
  // Environment variables take precedence over programmatic values
  const envResource = await envDetector.detect();
  const processResource = await processDetector.detect();

  return baseResource.merge(envResource).merge(processResource);
}

/**
 * Initialize metrics-only mode with Prometheus exporter.
 * This is used when only the 'metrics' feature flag is enabled (not 'otel').
 * Metrics are served on /metrics endpoint for scraping, not pushed to OTLP.
 */
export async function initializeMetricsOnly(config: EnvVars): Promise<MetricsOnlyProviders> {
  const resource = await createOtelResource(config);

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
        // Disable HTTP instrumentation - we use custom middleware for route-aware metrics
        "@opentelemetry/instrumentation-http": {
          enabled: false,
        },
      }),
      // Add Node.js runtime metrics (heap, GC, event loop lag, etc.)
      new RuntimeNodeInstrumentation(),
    ],
  });

  // Start host metrics collection (CPU, memory, network)
  const hostMetrics = new HostMetrics({ meterProvider });
  hostMetrics.start();

  return {
    meterProvider,
    prometheusExporter,
    hostMetrics,
  };
}

/**
 * Initialize OpenTelemetry providers for metrics, logs, and traces.
 * This is used when the 'otel' feature flag is enabled.
 * All telemetry is pushed to OTLP endpoint, no /metrics endpoint is served.
 *
 * To disable OpenTelemetry SDK without removing the 'otel' feature flag,
 * set the standard OTEL_SDK_DISABLED=true environment variable.
 */
export async function initializeOtel(config: EnvVars): Promise<OtelProviders | null> {
  // Check standard OpenTelemetry environment variable to disable the SDK
  if (process.env.OTEL_SDK_DISABLED === "true") {
    return null;
  }

  const resource = await createOtelResource(config);

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
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));

  // Register automatic instrumentations for MongoDB, etc.
  registerInstrumentations({
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation to reduce noise
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
        // Disable HTTP instrumentation - we use custom middleware for route-aware metrics
        "@opentelemetry/instrumentation-http": {
          enabled: false,
        },
      }),
      // Add Node.js runtime metrics (heap, GC, event loop lag, etc.)
      new RuntimeNodeInstrumentation(),
    ],
  });

  // Start host metrics collection (CPU, memory, network)
  const hostMetrics = new HostMetrics({ meterProvider });
  hostMetrics.start();

  return {
    tracerProvider,
    meterProvider,
    loggerProvider,
    hostMetrics,
  };
}

/**
 * Gracefully shutdown metrics-only providers.
 * Note: HostMetrics cleanup is handled automatically by MeterProvider shutdown.
 */
export async function shutdownMetricsOnly(providers: MetricsOnlyProviders): Promise<void> {
  await Promise.all([providers.meterProvider.shutdown(), providers.prometheusExporter.shutdown()]);
}

/**
 * Gracefully shutdown all OpenTelemetry providers.
 * Note: HostMetrics cleanup is handled automatically by MeterProvider shutdown.
 */
export async function shutdownOtel(providers: OtelProviders): Promise<void> {
  await Promise.all([
    providers.tracerProvider.shutdown(),
    providers.meterProvider.shutdown(),
    providers.loggerProvider.shutdown(),
  ]);
}
