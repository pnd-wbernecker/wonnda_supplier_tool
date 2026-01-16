# Wonnda
Supplier scraping BigQuery pipeline.

## Build and Deploy
```BASH
export GCLOUD_PROJECT="supplier-scraping"
export REPO="wonnda-bigquery"
export REGION="europe-west3"
export IMAGE="bigquery-pipeline"
export IMAGE_TAG=${REGION}-docker.pkg.dev/$GCLOUD_PROJECT/$REPO/$IMAGE

# next line only needed once
gcloud auth configure-docker ${REGION}-docker.pkg.dev

docker build --platform linux/amd64 -t $IMAGE_TAG -f pipeline.dockerfile --no-cache \
--build-arg ssh_prv_key_pnd_cb_database_connector="$(cat ~/.ssh/pnd_database_connector)" \
--build-arg ssh_prv_key_pnd_cb_gcs="$(cat ~/.ssh/pnd_gcs)" \
--build-arg ssh_prv_key_pnd_cb_gsheets_connector="$(cat ~/.ssh/pnd_gsheets_connector)" \
--build-arg ssh_prv_key_pnd_cb_utils="$(cat ~/.ssh/pnd_utils)" .

docker push $IMAGE_TAG
```

Then create a new version with the new image in cloud run.

Cloud scheduler is used to run it periodically.
