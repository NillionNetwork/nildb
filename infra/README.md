# Deploy nildb

## AWS Lambda

### pre-requisites
* you must have a domain registered
* your domain must be configured/accessible in route53 for your aws user/role

Execute these commands in the root of this repo

> copy sam config and fill in your values
```shell
cp samconfig.example.yaml samconfig.yaml
nvim samconfig.yaml
```

> deploy function
```shell
sam build --template-file infra/sam-template.yaml
sam deploy --resolve-image-repos
```
