const core = require('@actions/core');
const { S3Client } = require('@aws-sdk/client-s3');
const { sync } = require('./sync');

async function run() {
  const bucket = core.getInput('bucket', { required: true });
  const accountId = core.getInput('account-id', { required: true });
  const accessKeyId = core.getInput('access-key-id', { required: true });
  const secretAccessKey = core.getInput('secret-access-key', { required: true });

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const publishDir = 'publish';

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  core.info(`Deploying "${publishDir}" to bucket "${bucket}" via ${endpoint}`);

  const result = await sync({ client, bucket, publishDir });

  core.info(`Done — uploaded: ${result.uploaded}, deleted: ${result.deleted}, unchanged: ${result.unchanged}`);
}

run().catch((err) => {
  core.setFailed(err.message);
});
