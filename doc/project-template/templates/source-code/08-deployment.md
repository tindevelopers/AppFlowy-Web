<!-- BEGIN GENERATED:main -->
# Deployment — {{PROJECT_NAME}}

## Environments

| Environment | URL | Method |
|-------------|-----|--------|
| Production | {{PROD_URL}} | {{PROD_METHOD}} |
| Staging | {{STAGING_URL}} | {{STAGING_METHOD}} |
| Development | {{DEV_URL}} | {{DEV_METHOD}} |

## Pipeline

1. Push to `{{TRUNK_BRANCH}}`.
2. {{CI_STEP_1}} (e.g. build, test).
3. {{CI_STEP_2}} (e.g. image build / deploy trigger).

## Deploy steps

```bash
{{DEPLOY_COMMANDS}}
```

## Rollback

- {{ROLLBACK_PROCEDURE}}

## Monitoring & alerting

- {{MONITORING_URL}}
- {{ALERTS}}
<!-- END GENERATED:main -->
