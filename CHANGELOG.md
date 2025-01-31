# Changelog

## [1.0.0](https://github.com/NillionNetwork/nildb/compare/v0.2.0...v1.0.0) (2025-01-31)


### ⚠ BREAKING CHANGES

* run db migrations programmatically when node starts and for tests
* overhaul tests
* move from express to hono
* add layer type hint to filenames and reorg structure
* return `400/BAD_REQUEST` when body.errors is not empty
* drop root user secret key env var
* update deps; bump vitest to v3
* update to pnpm@10.0.0
* rename remove account to delete; mv param to payload body
* **admin:** rename `/create` to `/upload` to align with data routes
* **schemas:** move `add` and `delete` under `/admin`
* **query:** move `add` and `delete` under `/admin`
* improve auth check to include method so `POST /api/v1/accounts` is allowed
* allow orgs to self register; move admin functionality to own route
* add query endpoint require admin caller
* move `query.id` generation client-side
* updated delete schema to require admin caller
* move `schema.id` generation client-side
* **env:** drop `JWT_SECRET`; rename `PRIVATE_KEY` to `SECRET_KEY`
* update tests suite to work with DID-based api
* add scaffolding for mongodb database migrations with `mongo-migrate-ts`
* use secp256k1 keypairs and DIDs to faciliate decentralised authentication
* add `/data/create` for data insertion with partial success
* improve api structure and typing
* **schema:** save/retrieve as object literals
* move project hono + bun + biome + lefthook

### Features

* `deleteQ` and `deleteS` now return `UuidDto` ([35acf99](https://github.com/NillionNetwork/nildb/commit/35acf99fa3ac8850ab62e461a8f7647bf5f4550b))
* add `/data/create` for data insertion with partial success ([29f9572](https://github.com/NillionNetwork/nildb/commit/29f9572ce2445ddda39dec37c2391ab0ebb33a94))
* add `/data/delete` endpoint to remove matched records from a collection ([02c273e](https://github.com/NillionNetwork/nildb/commit/02c273ef4893e4214e9a181047124685254b1479))
* add `/data/flush` endpoint to remove all records from a collection ([0595c56](https://github.com/NillionNetwork/nildb/commit/0595c5656510f8b5308f39726aadffdbb79f027b))
* add `/data/read` endpoint ([237e0e6](https://github.com/NillionNetwork/nildb/commit/237e0e66b1584e8ab640c8dac5229738596f024d))
* add `/data/update` endpoint ([8007bfb](https://github.com/NillionNetwork/nildb/commit/8007bfb6ac9c2f14416a81a8b3191c613392a2e9))
* add `/openapi` to serve api docs ([c36b964](https://github.com/NillionNetwork/nildb/commit/c36b96477746cd19fbdaaea753c3aa98b8ae08df))
* add `bin/db-migrations.ts`; run migrations on node start ([cc3fba3](https://github.com/NillionNetwork/nildb/commit/cc3fba35a05e757c08fe9952cacc9609ed37e518))
* add `credentials` script for generating a key pairs and jwts ([55bd589](https://github.com/NillionNetwork/nildb/commit/55bd5896981d4ea2703e80c26eebb93d3a245dcc))
* add `data/tail` to retrieve sample of newest collection elements ([7662598](https://github.com/NillionNetwork/nildb/commit/766259893b7036a3e23ac07b5e56dcf680593d01))
* add `Identity` class to simplify and centralise `secp256k1` ops ([71a0e33](https://github.com/NillionNetwork/nildb/commit/71a0e3334c95d5f5c75dc851539b6e09c27be6f2))
* add `payloadValidator` middleware; simplify controller names; fix some HTTP verbs ([5fe6d86](https://github.com/NillionNetwork/nildb/commit/5fe6d8656695d01665313de879e4208cb7c49130))
* add `pnpm dev` script which uses `tsx --watch` ([7c33018](https://github.com/NillionNetwork/nildb/commit/7c330188543a203e33d579a02ca17cda34cf6289))
* add ajv-formats to support `date-time` in schema ([8ac06ac](https://github.com/NillionNetwork/nildb/commit/8ac06accb262c8a83ebe88016313513fd216e350))
* add default label `node=address` to all metrics ([8eef08c](https://github.com/NillionNetwork/nildb/commit/8eef08cc2c659f9f3b08af4657a955f6b2c0ff4f))
* add env override to loadBindings to support per-test-suite db names ([a19de19](https://github.com/NillionNetwork/nildb/commit/a19de1964cbbd8d4368906f63b6edfd8aca66a55))
* add in pino logger middleware; log after system routes ([80cfcbd](https://github.com/NillionNetwork/nildb/commit/80cfcbd523aa7dfc092d430197189db4b84eae06))
* add json primitive coercion for `date-time` and `uuid` to objects ([580bb2f](https://github.com/NillionNetwork/nildb/commit/580bb2f1b2e13ce19637ce216d419a8652f6b48a))
* add keypair generator utility ([f7deec3](https://github.com/NillionNetwork/nildb/commit/f7deec38307585f9372510f2cae994687d9ee119))
* add naive api request counter ([d0c239e](https://github.com/NillionNetwork/nildb/commit/d0c239ed16874eac8216f64f40b9558737957d80))
* add organization add query endpoint ([a842219](https://github.com/NillionNetwork/nildb/commit/a842219675875debb3aa46eb8262b0020d1556cb))
* add organization add schema endpoint ([631e736](https://github.com/NillionNetwork/nildb/commit/631e736b17f3ad57e6ff9eb5d81c4abaad686143))
* add organization delete query endpoint ([4852c33](https://github.com/NillionNetwork/nildb/commit/4852c33d6d2297fe2de840c83e06793a424c2452))
* add organization delete schema endpoint ([8b31780](https://github.com/NillionNetwork/nildb/commit/8b3178002837b95e5408be9295f4817d76f42a11))
* add prometheus `/metrics` endpoint; reduce log noise; enable http compression ([3959ab4](https://github.com/NillionNetwork/nildb/commit/3959ab4eeb3c578f60de513c3ed9d60a99b42d60))
* add query endpoint require admin caller ([4a1ea26](https://github.com/NillionNetwork/nildb/commit/4a1ea2600a6e4393576ecbb9aa8d78d65b9893a4))
* add role-based access control to jwt auth ([b14337d](https://github.com/NillionNetwork/nildb/commit/b14337dd834818c61ef546a7d92ed9524055fc2a))
* add scaffolding for mongodb database migrations with `mongo-migrate-ts` ([8ccdeae](https://github.com/NillionNetwork/nildb/commit/8ccdeaeaf5fb3df1f354a7f028f66731283b81b3))
* **admin:** add data operation endpoints ([5ed11bf](https://github.com/NillionNetwork/nildb/commit/5ed11bf99159d768c3f9f57ff223cc21b415a914))
* **admin:** expose query execute route ([981b3cb](https://github.com/NillionNetwork/nildb/commit/981b3cb4d185264ac167006fe8507e088bf64b14))
* **admin:** rename `/create` to `/upload` to align with data routes ([2dae7f8](https://github.com/NillionNetwork/nildb/commit/2dae7f81c66a113f326cc0767c67e5f172dc6824))
* allow orgs to self register; move admin functionality to own route ([e8bf38f](https://github.com/NillionNetwork/nildb/commit/e8bf38f03eacf792e89e109589471b7d69625664))
* allow read data by id and by list of ids ([bbf2e9f](https://github.com/NillionNetwork/nildb/commit/bbf2e9f01b74fade1a6626d41e094c930ae286c2))
* **api:** add fastify http server with `GET /health` route ([8278d50](https://github.com/NillionNetwork/nildb/commit/8278d507042474fc8b220c2048599521a65e5f6b))
* **auth:** permit `root` and `admin` access to `/metrics` ([92315c7](https://github.com/NillionNetwork/nildb/commit/92315c7362eec6955e12f626d5107a3ec827982f))
* basic implementation of entire schema to query flow ([c4f50ad](https://github.com/NillionNetwork/nildb/commit/c4f50add1163b0a07cd1a8122af7995138b90cc0))
* bump dependencies ([0ed968d](https://github.com/NillionNetwork/nildb/commit/0ed968d0f0260c850a857bf1520b2168a861f564))
* bump dependencies ([40e08d9](https://github.com/NillionNetwork/nildb/commit/40e08d96c7b99234515feb5532b74f73df4d89c2))
* bump json body limit to 17mb ([5d07876](https://github.com/NillionNetwork/nildb/commit/5d07876c6bc4f0c6c32d7155d531a551dcb75e8e))
* **data:** remove `owner` from upload db query ([9cb6306](https://github.com/NillionNetwork/nildb/commit/9cb6306c2d701482fe0cc5afffa1c5a59e55d45c))
* **data:** upsert on key conflicts else insert ([855cddb](https://github.com/NillionNetwork/nildb/commit/855cddb589ab010b1e0abcdf6921fc6b36a42de5))
* **db:** improve clarity on db clients ([3a7f421](https://github.com/NillionNetwork/nildb/commit/3a7f421d2af0c29fff3a3e8642ae84cfdeb14c19))
* **demo:** enable CORS if node.endpoint is `nildb-demo` ([d4172f1](https://github.com/NillionNetwork/nildb/commit/d4172f108dc088704e645399b1b294448d0818b6))
* **demo:** enable CORS support for demo domains ([ce4ecda](https://github.com/NillionNetwork/nildb/commit/ce4ecda4ef3326db087fc44b6e4eac681fa5bda7))
* derive node address from private key ([16edc38](https://github.com/NillionNetwork/nildb/commit/16edc383fb4e4ace5bc89ffda341c3f563252049))
* disable `x-powered-by` header ([b28500b](https://github.com/NillionNetwork/nildb/commit/b28500b461bb127b6965003fd4de94995859de54))
* **docs:** update openapi spec to reflect latest public api endpoints ([2850147](https://github.com/NillionNetwork/nildb/commit/28501477b943590ce160336aa2fc3c177e8475da))
* drop `PUT` as option for test client ([18deac4](https://github.com/NillionNetwork/nildb/commit/18deac4ac69745ff9e7553e2fe0435fe51220dbf))
* drop root user secret key env var ([2c8675e](https://github.com/NillionNetwork/nildb/commit/2c8675e4be09703184d05392e40a556f3d10b00a))
* enable cors to support swagger ui requests ([7a1c1f7](https://github.com/NillionNetwork/nildb/commit/7a1c1f73e5c0d4bc077586dd283e854044a46aab))
* **env:** drop `JWT_SECRET`; rename `PRIVATE_KEY` to `SECRET_KEY` ([89f80b7](https://github.com/NillionNetwork/nildb/commit/89f80b77c169e6afb5a108eb7b40d498d1520901))
* **env:** rename `nodePublicUrl` to `nodePublicEndpoint` ([d27579b](https://github.com/NillionNetwork/nildb/commit/d27579bebf05dd8d3c2496b8d669299d8bb76ebd))
* expose schema failure messages ([650ed57](https://github.com/NillionNetwork/nildb/commit/650ed57d60a2b154b7b3182c4815276609463b96))
* improve auth check to include method so `POST /api/v1/accounts` is allowed ([e117186](https://github.com/NillionNetwork/nildb/commit/e1171869ae441038a5f2cd5b64f2a399cb0c5d48))
* improve error responses; expose missing query execute variables ([e87af3f](https://github.com/NillionNetwork/nildb/commit/e87af3f422d8f50fbf1af0551a9a57690bcc8eb3))
* include .env.example and .env.test ([d77e108](https://github.com/NillionNetwork/nildb/commit/d77e108b2ce5c9f1fe345b7477d2190f92cb74ef))
* include `bin/*.ts` and `migrations/*.ts` in tsc path ([be20863](https://github.com/NillionNetwork/nildb/commit/be208636a654407dc1f05a2b6c64956f941986c3))
* **infra/demo:** allow staging domain for testing ([2a106f6](https://github.com/NillionNetwork/nildb/commit/2a106f66038286d07b28f6e4da5b4293f632bd48))
* **infra:** add nildb-demo deployment and enable CORS via LB ([829496d](https://github.com/NillionNetwork/nildb/commit/829496d1bd42f40da3b2ca8489a3347bc9169c69))
* **infra:** add nildb-demo secrets ([4d62a7c](https://github.com/NillionNetwork/nildb/commit/4d62a7cea0f4a8ae30f523c80d5d0363a011c73a))
* **infra:** add node-a50d deployment ([6017899](https://github.com/NillionNetwork/nildb/commit/6017899ea1e57df02954914da2cb2582d8c04952))
* **infra:** add node-dvml deployment ([3349673](https://github.com/NillionNetwork/nildb/commit/33496738cedbc37334d4c857f1c0a33ebdb22b61))
* **infra:** add node-guue deployment ([2d6c21d](https://github.com/NillionNetwork/nildb/commit/2d6c21db6db6174f1aef9c67425fa5a92a1e18ee))
* **infra:** drop demo CORS header insertion ([f572bc8](https://github.com/NillionNetwork/nildb/commit/f572bc8cdbaf77ea2860ff1545644742e471c098))
* **infra:** use devops frameworks to deploy sandbox ([d796069](https://github.com/NillionNetwork/nildb/commit/d796069da7db03745d192a94b0860364aa6c5308))
* lift admin/root account access check into middleware ([09e1c09](https://github.com/NillionNetwork/nildb/commit/09e1c09510c90a54011fee8a296d3956f02c30e3))
* lift org account access check into middleware ([6447db2](https://github.com/NillionNetwork/nildb/commit/6447db22f9467ad7e3ec476ecb98cd0029ad78cd))
* limit data upload to `10_000` records in one request ([f9b4148](https://github.com/NillionNetwork/nildb/commit/f9b41483c68e5611c6210d3a81519c3e938251b9))
* move `/metrics` onto private port for internal scraping ([15eff40](https://github.com/NillionNetwork/nildb/commit/15eff40453ce5d01d1134083b9784007fa4c1a9b))
* move `query.id` generation client-side ([27210ac](https://github.com/NillionNetwork/nildb/commit/27210ac97548286d3e805d1edec51c3cce6ead7d))
* move `schema.id` generation client-side ([2a8fdb6](https://github.com/NillionNetwork/nildb/commit/2a8fdb61f5be459bc08cfaa1aac0556f086c68d7))
* move from express to hono ([b11fd67](https://github.com/NillionNetwork/nildb/commit/b11fd67800b796797b1d5429ec21041ba7f39d0c))
* move project hono + bun + biome + lefthook ([bd47c8b](https://github.com/NillionNetwork/nildb/commit/bd47c8bf58b898932d7dbd085c7e699013d66716))
* only validate top structure of query ([fe847bd](https://github.com/NillionNetwork/nildb/commit/fe847bd24c81a617d7566becf2dbb046bf9446a5))
* **openapi:** remove registration endpoint ([1dc554e](https://github.com/NillionNetwork/nildb/commit/1dc554e0a7c088aa28ea85f06e681f6406e4803b))
* **openapi:** tweak language; add Query section ([ac5e0e1](https://github.com/NillionNetwork/nildb/commit/ac5e0e138f0f856df181fc92974c50d6f9a537f7))
* prevent cross organisation operations ([82948e3](https://github.com/NillionNetwork/nildb/commit/82948e3fadfabe54f1909ae5e379ef65cb129b78))
* put logger instance on context ([5b95378](https://github.com/NillionNetwork/nildb/commit/5b95378074a36b6af4d71f972186debc8352a2a5))
* **queries:** add list queries endpoint at `GET /api/v1/orgs/queries` ([57ca343](https://github.com/NillionNetwork/nildb/commit/57ca34375c8747bf155dbfd7de267b4150e5a280))
* **queries:** add support for runtime variable ([865409a](https://github.com/NillionNetwork/nildb/commit/865409ad966e37799ccfefef82d6a592056eeda6))
* **query:** move `add` and `delete` under `/admin` ([cb2fb14](https://github.com/NillionNetwork/nildb/commit/cb2fb14a00e46bda28f69ca4b7ced2bfcd802e16))
* refine `/about` to include build info ([a740340](https://github.com/NillionNetwork/nildb/commit/a74034010d4e17dcbff7a035732f18530e75db0b))
* remove dead code; updated to use missed module exports ([23a52a7](https://github.com/NillionNetwork/nildb/commit/23a52a708f64e6754c5d5002219d2398e612a8bf))
* remove IaC artefacts ([2c59e86](https://github.com/NillionNetwork/nildb/commit/2c59e8641d8fec3289bf2f2204606e92d0c80acb))
* remove mongoose ([cfe9011](https://github.com/NillionNetwork/nildb/commit/cfe9011e910a6fa2e9d188f8976cc142ca611586))
* remove mongoose timestamps and rename `createdAt` to `_created` ([08e3660](https://github.com/NillionNetwork/nildb/commit/08e36600a5480c5ac70d103f5fd7373b5b081208))
* remove redundant response error check in test setup ([e16123a](https://github.com/NillionNetwork/nildb/commit/e16123a88c61d3b457ac91c88c11ca1515ee3115))
* rename `about.endpoint` to `about.url` ([3049555](https://github.com/NillionNetwork/nildb/commit/304955549a05bae72145a7c588f29e1c56a9a4ec))
* rename remove account to delete; mv param to payload body ([3d6192e](https://github.com/NillionNetwork/nildb/commit/3d6192edd6fbb991fe7868d2892807b3ccd3dc59))
* replace `elliptic` with `@noble/curves` ([c7f4e28](https://github.com/NillionNetwork/nildb/commit/c7f4e28d480e0c286b34c998d08f19c0c627b2bb))
* require `engines.node &gt;= 23` in package.json ([97c714b](https://github.com/NillionNetwork/nildb/commit/97c714b02c648c473bba418ae00a5b02edb74e99))
* return `400/BAD_REQUEST` when body.errors is not empty ([c23f7b5](https://github.com/NillionNetwork/nildb/commit/c23f7b5ca7f9499656fb97a07906f74331a9a3f5))
* run db migrations programmatically when node starts and for tests ([67bb594](https://github.com/NillionNetwork/nildb/commit/67bb5940b8847dd9410a78d48a5cdf7127fac044))
* **schema:** save/retrieve as object literals ([cfd8121](https://github.com/NillionNetwork/nildb/commit/cfd81215d09b733369e82a11f85bec3fe47bec7b))
* **schemas:** move `add` and `delete` under `/admin` ([d936c48](https://github.com/NillionNetwork/nildb/commit/d936c48acdf3908da5f4a42e54ccf8dcd70508c9))
* separate admin create account from org register ([d1aa1a9](https://github.com/NillionNetwork/nildb/commit/d1aa1a9c5e74540b60514a9b72d9bc3dea82dc87))
* set max json body limit to 16mb ([b446653](https://github.com/NillionNetwork/nildb/commit/b446653f7eed1e5ceaca0044f33e773930e0f2ca))
* set request timeout to 2 minutes ([25d9651](https://github.com/NillionNetwork/nildb/commit/25d9651e3bf6f9e6ad48ffe872ee4e41e5cb9642))
* simple subscription support ([a3c53e1](https://github.com/NillionNetwork/nildb/commit/a3c53e11d0ac266e2e2f67337fcbecd53d36e83c))
* simply logging ([9523006](https://github.com/NillionNetwork/nildb/commit/9523006b215aee2fb15d4a6a326ac947cd878ed1))
* support `Date` query variable ([728ed24](https://github.com/NillionNetwork/nildb/commit/728ed24531554a55f13a33cd1e03ca51f257a80a))
* support array of variables in queries ([345376b](https://github.com/NillionNetwork/nildb/commit/345376bcd9218deda36ea888850b0eed0efd3c13))
* surface Ajv validation errors in api response ([fe5d090](https://github.com/NillionNetwork/nildb/commit/fe5d090a2a2cda7791f5b6975947410542715ebb))
* **test:** separate clients for `root`, `admin and `org` ([718405d](https://github.com/NillionNetwork/nildb/commit/718405d6e5ba201995019a8cb2417e3d16749a01))
* update cache to use `Temporal` ([cd4288c](https://github.com/NillionNetwork/nildb/commit/cd4288cb02c0d3d54dba6fababf77ed42f312ab9))
* update deps ([7d4a37c](https://github.com/NillionNetwork/nildb/commit/7d4a37cb386aa55abce45d9ac0cf70f8cace4453))
* update deps; bump vitest to v3 ([b93138a](https://github.com/NillionNetwork/nildb/commit/b93138abf393608128eb13ca2354050a18618eef))
* update get account to require admin or organization user ([6f94c05](https://github.com/NillionNetwork/nildb/commit/6f94c053561cc49c5840dd99f4a50160df384be3))
* update pnpm to 9.15.0 ([b049c58](https://github.com/NillionNetwork/nildb/commit/b049c5821f4c23863585a426705df2fbd0028c6a))
* update to pnpm@10.0.0 ([eef4ab4](https://github.com/NillionNetwork/nildb/commit/eef4ab4e575b2ac609f8fab6d2581e2b962d42eb))
* updated delete schema to require admin caller ([5015cfb](https://github.com/NillionNetwork/nildb/commit/5015cfb99e46c96367a54ad3d905f5d2d378856b))
* upgrade dependencies ([b222e95](https://github.com/NillionNetwork/nildb/commit/b222e952b7396b5974040db6b8ddffa2769ee1a5))
* upgrade dependencies ([938335d](https://github.com/NillionNetwork/nildb/commit/938335db7fb7d8de6574bc3b774666ace8255cbd))
* upgrade dependencies ([e44c2b4](https://github.com/NillionNetwork/nildb/commit/e44c2b452cdbefa54f2e310acfbffdf6848b0076))
* upgrade pnpm to 10.1 ([01c361a](https://github.com/NillionNetwork/nildb/commit/01c361a3b54b722fd07a0a6b661f56ed472e6076))
* use pino-pretty transport for test logging ([1a4a592](https://github.com/NillionNetwork/nildb/commit/1a4a592579063f21f26b85f61c90e0182a9238b8))
* use secp256k1 to derive node attributes and expose at `/about` ([449b858](https://github.com/NillionNetwork/nildb/commit/449b85855150a44b8e85e60fa682633b9ba3fd23))


### Bug Fixes

* **admin:** delete query permitted role should be `admin` ([53de63a](https://github.com/NillionNetwork/nildb/commit/53de63a192edde8733ddb76309ab1d006672e6c4))
* allow access to docs without subscription.ts ([2c38b94](https://github.com/NillionNetwork/nildb/commit/2c38b94e17e01937fa5af384369ce2895f0f1287))
* **auth:** correctly deal with `argon2.verify` boolean result ([eb07c87](https://github.com/NillionNetwork/nildb/commit/eb07c87908f55e215c925a0c567b31882ffd6599))
* avoid parsing the Env on every call to `loadEnv` ([98cfe99](https://github.com/NillionNetwork/nildb/commit/98cfe9910a148b501760c097ae6d3080c1b1a01a))
* **CD:** correct `dir` input syntax for ecs_service action ([38cb7bf](https://github.com/NillionNetwork/nildb/commit/38cb7bfbcb4450bff97d6775fe5cd7c83ca3037d))
* **ci:** set ECS task container name to `nil-db` ([6708e06](https://github.com/NillionNetwork/nildb/commit/6708e06438a1e9b50d3e877aef2c1db8d95f0025))
* correct vitest defineConfig import ([3296f6d](https://github.com/NillionNetwork/nildb/commit/3296f6d24af3a61cba4396b9452794f3a3f48237))
* correctly extract _id in failing delete schema test ([f5ffeb6](https://github.com/NillionNetwork/nildb/commit/f5ffeb6feebb9af71e02ed21a02775d43c838479))
* explicitly reject null date (default coerces to unix epoch) ([3695f99](https://github.com/NillionNetwork/nildb/commit/3695f99b3f5faa522556193e6ff6470bdc6fbc94))
* **infra/demo:** move `headers` under `network` ([2541d26](https://github.com/NillionNetwork/nildb/commit/2541d2652a314f21548768e456426a2ae5ea9ba8))
* **infra/demo:** remove spaces from `headers.insert` values ([277e7d8](https://github.com/NillionNetwork/nildb/commit/277e7d8963774545ec961dcb42ec50536e73f769))
* **infra:** dockerignore terragrunt/terraform cache ([33f1acf](https://github.com/NillionNetwork/nildb/commit/33f1acf34e71e5db872867e4756b5303b43915cd))
* **infra:** use 'nil-db' formatted role name ([f68c062](https://github.com/NillionNetwork/nildb/commit/f68c062f2f4e87c543970fa9923fa9499816f2d3))
* **infra:** use sandbox image for ECS deployment ([315a34f](https://github.com/NillionNetwork/nildb/commit/315a34fc443cea208b76c0cd904e9408c0b6fe76))
* raise error if data fails schema validation ([bfacbbb](https://github.com/NillionNetwork/nildb/commit/bfacbbbc8fb7eb670ad5fdcbf114890132c6d7e7))
* **schemas:** handle empty keys on schema creation ([577475f](https://github.com/NillionNetwork/nildb/commit/577475f1d5a54360a69588028b2476a8ca835e78))


### Reverts

* **cache:** allow custom Ttl on cached items ([00764b1](https://github.com/NillionNetwork/nildb/commit/00764b1cc6ba4615d2670cba6c6e7f75d870a82f))


### Code Refactoring

* add layer type hint to filenames and reorg structure ([821d2c7](https://github.com/NillionNetwork/nildb/commit/821d2c79b09089f63d5198f35efcbeb1ca2e888c))
* improve api structure and typing ([e54eb4e](https://github.com/NillionNetwork/nildb/commit/e54eb4e516e3c704dbc6c959eb5862078744c889))
* overhaul tests ([995af1a](https://github.com/NillionNetwork/nildb/commit/995af1a5c19c56820434110a31b45eb7477eaf4e))
* use secp256k1 keypairs and DIDs to faciliate decentralised authentication ([d255f2c](https://github.com/NillionNetwork/nildb/commit/d255f2cb8ed5575d6aa68d009db610689244a6df))


### Tests

* update tests suite to work with DID-based api ([1b1058d](https://github.com/NillionNetwork/nildb/commit/1b1058de652248a6901d089c159e399a4309cc15))
