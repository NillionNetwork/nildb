# An overview

nilDb is a structured data persistence service that provides a robust, distributed, and queryable data solution when multiple nodes are combined into a cluster. Users write data schemas, upload those schemas to nilDB clusters, and then perform data CRUD operations against them. Additionally, users can write aggregation pipelines to produce insights from their data. Users can apply advanced cryptography to enable secret sharing and other secure data processing use cases.

## Contents

- [Networks](#networks)
- [Network topology](#network-topology)
  - [Clusters](#clusters)
  - [Node Architecture](#node-architecture)
- [Clients](#clients)

## Networks

There are two nilDB networks:

1. _Mainnet_ refers to the group of nodes integrated with nilChain mainnet (not yet launched).
2. _Testnet_ refers to the group of nodes integrated with nilChain testnet.

## Network topology

### Clusters

A nilDB cluster is a subset of nodes within a network. Cluster membership is defined by the client, allowing multiple clusters to exist within a network.

<div style="text-align: center">
  <img src="assets/network-topology.svg" height="400" alt="node-simple">
</div>

### Node architecture

Each nilDB node consists of a RESTful API and a database:

<div style="text-align: center">
  <img src="./assets/node-simple.svg" height="400" alt="node-simple">
</div>

Deployment typically includes:

- TLS termination via cloud provider (AWS, GCP) or reverse proxy (e.g., Caddy)
- Database (local or hosted MongoDB Atlas)
- API container running in a container runtime (e.g., Docker)

### Clients

nilDB uses a decentralized authentication model based on NUC (Nillion UCAN) tokens. Clients:

1. Generate their own identities using secp256k1 private keys
2. Derive public keys and DIDs ([Decentralised Identifier](https://www.w3.org/groups/wg/did/))
3. Pay for a subscription on nilchain
4. Request NUC tokens from nilauth after payment verification
5. Use NUC tokens for API authentication

As RESTful APIs any modern HTTP client can be used to interact with nilDB. The `@nillion/nuc` library handles the complexity of payment, verification, and token management transparently.

> ![NOTE]
> Unlike traditional JWT systems, NUC tokens are based on the UCAN specification and provide capability-based security with embedded proof chains.

Example API interaction:

```shell
curl https://nildb-a50d.nillion.network/api/v1/data/create \
  --header "Bearer ${TOKEN}" \
  --header "Content-type: application/json" \
  -d @data.json
```

> ![NOTE] Data encryption is applied using [nilQL-ts](https://github.com/nillionnetwork/nilql-ts) or [nilQL-py](https://github.com/nillionnetwork/nilql-py) before transmission.
