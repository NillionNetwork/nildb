import type { BuilderStatus } from "@nildb/builders/builders.types";

import type {
  BuilderStatusDto,
  ReadCreditsResponse,
  ReadPricingResponse,
  ReadPaymentsResponse,
  RegisterCreditsRequest,
  RegisterCreditsResponse,
} from "@nillion/nildb-types";

import type { PaymentDocument, RegisterCreditsCommand } from "./credits.types";

export const CreditsDataMapper = {
  toRegisterCreditsCommand(dto: RegisterCreditsRequest): RegisterCreditsCommand {
    return {
      txHash: dto.txHash,
      chainId: dto.chainId,
      nodePublicKey: dto.payload.nodePublicKey,
      payerDid: dto.payload.payerDid,
      amountUnils: BigInt(dto.payload.amountUnils),
      nonce: dto.payload.nonce,
      timestamp: dto.payload.timestamp,
    };
  },

  toRegisterCreditsResponse(data: { creditsUsd: number; status: BuilderStatus }): RegisterCreditsResponse {
    return {
      data: {
        creditsUsd: data.creditsUsd,
        status: data.status as BuilderStatusDto,
      },
    };
  },

  toReadCreditsResponse(data: {
    creditsUsd: number;
    status: BuilderStatus;
    storageBytes: number;
    estimatedHoursRemaining: number | null;
  }): ReadCreditsResponse {
    return {
      data: {
        creditsUsd: data.creditsUsd,
        status: data.status as BuilderStatusDto,
        storageBytes: data.storageBytes,
        estimatedHoursRemaining: data.estimatedHoursRemaining,
      },
    };
  },

  toReadPricingResponse(data: {
    storageCostPerGbHour: number;
    freeTierBytes: number;
    supportedChainIds: number[];
    nilUsdPrice: number | null;
    chains: { chainId: number; nilTokenAddress: string; burnContractAddress: string }[];
  }): ReadPricingResponse {
    return {
      data: {
        storageCostPerGbHour: data.storageCostPerGbHour,
        freeTierBytes: data.freeTierBytes,
        supportedChainIds: data.supportedChainIds,
        nilUsdPrice: data.nilUsdPrice,
        chains: data.chains,
      },
    };
  },

  toReadPaymentsResponse(data: {
    data: PaymentDocument[];
    total: number;
    limit: number;
    offset: number;
  }): ReadPaymentsResponse {
    return {
      data: data.data.map((p) => ({
        txHash: p.txHash,
        chainId: p.chainId,
        amountUnils: p.amountUnils,
        amountUsd: p.amountUsd,
        processedAt: p.processedAt.toISOString(),
      })),
      pagination: {
        total: data.total,
        limit: data.limit,
        offset: data.offset,
      },
    };
  },
};
